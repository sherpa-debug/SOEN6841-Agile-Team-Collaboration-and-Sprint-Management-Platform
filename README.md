# SprintProof

**Agile Team Collaboration & Sprint Management Platform**

## Project Vision

**SprintProof** is a project planning and feasibility platform designed to help software teams organize requirements, coordinate work, and manage Agile sprints. The platform will turn stakeholder needs into traceable, prioritized components and give teams a clear view of sprint progress.



## Run the Project Locally

### Prerequisites

- Node.js 20 or later
- npm 10 or later
- Git

### 1. Clone the repository

```bash
git clone https://github.com/sherpa-debug/SOEN6841-Agile-Team-Collaboration-and-Sprint-Management-Platform.git
cd SOEN6841-Agile-Team-Collaboration-and-Sprint-Management-Platform
```

### 2. Install client dependencies

```bash
cd client
npm ci
```

### 3. Start the development server

```bash
npm run dev
```

Open the local URL shown by Vite in a browser, usually:

```text
http://localhost:5173
```

To use the app immediately without GitHub credentials, leave `VITE_GITHUB_CLIENT_ID` unset. In demo mode, the GitHub sign-in button creates a local demo session. Then enter one of these invite codes:

- `ALPHA24` — joins Team Alpha
- `SPRINT1` — joins SprintProof Team

### Optional: Enable GitHub OAuth

Create a GitHub OAuth App and set its authorization callback URL to:

```text
http://localhost:5173/auth/callback
```

Create `client/.env.local`:

```env
VITE_GITHUB_CLIENT_ID=your_github_o_client_id
```

Restart the Vite development server after changing environment variables.

### Available commands

Run these commands from the `client` directory:

| Command | Purpose |
|---|---|
| `npm run dev` | Start the local development server |
| `npm test` | Run the Vitest test suite |
| `npm run build` | Create a production build in `client/dist` |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview the production build locally |

## Technology Stack

The implementation technology has not yet been finalized. Proposed technologies will be documented after the project feasibility and architectural decisions are completed.

| Area | Proposed Direction |
|---|---|
| Frontend | Web-based responsive interface |
| Backend | REST-based application services |
| Database | Relational database |
| Authentication | Role-based team access |
| Project Management | Agile sprint workflow |

##  Components and Data Flow
SprintProof is one web app. Students and instructors use it in a browser, and behind it run an API, a contribution engine, a sync job, and a database.

1. Students add their work. In the web app, team members create tasks, tag them with rubric criteria, note any AI use, and complete peer check-ins.
2. The app collects work from GitHub. The sync job regularly asks GitHub for new commits and pull requests, using each member’s own GitHub permission.
3. Each commit is linked to its task. The sync job looks for a task key such as “SP-12” in the branch, message or title. It saves the commit under that task, or in an “unlinked work” list when no key matches.
4. The numbers are kept up to date. The contribution engine recalculates each member’s numbers for the sprint from what is saved in the database.
5. Instructors and TAs check the evidence. They see the same data in a read-only view, and every number opens the tasks and commits behind it.

## Functional Requirements

| ID | Requirement | Priority | Source |
|---:|---|---|---|
| FR1 | Sign in with GitHub and join a team with an invite code. | Must | D1: GitHub integration, set up in minutes |
| FR2 | Create, assign, estimate (story points) and move tasks on a sprint board; each task gets a key such as SP-12. | Must | D1: sprint and backlog board |
| FR3 | Members tag tasks with the course's rubric criteria, which the team enters once at setup. | Must | D1: task-to-rubric linking |
| FR4 | Link commits and PRs to tasks by the key in the branch, message or title; list the rest as unlinked work. | Must | D1: commit and PR ingestion |
| FR5 | Show each member's measures per sprint side by side (story points, linked commits and PRs, rubric-tagged tasks, AI entries, peer ratings), never as one score. | Must | D1: contribution dashboard |
| FR6 | Log AI use on a task: tool, purpose, verified or not. | Must | D1: task-linked AI-usage log |
| FR7 | Give instructors and TAs a read-only view of every team's board, rubric coverage and contributions; they cannot create, edit or delete anything. | Should | D1: instructor/TA dashboard |
| FR8 | Each member rates each teammate once per sprint, with a comment. | Should | D1: short peer check-ins |
| FR9 | Flag a member's late-work share (activity in the last 20% of the sprint). | Could | D1: burst work; II.D measure 6 |

## Non-Functional Requirements

| ID | Quality | Target |
|---:|---|---|
| NFR1 | Setup time | A team creates its team, links its repository and invites members in 10 minutes or less. |
| NFR2 | Timeliness | A pushed commit appears, linked to its task, within 15 minutes (sync every 10 minutes); the dashboard loads in 3 seconds or less with 500 commits. |
| NFR3 | Access control | The API checks the role on every request; students reach only their own team; TAs and instructors have read-only access and cannot write; GitHub tokens are encrypted at rest and never sent to the browser. |
| NFR4 | Reliability | After downtime or host spin-down, the sync catches up with no missing or duplicate commits. |
| NFR5 | Explainability | Every dashboard number opens the tasks, commits and check-ins behind it, and the counts match. |

# Git Workflow

## Goal

Keep the `main` branch **clean and stable**, and reduce merge conflicts.

## Rules

### 1. Never work directly on `main`

Each person must create and work on their **own branch**.

```bash
git checkout main
git pull origin main
git checkout -b feature/your-name-task
```

Example:

```text
main
├── feature/alice-login
├── feature/bob-payment
└── feature/charlie-report
```

### 2. Commit and push to your own branch

Do your work, test it, then commit and push:

```bash
git add .
git commit -m "Describe your changes"
git push
```

### 3. Create a Pull Request

When your work is complete:

```text
Your Branch → Pull Request → main
```

**Do not merge directly into `main` without a Pull Request.**

### 4. Keep your branch updated

Before creating a Pull Request, update your branch with the latest `main`:

```bash
git checkout main
git pull origin main
git checkout feature/your-branch
git merge main
```

Resolve any conflicts **on your branch**, then push again.

### 5. Review and merge

After testing:

1. Create a Pull Request.
2. Ask another team member to review it.
3. Fix any requested changes.
4. Merge into `main`.

---

## Golden Rule

> **Work on your branch → Push → Pull Request → Review → Merge into `main`**

**Keep `main` clean. Keep your branch focused. Update your branch regularly to reduce merge conflicts.**
