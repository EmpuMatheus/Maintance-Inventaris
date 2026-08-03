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
import type { AnalyticsDashboard, HealthCategory, MonthlyTrendPoint } from '../types';
import { CATEGORY_CHART_COLORS, CATEGORY_ORDER, CONDITION_CHART_COLORS, CHART_PALETTE } from '../constants';

export function HealthDistributionChart({ data }: { data: AnalyticsDashboard['healthDistribution'] }) {
  const chartData = CATEGORY_ORDER.map((category) => ({
    name: category,
    value: data.find((d) => d.category === category)?.value ?? 0,
  }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }: { name: string; value: number }) => `${name}: ${value}`}>
          {chartData.map((entry) => (
            <Cell key={entry.name} fill={CATEGORY_CHART_COLORS[entry.name as HealthCategory]} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function ConditionDistributionChart({ data }: { data: AnalyticsDashboard['conditionDistribution'] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="condition" cx="50%" cy="50%" outerRadius={80} label={({ condition, value }: { condition: string; value: number }) => `${condition}: ${value}`}>
          {data.map((entry) => (
            <Cell key={entry.condition} fill={CONDITION_CHART_COLORS[entry.condition] ?? '#94a3b8'} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function AgeDistributionChart({ data }: { data: AnalyticsDashboard['ageDistribution'] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Bar dataKey="value" name="Assets" fill="#6366f1" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TrendLineChart({ data, color = '#6366f1', name = 'Count' }: { data: MonthlyTrendPoint[]; color?: string; name?: string }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Line type="monotone" dataKey="value" name={name} stroke={color} strokeWidth={2} dot={{ r: 2 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function TrendBarChart({ data, color = '#0ea5e9', name = 'Count' }: { data: MonthlyTrendPoint[]; color?: string; name?: string }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Bar dataKey="value" name={name} fill={color} radius={[4, 4, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={entry.month} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
