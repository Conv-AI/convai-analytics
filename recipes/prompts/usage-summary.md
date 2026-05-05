# Usage summary

Sessions, audio minutes, and unique end users — by character or experience.

## The question

> How many unique end users did each of my characters have this month? Which character drove the most sessions?

## Prompt to give the agent

```
For the last 30 days, give me a table of sessions and unique end users per
character, sorted by sessions descending.
```

## What the agent should do

```ts
const sessionsByChar = await client.usage.summary({
  range: "last_30d",
  groupBy: "characterId",
});
// .rows is already a list of { group: characterId, value: uniqueSessions, sampleCount: ... }

// To also get interaction count per character:
const interactionsByChar = await client.usage.interactions({
  range: "last_30d",
  groupBy: "characterId",
});
```

## Follow-up worth asking

> Which experience (or UE app) drove the most usage?

```ts
const byExperience = await client.usage.summary({ range: "last_30d", groupBy: "experienceId" });
```
