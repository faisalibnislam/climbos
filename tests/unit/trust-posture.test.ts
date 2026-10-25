import { describe, expect, it } from "vitest";
import { trustPostureContext } from "../../shared/agents/evidenceKind";

describe("brand trust context", () => {
  it("treats reputation as unknown when there is no observed proof", () => {
    const context = trustPostureContext(["published", "stated", "owner"]);
    expect(context).toContain("Brand age and reputation are unknown");
    expect(context).toContain("do not call the business new or established");
    expect(context).toContain("small pilot");
  });

  it("uses measured or observed evidence without inferring brand maturity", () => {
    const context = trustPostureContext(["owner", "behavior"]);
    expect(context).toContain("Current facts include observed customer behaviour");
    expect(context).toContain("do not infer overall brand maturity");
    expect(trustPostureContext(["commitment"])).toContain("Current facts include");
  });
});
