import { AppError } from '@/middleware/error-handler';

export interface ScopeUser {
  id: string;
  username: string;
  name: string;
  roles: string[];
  permissions: string[];
  categoryIds?: string[];
}

export interface AssetScope {
  /** Assets currently assigned to this user (via current_pic_id). */
  ownUserId?: string;
  /** ADMIN/TECHNICIAN: assets belonging to these categories. */
  categoryIds?: string[];
}

/**
 * Resolves the asset access scope for the authenticated user.
 *
 * - SUPER_ADMIN: unrestricted (empty scope).
 * - ADMIN / TECHNICIAN: scoped to their asset categories.
 * - USER: scoped to assets assigned to them.
 *
 * The scope is derived server-side from the user's roles and category
 * membership, never from the client.
 */
export function resolveAssetScope(user: ScopeUser | undefined): AssetScope {
  if (!user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
  }
  if (user.roles.includes('SUPER_ADMIN')) {
    return {};
  }
  const ownScope = user.permissions.includes('asset.read.own') ? { ownUserId: user.id } : {};
  if (user.roles.includes('ADMIN') || user.roles.includes('TECHNICIAN')) {
    return { ...ownScope, categoryIds: user.categoryIds ?? [] };
  }
  return ownScope;
}

/**
 * Whether the current scope may access a single asset. An unrestricted scope
 * (SUPER_ADMIN) can access everything. An own-user scope requires the asset to
 * be assigned to the user. A category scope requires the asset's category to
 * match one of the user's categories.
 */
export function canAccessAsset(
  scope: AssetScope,
  asset: { categoryId?: unknown; currentPicId?: unknown } | null | undefined,
): boolean {
  if (!scope.ownUserId && !scope.categoryIds) {
    return true;
  }
  if (!asset) return false;
  if (scope.ownUserId && asset.currentPicId === scope.ownUserId) return true;
  if (scope.categoryIds && scope.categoryIds.length > 0) {
    return !!asset.categoryId && scope.categoryIds.includes(asset.categoryId as string);
  }
  return false;
}
