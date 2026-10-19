"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Bot, Check, Copy, KeyRound, ShieldCheck } from "@/components/icons"
import { useParams } from "next/navigation";
import { useState } from "react";
import { Badge, Button, Callout, Card, CardContent, CardDescription, CardHeader, CardTitle, Checkbox, EmptyState, Field, Input, Segmented, TableFrame, Table, TBody, Td, Th, THead, Tr, CellStack, toast } from "@/components/ui";
import { errorMessage } from "@/components/app/errors";
import { relativeTime } from "@/components/app/money";
import { LoadingBlock, QueryBoundary } from "@/components/app/results/QueryBoundary";
import { SettingsHeader } from "@/components/app/settings/SettingsNav";

const SCOPE_LABEL: Record<string, string> = { read: "Read", draft: "Prepare work", request_approval: "Request approvals" };

function CopyBlock({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-ink-2">{label}</span>
        <Button
          size="sm"
          variant="ghost"
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />} {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="overflow-x-auto rounded-lg border border-line bg-surface-2 p-3 font-mono text-xs leading-5 text-ink">{text}</pre>
    </div>
  );
}

/** Let external AI agents (Claude Desktop, Claude Code, ChatGPT…) use this workspace through MCP. */
/** Query errors (e.g. a role without access) show the shared error state, not a crash. */
export default function AgentsSettingsPage() {
  return (
    <QueryBoundary>
      <AgentsSettings />
    </QueryBoundary>
  );
}

function AgentsSettings() {
  const { organization: slug } = useParams<{ organization: string }>();
  const data = useQuery(api.agentTokens.list, { slug });
  const create = useMutation(api.agentTokens.create);
  const revoke = useMutation(api.agentTokens.revoke);
  const [name, setName] = useState("Claude Desktop");
  const [draft, setDraft] = useState(true);
  const [approvals, setApprovals] = useState(false);
  const [days, setDays] = useState(90);
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);
  if (data === undefined) return <LoadingBlock label="Loading agents" lines={3} />;

  const desktopConfig = (token: string) => JSON.stringify({ mcpServers: { climbos: { command: "npx", args: ["-y", "mcp-remote", data.mcpUrl, "--header", `Authorization: Bearer ${token}`] } } }, null, 2);
  const codeCommand = (token: string) => `claude mcp add --transport http climbos ${data.mcpUrl} --header "Authorization: Bearer ${token}"`;

  return (
    <div className="flex flex-col gap-6">
      <SettingsHeader title="Agents & MCP" intro="Let AI agents you already use, like Claude Desktop, Claude Code or ChatGPT, work in this workspace through the Model Context Protocol. They act as you, only within what you tick here." />

      <Callout tone="info" title="You stay in control">
        Agents can read and prepare work. Anything that would publish, schedule, approve or change settings becomes a confirmation card in your Climb AI panel. Nothing happens until you tap Confirm.
      </Callout>

      {fresh ? (
        <Card className="border-brand-200">
          <CardHeader>
            <CardTitle as="h2" className="flex items-center gap-2">
              <KeyRound aria-hidden className="size-4 text-brand-800" /> Your new agent token
            </CardTitle>
            <CardDescription>Copy it now. For your safety we only show it once.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <CopyBlock label="Token" text={fresh} />
            <CopyBlock label="Claude Code (terminal)" text={codeCommand(fresh)} />
            <CopyBlock label="Claude Desktop (claude_desktop_config.json)" text={desktopConfig(fresh)} />
            <Button variant="secondary" className="self-start" onClick={() => setFresh(null)}>
              I&apos;ve saved it
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle as="h2">Connect an agent</CardTitle>
            <CardDescription>Server address: {data.mcpUrl}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Claude Desktop" />
            </Field>
            <fieldset className="flex flex-col gap-1">
              <legend className="text-ui font-medium text-ink">What it may do</legend>
              <Checkbox label="Read this workspace" description="Overview, content, plan, results, autopilot and images." checked disabled />
              <Checkbox label="Prepare work" description="Draft posts, ads, emails and pages; refresh the plan; capture screenshots. Nothing is published." checked={draft} onCheckedChange={(v) => setDraft(Boolean(v))} />
              <Checkbox label="Request approvals" description="Ask to approve, schedule or publish posts and change autopilot. You confirm each one in ClimbOS." checked={approvals} onCheckedChange={(v) => setApprovals(Boolean(v))} />
            </fieldset>
            <fieldset className="flex flex-col gap-1.5">
              <legend className="text-ui font-medium text-ink">Expires after</legend>
              <Segmented label="Expires after" value={days} onChange={setDays} options={[{ value: 30, label: "30 days" }, { value: 90, label: "90 days" }, { value: 365, label: "1 year" }]} />
            </fieldset>
            <Button
              className="self-start"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const scopes = [...(draft ? (["draft"] as const) : []), ...(approvals ? (["request_approval"] as const) : [])];
                  const { token } = await create({ slug, name, scopes, days });
                  setFresh(token);
                } catch (e) {
                  toast({ tone: "danger", title: errorMessage(e) });
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Bot aria-hidden /> Create agent token
            </Button>
          </CardContent>
        </Card>
      )}

      <section aria-labelledby="tokens-heading" className="flex flex-col gap-3">
        <h2 id="tokens-heading" className="heading-section">
          Connected agents
        </h2>
        {data.tokens.length === 0 ? (
          <EmptyState icon={<ShieldCheck />} title="No agents connected" body="Create a token above to connect Claude Desktop, Claude Code or another MCP client." />
        ) : (
          <TableFrame>
            <Table>
              <THead>
                <tr>
                  <Th>Agent</Th>
                  <Th>Can</Th>
                  <Th>Last used</Th>
                  <Th>Expires</Th>
                  <Th className="w-24">
                    <span className="sr-only">Actions</span>
                  </Th>
                </tr>
              </THead>
              <TBody>
                {data.tokens.map((t) => (
                  <Tr key={t.id}>
                    <Td>
                      <CellStack primary={t.name} secondary={`${t.prefix}…`} />
                    </Td>
                    <Td>
                      <span className="flex flex-wrap gap-1">
                        {t.scopes.map((s) => (
                          <Badge key={s} tone={s === "request_approval" ? "amber" : s === "draft" ? "blue" : "neutral"}>
                            {SCOPE_LABEL[s] ?? s}
                          </Badge>
                        ))}
                      </span>
                    </Td>
                    <Td className="text-ink-3">{t.lastUsedAt ? relativeTime(t.lastUsedAt) : "Never"}</Td>
                    <Td className="text-ink-3">{new Date(t.expiresAt).toLocaleDateString()}</Td>
                    <Td>
                      <Button size="sm" variant="ghost" onClick={() => revoke({ slug, tokenId: t.id as Id<"agentTokens"> }).then(() => toast({ title: `Revoked ${t.name}` })).catch((e) => toast({ tone: "danger", title: errorMessage(e) }))}>
                        Revoke
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableFrame>
        )}
      </section>
    </div>
  );
}
