// Clickable rubric chips: click to tag a task, click again to remove the tag.
export default function CriteriaPicker({ criteria, selected, onToggle }) {
  if (criteria.length === 0) {
    return <p className="muted">No rubric criteria yet. Add them with “Edit rubric”.</p>
  }
  return (
    <div className="picker" role="group" aria-label="Rubric criteria">
      {criteria.map((criterion) => {
        const isOn = selected.includes(criterion.id)
        return (
          <button
            key={criterion.id}
            type="button"
            className={`chip${isOn ? ' chip--on' : ''}`}
            aria-pressed={isOn}
            onClick={() => onToggle(criterion.id)}
          >
            <span aria-hidden="true">{isOn ? '✓' : '+'}</span> {criterion.name}
          </button>
        )
      })}
    </div>
  )
}
