## Reference: reply labels, signals and actions

Check rows in this order; the first match wins the primary label.

| Order | Label | Typical signals | System actions | Draft default |
|---|---|---|---|---|
| 1 | Out of office / auto-reply | Auto-Submitted or Precedence headers; "Automatic reply", "Out of office", "Abwesenheitsnotiz", "Réponse automatique", "Fuera de la oficina", "will be back on"; ticket acknowledgements | Reschedule next step to return date + 1 business day (no date: 5 business days); ticket systems stop the sequence | No reply, ever |
| 2 | Left the company | "No longer with", "has left", bounce-like human notes | Mark address invalid; log any named replacement as a referral candidate | No reply |
| 3 | Unsubscribe | "no" or "stop" answering the opt-out line, "remove me", "unsubscribe", "don't email me" | Suppress immediately (system); stop sequence | None, or one line confirming removal if they asked |
| 4 | Angry / complaint | Anger, "spam", "reporting you", legal threats | Suppress immediately; alert owner; counts towards the negative-reply breaker | Optional short apology plus removal confirmation; owner decides |
| 5 | Data request | "Where did you get my details?", "what do you hold?", "delete my data" | Alert owner (legal request with a deadline); suppress or delete if asked | Truthful source, confirmation, privacy notice pointer |
| 6 | Positive / interested | "Yes", "send it", "sounds good", "let's talk" | Stop sequence; urgent owner alert | Deliver the promised item, then two time options or a booking link |
| 7 | Question | "How much?", "how does it work?", "who else uses it?" | Stop sequence | Direct answer from facts, light next step |
| 8 | Objection | "We already have someone", "too expensive", "tried it" | Stop sequence | Acknowledge, one proof or clarifying question, smaller step |
| 9 | Not now | "Not this quarter", "try me in January" | Stop sequence; one check-in only with permission or a named date | Thank, confirm timing, ask permission |
| 10 | Not interested | "Not for us, thanks" | Stop sequence; no further outreach from this sender | Optional one-line gracious close |
| 11 | Wrong person / referral | "Not my area", "speak to Dana" | Stop sequence; log referral for compliance checks and owner approval | Short thank-you |
| 12 | Other / unclear | Anything else | Stop sequence; route to owner | Owner decides |
