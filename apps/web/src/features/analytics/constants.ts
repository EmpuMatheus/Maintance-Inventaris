import type { HealthCategory } from './types';

export const CATEGORY_CHART_COLORS: Record<HealthCategory, string> = {
  Excellent: '#10b981',
  Good: '#22c55e',
  Fair: '#eab308',
  Poor: '#f97316',
  Critical: '#ef4444',
};

export const CATEGORY_ORDER: HealthCategory[] = ['Excellent', 'Good', 'Fair', 'Poor', 'Critical'];

export const CONDITION_CHART_COLORS: Record<string, string> = {
  GOOD: '#22c55e',
  FAIR: '#eab308',
  NEED_ATTENTION: '#f97316',
  BROKEN: '#ef4444',
  CRITICAL: '#b91c1c',
};

export const CHART_PALETTE = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316'];
