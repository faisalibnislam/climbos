import { describe, expect, it } from "vitest";
import {
  cheapestPolarPlan,
  cloneAssumptions,
  computeAllProfiles,
  computePlanCaps,
  computeProfile,
  COST_LINE_KEYS,
  CURRENT_ENTITLEMENTS,
  DEFAULT_ASSUMPTIONS,
  economicsCsv,
  EconomicsInputError,
  effectivePaymentRate,
  GEMINI_FLASH_REPRICE_2027_01_01,
  marginGuard,
  maxTopupDeliveryCostUsd,
  microsToUsd,
  minimumPrice,
  PLAN_KEYS,
  rateVersionForDate,
  RESEARCH_2026_10_17,
  roleTextCosts,
  ROUTING_CLIMBOS_2026_10_17,
  topupEconomics,
  USAGE_PROFILES,
  usdToMicros,
  VERIFIED_2026_10_17,
} from "../../shared/economics";
import { ROLE_BUDGETS } from "../../shared/economics/roles";
import { WORKBOOK } from "../fixtures/workbook-2026-10-17";

const CENT_TOLERANCE = 0.00002; // µUSD line rounding across ≤ 12 lines

describe("rate registry", () => {
  it("keeps the research snapshot immutable", () => {
    expect(Object.isFrozen(RESEARCH_2026_10_17)).toBe(true);
    expect(RESEARCH_2026_10_17.services.imageAttempt).toBe(0.045);
    expect(RESEARCH_2026_10_17.models["claude-sonnet-5.5"].outputPerM).toBe(10);
  });

  it("selects the effective version by date", () => {
    expect(rateVersionForDate("2026-10-17").id).toBe(VERIFIED_2026_10_17.id);
    expect(rateVersionForDate("2026-12-31").id).toBe(VERIFIED_2026_10_17.id);
    expect(rateVersionForDate("2027-01-01").id).toBe(GEMINI_FLASH_REPRICE_2027_01_01.id);
    expect(() => rateVersionForDate("2025-01-01")).toThrow();
    expect(() => rateVersionForDate("17/10/2026")).toThrow(RangeError);
  });
});

describe("agents sheet", () => {
  it("reproduces the $5.844 base text cost and 6.028M input units", () => {
    expect(roleTextCosts().totalUsd).toBeCloseTo(WORKBOOK.baseTextCostUsd, 9);
    const units = ROLE_BUDGETS.reduce((s, r) => s + r.baseRunsPerMonth * r.inputTokensPerRun, 0);
    expect(units).toBe(WORKBOOK.agentInputUnits);
    expect(ROLE_BUDGETS.reduce((s, r) => s + r.baseRunsPerMonth, 0)).toBe(1308);
  });

  it("production routing (no OpenAI) costs the same as the blueprint routing", () => {
    expect(roleTextCosts({ routing: ROUTING_CLIMBOS_2026_10_17 }).totalUsd).toBeCloseTo(5.844, 9);
    for (const route of Object.values(ROUTING_CLIMBOS_2026_10_17.routes)) {
      expect(route.primary.startsWith("gpt")).toBe(false);
      expect(route.fallback.startsWith("gpt")).toBe(false);
    }
  });
});

describe("twelve plan/profile rows reproduce the workbook", () => {
  for (const plan of PLAN_KEYS) {
    USAGE_PROFILES.forEach((profile, i) => {
      it(`${plan} / ${profile}`, () => {
        const r = computeProfile(plan, profile);
        const w = WORKBOOK.plans[plan];
        expect(microsToUsd(r.revenueMicros)).toBeCloseTo(w.revenue, 6);
        for (const key of COST_LINE_KEYS) {
          expect(microsToUsd(r.lines[key])).toBeCloseTo(w.lines[key][i], 5);
        }
        expect(Math.abs(microsToUsd(r.directCogsMicros) - w.direct[i])).toBeLessThan(CENT_TOLERANCE);
        expect(microsToUsd(r.paymentFeesMicros)).toBeCloseTo(w.fees[i], 5);
        expect(Math.abs(microsToUsd(r.totalCogsMicros) - w.total[i])).toBeLessThan(CENT_TOLERANCE);
        expect(r.grossMargin).toBeCloseTo(w.margin[i], 6);
        expect(r.minimumListPriceUsd).toBeCloseTo(w.minPrice[i], 4);
        expect(microsToUsd(r.stress.revenueMicros)).toBeCloseTo(w.stressRevenue, 6);
        expect(Math.abs(microsToUsd(r.stress.directCogsMicros) - w.stressDirect[i])).toBeLessThan(CENT_TOLERANCE);
        expect(microsToUsd(r.stress.paymentFeesMicros)).toBeCloseTo(w.stressFees, 5);
        expect(Math.abs(microsToUsd(r.stress.totalCogsMicros) - w.stressTotal[i])).toBeLessThan(CENT_TOLERANCE);
        expect(r.stress.grossMargin).toBeCloseTo(w.stressMargin[i], 6);
        expect(r.stress.minimumListPriceUsd).toBeCloseTo(w.stressMinPrice[i], 4);
        expect(r.caps.deliveredImages).toBe(w.caps.images[i]);
        expect(r.caps.imageAttempts).toBe(w.caps.attempts[i]);
        expect(r.caps.socialPosts).toBe(w.caps.posts[i]);
        expect(r.caps.scrapeCredits).toBe(w.caps.scrape[i]);
        expect(r.caps.searchCalls).toBe(w.caps.search[i]);
        expect(r.caps.transactionalEmails).toBe(w.caps.emails[i]);
        expect(r.caps.byoMarketingSends).toBe(w.caps.byo[i]);
        expect(r.caps.aiWalletUsdUnrounded).toBeCloseTo(w.wallet[i], 5);
        expect(r.meetsTarget).toBe(true);
      });
    });
  }

  it("heavy stress margins are 36.6%–40.2% and all ≥ 30%", () => {
    const heavy = computeAllProfiles().filter((r) => r.profile === "heavy");
    const margins = heavy.map((r) => Number((r.stress.grossMargin * 100).toFixed(1)));
    expect(margins).toEqual([36.6, 40.2, 36.6, 37.2]);
    expect(marginGuard().ok).toBe(true);
  });

  it("recommended prices exceed the stress price floors", () => {
    for (const plan of PLAN_KEYS) {
      const r = computeProfile(plan, "heavy");
      expect(microsToUsd(r.listPriceMicros)).toBeGreaterThan(r.stress.minimumListPriceUsd);
    }
  });
});

describe("drivers propagate", () => {
  it("raising the price raises margin", () => {
    const a = cloneAssumptions();
    a.plans.growth.listPriceUsd = 499;
    expect(computeProfile("growth", "heavy", { assumptions: a }).grossMargin).toBeGreaterThan(
      computeProfile("growth", "heavy").grossMargin,
    );
  });

  it("more support time increases cost by exactly minutes × $0.50", () => {
    const a = cloneAssumptions();
    a.plans.growth.baseSupportMinutes = 35; // +10 base → +20 heavy minutes
    const delta =
      computeProfile("growth", "heavy", { assumptions: a }).directCogsMicros -
      computeProfile("growth", "heavy").directCogsMicros;
    expect(delta).toBe(usdToMicros(10));
  });

  it("more image attempts increase image cost and the wallet", () => {
    const a = cloneAssumptions();
    a.growthBase.attemptsPerDeliveredImage = 3;
    const r = computeProfile("growth", "base", { assumptions: a });
    expect(microsToUsd(r.lines.images)).toBeCloseTo(30 * 3 * 0.045, 6);
    expect(r.caps.imageAttempts).toBe(90);
  });

  it("fewer customers raise the allocated fixed cost", () => {
    const a = cloneAssumptions();
    a.payingCustomers = 25;
    expect(microsToUsd(computeProfile("starter", "base", { assumptions: a }).lines.fixedAllocated)).toBeCloseTo(
      111.25 / 25,
      6,
    );
  });

  it("a vendor rate increase propagates", () => {
    const pricier = {
      ...RESEARCH_2026_10_17,
      services: { ...RESEARCH_2026_10_17.services, imageAttempt: 0.09 },
    };
    expect(computeProfile("pro", "heavy", { rates: pricier }).lines.images).toBe(
      2 * computeProfile("pro", "heavy").lines.images,
    );
  });

  it("the Gemini Flash reprice still passes the stress gate", () => {
    const guard = marginGuard({ rates: GEMINI_FLASH_REPRICE_2027_01_01 });
    expect(guard.ok).toBe(true);
  });

  it("a configuration that breaches the gate is rejected", () => {
    const a = cloneAssumptions();
    a.plans.starter.listPriceUsd = 99;
    const guard = marginGuard({ assumptions: a });
    expect(guard.ok).toBe(false);
    expect(guard.failures.some((f) => f.plan === "starter" && f.profile === "heavy")).toBe(true);
  });
});

describe("fees and formulas", () => {
  it("payment fees apply to the taxed checkout total", () => {
    const rate = effectivePaymentRate({
      percent: 0.05,
      internationalSurcharge: 0.015,
      internationalMix: 0.5,
      checkoutTax: 0.1,
      payoutVariableReserve: 0.0125,
    });
    expect(rate).toBeCloseTo((0.05 + 0.0075) * 1.1 + 0.0125, 12);
    // Growth: 449 × rate + $0.50
    expect(449 * rate + 0.5).toBeCloseTo(34.51175, 6);
  });

  it("refunds reduce recognized revenue while fees are kept", () => {
    const a = cloneAssumptions();
    a.refundReserve = 0.05;
    const r = computeProfile("growth", "base", { assumptions: a });
    expect(microsToUsd(r.revenueMicros)).toBeCloseTo(449 * 0.95, 6);
    expect(microsToUsd(r.paymentFeesMicros)).toBeCloseTo(34.51175, 5);
  });

  it("a 30% markup is not a 30% margin", () => {
    const cost = 100;
    const price = cost * 1.3;
    expect((price - cost) / price).toBeCloseTo(0.2308, 4);
    expect(minimumPrice({ directCostUsd: cost, fixedPerTransactionUsd: 0, refundReserve: 0, targetMargin: 0.3, paymentRate: 0 })).toBeCloseTo(
      cost / 0.7,
      9,
    );
  });

  it("invalid denominators and inputs fail clearly", () => {
    expect(() =>
      minimumPrice({ directCostUsd: 10, fixedPerTransactionUsd: 0.5, refundReserve: 0.01, targetMargin: 0.3, paymentRate: 0.8 }),
    ).toThrow(EconomicsInputError);
    const a = cloneAssumptions();
    a.payingCustomers = 0;
    expect(() => computeProfile("growth", "base", { assumptions: a })).toThrow(/Paying customers/);
    const b = cloneAssumptions();
    b.cacheReadFraction = 0.7;
    b.cacheWriteFraction = 0.5;
    expect(() => computeProfile("growth", "base", { assumptions: b })).toThrow(/Cache/);
    const c = cloneAssumptions();
    c.plans.pro.listPriceUsd = Number.NaN;
    expect(() => computeProfile("pro", "base", { assumptions: c })).toThrow(EconomicsInputError);
  });
});

describe("entitlements", () => {
  it("published caps equal the calculator heavy profile", () => {
    for (const plan of PLAN_KEYS) {
      const caps = computePlanCaps(plan);
      const ent = CURRENT_ENTITLEMENTS.plans[plan];
      expect(ent.deliveredImages).toBe(caps.deliveredImages);
      expect(ent.imageAttempts).toBe(caps.imageAttempts);
      expect(ent.socialPosts).toBe(caps.socialPosts);
      expect(ent.scrapeCredits).toBe(caps.scrapeCredits);
      expect(ent.searchCalls).toBe(caps.searchCalls);
      expect(ent.transactionalEmails).toBe(caps.transactionalEmails);
      expect(ent.byoMarketingSends).toBe(caps.byoMarketingSends);
      expect(ent.storageGb).toBeCloseTo(caps.storageGb, 9);
      expect(ent.supportMinutes).toBe(caps.supportMinutes);
      expect(ent.aiWalletMicros).toBe(caps.aiWalletMicros);
      expect(ent.roleRuns).toEqual(caps.roleRuns);
      expect(ent.priceUsd).toBe(DEFAULT_ASSUMPTIONS.plans[plan].listPriceUsd);
    }
  });

  it("AI wallets round down to $20 / $58 / $145 / $349", () => {
    expect(PLAN_KEYS.map((p) => CURRENT_ENTITLEMENTS.plans[p].aiWalletMicros / 1_000_000)).toEqual([20, 58, 145, 349]);
  });
});

describe("top-ups", () => {
  it("$29 pack authorizes at most $10 and keeps ~54% stressed margin", () => {
    const pack = CURRENT_ENTITLEMENTS.topups[0];
    expect(pack.priceUsd).toBe(29);
    expect(pack.deliveryCostMicros).toBe(10_000_000);
    const e = topupEconomics(29, 10);
    expect(e.grossMargin).toBeCloseTo(0.5396, 3);
    expect(maxTopupDeliveryCostUsd(29, 0.3)).toBeGreaterThan(10);
  });
});

describe("Polar plan comparison", () => {
  it("Pro saves 1.2% of volume + $0.10/txn minus $20 vs Starter", () => {
    const params = { taxedCheckoutVolumeUsd: 10_000, transactions: 40, internationalMix: 0.5 };
    const res = cheapestPolarPlan(params);
    expect(res.all.starter - res.all.pro).toBeCloseTo(10_000 * 0.012 + 40 * 0.1 - 20, 9);
  });
});

describe("CSV export", () => {
  it("exports twelve rows plus a header", () => {
    const csv = economicsCsv();
    const lines = csv.trim().split("\n");
    expect(lines).toHaveLength(13);
    expect(lines[0]).toContain("gross_margin");
    expect(lines[1].startsWith("starter,low,169,")).toBe(true);
  });
});
