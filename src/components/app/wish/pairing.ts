/** The fields wish pairing needs from a chat message. */
export interface PairableMessage {
  id: string;
  author: "user" | "climbos";
  replyTo: string | null;
}

/**
 * Pair each owner wish with the team's answer (newest first). Answers name the
 * wish they reply to, so two wishes in flight never swap cards; older answers
 * without that link fall back to "the next message".
 */
export function wishesFrom<M extends PairableMessage>(chat: M[]): { ask: M; answer: M | null }[] {
  const linked = new Map<string, M>();
  for (const m of chat) if (m.author === "climbos" && m.replyTo) linked.set(m.replyTo, m);
  const out: { ask: M; answer: M | null }[] = [];
  for (let i = 0; i < chat.length; i++) {
    const m = chat[i];
    if (m.author !== "user") continue;
    const next = chat[i + 1];
    out.push({ ask: m, answer: linked.get(m.id) ?? (next && next.author === "climbos" && !next.replyTo ? next : null) });
  }
  return out.reverse();
}
