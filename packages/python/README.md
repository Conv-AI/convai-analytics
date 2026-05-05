# convai-analytics (Python)

Python SDK for the Convai analytics API.

```python
from convai_analytics import ConvaiAnalytics

client = ConvaiAnalytics(api_key=os.environ["CONVAI_API_KEY"])

summary = client.summary(range="last_24h")
trace = client.interactions.get("int_8a31...")
```

See the [repo root](../../) for full docs, recipes, and examples.

## API surface

Mirrors the TypeScript SDK one-for-one:

```python
client.summary(range="last_24h")
client.timeseries(measure="turn_p95", metric_name="voice.user_to_bot_latency", granularity="hour")
client.breakdown(measure="turn_p95", group_by="processor", segment="end_to_end_turn_latency")

client.sessions.list(range="last_24h")
client.sessions.get(session_id)
client.interactions.get(interaction_id)
client.catalog()

# Convenience facades
client.latency.by_component(character_id="...", range="last_24h")
client.providers.compare(component="llm", range="last_7d")
client.errors.summary(range="last_24h")
client.usage.summary(group_by="character_id", range="last_30d")

# Advanced (business+)
client.regression_detection(baseline_range="last_7d", current_range="last_24h", measure="turn_p95")
client.query(cube_query)
```

Naming convention: `snake_case` in Python (idiomatic), automatically translated to `camelCase` on the wire.
