import { AppError } from '@/middleware/error-handler';
import * as repo from './master-data.repository';

const LIST_RESOURCES = [
  'categories', 'subcategories', 'brands', 'departments',
  'vendors', 'sites', 'buildings', 'floors', 'rooms', 'maintenance-types',
] as const;

type ListResource = (typeof LIST_RESOURCES)[number];

function assertResource(v: string): asserts v is ListResource {
  if (!(LIST_RESOURCES as readonly string[]).includes(v)) {
    throw new AppError(404, 'NOT_FOUND', `Unknown master data resource: ${v}`);
  }
}

function cleanString(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined;
  return undefined;
}

function cleanOptional(value: unknown): string | undefined | null {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') {
    const t = value.trim();
    return t || undefined;
  }
  return undefined;
}

function cleanBool(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

/**
 * Resources whose `code` must be unique within a parent record.
 * Keyed by resource, mapping the request body parent key to the DB column used
 * by the repository.
 */
const UNIQUE_PARENT: Record<string, { parentField: string; parentKey: string }> = {
  subcategories: { parentField: 'categoryId', parentKey: 'categoryId' },
  buildings: { parentField: 'siteId', parentKey: 'siteId' },
  floors: { parentField: 'buildingId', parentKey: 'buildingId' },
  rooms: { parentField: 'floorId', parentKey: 'floorId' },
};

const DUPLICATE_CODE_MESSAGE = 'Code sudah digunakan pada parent yang dipilih.';

async function assertUniqueCode(
  resource: string,
  data: Record<string, unknown>,
  existing: Record<string, unknown> | null,
  id?: string,
): Promise<void> {
  const cfg = UNIQUE_PARENT[resource];
  if (!cfg) return;

  const parentId = (data[cfg.parentKey] ?? existing?.[cfg.parentKey]) as string | undefined;
  const code = (data.code ?? existing?.code) as string | undefined;
  if (!parentId || !code) return;

  const dup = await repo.findByParentAndCode(resource, cfg.parentField, parentId, code, id);
  if (dup) {
    throw new AppError(409, 'CONFLICT', DUPLICATE_CODE_MESSAGE);
  }
}

const SCHEMAS: Record<string, (body: Record<string, unknown>) => Record<string, unknown>> = {
  categories(body) {
    return {
      code: cleanString(body.code),
      name: cleanString(body.name),
      description: cleanOptional(body.description),
      icon: cleanOptional(body.icon),
    };
  },
  subcategories(body) {
    return {
      categoryId: body.categoryId,
      code: cleanString(body.code),
      name: cleanString(body.name),
      description: cleanOptional(body.description),
      isNetworkDevice: cleanBool(body.isNetworkDevice),
    };
  },
  brands(body) {
    return {
      name: cleanString(body.name),
      description: cleanOptional(body.description),
    };
  },
  departments(body) {
    return {
      code: cleanString(body.code),
      name: cleanString(body.name),
      description: cleanOptional(body.description),
    };
  },
  vendors(body) {
    return {
      code: cleanString(body.code),
      name: cleanString(body.name),
      contactPerson: cleanOptional(body.contactPerson),
      phone: cleanOptional(body.phone),
      email: cleanOptional(body.email),
      address: cleanOptional(body.address),
      notes: cleanOptional(body.notes),
    };
  },
  sites(body) {
    return {
      code: cleanString(body.code),
      name: cleanString(body.name),
      address: cleanOptional(body.address),
      description: cleanOptional(body.description),
    };
  },
  buildings(body) {
    return {
      siteId: body.siteId,
      code: cleanString(body.code),
      name: cleanString(body.name),
      description: cleanOptional(body.description),
    };
  },
  floors(body) {
    return {
      buildingId: body.buildingId,
      code: cleanString(body.code),
      name: cleanString(body.name),
      description: cleanOptional(body.description),
    };
  },
  rooms(body) {
    return {
      floorId: body.floorId,
      code: cleanString(body.code),
      name: cleanString(body.name),
      description: cleanOptional(body.description),
    };
  },
  'maintenance-types'(body) {
    return {
      code: cleanString(body.code),
      name: cleanString(body.name),
      maintenanceCategory: cleanString(body.maintenanceCategory),
    };
  },
};

/**
 * Normalizes the incoming Task List of a Maintenance Type.
 *
 * Empty/whitespace-only tasks are dropped, the text is trimmed, and the order
 * is rewritten from the array position so the submitted sequence is preserved.
 */
function normalizeTaskList(value: unknown): repo.TaskInput[] {
  if (!Array.isArray(value)) return [];

  const tasks: repo.TaskInput[] = [];
  for (const raw of value) {
    const item = raw as { id?: unknown; task?: unknown };
    const text = typeof item?.task === 'string' ? item.task.trim() : '';
    if (!text) continue;
    const id = typeof item.id === 'string' && item.id.trim() ? item.id.trim() : undefined;
    tasks.push({ id, task: text, order: tasks.length });
  }
  return tasks;
}

export async function list(
  resource: string,
  query: {
    page?: number;
    limit?: number;
    search?: string;
    sort?: string;
    order?: string;
    categoryId?: string;
    siteId?: string;
    buildingId?: string;
    floorId?: string;
    isActive?: boolean;
  },
) {
  assertResource(resource);

  const parentId = query.categoryId || query.siteId || query.buildingId || query.floorId;

  const result = await repo.list(resource, {
    page: query.page,
    limit: query.limit,
    search: query.search,
    sort: query.sort,
    order: query.order,
    parentId,
    isActive: query.isActive,
  });

  if (resource === 'maintenance-types') {
    const taskMap = await repo.getTasksForTypes(result.data.map((r) => r.id as string));
    result.data = result.data.map((row) => ({ ...row, tasks: taskMap.get(row.id as string) ?? [] }));
  }

  return result;
}

export async function getById(resource: string, id: string) {
  assertResource(resource);
  const row = await repo.getById(resource, id);
  if (!row) {
    throw new AppError(404, 'NOT_FOUND', `${resource} not found.`);
  }
  if (resource === 'maintenance-types') {
    const tasks = await repo.getTasksForType(id);
    return { ...row, tasks };
  }
  return row;
}

export async function create(resource: string, body: Record<string, unknown>) {
  assertResource(resource);
  const fn = SCHEMAS[resource];
  const data = fn(body);

  await assertUniqueCode(resource, data, null);

  try {
    const created = await repo.create(resource, data);
    if (resource === 'maintenance-types') {
      const tasks = normalizeTaskList(body.tasks);
      await repo.setMaintenanceTypeTasks(created.id as string, tasks);
      return { ...created, tasks: await repo.getTasksForType(created.id as string) };
    }
    return created;
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      if (UNIQUE_PARENT[resource]) {
        throw new AppError(409, 'CONFLICT', DUPLICATE_CODE_MESSAGE);
      }
      throw new AppError(409, 'CONFLICT', `${resource} with this code/name already exists.`);
    }
    if (isForeignKeyViolation(err)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Referenced record not found.');
    }
    throw err;
  }
}

export async function update(resource: string, id: string, body: Record<string, unknown>) {
  assertResource(resource);
  const existing = await repo.getById(resource, id);
  if (!existing) {
    throw new AppError(404, 'NOT_FOUND', `${resource} not found.`);
  }

  const fn = SCHEMAS[resource];
  const cleaned = fn(body);
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(cleaned)) {
    if (value !== undefined) {
      data[key] = value;
    }
  }

  const hasTasks = resource === 'maintenance-types' && body.tasks !== undefined;
  if (hasTasks && !Array.isArray(body.tasks)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'tasks must be an array.');
  }

  if (Object.keys(data).length === 0 && !hasTasks) {
    return existing;
  }

  await assertUniqueCode(resource, data, existing, id);

  try {
    const updated = Object.keys(data).length > 0
      ? (await repo.update(resource, id, data)) ?? existing
      : existing;

    if (hasTasks) {
      await repo.setMaintenanceTypeTasks(id, normalizeTaskList(body.tasks));
      return { ...updated, tasks: await repo.getTasksForType(id) };
    }

    return updated;
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      if (UNIQUE_PARENT[resource]) {
        throw new AppError(409, 'CONFLICT', DUPLICATE_CODE_MESSAGE);
      }
      throw new AppError(409, 'CONFLICT', `${resource} with this code/name already exists.`);
    }
    if (isForeignKeyViolation(err)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Referenced record not found.');
    }
    throw err;
  }
}

/**
 * Soft-activates or soft-deactivates a master data record.
 *
 * Every master data resource carries an `is_active` flag, including categories.
 * Deactivation only flips the status; the row and all existing references are
 * preserved.
 */
export async function setActive(resource: string, id: string, isActive: boolean) {
  assertResource(resource);

  const existing = await repo.getById(resource, id);
  if (!existing) {
    throw new AppError(404, 'NOT_FOUND', `${resource} not found.`);
  }

  const updated = await repo.setActive(resource, id, isActive);
  return updated ?? existing;
}

/**
 * Soft-deactivates a master data record. Categories share the same soft-status
 * behaviour; physical removal is handled separately by
 * `deletePermanently`.
 */
export async function deactivate(resource: string, id: string) {
  assertResource(resource);
  return setActive(resource, id, false);
}

/**
 * Permanently deletes a category.
 *
 * DEVELOPMENT ONLY: the category foreign keys use ON DELETE CASCADE, so a
 * single physical DELETE removes the whole subtree (subcategories, assets and
 * all asset child records). `asset_code_counters` (no FK) is cleaned up in the
 * same transaction, so no orphan data or foreign key errors are left behind.
 *
 * TODO: before production assets.category_id -> asset_categories.id MUST be
 * changed back to ON DELETE RESTRICT and the "category is used by assets"
 * validation restored.
 */
export async function deletePermanently(resource: string, id: string) {
  assertResource(resource);
  if (resource !== 'categories') {
    throw new AppError(400, 'VALIDATION_ERROR', 'Permanent delete is only supported for categories.');
  }

  const existing = await repo.getById(resource, id);
  if (!existing) {
    throw new AppError(404, 'NOT_FOUND', `${resource} not found.`);
  }

  try {
    const removed = await repo.removeCategory(id);
    return removed ?? existing;
  } catch (err: unknown) {
    if (isForeignKeyViolation(err)) {
      throw new AppError(409, 'CONFLICT', 'This category is still referenced by existing records.');
    }
    throw err;
  }
}

/**
 * Extracts the PostgreSQL error code from an error thrown by the query layer.
 * Drizzle/postgres-js wrap the underlying PostgresError in a generic `Error`
 * ("Failed query: ...") and expose the real driver error via `err.cause`.
 */
function getPostgresErrorCode(err: unknown): string | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const e = err as { code?: unknown; cause?: unknown };
  if (typeof e.code === 'string') return e.code;
  if (e.cause && typeof e.cause === 'object') {
    const c = e.cause as { code?: unknown };
    if (typeof c.code === 'string') return c.code;
  }
  return undefined;
}

function isUniqueViolation(err: unknown): boolean {
  return getPostgresErrorCode(err) === '23505';
}

function isForeignKeyViolation(err: unknown): boolean {
  return getPostgresErrorCode(err) === '23503';
}
