import type { RoleOption } from '../types';

export default function RoleSelector({
  roles,
  value,
  onChange,
}: {
  roles: RoleOption[];
  value: string;
  onChange: (roleId: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
    >
      <option value="">Select role...</option>
      {roles.map((role) => (
        <option key={role.id} value={role.id}>{role.name}</option>
      ))}
    </select>
  );
}
