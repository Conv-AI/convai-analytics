# convai-analytics CLI

Command-line interface to the Convai analytics API. Wraps `@convai/analytics`.

```bash
npm install -g @convai/analytics-cli

export CONVAI_API_KEY=ck_live_...

convai-analytics summary --range last_24h
convai-analytics interaction int_8a31abcd1234 --json
convai-analytics session s_8a31abcd1234 --json
convai-analytics chart waterfall --interaction int_8a31abcd1234 --output trace.png
```

Run `convai-analytics --help` for the full command list.

## Why the CLI exists

- **Quick checks** that don't need a full script.
- **Shell pipelines** — pipe JSON output into `jq` / `gron` / `vd`.
- **Coding agents that prefer running commands over importing libraries.** Some agents are happier shelling out than reasoning about TypeScript imports; the CLI gives them a unified surface.

The CLI is a thin wrapper — for any non-trivial workflow, prefer the SDK directly.
