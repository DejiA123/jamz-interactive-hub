# Homepage: "What to expect" from Friday's schedule

## What changes
- File: `src/routes/index.tsx` only.
- Replace the current "Final event order" section (the four ordered day/time items) with a "What to expect" section built from the Friday schedule in the screenshot — a general gist, not the full detail, not in order.
- No changes to other routes, the database, or the join flow.

## New section content
- Heading changes from "Final event order" to "What to expect" (keeping the same magazine styling: icon, uppercase display headline, muted description).
- Replace the numbered day/time list with a short unordered list of general highlights distilled from Friday 16 Oct (6:00–9:30 PM):
  - A lively welcome with audience games and icebreakers
  - Worship led by Pastor Deji, Kenoly and the team
  - Live music and performances — Jo Melody, J Rose, Sodiq
  - A word on evangelism and the gifts of the Spirit
  - Teaching from Bishop/Dr Mirella
  - Testimonies and a drama ministration
  - Prayer and closing announcements
- Keep the existing list styling (bordered rows, display font, small text) but drop the day/time columns and numbering so it reads as expectations, not a timetable.
- Keep the supporting copy ("Enter your code above to join the live room…") and everything else on the page unchanged.

## Verification
- Build check clean.
- Playwright screenshot of the homepage section at desktop and mobile widths to confirm the new list renders without overlap and the join box is untouched.
