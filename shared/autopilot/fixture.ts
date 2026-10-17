import type { SocialCalendar } from "../agents/specs";
import { spreadDays } from "./index";

/**
 * Deterministic week plan for demo workspaces (and v1 deployments): built
 * from the business's confirmed facts, clearly generic, never inventing
 * results or offers. Real workspaces on Engine v2 use the planning agent.
 */
export function fixtureCalendar(cadence: Record<string, number>, fromDay: number, businessName: string, facts: string[]): SocialCalendar {
  const pillars = [
    { name: "Answer real questions", why: "Teaching what customers ask builds trust before they buy." },
    { name: "Show how it works", why: "Process and behind-the-scenes posts prove the claims on the website." },
    { name: "Make the next step easy", why: "A clear, low-friction offer turns attention into enquiries." },
  ];
  const formats: Record<string, SocialCalendar["slots"][number]["format"]> = {
    instagram: "carousel",
    facebook: "single_image",
    linkedin: "text",
    x: "text",
    tiktok: "reel",
    youtube: "reel",
    pinterest: "single_image",
  };
  const purposes: SocialCalendar["slots"][number]["purpose"][] = ["teach", "prove", "teach", "ask", "connect", "prove"];
  const slots: SocialCalendar["slots"] = [];
  let k = 0;
  for (const [channel, n] of Object.entries(cadence)) {
    const days = spreadDays(n).map((d) => Math.max(fromDay, Math.min(7, fromDay + Math.round(((d - 1) * (8 - fromDay)) / 7))));
    days.forEach((day, i) => {
      const purpose = purposes[(k + i) % purposes.length];
      const fact = facts[(k + i) % Math.max(1, facts.length)] ?? `what ${businessName} does`;
      const pillar = purpose === "ask" ? pillars[2] : purpose === "prove" ? pillars[1] : pillars[0];
      slots.push({
        channel,
        day,
        pillar: pillar.name,
        purpose,
        format: formats[channel] ?? "single_image",
        idea: `${purpose === "ask" ? "Invite people to take the next step, based on" : purpose === "prove" ? "Show the work behind" : "Explain, in plain words,"} ${fact.replace(/\.$/, "")} (${channel} post ${i + 1}).`,
        angle: `For people deciding whether ${businessName} is right for them.`,
        hookDraft: purpose === "ask" ? `Thinking about it? Here's the easiest way to start.` : `One thing most people don't know about this:`,
        proof: facts.length ? fact : "none needed",
        callToAction: purpose === "ask" ? "Visit the website" : "Save this for later",
        needsOwner: false,
        ownerNote: "",
      });
    });
    k += n;
  }
  return {
    weekTheme: `A steady week for ${businessName}: answer questions, show the work, and make the next step easy.`,
    pillars,
    slots,
    learningsApplied: ["Demo plan: built from your confirmed facts. Real workspaces plan with the expert agent and learn from results."],
  };
}
