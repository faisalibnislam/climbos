import { z } from "zod";
import type { LintIssue } from "./types";

/** Review annotations, not observed events or independent semantic verification. */
export const FocusedMeasurementCheckSchema = z.object({
  claimPath: z.string().trim().min(1).max(300),
  claimQuote: z.string().trim().min(1).max(700),
  observationPath: z.string().trim().min(1).max(300),
  observationQuote: z.string().trim().min(1).max(700),
  activity: z.enum(["simulation_or_walkthrough", "stated_preference", "checkout_started", "customer_job_completed", "confirmed_payment", "repeated_customer_job", "unknown"]),
  claimedOutcome: z.enum(["comprehension_or_job_fit", "stated_intent", "product_use", "payment", "repeat_use", "unknown"]),
  paymentScope: z.enum(["matches_claim", "different_transaction", "unverified"]).optional().describe("For a payment outcome only: do payer, recipient and purchased offer support the specific payment claimed?"),
  actorMatchesTarget: z.boolean().nullable().describe("Does the person expressing interest or doing the job match the role whose intent or use is claimed? Null means not established."),
  basis: z.string().trim().min(1).max(500),
});
export type FocusedMeasurementCheck = z.infer<typeof FocusedMeasurementCheckSchema>;

const permitted: Record<FocusedMeasurementCheck["claimedOutcome"], readonly FocusedMeasurementCheck["activity"][]> = {
  comprehension_or_job_fit: ["simulation_or_walkthrough", "stated_preference", "customer_job_completed", "repeated_customer_job"],
  stated_intent: ["stated_preference", "checkout_started"],
  product_use: ["customer_job_completed", "repeated_customer_job"],
  payment: ["confirmed_payment"],
  repeat_use: ["repeated_customer_job"],
  unknown: ["simulation_or_walkthrough", "stated_preference", "checkout_started", "customer_job_completed", "confirmed_payment", "repeated_customer_job", "unknown"],
};
const activityLabels: Record<FocusedMeasurementCheck["activity"], string> = {
  simulation_or_walkthrough: "a demonstration or simulated task", stated_preference: "a stated preference",
  checkout_started: "a started checkout", customer_job_completed: "a completed customer job",
  confirmed_payment: "a confirmed payment", repeated_customer_job: "a repeated customer job", unknown: "an unknown activity",
};
const outcomeLabels: Record<FocusedMeasurementCheck["claimedOutcome"], string> = {
  comprehension_or_job_fit: "understanding or perceived job fit", stated_intent: "stated intent",
  product_use: "successful product use", payment: "successful payment", repeat_use: "repeat use", unknown: "an unknown outcome",
};

/** Prevent a review from approving a stronger outcome than its own activity classification. */
export function lintFocusedMeasurementCheck(check: FocusedMeasurementCheck, fields: Map<string, string> | null): LintIssue[] {
  if (!fields?.get(check.claimPath)?.includes(check.claimQuote) || !fields.get(check.observationPath)?.includes(check.observationQuote)) return [{
    rule: "review_scores", severity: "error", path: "review.evidenceAudit",
    message: "Bind the measurement check to this draft's exact outcome claim and proposed observation. Do not quote a different version or a corrected experiment that is not in the draft.",
  }];
  if (check.claimedOutcome === "payment" && check.activity === "confirmed_payment" && check.paymentScope !== "matches_claim") {
    return [{ rule: "focused_learning", severity: "error", path: check.claimPath,
      message: `A confirmed charge supports this payment claim only when its payer, recipient and purchased offer match the claim. The review classified that match as ${check.paymentScope ?? "unverified"}. ${check.basis} Record the underlying transaction separately and leave the claimed payment unknown.` }];
  }
  const wrongActor = ["stated_intent", "product_use", "repeat_use"].includes(check.claimedOutcome) && check.actorMatchesTarget !== true;
  if (permitted[check.claimedOutcome].includes(check.activity) && !wrongActor) return [];
  return [{ rule: "focused_learning", severity: "error", path: check.claimPath,
    message: `The review classifies the proposed observation as ${activityLabels[check.activity]}, which does not establish ${outcomeLabels[check.claimedOutcome]}${wrongActor ? " for the claimed customer role" : ""}. ${check.basis} Keep the useful weaker test under its actual learning label, or specify a separate conditional observation of the customer completing their own job. A demonstration, checkout start, stated reuse or test-mode payment cannot substitute for product activation, successful payment or repeat use. Unknown access leaves the dependent outcome untested; do not invent free access or authorize a purchase.` }];
}

export const FOCUSED_MEASUREMENT_GUIDANCE = `Define a learning event by who acts, in which role, what they actually do, and what that observation can establish. An agency’s willingness to offer terms does not establish a client’s willingness to accept them. Count each role’s intent separately. Money paid by an end customer to a merchant is a different transaction from a merchant paying for a software subscription. A buyer filling the owner's fictional form as a respondent can reveal comprehension or job fit; it does not show that the buyer can create and use their own workflow. For a product whose intended customer job really is responding, assess that actual job instead of assuming the form-owner role. Payment may precede or follow successful use; neither proves the other. Test-mode transactions are simulations, checkout starts are intent, promises to return are stated preferences, and repeat use needs another actual customer job. Keep a legitimate weaker experiment rather than forcing every test to measure activation or payment. With access unknown, prepare separate conditional observation branches and leave unavailable outcomes untested. Choose observation definitions and decision rules before exposure; missing economic thresholds stay unknown rather than being chosen to fit later results. Change a metric after learning only as a new test, preserving the original result.`;

export const FOCUSED_MEASUREMENT_REVIEW = `${FOCUSED_MEASUREMENT_GUIDANCE}
In capabilities_and_results.measurementChecks, check up to four material outcome definitions, including the primary metric and any conflicting definition in a private test brief. Bind claimPath/claimQuote to the actual outcome label and observationPath/observationQuote to its concrete proposed activity, verbatim from this draft. For a payment claim classify paymentScope against the exact payer, recipient and offer. A separate transaction, even for the same amount, cannot establish a subscription purchase. Unknown parties or offer leave that match unverified. Classify that activity, the claimedOutcome and whether its actor matches the target customer role; explain the interpretation in basis. These are definitions of proposed observations, never claims the test ran. Use unknown for an explicitly unresolved outcome, not to excuse a stronger claim. Split multiple outcome claims into separate checks. Keep the array empty in other categories, and when no outcome definition exists explain that in the category basis. Code checks binding and consistency, not your semantic interpretation; assess the real actor, account, job and payment recipient. Supported or conditional current product use still requires the right event. An independent fresh review must not endorse the previous review's mistaken label.`;
