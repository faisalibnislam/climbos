"use client";

import { useState } from "react";
import { Badge, Button, Segmented } from "@/components/ui";
import { AvatarGroup, PresenceIndicator, UserAvatar, type Person, type Presence } from "@/components/ds/accounts/avatar";
import { AccessBadge, PermissionMatrix, RoleSelector, ViewAsBanner, roleLabel, type Permission, type PermissionGrid, type Role } from "@/components/ds/accounts/roles";
import { InviteMemberDialog, TeamMemberList, UserProfileMenu, type Member } from "@/components/ds/accounts/team";
import { ProfileCompletion, VerificationBadge, type CompletionStep } from "@/components/ds/accounts/profile";
import { ApiKeyManager, ConnectedAccounts, SecuritySettings, SessionManager, type ApiKey, type Connection, type Session } from "@/components/ds/accounts/security";
import { DocPage, Spec, Specimen, Stage } from "../../_kit/doc";

const PEOPLE: Person[] = [
  { id: "p1", name: "Maya Rahman", role: "Owner", presence: "online" },
  { id: "p2", name: "Sam Okafor", role: "Admin", presence: "online" },
  { id: "p3", name: "Lena Brooks", role: "Member", presence: "away" },
  { id: "p4", name: "Diego Ruiz", role: "Member", presence: "busy" },
  { id: "p5", name: "Priya Nair", role: "Member", presence: "offline" },
  { id: "p6", name: "Tom Becker", role: "Member", presence: "offline" },
  { id: "p7", name: "Ana Souza", role: "Admin", presence: "online" },
  { id: "p8", name: "Jon Park", role: "Member", presence: "offline" },
];

const WORKSPACES = ["Tartine Bakery", "Tartine Catering", "Ollie’s Gym (client)"];

const MEMBERS: Member[] = [
  { id: "m1", name: "Maya Rahman", email: "maya@tartine.co", role: "owner", workspaces: "all", lastActive: "Now", presence: "online" },
  { id: "m2", name: "Sam Okafor", email: "sam@tartine.co", role: "admin", workspaces: "all", lastActive: "12 min ago", presence: "online" },
  { id: "m3", name: "Lena Brooks", email: "lena@tartine.co", role: "member", workspaces: ["Tartine Bakery"], lastActive: "Yesterday", presence: "away" },
  { id: "m4", name: "Diego Ruiz", email: "diego@olliesgym.com", role: "member", workspaces: ["Ollie’s Gym (client)"], lastActive: "3 days ago", presence: "offline" },
  { id: "m5", name: "", email: "priya@tartine.co", role: "member", workspaces: ["Tartine Catering"], lastActive: "Invited 2 days ago", invited: true },
];

const PERMISSIONS: Permission[] = [
  { id: "view", label: "View results and reports", group: "Growth" },
  { id: "create", label: "Create posts, plays and campaigns", group: "Growth" },
  { id: "approve", label: "Approve and publish", group: "Growth" },
  { id: "leads", label: "Export leads", group: "Growth" },
  { id: "spend", label: "Spend credits", group: "Account" },
  { id: "billing", label: "Manage billing and plan", group: "Account" },
  { id: "team", label: "Invite and remove people", group: "Account" },
  { id: "keys", label: "Manage API keys", group: "Account" },
];

const DEFAULT_GRID: PermissionGrid = {
  owner: PERMISSIONS.map((p) => p.id),
  admin: ["view", "create", "approve", "leads", "spend", "team"],
  member: ["view", "create", "spend"],
  staff: ["view"],
};

const KEYS: ApiKey[] = [
  { id: "k1", name: "Zapier sync", last4: "3f9a", mode: "live", scope: "write", created: "12 Sep", lastUsed: "2 hours ago" },
  { id: "k2", name: "Website lead form", last4: "8c21", mode: "live", scope: "read", created: "3 Aug", lastUsed: "Yesterday" },
  { id: "k3", name: "Staging", last4: "b07e", mode: "test", scope: "write", created: "1 Jul", lastUsed: "3 weeks ago" },
];

const CONNECTIONS: Connection[] = [
  { id: "c1", network: "google", label: "Google", use: "Sign-in and Business Profile", status: "connected", account: "maya@tartine.co" },
  { id: "c2", network: "instagram", label: "Instagram", use: "Posts and replies", status: "connected", account: "@tartinebakery" },
  { id: "c3", network: "facebook", label: "Facebook", use: "Page posts and ads", status: "expired", account: "Tartine Bakery" },
  { id: "c4", network: "linkedin", label: "LinkedIn", use: "Company page posts", status: "off" },
];

const SESSIONS: Session[] = [
  { id: "s1", device: "desktop", name: "Chrome on macOS", place: "San Francisco, US", lastActive: "Now", current: true },
  { id: "s2", device: "mobile", name: "ClimbOS app on iPhone", place: "San Francisco, US", lastActive: "1 hour ago" },
  { id: "s3", device: "desktop", name: "Safari on macOS", place: "Oakland, US", lastActive: "4 days ago" },
];

const STEPS: CompletionStep[] = [
  { id: "photo", label: "Add a profile photo", done: true },
  { id: "business", label: "Describe your business", hint: "Plays use it to pick the right audience.", done: true },
  { id: "hours", label: "Add opening hours", hint: "Shown on Google and in replies.", done: false },
  { id: "brand", label: "Upload your logo and colours", hint: "Every post uses your brand kit.", done: false },
  { id: "verify", label: "Verify your domain", hint: "Needed before cold email can send.", done: false },
];

export function AccountsContent() {
  const [presence, setPresence] = useState<Presence>("online");
  const [members, setMembers] = useState(MEMBERS);
  const [role, setRole] = useState<Role>("member");
  const [grid, setGrid] = useState(DEFAULT_GRID);
  const [viewAs, setViewAs] = useState(true);
  const [steps, setSteps] = useState(STEPS);
  const [verify, setVerify] = useState<"unverified" | "pending" | "verified">("unverified");
  const [keys, setKeys] = useState(KEYS);
  const [conns, setConns] = useState(CONNECTIONS);
  const [sessions, setSessions] = useState(SESSIONS);
  const changed = (Object.keys(grid) as Role[]).some((r) => grid[r].length !== DEFAULT_GRID[r].length || grid[r].some((x) => !DEFAULT_GRID[r].includes(x)));

  return (
    <DocPage eyebrow="Components" title="Users & accounts" intro="People, roles and the security around them. Credits are shared across the account; roles decide who can spend them.">
      <Specimen title="User avatar" description="Photo, falling back to initials. Same person, same colour. Square for workspaces and bots.">
        <Stage tone="white" className="flex flex-wrap items-end gap-6">
          {(["xs", "sm", "md", "lg", "xl"] as const).map((s) => (
            <span key={s} className="flex flex-col items-center gap-2">
              <UserAvatar name="Maya Rahman" size={s} presence={s === "xs" ? undefined : "online"} />
              <span className="text-2xs text-ink-3">{s}</span>
            </span>
          ))}
          <span className="mx-2 h-10 w-px bg-line" />
          {(["online", "away", "busy", "offline"] as const).map((p, i) => (
            <span key={p} className="flex flex-col items-center gap-2">
              <UserAvatar name={PEOPLE[i + 1].name} size="lg" presence={p} />
              <span className="text-2xs text-ink-3">{p}</span>
            </span>
          ))}
          <span className="mx-2 h-10 w-px bg-line" />
          <span className="flex flex-col items-center gap-2">
            <UserAvatar name="Tartine Bakery" size="lg" shape="square" />
            <span className="text-2xs text-ink-3">workspace</span>
          </span>
          <span className="flex flex-col items-center gap-2">
            <UserAvatar name="Broken Photo" src="data:image/png;base64,AAAA" size="lg" />
            <span className="text-2xs text-ink-3">image failed</span>
          </span>
        </Stage>
        <Spec items={[["Sizes", "20 / 24 / 32 / 40 / 56px"], ["Status", "Dot + accessible label; online pulses unless reduced motion"], ["Shape", "Circle for people, 3px square for workspaces"]]} />
      </Specimen>

      <Specimen title="Avatar group" description="Overlaps with a white ring. The +N chip lists everyone else.">
        <Stage tone="white" className="flex flex-wrap items-center gap-8">
          <AvatarGroup people={PEOPLE} max={4} label="Workspace members" />
          <AvatarGroup people={PEOPLE.slice(0, 5)} max={3} size="sm" label="Approvers" />
          <AvatarGroup people={PEOPLE.slice(0, 3)} max={4} size="lg" label="Owners" />
        </Stage>
      </Specimen>

      <Specimen title="User profile menu" description="Sidebar footer. Status, credits left and account links.">
        <Stage className="flex flex-col gap-3">
          <UserProfileMenu name="Maya Rahman" email="maya@tartine.co" role="owner" workspace="Tartine Bakery · Pro" credits={1840} presence={presence} onPresenceChange={setPresence} />
          <PresenceIndicator presence={presence} />
        </Stage>
      </Specimen>

      <Specimen title="Team member list" description="Change roles inline. Owners and you can’t be removed here.">
        <Stage>
          <TeamMemberList members={members} onChange={setMembers} meId="m1" />
        </Stage>
      </Specimen>

      <Specimen title="Invite member dialog" description="Emails become chips. One role and a set of workspaces for everyone in the batch.">
        <Stage className="flex flex-wrap items-center gap-3">
          <InviteMemberDialog
            workspaces={WORKSPACES}
            seatsLeft={3}
            onInvite={(emails, r, ws) => setMembers((m) => [...m, ...emails.map((e, i) => ({ id: `inv-${m.length + i}`, name: "", email: e, role: r, workspaces: ws, lastActive: "Invited just now", invited: true }))])}
          />
          <span className="text-xs text-ink-3">3 seats left on Pro. New invites appear in the list above.</span>
        </Stage>
      </Specimen>

      <Specimen title="Role selector" description="Listbox with what each role can do. Owner needs a transfer, so it’s disabled here.">
        <Stage tone="white" className="flex flex-wrap items-center gap-4">
          <RoleSelector value={role} onChange={setRole} disabledRoles={["owner"]} />
          <RoleSelector value={role} onChange={setRole} disabledRoles={["owner"]} size="sm" aria-label="Compact role" />
          <p className="text-ui text-ink-2">
            Selected: <strong className="font-semibold">{roleLabel(role)}</strong>
          </p>
        </Stage>
      </Specimen>

      <Specimen title="Permission matrix" description="Owner always has everything; support staff is fixed read-only.">
        <PermissionMatrix permissions={PERMISSIONS} value={grid} onChange={setGrid} />
        <div className="flex items-center gap-3">
          <Button size="sm" variant="secondary" disabled={!changed} onClick={() => setGrid(DEFAULT_GRID)}>
            Reset to defaults
          </Button>
          {changed ? <Badge tone="amber">Unsaved changes</Badge> : <span className="text-xs text-ink-3">Defaults</span>}
        </div>
      </Specimen>

      <Specimen title="Access control indicator" description="Who can see an item, plus the read-only strip for view-as.">
        <Stage tone="white" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <AccessBadge level="private" />
            <AccessBadge level="team" who="Maya, Sam, Lena and 2 others" />
            <AccessBadge level="admins" who="Maya Rahman, Sam Okafor" />
            <AccessBadge level="public" who="Anyone with the link can view" />
          </div>
          {viewAs ? (
            <ViewAsBanner name="Lena Brooks" role="Member" onExit={() => setViewAs(false)} />
          ) : (
            <Button size="sm" variant="secondary" className="self-start" onClick={() => setViewAs(true)}>
              View as Lena
            </Button>
          )}
        </Stage>
      </Specimen>

      <Specimen title="User presence indicator" description="Dot plus words. Last seen for people who are away or offline.">
        <Stage tone="white" className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <PresenceIndicator presence="online" detail="Active now" />
            <PresenceIndicator presence="away" detail="Idle 20 min" />
            <PresenceIndicator presence="busy" detail="Until 3 pm" />
            <PresenceIndicator presence="offline" detail="Last seen 2 days ago" />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-ui text-ink-3">Set yours</span>
            <Segmented label="Your status" value={presence} onChange={setPresence} options={[{ value: "online", label: "Online" }, { value: "away", label: "Away" }, { value: "busy", label: "Busy" }]} />
          </div>
        </Stage>
      </Specimen>

      <Specimen title="Profile completion">
        <Stage className="max-w-lg">
          <ProfileCompletion steps={steps} onStep={(id) => setSteps((s) => s.map((x) => (x.id === id ? { ...x, done: true } : x)))} />
        </Stage>
      </Specimen>

      <Specimen title="Verification badge" description="Email, domain and business checks. Compact mark sits after a name.">
        <Stage tone="white" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <VerificationBadge status="verified" subject="Email" />
            <VerificationBadge status="verified" subject="Business" detail="Checked against Google Business Profile on 12 Oct" />
            <VerificationBadge status="pending" subject="Domain" detail="DNS records can take up to 24 hours" />
            <VerificationBadge status="unverified" subject="Phone" />
          </div>
          <p className="flex items-center gap-1.5 text-sm font-medium">
            Tartine Bakery <VerificationBadge status="verified" compact detail="Verified business" />
          </p>
          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <span className="text-ui">tartine.co</span>
            <VerificationBadge status={verify} subject="Domain" />
            {verify !== "verified" ? (
              <Button size="sm" variant="secondary" loading={verify === "pending"} loadingText="Checking DNS…" onClick={() => {
                setVerify("pending");
                window.setTimeout(() => setVerify("verified"), 1400);
              }}>
                Verify domain
              </Button>
            ) : null}
          </div>
        </Stage>
      </Specimen>

      <Specimen title="Security settings">
        <Stage className="max-w-2xl">
          <SecuritySettings />
        </Stage>
      </Specimen>

      <Specimen title="API key management" description="Keys are masked to their last 4. A new key is shown once.">
        <Stage>
          <ApiKeyManager keys={keys} onChange={setKeys} />
        </Stage>
      </Specimen>

      <Specimen title="Connected accounts">
        <Stage className="max-w-2xl">
          <ConnectedAccounts connections={conns} onChange={setConns} />
        </Stage>
      </Specimen>

      <Specimen title="Session management">
        <Stage className="max-w-2xl">
          <SessionManager sessions={sessions} onChange={setSessions} />
          {sessions.length < SESSIONS.length ? (
            <Button size="sm" variant="link" className="mt-3" onClick={() => setSessions(SESSIONS)}>
              Reset demo
            </Button>
          ) : null}
        </Stage>
      </Specimen>
    </DocPage>
  );
}
