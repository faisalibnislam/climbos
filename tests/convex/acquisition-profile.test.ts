import { describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";

describe("owner-confirmed acquisition types", () => {
  it("separates inferred business labels from owner-confirmed eligibility inputs", async () => {
    const t = setup();
    const owner = await asNewUser(t, "acquisition-types@example.com");
    const { slug } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Type Check Co" });
    await owner.client.mutation(api.orgs.setGoal, { slug, kind: "more_customers", statement: "More customers", horizonDays: 90, monthlyAdBudget: 600 });

    await expect(owner.client.mutation(api.acquisition.setTypes, { slug, types: ["not_a_type"] })).rejects.toThrow(/Choose 1–3 distinct business types/);
    const inferred = await owner.client.query(api.acquisition.view, { slug });
    expect(inferred?.typesSource).toBe("inferred");
    expect(inferred?.channels.find((channel) => channel.id === "S18")?.status).toBe("ineligible");

    await owner.client.mutation(api.acquisition.setTypes, { slug, types: ["mobile_app"] });
    const confirmed = await owner.client.query(api.acquisition.view, { slug });
    expect(confirmed?.typesSource).toBe("owner");
    expect(confirmed?.channels.find((channel) => channel.id === "S18")?.status).not.toBe("ineligible");
  });
});
