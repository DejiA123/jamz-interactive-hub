# Better saving for minister feedback

## What you will get

**1. A fresh name box every time you go live**
- Keep one "Minister feedback" moment in the run of show.
- Pressing **Go live** on it opens a small box asking "Who is ministering now?" — always blank.
- Type the name, press Go live. That starts a new feedback round just for that person.
- Ending it saves everything. Next minister: press Go live again, type the next name.

**2. A Feedback archive in the Host Studio**
- New "Feedback archive" section listing every minister who has had feedback, newest first.
- Each shows the minister's name, the time, how many messages, and every message people wrote.
- Messages stay saved after the round ends or the room closes. Nothing is deleted automatically.
- A "Copy all" button so you can paste the messages to send to the minister.

**3. You decide if the audience can see past feedback**
- Each minister in the archive has a switch: **Show to audience** (off by default).
- When on, the audience screen shows a "Words of encouragement" section with that minister's messages (no names of who wrote them).
- Switch off any time to hide them again.

## Technical details
- Add `feedback_public boolean not null default false` to `activities` (migration).
- Each "Go live" on a rating moment inserts a new rating activity (same prompt, minister name as its single option) and publishes it; the template moment itself stays unpublished as the reusable starter. Past rounds keep their own responses (unique answer per person per round still holds).
- Hide past feedback rounds from the run-of-show list; show them in the new archive panel, loaded with `fetchResponses`.
- Toggle updates `feedback_public`; `play.$code.tsx` loads rating activities with `feedback_public = true` and their text answers, refreshing via the existing realtime channel.
- Builder: for Minister feedback, the name field becomes optional (asked at Go live instead).
- Verify in the browser: two rounds with different names, messages saved after End, archive shows both, toggle shows/hides on the audience screen.
