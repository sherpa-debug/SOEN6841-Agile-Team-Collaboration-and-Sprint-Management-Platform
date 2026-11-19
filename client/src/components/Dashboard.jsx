import { useState } from 'react'
import Avatar from './Avatar.jsx'
import DrillDown from './DrillDown.jsx'
import { MEMBERS } from '../data/sampleData.js'
import { memberMeasures, sprintSummary } from '../lib/contribution.js'

// A number that opens the items behind it
function Metric({ value, label, onOpen, className = '' }) {
  return (
    <button type="button" className={`metric ${className}`} onClick={onOpen} aria-label={label}>
      {value}
    </button>
  )
}

// Contribution dashboard (FR5, FR9, NFR5): six measures per member, never one score
export default function Dashboard({ sprint, tasks, work, aiLog, criteria }) {
  const [drill, setDrill] = useState(null)

  if (!sprint) {
    return (
      <div className="dash-empty">
        <h1>Contribution</h1>
        <p className="muted">Choose a sprint in the top bar to see each member's contribution.</p>
      </div>
    )
  }

  const summary = sprintSummary({ sprint, tasks, work, aiLog })
  const rows = MEMBERS.map((member) => ({ member, m: memberMeasures({ member, sprint, tasks, work, aiLog }) }))
  const maxPoints = Math.max(1, ...rows.map((r) => r.m.storyPoints.value))
  const open = (title, subtitle, type, items) => setDrill({ title, subtitle, type, items })
  const sprintName = `Sprint ${sprint.number}`

  return (
    <>
      <div className="dash-head">
        <div>
          <h1>Contribution</h1>
          <p className="muted">Evidence for human judgement, not a grade · {sprintName}</p>
        </div>
      </div>

      <p className="notice" role="note">
        Commits and pull requests are <strong>sample data</strong> until GitHub sync (SP-9) is connected. Peer
        ratings arrive with the peer check-in (SP-13).
      </p>

      <div className="tiles">
        <button
          type="button"
          className="tile"
          onClick={() => open('Story points done', sprintName, 'task', summary.pointsDone.items)}
        >
          <span className="tile-label">Story points done</span>
          <span className="tile-value">
            {summary.pointsDone.value} <small>/ {summary.pointsDone.total}</small>
          </span>
        </button>
        <button
          type="button"
          className="tile"
          onClick={() => open('Linked commits', sprintName, 'work', summary.linkedCommits.items)}
        >
          <span className="tile-label">Linked commits</span>
          <span className="tile-value">{summary.linkedCommits.value}</span>
        </button>
        <button
          type="button"
          className="tile"
          onClick={() => open('Unlinked work', `${sprintName} · commits and PRs without a task key`, 'work', summary.unlinked.items)}
        >
          <span className="tile-label">Unlinked work</span>
          <span className={`tile-value${summary.unlinked.value > 0 ? ' is-alert' : ''}`}>{summary.unlinked.value}</span>
        </button>
        <button
          type="button"
          className="tile"
          onClick={() => open('AI log entries', sprintName, 'ai', summary.aiEntries.items)}
        >
          <span className="tile-label">AI log entries</span>
          <span className="tile-value">{summary.aiEntries.value}</span>
        </button>
      </div>

      <div className="table-card">
        <table className="dash-table">
          <thead>
            <tr>
              <th scope="col">Member</th>
              <th scope="col">Story points</th>
              <th scope="col">Commits / PRs</th>
              <th scope="col">Rubric tasks</th>
              <th scope="col">AI entries</th>
              <th scope="col">Peer rating</th>
              <th scope="col">Last 20% of sprint</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ member, m }) => {
              const who = `${member.name} · ${sprintName}`
              const late = Math.round(m.lateShare.value * 100)
              return (
                <tr key={member.id}>
                  <th scope="row">
                    <span className="member-cell">
                      <Avatar member={member} />
                      {member.name}
                    </span>
                  </th>
                  <td>
                    <span className="points-cell">
                      <span className="bar" aria-hidden="true">
                        <span style={{ width: `${(m.storyPoints.value / maxPoints) * 100}%` }} />
                      </span>
                      <Metric
                        value={m.storyPoints.value}
                        label={`${member.name}: ${m.storyPoints.value} story points done. Show tasks`}
                        onOpen={() => open('Story points done', who, 'task', m.storyPoints.items)}
                      />
                    </span>
                  </td>
                  <td>
                    <Metric
                      value={m.commits.value}
                      label={`${member.name}: ${m.commits.value} linked commits. Show them`}
                      onOpen={() => open('Linked commits', who, 'work', m.commits.items)}
                    />
                    <span className="slash"> / </span>
                    <Metric
                      value={m.prs.value}
                      label={`${member.name}: ${m.prs.value} linked pull requests. Show them`}
                      onOpen={() => open('Linked pull requests', who, 'work', m.prs.items)}
                    />
                  </td>
                  <td>
                    <Metric
                      value={m.rubricTasks.value}
                      label={`${member.name}: ${m.rubricTasks.value} finished rubric-tagged tasks. Show them`}
                      onOpen={() => open('Finished rubric-tagged tasks', who, 'task', m.rubricTasks.items)}
                    />
                  </td>
                  <td>
                    <Metric
                      value={m.aiEntries.value}
                      label={`${member.name}: ${m.aiEntries.value} AI log entries. Show them`}
                      onOpen={() => open('AI log entries', who, 'ai', m.aiEntries.items)}
                    />
                  </td>
                  <td>
                    <span className="muted" title="Arrives with the peer check-in (SP-13)">
                      —
                    </span>
                  </td>
                  <td>
                    <Metric
                      value={m.lateShare.flagged ? `${late}% late burst` : `${late}%`}
                      className={`pill-metric ${m.lateShare.flagged ? 'is-late' : 'is-ok'}`}
                      label={`${member.name}: ${late}% of commits and PRs in the last 20% of the sprint. Show them`}
                      onOpen={() => open('Work in the last 20% of the sprint', who, 'work', m.lateShare.items)}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="muted dash-foot">Click any number to open the tasks, commits and AI entries behind it.</p>

      {drill && <DrillDown drill={drill} criteria={criteria} onClose={() => setDrill(null)} />}
    </>
  )
}
