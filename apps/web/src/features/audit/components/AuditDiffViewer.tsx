function renderValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') return JSON.stringify(v, null, 2);
  return String(v);
}

export default function AuditDiffViewer({ oldData, newData }: { oldData: Record<string, unknown> | null; newData: Record<string, unknown> | null }) {
  const oldKeys = Object.keys(oldData ?? {});
  const newKeys = Object.keys(newData ?? {});
  const keys = Array.from(new Set([...oldKeys, ...newKeys]));

  if (keys.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-400">No data changes recorded.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50">
          <tr>
            <th className="px-3 py-2 font-medium text-slate-600">Field</th>
            <th className="px-3 py-2 font-medium text-slate-600">Before</th>
            <th className="px-3 py-2 font-medium text-slate-600">After</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {keys.map((key) => {
            const before = oldData?.[key];
            const after = newData?.[key];
            const changed = JSON.stringify(before) !== JSON.stringify(after);
            return (
              <tr key={key}>
                <td className="px-3 py-2 font-mono text-xs font-medium text-slate-700">{key}</td>
                <td className={`px-3 py-2 text-xs ${changed ? 'bg-red-50 text-red-700' : 'text-slate-500'}`}>{renderValue(before)}</td>
                <td className={`px-3 py-2 text-xs ${changed ? 'bg-green-50 text-green-700' : 'text-slate-500'}`}>{renderValue(after)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
