import type { ReactElement } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { MaintenanceCostAnalytics, MaintenanceCostSummary } from '../types';

const PALETTE = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316', '#3b82f6', '#64748b'];

function currency(value: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
}

function ChartCard({ title, children, empty }: { title: string; children: ReactElement; empty: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">{title}</h2>
      {empty ? (
        <div className="flex h-52 items-center justify-center"><p className="text-sm text-slate-400">No data yet.</p></div>
      ) : (
        <ResponsiveContainer width="100%" height={210}>{children}</ResponsiveContainer>
      )}
    </div>
  );
}

function CostTooltip() {
  return <Tooltip formatter={(value) => currency(Number(value))} />;
}

export default function MaintenanceCostCharts({ analytics, summary }: { analytics?: MaintenanceCostAnalytics; summary?: MaintenanceCostSummary }) {
  const trend = analytics?.monthlyTrend ?? [];
  const byCategory = (analytics?.topCategories ?? []).map((b) => ({ name: b.name, value: b.value }));
  const byVendor = (analytics?.topVendors ?? []).map((b) => ({ name: b.name, value: b.value }));
  const byDepartment = (analytics?.topDepartments ?? []).map((b) => ({ name: b.name, value: b.value }));
  const preventive = summary?.preventiveCost ?? 0;
  const corrective = summary?.correctiveCost ?? 0;

  const pieData = [
    { name: 'Preventive', value: preventive, color: '#10b981' },
    { name: 'Corrective', value: corrective, color: '#f97316' },
  ];

  const compact = (v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v));

  return (
    <div className="mb-4 grid gap-4 lg:grid-cols-2">
      <div className="lg:col-span-2">
        <ChartCard title="Monthly Cost Trend" empty={trend.length === 0}>
          <LineChart data={trend} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={compact} />
            <CostTooltip />
            <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ChartCard>
      </div>

      <ChartCard title="Cost by Category" empty={byCategory.length === 0}>
        <BarChart data={byCategory} margin={{ top: 4, right: 4, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={46} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={compact} />
          <CostTooltip />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {byCategory.map((_e, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
          </Bar>
        </BarChart>
      </ChartCard>

      <ChartCard title="Cost by Vendor" empty={byVendor.length === 0}>
        <BarChart data={byVendor} margin={{ top: 4, right: 4, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={46} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={compact} />
          <CostTooltip />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="#0ea5e9" />
        </BarChart>
      </ChartCard>

      <ChartCard title="Cost by Department" empty={byDepartment.length === 0}>
        <BarChart data={byDepartment} margin={{ top: 4, right: 4, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={46} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={compact} />
          <CostTooltip />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="#10b981" />
        </BarChart>
      </ChartCard>

      <ChartCard title="Preventive vs Corrective Cost" empty={pieData.every((d) => d.value === 0)}>
        <PieChart>
          <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
            {pieData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
          </Pie>
          <CostTooltip />
        </PieChart>
      </ChartCard>
    </div>
  );
}
