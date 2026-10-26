import { v, type Infer } from "convex/values";

/**
 * The visual a social draft suggests: its format and a brief the owner can act on
 * (slides for a carousel or document, a script and shot list for a short video).
 */
export const postVisualValidator = v.object({
  format: v.union(
    v.literal("text"),
    v.literal("single_image"),
    v.literal("carousel"),
    v.literal("document"),
    v.literal("reel"),
    v.literal("thread"),
    v.literal("story"),
  ),
  brief: v.string(),
  slides: v.optional(v.array(v.object({ heading: v.string(), body: v.string() }))),
  videoScript: v.optional(v.string()),
  shotList: v.optional(v.array(v.object({ timing: v.string(), show: v.string() }))),
});
export type PostVisual = Infer<typeof postVisualValidator>;

/** Formats ClimbOS can make a still image for (a cover for multi-page formats). Video is filmed by the owner. */
export function visualTakesImage(format: PostVisual["format"]): boolean {
  return format !== "reel";
}
