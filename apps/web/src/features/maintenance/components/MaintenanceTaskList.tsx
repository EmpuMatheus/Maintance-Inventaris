import type { MaintenanceTask, MaintenanceTaskProgress } from '../types';

interface Props {
  tasks: MaintenanceTask[];
  progress: MaintenanceTaskProgress;
  canToggle: boolean;
  isPending?: boolean;
  onToggle: (taskId: string, isCompleted: boolean) => void;
}

/**
 * Task List snapshot of a maintenance record with a checkbox per task and a
 * progress summary. Checkboxes stay read-only until the maintenance is started
 * and the user has update permission.
 */
export default function MaintenanceTaskList({ tasks, progress, canToggle, isPending, onToggle }: Props) {
  const total = progress?.total ?? tasks.length;
  const completed = progress?.completed ?? tasks.filter((t) => t.isCompleted).length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Task List</h2>
        <span className="text-xs font-medium text-slate-500">{completed} / {total} completed</span>
      </div>

      <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-indigo-600 transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>

      {tasks.length === 0 ? (
        <p className="text-sm text-slate-400">No tasks for this maintenance.</p>
      ) : (
        <ul className="space-y-1">
          {tasks.map((task) => (
            <li key={task.id}>
              <label className={`flex items-center gap-3 rounded-lg px-2 py-1.5 ${canToggle ? 'cursor-pointer hover:bg-slate-50' : 'cursor-default'}`}>
                <input
                  type="checkbox"
                  checked={task.isCompleted}
                  disabled={!canToggle || isPending}
                  onChange={(e) => onToggle(task.id, e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-60"
                />
                <span className={`text-sm ${task.isCompleted ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                  {task.task}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
