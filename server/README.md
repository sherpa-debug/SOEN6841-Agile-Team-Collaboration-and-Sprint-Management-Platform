# SprintProof API

Starter Express API and PostgreSQL connection for the SprintProof schema.

## Run locally

From the `server` directory:

```bash
npm ci
$env:DATABASE_URL="postgres://user:password@localhost:5432/sprintproof"
npm run dev
```

Set `CLIENT_ORIGIN` to the frontend origin if it differs from `http://localhost:5173`. The server listens on port `3000` by default; set `PORT` to change it.

Apply the initial database schema from the repository root with:

```bash
psql -d sprintproof -f server/db/schema.sql
```

Available initial endpoints:

| Method | Path | Purpose |
|---|---|---|
| GET | `/` | API landing response |
| GET | `/api` | API name and endpoint listing |
| GET | `/api/health` | Liveness check |
| GET | `/api/health/database` | PostgreSQL readiness check |

Resource routes, authentication, and authorization are not implemented yet. Do not expose this starter API to untrusted clients until request-level authentication and role/team authorization are added.
