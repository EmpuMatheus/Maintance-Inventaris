import type { Request } from 'express';
import { resolveAssetScope } from '@/middleware/scope';

/** Resolves the caller's enforced category scope for report queries. */
export function scopeCategoryIds(req: Request): string[] | undefined {
  const scope = resolveAssetScope(req.user);
  return scope.categoryIds?.length ? scope.categoryIds : undefined;
}
