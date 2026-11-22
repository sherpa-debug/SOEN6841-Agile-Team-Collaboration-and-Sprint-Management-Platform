# SprintProof API

Express API for GitHub OAuth sign-in, signed sessions, PostgreSQL-backed teams, and expiring team invitations.

## Run locally

From the `server` directory:

```bash
npm ci
cp .env.example .env
npm run dev
```

Create a [GitHub OAuth App](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app] with) callback `http://localhost:5173/api/auth/callback`. Set `DATABASE_URL`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `APP_ORIGIN`, and a random `SESSION_SECRET` of at least 32 characters in `.env`. Keep OAuth credentials and the session key on the server. `APP_ORIGIN` determines the callback URL and allowed write-request origin. The server listens on port `3000` by default; set `PORT` to change it.

Create the `sprintproof` database, then apply (or reapply) the schema from the repository rc
```bash
psql -d sprintproof -f server/db/schema.sql
```

Authentication and team endpoints:

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/auth/github` | Begin GitHub OAuth |
| GET | `/api/auth/callback` | Verify OAuth state, exchange the code, and set a signed session cookie |
| GET | `/api/auth/session` | Return the authenticated profile and team |
| POST | `/api/auth/logout` | Clear the session cookie |
| POST | `/api/teams` | Create a team and join its creator |
| POST | `/api/teams/invites` | Create a seven-day team invitation |
| POST | `/api/teams/join` | Join a team using an invitation code |
| GET | `/api/health` | Liveness check |
| GET | `/api/health/database` | PostgreSQL readiness check |

Invite codes use cryptographic randomness and only their hashes are persisted. Session and OAuth state cookies are HttpOnly and SameSite=Lax (Secure in production). In production, serve the frontend and API on one origin or proxy `/api/*` to the API; configure the GitHub callback as `<APP_ORIGIN>/api/auth/callback`. Existing task, rubric, and check-in resources still use local demo data and are not backed by these account/team records.
