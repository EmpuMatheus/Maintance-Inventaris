import { describe, it, expect } from 'vitest';
import { createRoleSchema, updateRoleSchema, setPermissionsSchema, setUsersSchema } from '@/modules/roles/role.schema';
import { permissionGroup } from '@/modules/roles/role.repository';

const UUID = '00000000-0000-0000-0000-000000000001';

describe('Role schema validation', () => {
  it('accepts a valid create payload', () => {
    expect(createRoleSchema.safeParse({ name: 'Admin', permissions: [UUID] }).success).toBe(true);
  });

  it('rejects empty role name', () => {
    expect(createRoleSchema.safeParse({ name: '' }).success).toBe(false);
  });

  it('allows partial updates', () => {
    expect(updateRoleSchema.safeParse({ description: 'x' }).success).toBe(true);
  });

  it('validates permission and user assignment', () => {
    expect(setPermissionsSchema.safeParse({ permissions: [UUID] }).success).toBe(true);
    expect(setPermissionsSchema.safeParse({ permissions: [] }).success).toBe(true);
    expect(setUsersSchema.safeParse({ userIds: [UUID] }).success).toBe(true);
  });
});

describe('Permission groups', () => {
  it('maps codes to groups', () => {
    expect(permissionGroup('asset.read')).toBe('Inventory');
    expect(permissionGroup('master_data.read')).toBe('Master Data');
    expect(permissionGroup('maintenance.complete')).toBe('Maintenance');
    expect(permissionGroup('ticket.resolve')).toBe('Ticket');
    expect(permissionGroup('report.export')).toBe('Report');
    expect(permissionGroup('audit.read')).toBe('Audit');
    expect(permissionGroup('user.read')).toBe('Administration');
    expect(permissionGroup('role.update')).toBe('Administration');
    expect(permissionGroup('notification.read')).toBe('System');
  });
});
