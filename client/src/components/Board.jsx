import Column from './Column.jsx'
import { STATUSES } from '../data/sampleData.js'

// The 3 columns: To do, In progress, Done
export default function Board({ tasks, criteria, aiCounts, onOpen, onMove }) {
  return (
    <div className="board">
      {STATUSES.map((status) => (
        <Column
          key={status.id}
          status={status}
          tasks={tasks.filter((t) => t.status === status.id)}
          criteria={criteria}
          aiCounts={aiCounts}
          onOpen={onOpen}
          onMove={onMove}
        />
      ))}
    </div>
  )
}
