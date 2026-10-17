/**
 * Image treatments for real visuals. Each keeps what must stay true (the real
 * product, the real interface) and changes only what the owner picked.
 */
export type Treatment = "sample_data" | "clean_background" | "lifestyle_scene";

export const SCENES = ["on a tidy desk", "on a kitchen counter", "on a café table", "outdoors in soft daylight", "gift-wrapped on a table"] as const;
export type Scene = (typeof SCENES)[number];

export const TREATMENTS: Record<Treatment, { label: string; description: string; for: ("screenshot" | "product_photo" | "upload")[] }> = {
  sample_data: {
    label: "Realistic sample data",
    description: "Replaces names, emails, numbers and photos in a screenshot with believable made-up ones, so no real customer data appears. Layout stays identical.",
    for: ["screenshot", "upload"],
  },
  clean_background: {
    label: "Clean studio background",
    description: "Puts your exact product on a soft, neutral background with a natural shadow.",
    for: ["product_photo", "upload"],
  },
  lifestyle_scene: {
    label: "Lifestyle scene",
    description: "Places your exact product in a real-looking setting you pick.",
    for: ["product_photo", "upload"],
  },
};

export function treatmentPrompt(t: Treatment, scene?: string): string {
  switch (t) {
    case "sample_data":
      return "This is a screenshot of a software product's interface. Replace every piece of personal or business data (people's names, email addresses, phone numbers, company names, avatars, monetary values, counts, dates and free-text content) with realistic but clearly fictional sample data of the same length and type. Keep the layout, fonts, colors, icons, spacing, buttons, navigation and every interface label exactly the same. Do not add, remove or move any interface element. Do not add text or watermarks.";
    case "clean_background":
      return "Place this exact product on a clean, soft, neutral studio background with gentle natural lighting and a realistic soft shadow. Do not change the product's shape, proportions, colors, materials, labels, logos or any text on it. Do not add other objects, text or watermarks.";
    case "lifestyle_scene":
      return `Place this exact product ${scene ?? "on a tidy desk"} in a realistic, softly lit, uncluttered scene that looks like a real photo. Do not change the product's shape, proportions, colors, materials, labels, logos or any text on it. No people's faces, no other brands, no text or watermarks.`;
  }
}
