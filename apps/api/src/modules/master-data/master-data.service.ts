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
      description: cleanOptional(body.description),
    };
  },
};

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
  },
) {
  assertResource(resource);

  const parentId = query.categoryId || query.siteId || query.buildingId || query.floorId;

  return repo.list(resource, {
    page: query.page,
    limit: query.limit,
    search: query.search,
    sort: query.sort,
    order: query.order,
    parentId,
  });
}

export async function getById(resource: string, id: string) {
  assertResource(resource);
  const row = await repo.getById(resource, id);
  if (!row) {
    throw new AppError(404, 'NOT_FOUND', `${resource} not found.`);
  }
  return row;
}

export async function create(resource: string, body: Record<string, unknown>) {
  assertResource(resource);
  const fn = SCHEMAS[resource];
  const data = fn(body);
  try {
    return await repo.create(resource, data);
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
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

  if (Object.keys(data).length === 0) {
    return existing;
  }

  try {
    const updated = await repo.update(resource, id, data);
    return updated ?? existing;
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      throw new AppError(409, 'CONFLICT', `${resource} with this code/name already exists.`);
    }
    if (isForeignKeyViolation(err)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Referenced record not found.');
    }
    throw err;
  }
}

export async function deactivate(resource: string, id: string) {
  assertResource(resource);
  const existing = await repo.getById(resource, id);
  if (!existing) {
    throw new AppError(404, 'NOT_FOUND', `${resource} not found.`);
  }
  const updated = await repo.deactivate(resource, id);
  return updated ?? existing;
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === '23505'
  );
}

function isForeignKeyViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === '23503'
  );
}
