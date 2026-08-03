import { useQuery } from '@tanstack/react-query';
import {
  analyticsKeys,
  getAnalyticsDashboard,
  getAnalyticsHealth,
  getAnalyticsReplacement,
  getAnalyticsFailures,
  getAnalyticsTrends,
} from '../api/analytics';

export function useAnalyticsDashboard() {
  return useQuery({ queryKey: analyticsKeys.dashboard(), queryFn: getAnalyticsDashboard, staleTime: 60_000 });
}

export function useAnalyticsHealth() {
  return useQuery({ queryKey: analyticsKeys.health(), queryFn: getAnalyticsHealth, staleTime: 60_000 });
}

export function useAnalyticsReplacement() {
  return useQuery({ queryKey: analyticsKeys.replacement(), queryFn: getAnalyticsReplacement, staleTime: 60_000 });
}

export function useAnalyticsFailures() {
  return useQuery({ queryKey: analyticsKeys.failures(), queryFn: getAnalyticsFailures, staleTime: 60_000 });
}

export function useAnalyticsTrends() {
  return useQuery({ queryKey: analyticsKeys.trends(), queryFn: getAnalyticsTrends, staleTime: 60_000 });
}
