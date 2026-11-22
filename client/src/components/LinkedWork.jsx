import { MEMBERS } from '../data/sampleData.js'

// "2026-11-17T18:30" -> "Nov 17"
function formatDay(value) {
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Commits and pull requests linked to a task by its key (FR4, D3 Fig. 4)
export default function LinkedWork({ taskKey, items }) {
  return (
    <div className="panel-section">
      <h3 className="section-label">
        Linked work <span className="work-count">{items.length}</span>
      </h3>

      {items.length === 0 ? (
        <p className="muted">
          No commits or pull requests mention {taskKey} yet. Put <code>{taskKey}</code> in a commit message or PR
          title to link it.
        </p>
      ) : (
        <ul className="linked-list">
          {items.map((item) => (
            <li key={`${item.kind}-${item.id}`} className="linked-item">
              <span className={`work-kind work-kind--${item.kind}`}>{item.kind === 'pr' ? 'PR' : 'Commit'}</span>
              <code>{item.id}</code>
              <span className="linked-label">{item.label}</span>
              <span className="linked-meta">
                {MEMBERS.find((m) => m.id === item.authorId)?.name ?? 'Unknown'} · {formatDay(item.date)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
