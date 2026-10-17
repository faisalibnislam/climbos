import { newId } from "./ops";
import { DEFAULT_BRAND, FORMATS, type BrandKit, type DesignDoc, type DesignFormat, type Layer, type Page, type TextLayer } from "./types";

/**
 * Starter layouts. Each template is a function of the format size so one
 * layout adapts to square, portrait, story and landscape. Layers carry a
 * `slot` (headline, subhead, body, photo, logo, cta, kicker…) that the AI and
 * the owner fill. Colours and fonts reference the brand kit, so a template
 * instantly takes on each business's look.
 */

export interface TemplateInfo {
  id: string;
  name: string;
  description: string;
  /** Slots the AI should fill, with guidance. */
  slots: Record<string, string>;
  kind: "single" | "carousel_cover" | "carousel_point" | "carousel_end";
}

interface Box {
  w: number;
  h: number;
  /** Shorter side, for proportional sizing. */
  s: number;
  pad: number;
  landscape: boolean;
}

function box(format: Exclude<DesignFormat, "custom">): Box {
  const f = FORMATS[format];
  const s = Math.min(f.width, f.height);
  return { w: f.width, h: f.height, s, pad: Math.round(s * 0.08), landscape: f.width > f.height * 1.2 };
}

function text(partial: Partial<TextLayer> & Pick<TextLayer, "x" | "y" | "width" | "height" | "text">): TextLayer {
  return {
    id: newId(),
    type: "text",
    rotation: 0,
    opacity: 1,
    fontFamily: "brand:body",
    fontWeight: 400,
    fontSize: 40,
    lineHeight: 1.2,
    letterSpacing: 0,
    color: "brand:dark",
    align: "left",
    verticalAlign: "top",
    autoFit: true,
    ...partial,
  };
}

function logo(b: Box, color = "brand:dark"): Layer {
  const size = Math.round(b.s * 0.07);
  return {
    id: newId(),
    type: "image",
    slot: "logo",
    src: "brand:logo",
    x: b.pad,
    y: b.h - b.pad - size,
    width: size,
    height: size,
    rotation: 0,
    opacity: 1,
    crop: { x: 0, y: 0, width: 1, height: 1 },
    fit: "contain",
    radius: 0,
    alt: "Logo",
    ...(color ? {} : {}),
  };
}

type Builder = (b: Box) => Pick<Page, "background" | "layers">;

const T: Record<string, { info: TemplateInfo; build: Builder }> = {
  bold_statement: {
    info: {
      id: "bold_statement",
      name: "Bold statement",
      description: "One big idea on a brand-colour background. For hooks, opinions and announcements.",
      slots: { kicker: "2–4 word label above the headline", headline: "The one idea, ≤ 12 words", subhead: "One supporting line, ≤ 20 words" },
      kind: "single",
    },
    build: (b) => ({
      background: { kind: "solid", color: "brand:primary" },
      layers: [
        text({ slot: "kicker", x: b.pad, y: b.pad, width: b.w - 2 * b.pad, height: b.s * 0.06, text: "A NOTE FROM US", fontSize: b.s * 0.032, fontWeight: 700, letterSpacing: 2, color: "brand:accent", fontFamily: "brand:body", transform: "uppercase" }),
        text({ slot: "headline", x: b.pad, y: b.h * 0.22, width: b.w - 2 * b.pad, height: b.h * 0.44, text: "Your big idea goes here in a few strong words", fontSize: b.s * 0.1, fontWeight: 800, lineHeight: 1.05, color: "brand:light", fontFamily: "brand:heading", verticalAlign: "middle" }),
        text({ slot: "subhead", x: b.pad, y: b.h * 0.7, width: b.w - 2 * b.pad, height: b.h * 0.12, text: "One line that makes the reader care.", fontSize: b.s * 0.04, color: "brand:light", opacity: 0.9 }),
        { ...logo(b), opacity: 0.95 },
      ],
    }),
  },
  photo_band: {
    info: {
      id: "photo_band",
      name: "Photo with caption band",
      description: "A full-bleed photo with a headline on a solid band. For products, places and people (only real, approved photos).",
      slots: { photo: "The hero photo", headline: "≤ 10 words", subhead: "≤ 16 words" },
      kind: "single",
    },
    build: (b) => {
      const band = b.landscape ? b.h * 0.42 : b.h * 0.34;
      return {
        background: { kind: "solid", color: "brand:dark" },
        layers: [
          { id: newId(), type: "image", slot: "photo", src: "", x: 0, y: 0, width: b.w, height: b.h - band, rotation: 0, opacity: 1, crop: { x: 0, y: 0, width: 1, height: 1 }, fit: "cover", radius: 0, alt: "" },
          { id: newId(), type: "shape", shape: "rect", x: 0, y: b.h - band, width: b.w, height: band, rotation: 0, opacity: 1, fill: { kind: "solid", color: "brand:light" }, radius: 0 },
          text({ slot: "headline", x: b.pad, y: b.h - band + b.pad * 0.7, width: b.w - 2 * b.pad, height: band * 0.5, text: "Headline about this photo", fontSize: b.s * 0.07, fontWeight: 800, lineHeight: 1.08, fontFamily: "brand:heading" }),
          text({ slot: "subhead", x: b.pad, y: b.h - band * 0.36, width: b.w - 2 * b.pad - b.s * 0.1, height: band * 0.24, text: "A short supporting line", fontSize: b.s * 0.034, color: "brand:dark", opacity: 0.8 }),
        ],
      };
    },
  },
  split: {
    info: {
      id: "split",
      name: "Split photo and text",
      description: "Photo on one side, message on the other. Balanced and calm; good for services and how-tos.",
      slots: { photo: "Supporting photo", kicker: "2–4 word label", headline: "≤ 10 words", body: "≤ 30 words", cta: "≤ 4 words" },
      kind: "single",
    },
    build: (b) => {
      const vertical = !b.landscape;
      const photo = vertical ? { x: 0, y: 0, width: b.w, height: b.h * 0.48 } : { x: 0, y: 0, width: b.w * 0.48, height: b.h };
      const tx = vertical ? b.pad : b.w * 0.48 + b.pad;
      const ty = vertical ? b.h * 0.48 + b.pad * 0.8 : b.pad;
      const tw = vertical ? b.w - 2 * b.pad : b.w * 0.52 - 2 * b.pad;
      const th = vertical ? b.h * 0.52 - 2 * b.pad : b.h - 2 * b.pad;
      return {
        background: { kind: "solid", color: "brand:light" },
        layers: [
          { id: newId(), type: "image", slot: "photo", src: "", ...photo, rotation: 0, opacity: 1, crop: { x: 0, y: 0, width: 1, height: 1 }, fit: "cover", radius: 0, alt: "" },
          text({ slot: "kicker", x: tx, y: ty, width: tw, height: th * 0.1, text: "HOW IT WORKS", fontSize: b.s * 0.028, fontWeight: 700, letterSpacing: 2, color: "brand:primary", transform: "uppercase" }),
          text({ slot: "headline", x: tx, y: ty + th * 0.13, width: tw, height: th * 0.38, text: "Say the main point clearly", fontSize: b.s * 0.07, fontWeight: 800, lineHeight: 1.08, fontFamily: "brand:heading" }),
          text({ slot: "body", x: tx, y: ty + th * 0.53, width: tw, height: th * 0.26, text: "Explain the one detail that makes it believable.", fontSize: b.s * 0.034, lineHeight: 1.4, opacity: 0.85 }),
          text({
            slot: "cta",
            x: tx,
            y: ty + th * 0.84,
            width: Math.min(tw, b.s * 0.42),
            height: th * 0.14,
            text: "Learn more",
            fontSize: b.s * 0.03,
            fontWeight: 700,
            color: "brand:light",
            align: "center",
            verticalAlign: "middle",
            background: { color: "brand:primary", padding: b.s * 0.015, radius: b.s * 0.012 },
          }),
        ],
      };
    },
  },
  quote: {
    info: {
      id: "quote",
      name: "Quote card",
      description: "A short quote with attribution. Only use real, approved quotes from confirmed facts.",
      slots: { quote: "The exact approved quote, ≤ 30 words", attribution: "Who said it (name, role)" },
      kind: "single",
    },
    build: (b) => ({
      background: { kind: "solid", color: "brand:light" },
      layers: [
        { id: newId(), type: "icon", icon: "Quote", x: b.pad, y: b.pad, width: b.s * 0.14, height: b.s * 0.14, rotation: 0, opacity: 1, color: "brand:accent", strokeWidth: 2 },
        text({ slot: "quote", x: b.pad, y: b.h * 0.25, width: b.w - 2 * b.pad, height: b.h * 0.45, text: "“A real customer quote, word for word.”", fontSize: b.s * 0.07, fontWeight: 600, lineHeight: 1.2, fontFamily: "brand:heading", verticalAlign: "middle" }),
        text({ slot: "attribution", x: b.pad, y: b.h * 0.74, width: b.w - 2 * b.pad, height: b.h * 0.08, text: "— Name, role", fontSize: b.s * 0.034, opacity: 0.8 }),
        logo(b),
      ],
    }),
  },
  big_number: {
    info: {
      id: "big_number",
      name: "Big number",
      description: "One sourced number with what it means. Only numbers from confirmed facts or the owner's own data.",
      slots: { number: "The number with unit, e.g. 41 or 3×", label: "What the number is, ≤ 12 words", note: "Source or context, ≤ 14 words" },
      kind: "single",
    },
    build: (b) => ({
      background: { kind: "linear", angle: 135, stops: [{ offset: 0, color: "brand:primary" }, { offset: 1, color: "brand:secondary" }] },
      layers: [
        text({ slot: "number", x: b.pad, y: b.h * 0.18, width: b.w - 2 * b.pad, height: b.h * 0.36, text: "41", fontSize: b.s * 0.3, fontWeight: 800, lineHeight: 1, color: "brand:light", fontFamily: "brand:heading", align: "center", verticalAlign: "bottom" }),
        text({ slot: "label", x: b.pad, y: b.h * 0.56, width: b.w - 2 * b.pad, height: b.h * 0.16, text: "quote requests in 8 weeks", fontSize: b.s * 0.055, fontWeight: 700, color: "brand:light", align: "center" }),
        text({ slot: "note", x: b.pad, y: b.h * 0.76, width: b.w - 2 * b.pad, height: b.h * 0.08, text: "From our own booking records", fontSize: b.s * 0.028, color: "brand:light", align: "center", opacity: 0.85 }),
      ],
    }),
  },
  carousel_cover: {
    info: {
      id: "carousel_cover",
      name: "Carousel cover",
      description: "First slide of a carousel: a promise that makes people swipe.",
      slots: { kicker: "Label, e.g. 'A 5-step guide'", headline: "The promise, ≤ 10 words", swipe: "Swipe cue, ≤ 3 words" },
      kind: "carousel_cover",
    },
    build: (b) => ({
      background: { kind: "solid", color: "brand:dark" },
      layers: [
        text({ slot: "kicker", x: b.pad, y: b.pad, width: b.w - 2 * b.pad, height: b.s * 0.06, text: "A 5-STEP GUIDE", fontSize: b.s * 0.03, fontWeight: 700, letterSpacing: 2, color: "brand:accent", transform: "uppercase" }),
        text({ slot: "headline", x: b.pad, y: b.h * 0.2, width: b.w - 2 * b.pad, height: b.h * 0.5, text: "The promise of this carousel in one line", fontSize: b.s * 0.11, fontWeight: 800, lineHeight: 1.02, color: "brand:light", fontFamily: "brand:heading", verticalAlign: "middle" }),
        text({ slot: "swipe", x: b.w - b.pad - b.s * 0.3, y: b.h - b.pad - b.s * 0.06, width: b.s * 0.3, height: b.s * 0.06, text: "Swipe →", fontSize: b.s * 0.032, fontWeight: 700, color: "brand:accent", align: "right", verticalAlign: "middle" }),
        logo(b),
      ],
    }),
  },
  carousel_point: {
    info: {
      id: "carousel_point",
      name: "Carousel point",
      description: "A middle slide: one numbered point with a short explanation.",
      slots: { number: "Step number, e.g. 01", headline: "The point, ≤ 8 words", body: "Explanation, ≤ 35 words" },
      kind: "carousel_point",
    },
    build: (b) => ({
      background: { kind: "solid", color: "brand:light" },
      layers: [
        text({ slot: "number", x: b.pad, y: b.pad, width: b.s * 0.3, height: b.s * 0.14, text: "01", fontSize: b.s * 0.12, fontWeight: 800, color: "brand:primary", fontFamily: "brand:heading", autoFit: false }),
        text({ slot: "headline", x: b.pad, y: b.h * 0.25, width: b.w - 2 * b.pad, height: b.h * 0.25, text: "One clear point", fontSize: b.s * 0.08, fontWeight: 800, lineHeight: 1.08, fontFamily: "brand:heading" }),
        text({ slot: "body", x: b.pad, y: b.h * 0.52, width: b.w - 2 * b.pad, height: b.h * 0.34, text: "Explain it in plain words with one concrete detail.", fontSize: b.s * 0.042, lineHeight: 1.45, opacity: 0.85 }),
      ],
    }),
  },
  carousel_end: {
    info: {
      id: "carousel_end",
      name: "Carousel ending",
      description: "Last slide: a recap and one clear next step.",
      slots: { headline: "Recap or takeaway, ≤ 10 words", cta: "The next step, ≤ 6 words" },
      kind: "carousel_end",
    },
    build: (b) => ({
      background: { kind: "solid", color: "brand:primary" },
      layers: [
        text({ slot: "headline", x: b.pad, y: b.h * 0.24, width: b.w - 2 * b.pad, height: b.h * 0.34, text: "The one thing to remember", fontSize: b.s * 0.09, fontWeight: 800, lineHeight: 1.05, color: "brand:light", fontFamily: "brand:heading", align: "center", verticalAlign: "middle" }),
        text({
          slot: "cta",
          x: b.w / 2 - b.s * 0.28,
          y: b.h * 0.64,
          width: b.s * 0.56,
          height: b.s * 0.1,
          text: "Save this for later",
          fontSize: b.s * 0.036,
          fontWeight: 700,
          color: "brand:dark",
          align: "center",
          verticalAlign: "middle",
          background: { color: "brand:accent", padding: b.s * 0.015, radius: b.s * 0.05 },
        }),
        logo(b, "brand:light"),
      ],
    }),
  },
};

export const TEMPLATES: TemplateInfo[] = Object.values(T).map((t) => t.info);

/** Build a page from a template for a format. */
export function templatePage(templateId: string, format: Exclude<DesignFormat, "custom">): Page {
  const t = T[templateId] ?? T.bold_statement;
  const { background, layers } = t.build(box(format));
  return { id: newId("p"), background, layers: layers.map((l) => ({ ...l, x: Math.round(l.x), y: Math.round(l.y), width: Math.round(l.width), height: Math.round(l.height) })) };
}

/** A new design document from a template (carousels get cover + points + ending). */
export function newDesign(format: Exclude<DesignFormat, "custom">, templateId = "bold_statement", brand: BrandKit = DEFAULT_BRAND, carouselPoints = 0): DesignDoc {
  const f = FORMATS[format];
  const pages =
    carouselPoints > 0
      ? [templatePage("carousel_cover", format), ...Array.from({ length: carouselPoints }, () => templatePage("carousel_point", format)), templatePage("carousel_end", format)]
      : [templatePage(templateId, format)];
  return { version: 1, format, width: f.width, height: f.height, pages, brand, templateId: carouselPoints > 0 ? "carousel" : templateId };
}
