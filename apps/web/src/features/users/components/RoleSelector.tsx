import type { RoleOption } from '../types';

export default function RoleSelector({
  roles,
  selected,
  onChange,
}: {
  roles: RoleOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
}) {
  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {roles.map((role) => (
        <label key={role.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50">
          <input type="checkbox" checked={selected.includes(role.id)} onChange={() => toggle(role.id)} className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
          <span className="text-sm font-medium text-slate-700">{role.name}</span>
        </label>
      ))}
    </div>
  );
}
