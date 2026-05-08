# Prompt recipes — index

Drop-in natural-language prompts for the most common analytics questions. Each recipe in [`recipes/prompts/`](../recipes/prompts/) is a self-contained markdown file with:

- the question it answers,
- a recommended prompt to give the agent verbatim,
- the SDK call(s) the agent should make,
- a follow-up worth asking next.

## Latency / debugging

- [why-was-this-session-slow.md](../recipes/prompts/why-was-this-session-slow.md) — full debugging walkthrough for a slow session.
- [aggregate-latency-distribution.md](../recipes/prompts/aggregate-latency-distribution.md) — aggregate P50/P95/P99 latency bands for systemic trend analysis and production sign-off.
- [p95-latency-trend.md](../recipes/prompts/p95-latency-trend.md) — track p95 end-to-end latency over time, optionally split by character.
- [component-bottlenecks.md](../recipes/prompts/component-bottlenecks.md) — which processor (LLM / TTS / Neurosync / ...) contributes most to p95.
- [trace-explanation.md](../recipes/prompts/trace-explanation.md) — explain what happened in a single interaction id.

## Errors & reliability

- [error-rate-trends.md](../recipes/prompts/error-rate-trends.md) — error rate over time, by component, by provider.

## Provider / model

- [provider-comparison.md](../recipes/prompts/provider-comparison.md) — compare LLM/TTS provider latency and reliability.

## Usage

- [usage-summary.md](../recipes/prompts/usage-summary.md) — sessions, audio minutes, end users by character/experience.

## How agents should use these

In a coding-agent session, point the agent at a recipe directly:

> Read `recipes/prompts/why-was-this-session-slow.md` and apply it to session `s_8a31...`.

The agent reads the recipe, performs the SDK calls listed there, and follows up using the suggested next-step. This is much more reliable than the agent guessing the right calls cold.
