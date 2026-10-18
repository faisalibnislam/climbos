/** Airly apps: where each API lives and how its token looks (from each app's source, 18 Oct 2026). */
export type AirlyApp = "formkit" | "meetrao" | "taskeni" | "folevi";

export const AIRLY_APPS: Record<AirlyApp, { name: string; what: string; base: string | null; tokenPattern: RegExp; tokenHelp: string; direction: "in" | "out" }> = {
  formkit: { name: "Formkit", what: "New form responses become leads in your Pipeline and Inbox.", base: "https://formkit.app/api/v1", tokenPattern: /^fk_live_[0-9a-f]{48}$/, tokenHelp: "Formkit → Settings → Controls → API keys (Business plan).", direction: "in" },
  meetrao: { name: "Meetrao", what: "Meetings booked in Meetrao show up as booked deals and in your Inbox.", base: "https://meetrao.com/api/v1", tokenPattern: /^mk_live_[0-9a-f]{48}$/, tokenHelp: "Meetrao → Settings → Developer → API keys.", direction: "in" },
  taskeni: { name: "Taskeni", what: "Send your plan's to-dos to a Taskeni board.", base: null, tokenPattern: /^tk_[A-Za-z0-9_-]{8,}$/, tokenHelp: "Taskeni → Settings → Developers → API tokens (choose Write). Copy the API base shown there too.", direction: "out" },
  folevi: { name: "Folevi", what: "Save your growth plan and weekly reports as Folevi notes.", base: "https://app.folevi.com/api/v1", tokenPattern: /^fvpat_[A-Za-z0-9_-]{20,}$/, tokenHelp: "Folevi → Settings → Connected apps → new token with notes:write.", direction: "out" },
};

export function isAirlyApp(s: string): s is AirlyApp {
  return s in AIRLY_APPS;
}
