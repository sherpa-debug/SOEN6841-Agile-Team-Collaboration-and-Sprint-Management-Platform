# SprintProof API

Starter Express API and PostgreSQL connection for the SprintProof schema.

## Run locally

From the `server` directory:

```bash
npm ci
cp .env.example .env
npm run dev
```

Create a [GitHub OAuth App](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app) with callback `http://localhost:5173/api/auth/callback`. Set `DATABASE_URL`, `OAUTH_CLIENT_ID`, `OAUTH_CLIENT_SECRET`, `APP_ORIGIN`, and a random `SESSION_SECRET` of at least 32 characters in `.env`. Keep OAuth credentials and the session key on the server. `APP_ORIGIN` determines the callback URL and allowed write-request origin. The server listens on port `3000` by default; set `PORT` to change it.
Apply the initial database schema from the repository root with:

```bash
psql -d sprintproof -f server/db/schema.sql
```

Available initial endpoints:

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

## GitHub sync (SP-9)

The API keeps each team's commits and pull requests up to date from GitHub (FR4, NFR2, NFR4). Code is in `src/sync/`.

1. Create the extra table once, after `schema.sql`: `psql -d sprintproof -f server/db/sync_state.sql`.
2. Set `GITHUB_TOKEN` to a read-only token that can read the repositories, and `DATABASE_URL`. Without both the API still runs, with sync off. The token stays on the server and is never logged or sent to the browser.
3. Put each team's repository in `team.repo` as `owner/name`. Every 10 minutes (`SYNC_INTERVAL_MS` changes it) the job reads the commits and pull requests of every team that has one.

How it behaves:

- A commit is linked to a task by the first known key (`SP-12`, any letter case) in its message; if that has none, by the key in its pull request's branch or title. Anything else is saved as unlinked work, never dropped. A task created later picks up its earlier commits on the next run.
- The author is matched to a team member by GitHub login, then by the login inside a GitHub `noreply` address, then by e-mail. Authors who are not on the team are reported, not guessed.
- Each run starts a few minutes before the last successful one and saves commits by `sha`, so a run after downtime catches up and a repeat run makes no duplicates. A failed run (rate limit, bad token) keeps the old last-sync time.
- Pull request lists use `If-None-Match`, so an unchanged list costs no rate limit.

Proof of concept (D3, section V): `node scripts/poc-sync.js --live owner/name --members login1,login2` prints how many commits were linked, how many authors matched and how long it took. Save the lists with `gh api --paginate --slurp` and use `--commits`/`--pulls` to run it offline.

Not done yet: per-member tokens encrypted at rest (SP-3), role checks on API routes (SP-10 on the server), and a manual "link this commit" action.

Resource routes, authentication, and authorization are not implemented yet. Do not expose this starter API to untrusted clients until request-level authentication and role/team authorization are added.
