// Sample data used until Ming's API is ready.
// Field names follow the D3 data model (task: key, sprint_id, assign_id, type, points, status).

export const TEAM = { id: 1, name: 'Team Alpha' }

export const MEMBERS = [
  { id: 1, name: 'Moncef' },
  { id: 2, name: 'Ming' },
  { id: 3, name: 'Anusha' },
  { id: 4, name: 'Tanzir' },
]

// The person using the app (will come from GitHub sign-in later)
export const CURRENT_USER_ID = 1

export const SPRINTS = [
  { id: 1, number: 1, start: '2026-11-09', end: '2026-11-22' },
  { id: 2, number: 2, start: '2026-11-23', end: '2026-12-06' },
]

export const STATUSES = [
  { id: 'todo', label: 'To do' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'done', label: 'Done' },
]

export const TASK_TYPES = ['Requirements', 'Design', 'Implementation', 'Testing', 'Documentation']

export const POINT_OPTIONS = [1, 2, 3, 5, 8, 13]

// Course rubric, entered once at setup (can be edited with "Edit rubric")
export const SAMPLE_CRITERIA = [
  { id: 1, name: 'Requirements' },
  { id: 2, name: 'Design' },
  { id: 3, name: 'Implementation' },
  { id: 4, name: 'Testing' },
  { id: 5, name: 'Project management' },
]

// Our own SprintProof backlog, so the demo shows real work
export const SAMPLE_TASKS = [
  { key: 'SP-1', title: 'Repo setup, schema and API skeleton', sprintId: 1, assigneeId: 2, type: 'Implementation', points: 5, criteria: [3], status: 'done' },
  { key: 'SP-2', title: 'Sprint board', sprintId: 1, assigneeId: 1, type: 'Design', points: 8, criteria: [2, 3], status: 'in_progress' },
  { key: 'SP-3', title: 'GitHub sign-in and invite code', sprintId: 1, assigneeId: 2, type: 'Implementation', points: 5, criteria: [3], status: 'in_progress' },
  { key: 'SP-4', title: 'Contribution engine', sprintId: 1, assigneeId: 4, type: 'Implementation', points: 8, criteria: [3], status: 'in_progress' },
  { key: 'SP-5', title: 'Deploy and CI', sprintId: 1, assigneeId: 3, type: 'Testing', points: 3, criteria: [4], status: 'todo' },
  { key: 'SP-6', title: 'Rubric tagging', sprintId: 1, assigneeId: 1, type: 'Design', points: 3, criteria: [2], status: 'todo' },
  { key: 'SP-7', title: 'Task-key linking', sprintId: 1, assigneeId: 4, type: 'Implementation', points: 3, criteria: [3, 4], status: 'todo' },
  { key: 'SP-8', title: 'AI log on tasks', sprintId: 1, assigneeId: 1, type: 'Implementation', points: 3, criteria: [3], status: 'todo' },
  { key: 'SP-9', title: 'GitHub commit and PR sync', sprintId: 1, assigneeId: 2, type: 'Implementation', points: 8, criteria: [3], status: 'todo' },
  { key: 'SP-10', title: 'Access control', sprintId: 1, assigneeId: 4, type: 'Implementation', points: 3, criteria: [3, 4], status: 'todo' },
  { key: 'SP-11', title: 'Dashboard screen', sprintId: 2, assigneeId: 1, type: 'Design', points: 5, criteria: [2], status: 'todo' },
  { key: 'SP-12', title: 'Instructor/TA read-only view', sprintId: 2, assigneeId: 4, type: 'Implementation', points: 5, criteria: [3], status: 'todo' },
  { key: 'SP-13', title: 'Peer check-in', sprintId: 2, assigneeId: 1, type: 'Implementation', points: 3, criteria: [2], status: 'todo' },
  { key: 'SP-14', title: 'Integration and regression tests', sprintId: 2, assigneeId: 3, type: 'Testing', points: 5, criteria: [4], status: 'todo' },
  { key: 'SP-15', title: 'Acceptance tests and usability session', sprintId: 2, assigneeId: 4, type: 'Testing', points: 3, criteria: [1, 4], status: 'todo' },
]
