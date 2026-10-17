/**
 * ClimbOS design document: a layered, editable scene for image posts,
 * carousels and stories. One model drives the editor canvas, AI edits,
 * thumbnails and exports. All geometry is in design pixels (the export size).
 */

export type DesignFormat =
  | "instagram_portrait" // 1080×1350
  | "instagram_square" // 1080×1080
  | "story" // 1080×1920 (Stories, Reels covers, TikTok, Shorts)
  | "linkedin_landscape" // 1200×627
  | "linkedin_document" // 1080×1350 pages, exported as PDF
  | "facebook_landscape" // 1200×630
  | "x_landscape" // 1600×900
  | "pinterest_pin" // 1000×1500
  | "youtube_thumbnail" // 1280×720
  | "custom";

export interface FormatSpec {
  id: DesignFormat;
  label: string;
  width: number;
  height: number;
  /** Margins where platform UI covers the image (top, right, bottom, left), in px. */
  safe: [number, number, number, number];
}

export const FORMATS: Record<Exclude<DesignFormat, "custom">, FormatSpec> = {
  instagram_portrait: { id: "instagram_portrait", label: "Instagram post (4:5)", width: 1080, height: 1350, safe: [60, 60, 60, 60] },
  instagram_square: { id: "instagram_square", label: "Square post (1:1)", width: 1080, height: 1080, safe: [60, 60, 60, 60] },
  story: { id: "story", label: "Story / Reel cover (9:16)", width: 1080, height: 1920, safe: [250, 60, 380, 60] },
  linkedin_landscape: { id: "linkedin_landscape", label: "LinkedIn image (1.91:1)", width: 1200, height: 627, safe: [40, 40, 40, 40] },
  linkedin_document: { id: "linkedin_document", label: "LinkedIn document page (4:5)", width: 1080, height: 1350, safe: [60, 60, 60, 60] },
  facebook_landscape: { id: "facebook_landscape", label: "Facebook image (1.91:1)", width: 1200, height: 630, safe: [40, 40, 40, 40] },
  x_landscape: { id: "x_landscape", label: "X image (16:9)", width: 1600, height: 900, safe: [40, 40, 40, 40] },
  pinterest_pin: { id: "pinterest_pin", label: "Pinterest pin (2:3)", width: 1000, height: 1500, safe: [60, 60, 120, 60] },
  youtube_thumbnail: { id: "youtube_thumbnail", label: "YouTube thumbnail (16:9)", width: 1280, height: 720, safe: [30, 30, 90, 30] },
};

/** Colour: a hex literal or a reference to a brand-kit colour slot. */
export type Paint = string; // "#RRGGBB", "#RRGGBBAA" or "brand:primary" | "brand:secondary" | "brand:accent" | "brand:dark" | "brand:light"

export interface GradientFill {
  kind: "linear";
  angle: number; // degrees, 0 = left→right
  stops: { offset: number; color: Paint }[];
}

export type Fill = { kind: "solid"; color: Paint } | GradientFill | { kind: "none" };

export interface Shadow {
  x: number;
  y: number;
  blur: number;
  color: Paint;
}

interface LayerBase {
  id: string;
  name?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Degrees clockwise around the layer centre. */
  rotation: number;
  opacity: number; // 0..1
  locked?: boolean;
  hidden?: boolean;
  shadow?: Shadow;
  /** Template slot this layer fills (e.g. "headline", "photo"), used by AI and templates. */
  slot?: string;
}

export interface TextLayer extends LayerBase {
  type: "text";
  text: string;
  fontFamily: string; // a font in the design font registry, or "brand:heading" / "brand:body"
  fontWeight: number;
  fontStyle?: "normal" | "italic";
  fontSize: number;
  lineHeight: number; // multiple of fontSize
  letterSpacing: number; // px
  color: Paint;
  align: "left" | "center" | "right";
  verticalAlign: "top" | "middle" | "bottom";
  transform?: "none" | "uppercase";
  /** Shrink the font until the text fits the box. */
  autoFit?: boolean;
  /** Pill/marker background behind the text box. */
  background?: { color: Paint; padding: number; radius: number };
  underline?: boolean;
}

export interface ImageLayer extends LayerBase {
  type: "image";
  /** Asset id in the workspace library, or an http(s)/data URL. */
  src: string;
  /** Crop window in the source image, as fractions of its width/height. */
  crop: { x: number; y: number; width: number; height: number };
  fit: "cover" | "contain";
  radius: number;
  mask?: "none" | "circle" | "rounded" | "blob";
  border?: { width: number; color: Paint };
  filters?: { brightness?: number; contrast?: number; saturation?: number; blur?: number; grayscale?: boolean };
  flipX?: boolean;
  flipY?: boolean;
  /** Alt text for accessibility and for the AI's understanding of the image. */
  alt?: string;
}

export interface ShapeLayer extends LayerBase {
  type: "shape";
  shape: "rect" | "ellipse" | "triangle" | "line" | "arrow" | "star" | "polygon";
  fill: Fill;
  stroke?: { width: number; color: Paint; dash?: number[] };
  radius: number; // rect corner radius
  sides?: number; // polygon
}

export interface IconLayer extends LayerBase {
  type: "icon";
  /** Icon name from the ClimbOS icon set. */
  icon: string;
  color: Paint;
  strokeWidth: number;
}

export interface GroupLayer extends LayerBase {
  type: "group";
  children: Layer[];
}

export type Layer = TextLayer | ImageLayer | ShapeLayer | IconLayer | GroupLayer;
export type LayerType = Layer["type"];

export interface Page {
  id: string;
  background: Fill & { imageSrc?: string; imageOpacity?: number };
  layers: Layer[];
  /** Notes for the AI/owner, e.g. the slide's message. Not rendered. */
  notes?: string;
}

export interface BrandKit {
  colors: { primary: string; secondary: string; accent: string; dark: string; light: string };
  fonts: { heading: string; body: string };
  logoSrc?: string;
  name?: string;
}

export interface DesignDoc {
  version: 1;
  format: DesignFormat;
  width: number;
  height: number;
  pages: Page[];
  brand: BrandKit;
  /** Template the design started from, if any. */
  templateId?: string;
}

export const DEFAULT_BRAND: BrandKit = {
  colors: { primary: "#0b5d46", secondary: "#0b3b2e", accent: "#ff9a4d", dark: "#101828", light: "#f5f6f8" },
  fonts: { heading: "Plus Jakarta Sans", body: "Plus Jakarta Sans" },
};
