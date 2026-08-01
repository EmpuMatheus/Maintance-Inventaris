import type { ReactElement } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const DEFAULT_PALETTE = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316', '#3b82f6', '#64748b'];

function ChartShell({ title, children, empty }: { title: string; children: ReactElement; empty: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">{title}</h2>
      {empty ? (
        <div className="flex h-48 items-center justify-center"><p className="text-sm text-slate-400">No data yet.</p></div>
      ) : (
        <ResponsiveContainer width="100%" height={190}>{children}</ResponsiveContainer>
      )}
    </div>
  );
}

export function BarChartCard({
  title,
  data,
  dataKey = 'value',
  xKey = 'name',
  color = '#6366f1',
  empty,
}: {
  title: string;
  data: Record<string, unknown>[];
  dataKey?: string;
  xKey?: string;
  color?: string;
  empty?: boolean;
}) {
  return (
    <ChartShell title={title} empty={empty ?? data.length === 0}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey={xKey} tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={46} />
        <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
        <Tooltip />
        <Bar dataKey={dataKey} radius={[4, 4, 0, 0]}>
          {data.map((_e, i) => <Cell key={i} fill={color === '#multi' ? DEFAULT_PALETTE[i % DEFAULT_PALETTE.length] : color} />)}
        </Bar>
      </BarChart>
    </ChartShell>
  );
}

export function PieChartCard({
  title,
  data,
  dataKey = 'value',
  nameKey = 'name',
  colors,
  empty,
}: {
  title: string;
  data: { name: string; value: number; color?: string }[];
  dataKey?: string;
  nameKey?: string;
  colors?: Record<string, string>;
  empty?: boolean;
}) {
  return (
    <ChartShell title={title} empty={empty ?? data.length === 0}>
      <PieChart>
        <Pie data={data} dataKey={dataKey} nameKey={nameKey} innerRadius={45} outerRadius={75} paddingAngle={2}>
          {data.map((entry) => <Cell key={entry.name} fill={colors?.[entry.name] ?? entry.color ?? '#94a3b8'} />)}
        </Pie>
        <Tooltip />
      </PieChart>
    </ChartShell>
  );
}

export function LineChartCard({
  title,
  data,
  dataKey = 'value',
  xKey = 'label',
  color = '#6366f1',
  empty,
}: {
  title: string;
  data: Record<string, unknown>[];
  dataKey?: string;
  xKey?: string;
  color?: string;
  empty?: boolean;
}) {
  return (
    <ChartShell title={title} empty={empty ?? data.length === 0}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip />
        <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ChartShell>
  );
}
