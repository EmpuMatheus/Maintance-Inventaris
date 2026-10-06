import { Plus, Trash2 } from 'lucide-react';
import { makeTaskRow, type TaskRow } from './task-list';

interface Props {
  value: TaskRow[];
  onChange: (tasks: TaskRow[]) => void;
}

/**
 * Editable list of tasks for a Maintenance Type. Each row has its own text
 * input, an add button that inserts a new row right below it, and a remove
 * button. There is no confirmation dialog: removing a row only affects this
 * form until the Maintenance Type is saved.
 */
export default function TaskListEditor({ value, onChange }: Props) {
  const rows = value.length > 0 ? value : [makeTaskRow()];

  const update = (index: number, task: string) => {
    onChange(value.map((row, i) => (i === index ? { ...row, task } : row)));
  };

  const addAfter = (index: number) => {
    const next = [...rows];
    next.splice(index + 1, 0, makeTaskRow());
    onChange(next);
  };

  const removeAt = (index: number) => {
    const next = rows.filter((_, i) => i !== index);
    // Always keep one empty input available so the user can keep adding tasks.
    onChange(next.length > 0 ? next : [makeTaskRow()]);
  };

  return (
    <div className="space-y-2">
      {rows.map((row, index) => (
        <div key={row.key} className="flex items-center gap-2">
          <input
            type="text"
            value={row.task}
            onChange={(e) => update(index, e.target.value)}
            placeholder={`Task ${index + 1}`}
            className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <button
            type="button"
            onClick={() => addAfter(index)}
            title="Tambah task"
            className="shrink-0 rounded-lg border border-indigo-200 p-2 text-indigo-600 hover:bg-indigo-50"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => removeAt(index)}
            title="Hapus task"
            className="shrink-0 rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
