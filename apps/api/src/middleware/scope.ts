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
  /** USER: only assets currently assigned to this user (via current_pic_id). */
  ownUserId?: string;
  /** ADMIN/TECHNICIAN: only assets belonging to these categories. */
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
  if (user.roles.includes('ADMIN') || user.roles.includes('TECHNICIAN')) {
    return { categoryIds: user.categoryIds ?? [] };
  }
  if (user.permissions.includes('asset.read.own')) {
    return { ownUserId: user.id };
  }
  return {};
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
  if (scope.ownUserId) {
    return !!asset && asset.currentPicId === scope.ownUserId;
  }
  if (scope.categoryIds && scope.categoryIds.length > 0) {
    return !!asset && !!asset.categoryId && scope.categoryIds.includes(asset.categoryId as string);
  }
  return false;
}
