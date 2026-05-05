"""session_timeline.py

Question: "Show me the event timeline for one session — every metric on a
time axis, color-coded by component."

Input:  --session <id>      session id to render
        --output <path>     output HTML (default) or .png
Output: Plotly timeline (one row per metric, time x-axis)

Calls: client.sessions.get(session_id)

Run:
    uv run recipes/charts/session_timeline.py --session s_8a31abcd1234 --output timeline.html
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from convai_analytics import ConvaiAnalytics


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    p.add_argument("--session", required=True, help="Session id")
    p.add_argument("--output", default="timeline.html", help="Output path (.html or .png)")
    args = p.parse_args()

    try:
        import plotly.express as px  # noqa: PLC0415
    except ImportError:
        sys.stderr.write("error: this recipe requires plotly. Install with: pip install plotly\n")
        sys.exit(1)

    client = ConvaiAnalytics()
    session = client.sessions.get(args.session)

    if not session.events:
        sys.stderr.write(f"no events for session {args.session}\n")
        sys.exit(1)

    # Plotly's timeline expects a duration; for instant events use a 50ms bar.
    rows = []
    for e in session.events:
        rows.append(
            {
                "metric": e.metric_name,
                "processor": e.processor or "other",
                "start": e.event_time,
                "interaction": e.interaction_id or "(session-level)",
                "value": e.value,
            },
        )

    fig = px.scatter(
        rows,
        x="start",
        y="metric",
        color="processor",
        hover_data=["value", "interaction"],
        title=f"Session {args.session} — {len(rows)} events",
    )
    fig.update_layout(height=max(400, len(set(r["metric"] for r in rows)) * 24))

    out = Path(args.output)
    if out.suffix.lower() == ".png":
        try:
            fig.write_image(str(out))
        except Exception as e:
            sys.stderr.write(
                f"error: PNG export requires 'kaleido' (pip install -U kaleido). {e}\n",
            )
            sys.exit(1)
    else:
        fig.write_html(str(out))
    sys.stderr.write(f"wrote {out}\n")


if __name__ == "__main__":
    main()
