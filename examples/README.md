# Examples

Runnable end-to-end scripts. For library-style snippets see `packages/*/README.md`; for question-driven recipes see `recipes/`.

| Example | Language | What it does |
|---|---|---|
| [node/account-summary.ts](node/account-summary.ts) | TypeScript | Pulls the account-level KPIs (sessions, p95 e2e latency, etc.) for an arbitrary range and optional character filter. |
| [node/why-was-this-session-slow.ts](node/why-was-this-session-slow.ts) | TypeScript | Implements the [`why-was-this-session-slow`](../recipes/prompts/why-was-this-session-slow.md) recipe end-to-end: pulls a session, finds the slowest interaction, prints its component waterfall and identifies the bottleneck. |

## Run

```bash
export CONVAI_API_KEY=ck_live_...
cd examples/node

npx tsx account-summary.ts last_24h
npx tsx why-was-this-session-slow.ts s_8a31abcd1234
```
