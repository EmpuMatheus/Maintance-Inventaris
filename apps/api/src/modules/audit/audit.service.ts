import type { Request } from 'express';
import { AppError } from '@/middleware/error-handler';
import { sql } from 'drizzle-orm';
import * as repo from './audit.repository';
import { generateAuditCode, sanitize, diffObjects } from './audit.utils';
import { AUDIT_MODULES, AUDIT_ACTIONS, type AuditModule, type AuditAction } from './audit.types';

export interface AuditParams {
  module: AuditModule;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  description: string;
  performedBy?: string | null;
  performedByName?: string | null;
  oldData?: unknown;
  newData?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

/**
 * Fire-and-forget audit logging. The insert runs asynchronously and failures
 * are swallowed so audit problems never roll back the business transaction.
 */
export function recordAudit(params: AuditParams): void {
  try {
    void (async () => {
      const code = await generateAuditCode();
      const diff = diffObjects(params.oldData, params.newData);
      await repo.insertLog({
        auditCode: code,
        module: params.module,
        entityType: params.entityType,
        entityId: params.entityId ?? undefined,
        action: params.action,
        description: params.description,
        oldData: JSON.stringify(sanitize(diff.old)),
        newData: JSON.stringify(sanitize(diff.new)),
        userId: params.performedBy ? sql`${params.performedBy}::uuid` : undefined,
        performedByName: params.performedByName ?? undefined,
        ipAddress: params.ipAddress ?? undefined,
        userAgent: params.userAgent ?? undefined,
        requestId: params.requestId ?? undefined,
      });
    })().catch(() => {
      // Audit must never break the business flow.
    });
  } catch {
    // Synchronous failures are also ignored.
  }
}

/** Convenience wrapper that derives performer + request context from an Express request. */
export function auditFromRequest(
  req: Request,
  params: Omit<AuditParams, 'ipAddress' | 'userAgent' | 'requestId' | 'performedBy' | 'performedByName'> & {
    performedBy?: string;
    performedByName?: string;
  },
): void {
  const user = req.user;
  recordAudit({
    ...params,
    performedBy: params.performedBy ?? user?.id ?? null,
    performedByName: params.performedByName ?? user?.name ?? null,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'] as string | undefined,
    requestId: (req as { id?: string }).id ?? (req.headers['x-request-id'] as string | undefined),
  });
}

export async function list(filters: repo.AuditFilters) {
  return repo.findMany(filters);
}

export async function getById(id: string) {
  const row = await repo.findById(id);
  if (!row) throw new AppError(404, 'NOT_FOUND', 'Audit log not found.');
  return row;
}

export async function modules() {
  return AUDIT_MODULES;
}

export async function actions() {
  return AUDIT_ACTIONS;
}

export async function summary() {
  return repo.summary();
}
