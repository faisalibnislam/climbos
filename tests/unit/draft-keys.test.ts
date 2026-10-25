import { describe, expect, it } from "vitest";
import { askDraftKey, wishDraftKey } from "../../src/components/app/draftKeys";

describe("owner request draft keys", () => {
  it("keeps one-time command handoffs separate from saved Home drafts", () => {
    expect(askDraftKey("studio", "user-1")).not.toBe(wishDraftKey("studio", "user-1"));
  });

  it("isolates saved drafts by both workspace and signed-in person", () => {
    const key = wishDraftKey("studio", "user-1");
    expect(wishDraftKey("studio", "user-2")).not.toBe(key);
    expect(wishDraftKey("shop", "user-1")).not.toBe(key);
  });
});
