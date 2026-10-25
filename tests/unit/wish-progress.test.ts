import { describe, expect, it } from "vitest";
import { wishProgressKind, WISH_PROGRESS_LABELS, type WishCardProgressInput } from "@/components/app/wish/progress";

const card = (status: string, externalEffect = false, kind = "generate_content"): WishCardProgressInput => ({ status, externalEffect, kind });

describe("request feed progress summary", () => {
  it("keeps request-level status distinct from work that still needs a next step", () => {
    expect(wishProgressKind([card("proposed")], false, false)).toBe("next_step");
    expect(wishProgressKind([card("running")], false, false)).toBe("working");
    expect(wishProgressKind([card("done")], false, false)).toBe("completed");
    expect(wishProgressKind([card("done", true)], false, false)).toBe("ready_for_review");
    expect(wishProgressKind([card("done", false, "schedule_content")], false, false)).toBe("ready_for_review");
    expect(wishProgressKind([card("rejected")], false, false)).toBe("skipped");
  });

  it("labels reading, failure, mixed completion, and note acknowledgement truthfully", () => {
    expect(wishProgressKind([], true, false)).toBe("reading");
    expect(wishProgressKind([], false, true)).toBe("failed");
    expect(wishProgressKind([card("done", true), card("rejected")], false, false)).toBe("ready_for_review");
    expect(wishProgressKind([card("proposed", false, "note")], false, false)).toBe("next_step");
    expect(wishProgressKind([card("done", false, "note")], false, false)).toBe("completed");
    expect(wishProgressKind([card("rejected", false, "note")], false, false)).toBe("skipped");
    expect(wishProgressKind([card("done"), card("proposed", false, "note")], false, false)).toBe("next_step");
    expect(WISH_PROGRESS_LABELS.skipped).toBe("Skipped");
  });
});
