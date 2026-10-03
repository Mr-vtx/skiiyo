# skiiyo console

A tiny reference client for the skiiyo backend — not a real product, a
stress-test harness. It exercises every route in the API through a real
browser (real CORS, real multipart upload, real JWT flow) so you can confirm
the backend genuinely works end to end, not just that the code compiles.

Every request and response is shown live in the right-hand activity log.

## What it covers

- **Auth** — register, login, Google sign-in (optional), refresh token,
  logout, forgot/reset password, verify email
- **Profile** — view and edit
- **Avatar** — real multipart upload (needs Cloudinary configured on the
  backend — otherwise you'll see a clean 503 in the log, which is itself a
  useful confirmation that the backend fails gracefully)
- **Settings** — arbitrary JSON, whole-object replace
- **Notifications** — list, mark-all-read, delete (a welcome notification is
  created automatically on signup, so there's always at least one to see)
- **Admin** — `/admin/stats`, gated behind an admin role

## Run it

1. Start the skiiyo backend first (see its own README). By default this
   console expects it at `http://localhost:8000/api/v1`.
2. `npm start` (no install needed — zero dependencies, just Node's built-in
   `http` module).
3. Open `http://localhost:5173`.

If your backend runs somewhere else, or you're testing a non-default
project, edit `public/config.js`.

## Testing the Admin tab

There's no self-serve way to become an admin yet (that's dashboard work).
For now, register a user through this console, then on the backend run:

```bash
node scripts/makeAdmin.js you@example.com
```

Log out and back in in the console (role is baked into the JWT), then Admin
→ Fetch stats should work.

## Testing Google sign-in

Optional. Set `GOOGLE_CLIENT_ID` in `public/config.js` to the same value as
`GOOGLE_CLIENT_ID` in the backend's `.env`. Leave both blank to skip — every
other tab works without it.

## CORS

The backend's `ALLOWED_ORIGINS` env var needs to include wherever this
console is running — `http://localhost:5173` if you used the default port.
