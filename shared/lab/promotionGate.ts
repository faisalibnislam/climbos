/** Conservative promotion policy for human-reviewed, multi-business rule evaluations. */
export interface PromotionReview {
  reviewerId: string;
  packetId: string;
  fullSetSha256: string;
  holdoutSetSha256: string;
  reviewedCases: number;
  incompleteCases: number;
  heldoutReviewedCases: number;
  baselinePreferred: number;
  candidatePreferred: number;
  ties: number;
  baselineHardFailures: number;
  candidateHardFailures: number;
  heldoutCandidateHardFailures: number;
  baselineMeanScore: number;
  candidateMeanScore: number;
  coverage: { businessType: string; reviewedCases: number }[];
}

const isCount = (n: number) => Number.isSafeInteger(n) && n >= 0;
const isSha256 = (s: string) => /^[a-f\d]{64}$/i.test(s);
const BUSINESS_TYPES = new Set(["saas", "mac_app", "agency", "ecommerce", "local_service", "marketplace", "cross_business"]);

/** Return every reason this human review is insufficient for promotion. */
export function promotionReviewIssues(review: PromotionReview | undefined): string[] {
  if (!review) return ["A human-reviewed evaluation is required."];
  const issues: string[] = [];
  if (!review.reviewerId.trim() || review.reviewerId.length > 120 || !review.packetId.trim() || review.packetId.length > 120) issues.push("Valid reviewer and blind-review packet identifiers are required.");
  if (!isSha256(review.fullSetSha256) || !isSha256(review.holdoutSetSha256) || review.fullSetSha256 === review.holdoutSetSha256) {
    issues.push("Distinct SHA-256 identities for the evaluation and held-out sets are required.");
  }
  for (const [name, value] of Object.entries({
    reviewedCases: review.reviewedCases,
    incompleteCases: review.incompleteCases,
    heldoutReviewedCases: review.heldoutReviewedCases,
    baselinePreferred: review.baselinePreferred,
    candidatePreferred: review.candidatePreferred,
    ties: review.ties,
    baselineHardFailures: review.baselineHardFailures,
    candidateHardFailures: review.candidateHardFailures,
    heldoutCandidateHardFailures: review.heldoutCandidateHardFailures,
  })) if (!isCount(value)) issues.push(`${name} must be a non-negative whole number.`);
  const businessTypes = new Set(review.coverage.map((x) => x.businessType));
  if (businessTypes.size !== review.coverage.length || review.coverage.some((x) => !BUSINESS_TYPES.has(x.businessType) || !isCount(x.reviewedCases))) {
    issues.push("Business-type coverage must contain unique recognized business types and non-negative whole-number counts.");
  }
  if (review.coverage.reduce((sum, x) => sum + (isCount(x.reviewedCases) ? x.reviewedCases : 0), 0) !== review.reviewedCases) {
    issues.push("Business-type coverage counts must equal the total reviewed cases.");
  }
  if (review.baselinePreferred + review.candidatePreferred + review.ties !== review.reviewedCases) {
    issues.push("Pairwise preferences must account for every reviewed case.");
  }
  if (review.baselineHardFailures > review.reviewedCases || review.candidateHardFailures > review.reviewedCases || review.heldoutCandidateHardFailures > review.heldoutReviewedCases) {
    issues.push("Hard-failure counts cannot exceed the number of cases reviewed.");
  }
  if (review.incompleteCases !== 0) issues.push("All submitted blind-review items must be complete.");
  if (review.reviewedCases < 12) issues.push("At least 12 complete full-set cases must be reviewed.");
  if (review.heldoutReviewedCases < 6) issues.push("At least 6 separate held-out cases must be reviewed.");
  if (review.coverage.filter((x) => x.reviewedCases >= 2).length < 4) issues.push("At least four business types must have two or more reviewed cases each.");
  if (review.candidatePreferred <= review.baselinePreferred) issues.push("The candidate must be preferred more often than the baseline.");
  if (review.candidateHardFailures > review.baselineHardFailures || review.heldoutCandidateHardFailures > 0) {
    issues.push("The candidate must not add hard failures and must have none on the held-out set.");
  }
  if (!Number.isFinite(review.baselineMeanScore) || !Number.isFinite(review.candidateMeanScore) || review.baselineMeanScore < 0 || review.baselineMeanScore > 2 || review.candidateMeanScore < 0 || review.candidateMeanScore > 2) {
    issues.push("Mean quality scores must be valid rubric scores from 0 to 2.");
  } else if (review.candidateMeanScore < review.baselineMeanScore) {
    issues.push("The candidate's mean rubric score must not regress.");
  }
  return issues;
}
