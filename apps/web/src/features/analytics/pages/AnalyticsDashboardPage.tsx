import { useQueryErrorResetBoundary } from '@tanstack/react-query';
import { AlertTriangle, CircleAlert, Activity, Wrench, Clock, TrendingUp, Package } from 'lucide-react';
import { useAnalyticsDashboard } from '../hooks/useAnalytics';
import { SectionCard, MetricCard, LoadingState, ErrorState } from '../components/ui';
import { HealthDistributionChart, ConditionDistributionChart, AgeDistributionChart, TrendLineChart, TrendBarChart } from '../components/charts';
import { TopCriticalTable, ReplacementCandidatesTable, MostExpensiveTable, MostProblematicTable, EventsTimeline } from '../components/tables';

const money = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

export default function AnalyticsDashboardPage() {
  const { data, isLoading, isError, error, refetch } = useAnalyticsDashboard();
  const { reset } = useQueryErrorResetBoundary();

  if (isLoading) return <LoadingState label="Loading analytics dashboard..." />;
  if (isError) {
    return (
      <ErrorState
        message={(error as Error)?.message || 'Failed to load analytics.'}
        onRetry={() => {
          reset();
          void refetch();
        }}
      />
    );
  }
  if (!data) return <ErrorState message="No analytics data available." />;

  const s = data.summary;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Advanced Analytics</h1>
        <p className="mt-1 text-sm text-slate-500">Asset health, repeated failures, replacement recommendations and trends.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="Avg Health Score" value={s.averageHealthScore} icon={<Activity className="h-4 w-4" />} hint={`of ${s.totalAssets} assets`} />
        <MetricCard label="MTBF" value={`${s.mtbfDays}d`} icon={<Clock className="h-4 w-4" />} hint="mean time between failures" />
        <MetricCard label="MTTR" value={`${s.mttrMinutes}m`} icon={<Wrench className="h-4 w-4" />} hint="mean time to repair" />
        <MetricCard label="Total Maint. Cost" value={money(s.totalMaintenanceCost)} icon={<TrendingUp className="h-4 w-4" />} />
        <MetricCard label="Repeated Failures" value={s.repeatedFailure} icon={<AlertTriangle className="h-4 w-4 text-orange-500" />} accent="text-orange-500" />
        <MetricCard label="Replace Soon" value={s.replaceImmediately + s.replaceSoon} icon={<CircleAlert className="h-4 w-4 text-red-500" />} accent="text-red-500" hint={`${s.replaceImmediately} immediate`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard title="Health Score Distribution">
          <HealthDistributionChart data={data.healthDistribution} />
        </SectionCard>
        <SectionCard title="Asset Age Distribution">
          <AgeDistributionChart data={data.ageDistribution} />
        </SectionCard>
        <SectionCard title="Condition Distribution">
          <ConditionDistributionChart data={data.conditionDistribution} />
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Monthly Maintenance Trend">
          <TrendLineChart data={data.maintenanceTrend} color="#6366f1" name="Maintenance" />
        </SectionCard>
        <SectionCard title="Monthly Ticket Trend">
          <TrendBarChart data={data.ticketTrend} color="#0ea5e9" name="Tickets" />
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Top Critical Assets" subtitle="Lowest health scores">
          <TopCriticalTable assets={data.topCritical} />
        </SectionCard>
        <SectionCard title="Replacement Candidates" subtitle="Recommended replace soon or immediately">
          <ReplacementCandidatesTable assets={data.replacementCandidates} />
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Most Expensive Assets" subtitle="By total maintenance cost">
          <MostExpensiveTable assets={data.mostExpensive} />
        </SectionCard>
        <SectionCard title="Most Problematic Assets" subtitle="Failures + tickets + downtime">
          <MostProblematicTable assets={data.mostProblematic} />
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard title="Recent Analytics Events" subtitle="Timeline of detections and recommendations" className="lg:col-span-3">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            <EventsTimeline events={data.recentEvents} />
          </div>
        </SectionCard>
      </div>

      <p className="text-xs text-slate-400">
        Health score factors: asset age, maintenance frequency, failure ratio, condition, downtime, tickets and critical events.
        Recommendations: Keep · Monitor · Repair · Replace Soon · Replace Immediately. <Package className="inline h-3 w-3" /> Data recalculated automatically by the analytics service.
      </p>
    </div>
  );
}
