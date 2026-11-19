// SAMPLE commits and pull requests, shown on the dashboard until GitHub sync (SP-9)
// brings the real ones. Task keys (SP-n) in messages and titles link work to tasks.
// authorId matches MEMBERS in sampleData.js.

export const SAMPLE_COMMITS = [
  { sha: '3f1c2a90', authorId: 2, message: 'SP-1 add README and pull request rules', date: '2026-11-18T14:10' },
  { sha: '8b7d4e21', authorId: 2, message: 'SP-1 database schema for teams, sprints and tasks', date: '2026-11-18T16:40' },
  { sha: 'c42e9f03', authorId: 2, message: 'SP-1 Express API skeleton', date: '2026-11-19T11:05' },
  { sha: '1a9b7c55', authorId: 1, message: 'SP-2 sprint board with task keys, drag and drop, and T2 test', date: '2026-11-17T18:30' },
  { sha: '5d0e6f12', authorId: 1, message: 'SP-6 rubric criteria, task tagging and coverage (T3)', date: '2026-11-17T18:46' },
  { sha: '9e3a1b77', authorId: 1, message: 'SP-8 AI log on tasks (T6)', date: '2026-11-17T19:02' },
  { sha: '04d6aa31', authorId: 1, message: 'SP-8 T6: count AI entries per member', date: '2026-11-19T10:12' },
  { sha: '04d67f20', authorId: 1, message: 'SP-16 add AI log file (course requirement)', date: '2026-11-19T10:27' },
  { sha: 'e7f20c48', authorId: 4, message: 'SP-4 contribution measures per member', date: '2026-11-17T13:20' },
  { sha: 'a8c3d916', authorId: 4, message: 'SP-4 hand-computed test data for T5', date: '2026-11-18T20:05' },
  { sha: 'f2b6e804', authorId: 3, message: 'SP-5 CI workflow runs tests on every push', date: '2026-11-19T09:40' },
  { sha: '6c1d0b2e', authorId: 3, message: 'fix typo in README', date: '2026-11-19T09:55' },
]

export const SAMPLE_PULL_REQUESTS = [
  { number: 1, authorId: 1, title: 'SP-2 Sprint board', date: '2026-11-17T18:35' },
  { number: 2, authorId: 1, title: 'SP-6 Rubric tagging', date: '2026-11-17T18:47' },
  { number: 3, authorId: 1, title: 'SP-8 AI log', date: '2026-11-17T19:05' },
  { number: 4, authorId: 1, title: 'SP-16 AI log file', date: '2026-11-19T10:31' },
  { number: 5, authorId: 2, title: 'SP-1 Repository setup and schema', date: '2026-11-19T11:30' },
]
