# Convai Evals Report Drilldown

You are given a `convai-evals` JSON report. Use the report as the source of truth for row-level behavior and latency. Rank failed or slow rows by `failure_reason`, `structure_match.overall`, and `latency.end_to_end_ms`.

For each row, preserve `test_id`, `session_id`, `backend.session_id`, `backend.character_session_id`, `backend.turn_id`, and `backend.character_id`. When `backend.session_id` is available, call `client.sessions.get(...)` to inspect the session timeline. When an interaction ID is available, call `client.interactions.get(...)` to inspect component spans. For aggregate context, call `client.latency.byComponent(...)` or `client.breakdown(...)` filtered by `report.run_metadata.characterId`.

Return a concise table of suspected bottlenecks, the evidence from the eval report, the analytics calls made, and the next action.
