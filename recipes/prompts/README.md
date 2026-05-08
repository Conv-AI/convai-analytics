# Prompt recipes

Drop-in natural-language prompts for the most common analytics questions. Point a coding agent at the relevant file and it will know which SDK calls to make.

| Recipe | Question |
|---|---|
| [why-was-this-session-slow.md](why-was-this-session-slow.md) | Diagnose latency for one specific session, end to end. |
| [aggregate-latency-distribution.md](aggregate-latency-distribution.md) | Chart aggregate P50/P95/P99 latency for production sign-off. |
| [p95-latency-trend.md](p95-latency-trend.md) | Track p95 e2e latency over time, optionally split by character. |
| [component-bottlenecks.md](component-bottlenecks.md) | Which processor (LLM / TTS / Neurosync / ...) drives p95? |
| [trace-explanation.md](trace-explanation.md) | Explain what happened in a single interaction id. |
| [error-rate-trends.md](error-rate-trends.md) | Error rate over time and by component. |
| [provider-comparison.md](provider-comparison.md) | Compare LLM/TTS provider latency and reliability. |
| [usage-summary.md](usage-summary.md) | Sessions, audio minutes, end users by character/experience. |

## Format

Each recipe is a short markdown file with four sections:

1. **The question** — what this recipe answers, in customer language.
2. **Prompt to give the agent** — verbatim text the user can paste.
3. **What the agent should do** — explicit SDK call sequence so the agent doesn't have to guess.
4. **Follow-up worth asking** — the natural next question, since debugging is exploratory.

## Why this exists

Coding agents are dramatically better when they have a reference for "the right way to answer this question with this SDK." Without recipes, the agent has to guess at parameter shapes from docs and types. With recipes, the agent reads one short file and gets an authoritative answer pattern.

These recipes also become the source for MCP tool definitions in Phase 7 — each recipe's "what the agent should do" section maps to one MCP tool.
