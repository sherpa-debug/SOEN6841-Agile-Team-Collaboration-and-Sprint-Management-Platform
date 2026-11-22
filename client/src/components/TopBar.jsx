import Avatar from './Avatar.jsx'
import Logo from './Logo.jsx'
import { SPRINTS } from '../data/sampleData.js'

export default function TopBar({ view, sprintId, session, readOnly = false, role, onSprintChange, onSignOut, onInvite }) {
  const me = { id: 1, name: session.name, avatarUrl: session.avatarUrl }

  function handleChange(event) {
    const value = event.target.value
    onSprintChange(value === 'backlog' ? 'backlog' : Number(value))
  }

  return (
    <header className="topbar">
      <div className="topbar-brand">
        <Logo />
        <span className="team-chip">{session.team.name}</span>
        {readOnly && <span className="team-chip">{role === 'instructor' ? 'Instructor' : 'TA'} · read-only</span>}
      </div>

      <nav className="topbar-nav" aria-label="Main">
        <a
          className={`nav-link${view === 'board' ? ' active' : ''}`}
          href="#board"
          aria-current={view === 'board' ? 'page' : undefined}
        >
          Board
        </a>
        <a
          className={`nav-link${view === 'dashboard' ? ' active' : ''}`}
          href="#dashboard"
          aria-current={view === 'dashboard' ? 'page' : undefined}
        >
          Dashboard
        </a>
        <a
          className={`nav-link${view === 'checkin' ? ' active' : ''}`}
          href="#checkin"
          aria-current={view === 'checkin' ? 'page' : undefined}
        >
          Check-in
        </a>
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
        {!readOnly && onInvite && <button type="button" className="topbar-invite" onClick={onInvite}>Invite</button>}
        {onSignOut && (
          <button type="button" className="topbar-signout" onClick={onSignOut}>
            Sign out
          </button>
        )}
      </div>
    </header>
  )
}
