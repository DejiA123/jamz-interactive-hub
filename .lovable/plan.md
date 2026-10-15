# Engagement ranking — polish the "Most engaged" board

## Current state (verified)

The engagement ranking already exists and works:

- `src/components/engagement-board.tsx` ranks people by how many times they took part (quiz answers, drama verdicts, panel questions, minister feedback, challenges). It refreshes every 8 seconds, shows the top 5 in the live room with the viewer's own row marked "You", and the top 10 in the Host Studio.
- The live room (`src/routes/play.$code.tsx`) shows it under the scoreboard, and the Host Studio has a "Show to audience" switch (`session.show_engagement`) that hides it from the audience while the host still sees it.

What's missing is presentation: the ranking reads as a plain numbered list, not a striking ranked board.

## Plan

1. **Ranked podium styling in the engagement board** (`src/components/engagement-board.tsx`)
   - Position 1 / 2 / 3 get distinct medal treatment: gold, silver, bronze rank badges (tokens from the existing palette — flame gold as gold, chrome silver as silver, muted bronze).
   - Rank 1 row gets a subtle highlighted background and a small crown/trophy accent.
   - Rows 4+ keep the current understated number style.
   - Keep the existing data logic untouched: same counting, sorting, 8-second refresh, "You" highlight, limit prop.

2. **Verify the full flow in the browser**
   - Join the demo room with a nickname, submit a few responses of different kinds, confirm the board ranks and updates, confirm the host Studio top-10 view matches, and confirm the audience toggle hides/shows the board live.

## Out of scope

- No database or scoring changes; the ranking still counts participation, not points.

## Verification

- Build must be clean; Playwright pass on the live room (desktop + mobile) with no console errors.
