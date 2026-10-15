# Fix the Host Studio passcode

## What's wrong
The Host Studio sign-in screen doesn't check the passcode saved in the backend. It compares what you type against an old passcode written straight into the app ("VIRTUALKEYS"). So the new passcode, TheGospel123, was saved in the backend but the sign-in screen never looks at it.

## Fix
- The sign-in screen will check what you type against the saved passcode in the backend. That's the same check the Studio already uses when you remove players.
- Remove the old passcode from the app, so the only working passcode is the one saved in the backend.
- Show a "Checking..." state while it verifies. A wrong passcode still shows the same error message.
- Capitals or small letters won't matter, and spaces before or after are ignored.

## Result
Typing **TheGospel123** opens the Host Studio, in the preview and in the published app once you publish. Typing VIRTUALKEYS no longer works.

## Technical details
- `src/lib/live-sync.ts`: delete the `HOST_PASSCODE` constant. Make `verifyAndSetHostPasscode` async: it calls `supabase.rpc("check_host_passcode", { p_passcode })` and only sets the auth flags and remembers the passcode when the result is `true`.
- `src/routes/auth.tsx`: `await` the async check in `submit`, keep `busy` on while it runs, and show the error when it returns false or fails.
- Check that `check_host_passcode` can be called by visitors who aren't signed in, because the sign-in screen has no session yet. The Studio's remove-player prompt already calls it, so this is expected to work.
- Test it in the browser: TheGospel123 opens the Studio; a wrong passcode shows the error.
