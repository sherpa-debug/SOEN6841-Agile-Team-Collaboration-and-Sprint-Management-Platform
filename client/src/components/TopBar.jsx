import Avatar from './Avatar.jsx'
import Logo from './Logo.jsx'
import { CURRENT_USER_ID, MEMBERS, SPRINTS, TEAM } from '../data/sampleData.js'

export default function TopBar({ sprintId, onSprintChange }) {
  const me = MEMBERS.find((m) => m.id === CURRENT_USER_ID)

  function handleChange(event) {
    const value = event.target.value
    onSprintChange(value === 'backlog' ? 'backlog' : Number(value))
  }

  return (
    <header className="topbar">
      <div className="topbar-brand">
        <Logo />
        <span className="team-chip">{TEAM.name}</span>
      </div>

      <nav className="topbar-nav" aria-label="Main">
        <a className="nav-link active" href="#board" aria-current="page">
          Board
        </a>
        <span className="nav-link disabled" title="Coming in Sprint 2">
          Dashboard
        </span>
        <span className="nav-link disabled" title="Coming in Sprint 2">
          Check-in
        </span>
      </nav>

      <div className="topbar-right">
        <label className="visually-hidden" htmlFor="sprint-select">
          Sprint
        </label>
        <select id="sprint-select" className="sprint-select" value={String(sprintId)} onChange={handleChange}>
          {SPRINTS.map((s) => (
            <option key={s.id} value={s.id}>
              Sprint {s.number}
            </option>
          ))}
          <option value="backlog">Backlog</option>
        </select>
        <Avatar member={me} light />
      </div>
    </header>
  )
}
