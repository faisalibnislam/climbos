import { describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { asNewUser, makePaid, setup, type T } from "./helpers";

/** Teams: invite links with seats, approval limit, comments with @mentions, assignments, presence and the bell. */

async function team(t: T) {
  const owner = await asNewUser(t, "boss@example.com");
  const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Agency Co" });
  await makePaid(t, orgId);
  return { owner, slug, orgId: orgId as Id<"organizations"> };
}

describe("teams", () => {
  it("invite links add people up to the account's seats, once each", async () => {
    const t = setup();
    const { owner, slug } = await team(t);
    const { token } = await owner.client.mutation(api.team.createInviteLink, { slug, role: "editor", days: 7, maxUses: 5 });
    const a = await asNewUser(t, "a@example.com");
    await expect(a.client.mutation(api.settings.acceptInvite, { token })).resolves.toMatchObject({ slug });
    expect((await owner.client.query(api.team.members, { slug })).map((m) => m.role).sort()).toEqual(["editor", "owner"]);
    const b = await asNewUser(t, "b@example.com");
    await b.client.mutation(api.settings.acceptInvite, { token });
    // Starter has 3 seats: owner + a + b. The fourth is refused.
    const c = await asNewUser(t, "c@example.com");
    await expect(c.client.mutation(api.settings.acceptInvite, { token })).rejects.toThrow(/no free seats/);
  });

  it("editors can't start jobs over the approval limit; admins are told", async () => {
    const t = setup();
    const { owner, slug } = await team(t);
    await owner.client.mutation(api.orgs.setGoal, { slug, kind: "more_customers", statement: "More", horizonDays: 90, monthlyAdBudget: 0 });
    await owner.client.mutation(api.team.setCreditApprovalLimit, { slug, credits: 1 });
    const { token } = await owner.client.mutation(api.team.createInviteLink, { slug, role: "editor", days: 7, maxUses: 1 });
    const ed = await asNewUser(t, "ed@example.com");
    await ed.client.mutation(api.settings.acceptInvite, { token });
    await expect(ed.client.mutation(api.content.generate, { slug, job: "content_seo" })).rejects.toThrow(/need an owner or admin/);
    expect(await ed.client.mutation(api.team.requestApproval, { slug, title: "SEO page", credits: 11, href: `/app/${slug}/content` })).toMatchObject({ told: 1 });
    const bell = await owner.client.query(api.team.myNotices, {});
    expect(bell.items.some((n) => n.kind === "approval")).toBe(true);
    await expect(owner.client.mutation(api.content.generate, { slug, job: "content_seo" })).resolves.toBeTruthy();
  });

  it("comments notify @mentioned people and assignees; presence shows who's here", async () => {
    const t = setup();
    const { owner, slug } = await team(t);
    const { token } = await owner.client.mutation(api.team.createInviteLink, { slug, role: "editor", days: 7, maxUses: 1 });
    const sam = await asNewUser(t, "sam@example.com");
    await sam.client.mutation(api.settings.acceptInvite, { token });
    const subject = { slug, subjectType: "card" as const, subjectId: "card_1", title: "Launch post", href: `/app/${slug}/today` };
    await owner.client.mutation(api.team.assign, { ...subject, assigneeId: sam.userId });
    await owner.client.mutation(api.team.addComment, { ...subject, body: "@sam can you tighten the hook?" });
    const notices = await sam.client.query(api.team.myNotices, {});
    expect(notices.unread).toBe(2);
    expect(notices.items.map((n) => n.kind).sort()).toEqual(["assigned", "mention"]);
    expect(await sam.client.query(api.team.myAssignments, { slug })).toHaveLength(1);
    await sam.client.mutation(api.team.markNoticesRead, {});
    expect((await sam.client.query(api.team.myNotices, {})).unread).toBe(0);
    await sam.client.mutation(api.team.heartbeat, { slug, path: "/today" });
    expect(await owner.client.query(api.team.here, { slug, path: "/today", now: Date.now() })).toHaveLength(1);
  });
});
