// Shows which rubric criteria already have tasks (covered) and which have none yet.
export default function RubricCoverage({ coverage, onEdit }) {
  const coveredCount = coverage.filter((item) => item.covered).length

  return (
    <section className="coverage" aria-label="Rubric coverage">
      <div className="coverage-head">
        <h2>Rubric coverage</h2>
        <span className="muted">
          {coveredCount} of {coverage.length} criteria have tasks · all sprints
        </span>
        {onEdit && (
          <button type="button" className="link-button" onClick={onEdit}>
            Edit rubric
          </button>
        )}
      </div>

      {coverage.length === 0 ? (
        <p className="muted">
          {onEdit ? 'No rubric yet. Click “Edit rubric” to enter your course criteria.' : 'No rubric yet.'}
        </p>
      ) : (
        <ul className="coverage-list">
          {coverage.map(({ criterion, taskKeys, covered }) => (
            <li
              key={criterion.id}
              className={`coverage-item ${covered ? 'is-covered' : 'is-missing'}`}
              title={covered ? `Tasks: ${taskKeys.join(', ')}` : 'No task covers this yet'}
            >
              <span aria-hidden="true">{covered ? '✓' : '!'}</span>
              <span>{criterion.name}</span>
              <span className="coverage-count">
                {taskKeys.length} {taskKeys.length === 1 ? 'task' : 'tasks'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
