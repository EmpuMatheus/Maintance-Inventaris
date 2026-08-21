import { AppError } from '@/middleware/error-handler';
import { getDb } from '@/database/client';
import { assets } from '@/database/schema';
import { eq, sql } from 'drizzle-orm';
import * as repo from './ticket.repository';
import { TICKET_TRANSITIONS } from './ticket.types';
import type { TicketStatus } from './ticket.types';
import type { TicketFilters, TicketScope } from './ticket.repository';
import { resolveAssetScope, canAccessAsset, type ScopeUser } from '@/middleware/scope';
import * as maintenanceService from '@/modules/maintenance/maintenance.service';
import { eventBus } from '@/lib/event-bus';

function assertTransition(current: string, target: TicketStatus) {
  const allowed = TICKET_TRANSITIONS[current];
  if (!allowed) throw new AppError(400, 'INVALID_TICKET_TRANSITION', `Unknown status: ${current}`);
  if (!allowed.includes(target)) {
    throw new AppError(400, 'INVALID_TICKET_TRANSITION', `Cannot transition from ${current} to ${target}.`);
  }
}

const ASSIGNABLE_STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD'];

async function generateCode(): Promise<string> {
  const db = getDb();
  const seq = await db.execute(sql`SELECT nextval('ticket_code_seq') AS n`);
  const num = Number((seq as any)[0]?.n ?? 1);
  const year = new Date().getFullYear();
  return `TKT-${year}-${String(num).padStart(6, '0')}`;
}

async function addSystemComment(ticketId: string, comment: string, userId?: string) {
  await repo.addComment({
    ticketId: sql`${ticketId}::uuid`,
    userId: userId ? sql`${userId}::uuid` : undefined,
    type: 'SYSTEM',
    comment,
    isInternal: true,
  });
}

interface RawTicket {
  id: string;
  ticketCode: string;
  assetId: string | null;
  reporterId: string | null;
  assignedTo: string | null;
  title: string;
  priority: string;
  status: string;
}

async function assertTicketExists(id: string): Promise<RawTicket> {
  const ticket = await repo.findRawById(id);
  if (!ticket) throw new AppError(404, 'NOT_FOUND', 'Ticket not found.');
  return ticket as unknown as RawTicket;
}

/**
 * Users with full `ticket.read` can access any ticket. Everyone else may only
 * access tickets within their scope (reported/assigned for USER, or belonging
 * to their asset categories for ADMIN/TECHNICIAN), otherwise the ticket is
 * treated as not found to avoid leaking its existence.
 */
function assertTicketAccess(
  ticket: { reporterId?: string | null; assignedTo?: string | null; assetCategoryId?: string | null },
  user?: ScopeUser,
) {
  if (!user) return;
  const scope = resolveAssetScope(user);
  if (!scope.ownUserId && !scope.categoryIds) return;
  if (scope.ownUserId) {
    if (ticket.reporterId === scope.ownUserId || ticket.assignedTo === scope.ownUserId) return;
    throw new AppError(404, 'NOT_FOUND', 'Ticket not found.');
  }
  if (scope.categoryIds && scope.categoryIds.length > 0) {
    if (ticket.assetCategoryId && scope.categoryIds.includes(ticket.assetCategoryId)) return;
    throw new AppError(404, 'NOT_FOUND', 'Ticket not found.');
  }
  throw new AppError(404, 'NOT_FOUND', 'Ticket not found.');
}

export async function list(filters: TicketFilters, scope?: TicketScope) {
  return repo.findMany(filters, scope);
}

export async function getById(id: string, user?: ScopeUser) {
  const ticket = await repo.findById(id);
  if (!ticket) throw new AppError(404, 'NOT_FOUND', 'Ticket not found.');
  assertTicketAccess(ticket, user);
  const [comments, assignments, maintenance] = await Promise.all([
    repo.getComments(id),
    repo.getAssignments(id),
    repo.findMaintenanceForTicket(id),
  ]);
  return { ...ticket, comments, assignments, maintenance };
}

export async function getByCode(code: string, user?: ScopeUser) {
  const ticket = await repo.findByCode(code);
  if (!ticket) throw new AppError(404, 'NOT_FOUND', 'Ticket not found.');
  assertTicketAccess(ticket, user);
  const [comments, assignments, maintenance] = await Promise.all([
    repo.getComments(ticket.id),
    repo.getAssignments(ticket.id),
    repo.findMaintenanceForTicket(ticket.id),
  ]);
  return { ...ticket, comments, assignments, maintenance };
}

export async function create(body: Record<string, unknown>, user?: ScopeUser) {
  const userId = user?.id;
  if (body.assetId) {
    const db = getDb();
    const asset = await db
      .select({ id: assets.id, currentPicId: assets.currentPicId, categoryId: assets.categoryId, status: assets.status })
      .from(assets)
      .where(eq(assets.id, sql`${body.assetId as string}::uuid`))
      .limit(1);
    if (!asset[0]) throw new AppError(400, 'VALIDATION_ERROR', 'Related asset not found.');
    if (asset[0].status === 'RETIRED') {
      throw new AppError(409, 'CONFLICT', 'Cannot create a ticket for a retired asset.');
    }

    // Users with only own-scoped access may only create tickets for assets
    // within their scope (assigned to them, or in their category).
    if (!canAccessAsset(resolveAssetScope(user), asset[0] as { categoryId?: unknown; currentPicId?: unknown })) {
      throw new AppError(403, 'FORBIDDEN', 'You can only create tickets for assets you have access to.');
    }
  }

  const code = await generateCode();
  const record = await repo.create({
    ticketCode: code,
    assetId: body.assetId ? sql`${body.assetId as string}::uuid` : undefined,
    reporterId: userId ? sql`${userId}::uuid` : undefined,
    departmentId: body.departmentId ? sql`${body.departmentId as string}::uuid` : undefined,
    category: typeof body.category === 'string' ? body.category : undefined,
    title: String(body.title),
    description: typeof body.description === 'string' ? body.description : undefined,
    priority: typeof body.priority === 'string' ? body.priority : 'MEDIUM',
    status: 'OPEN',
  });

  if (record?.id) {
    await addSystemComment(record.id as string, `Ticket ${code} created.`, userId);
  }

  eventBus.publish({
    type: 'TICKET',
    action: 'created',
    targetUserId: userId ?? null,
    entityType: 'ticket',
    entityId: record?.id as string,
    data: { ticketCode: code, title: String(body.title) },
  });

  return record;
}

export async function update(id: string, body: Record<string, unknown>, userId?: string) {
  await assertTicketExists(id);
  const data: Record<string, unknown> = {};
  if (body.title !== undefined) data.title = String(body.title);
  if (body.description !== undefined) data.description = typeof body.description === 'string' ? body.description : undefined;
  if (body.priority !== undefined) data.priority = String(body.priority);
  if (body.category !== undefined) data.category = typeof body.category === 'string' ? body.category : undefined;
  if (body.departmentId !== undefined) {
    data.departmentId = body.departmentId ? sql`${body.departmentId as string}::uuid` : undefined;
  }

  const record = await repo.update(id, data);
  if (record?.id) {
    await addSystemComment(record.id as string, 'Ticket updated.', userId);
  }
  return record;
}

export async function assign(id: string, technicianId: string, notes: string | undefined, userId?: string) {
  const ticket = await assertTicketExists(id);
  if (!ASSIGNABLE_STATUSES.includes(ticket.status)) {
    throw new AppError(400, 'INVALID_TICKET_TRANSITION', `Cannot assign a ticket in ${ticket.status} status.`);
  }

  const previousTechnicianId = ticket.assignedTo ?? null;
  const isFirstAssignment = ticket.status === 'OPEN';

  const data: Record<string, unknown> = {
    assignedTo: sql`${technicianId}::uuid`,
    assignedAt: sql`now()`,
  };
  if (isFirstAssignment) data.status = 'ASSIGNED';

  await repo.update(id, data);
  await repo.recordAssignment({
    ticketId: sql`${id}::uuid`,
    technicianId: sql`${technicianId}::uuid`,
    assignedBy: userId ? sql`${userId}::uuid` : undefined,
    reassignedFromId: previousTechnicianId ? sql`${previousTechnicianId}::uuid` : undefined,
    notes: notes || undefined,
  });

  const label = isFirstAssignment ? `Ticket assigned to technician.` : `Ticket reassigned to technician.`;
  await addSystemComment(id, label, userId);
  eventBus.publish({
    type: 'TICKET',
    action: 'assigned',
    targetUserId: technicianId,
    entityType: 'ticket',
    entityId: id,
    data: { ticketCode: ticket.ticketCode },
  });

  return repo.findById(id);
}

export async function start(id: string, userId?: string) {
  const ticket = await assertTicketExists(id);
  assertTransition(ticket.status, 'IN_PROGRESS');
  await repo.update(id, { status: 'IN_PROGRESS' });
  await addSystemComment(id, 'Ticket work started.', userId);
  return repo.findById(id);
}

export async function hold(id: string, userId?: string) {
  const ticket = await assertTicketExists(id);
  assertTransition(ticket.status, 'ON_HOLD');
  await repo.update(id, { status: 'ON_HOLD' });
  await addSystemComment(id, 'Ticket put on hold.', userId);
  return repo.findById(id);
}

export async function resume(id: string, userId?: string) {
  const ticket = await assertTicketExists(id);
  assertTransition(ticket.status, 'IN_PROGRESS');
  await repo.update(id, { status: 'IN_PROGRESS' });
  await addSystemComment(id, 'Ticket resumed.', userId);
  return repo.findById(id);
}

export async function resolve(id: string, resolution: string, userId?: string) {
  const ticket = await assertTicketExists(id);
  assertTransition(ticket.status, 'RESOLVED');
  await repo.update(id, { status: 'RESOLVED', resolvedAt: sql`now()`, resolution });
  await addSystemComment(id, `Ticket resolved. ${resolution}`, userId);
  eventBus.publish({
    type: 'TICKET',
    action: 'resolved',
    targetUserId: ticket.reporterId,
    entityType: 'ticket',
    entityId: id,
    data: { ticketCode: ticket.ticketCode },
  });
  return repo.findById(id);
}

export async function close(id: string, userId?: string) {
  const ticket = await assertTicketExists(id);
  assertTransition(ticket.status, 'CLOSED');
  await repo.update(id, { status: 'CLOSED', closedAt: sql`now()` });
  await addSystemComment(id, 'Ticket closed.', userId);
  return repo.findById(id);
}

export async function cancel(id: string, reason: string, userId?: string) {
  const ticket = await assertTicketExists(id);
  assertTransition(ticket.status, 'CANCELLED');
  await repo.update(id, { status: 'CANCELLED' });
  await addSystemComment(id, `Ticket cancelled. ${reason}`, userId);
  return repo.findById(id);
}

export async function addComment(id: string, comment: string, isInternal: boolean, user?: ScopeUser) {
  const ticket = await assertTicketExists(id);
  assertTicketAccess(ticket, user);
  return repo.addComment({
    ticketId: sql`${id}::uuid`,
    userId: user?.id ? sql`${user.id}::uuid` : undefined,
    type: isInternal ? 'INTERNAL' : 'COMMENT',
    comment,
    isInternal,
  });
}

export async function getComments(id: string, user?: ScopeUser) {
  const ticket = await assertTicketExists(id);
  assertTicketAccess(ticket, user);
  return repo.getComments(id);
}

export async function getAssignments(id: string, user?: ScopeUser) {
  const ticket = await assertTicketExists(id);
  assertTicketAccess(ticket, user);
  return repo.getAssignments(id);
}

/**
 * Creates a Maintenance record from a Ticket (TASK-135).
 *
 * The ticket must reference an asset, and duplicate generation is prevented by
 * checking for an existing maintenance already linked to the ticket.
 */
export async function createMaintenanceFromTicket(id: string, body: Record<string, unknown>, user?: ScopeUser) {
  const ticket = await assertTicketExists(id);

  const existing = await repo.findMaintenanceForTicket(id);
  if (existing.length > 0) {
    throw new AppError(409, 'MAINTENANCE_ALREADY_EXISTS', 'A maintenance record already exists for this ticket.');
  }

  if (!ticket.assetId) {
    throw new AppError(400, 'VALIDATION_ERROR', 'The ticket must reference an asset before maintenance can be created.');
  }

  const record = await maintenanceService.create(
    {
      assetId: ticket.assetId,
      maintenanceTypeId: body.maintenanceTypeId ?? null,
      maintenanceCategory: typeof body.maintenanceCategory === 'string' ? body.maintenanceCategory : 'CORRECTIVE',
      problem: ticket.title,
      priority: ticket.priority,
      technicianId: body.technicianId ?? ticket.assignedTo ?? null,
      vendorId: body.vendorId ?? null,
      notes: `Created from ticket ${ticket.ticketCode}.`,
      ticketId: ticket.id,
    },
    user?.id,
    resolveAssetScope(user),
  );

  await addSystemComment(id, `Maintenance ${record.maintenanceCode} created from ticket.`, user?.id);
  return { ticket: await repo.findById(id), maintenance: record };
}

export { repo };
