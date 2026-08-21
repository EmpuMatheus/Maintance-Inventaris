import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { env } from '@/config/env';
import { getCurrentUser } from '@/modules/auth/auth.service';
import * as userSvc from '@/modules/users/user.service';

const sql = postgres(env.DATABASE_URL, { max: 1 });
let userRoleId: string;
let userId: string;

beforeAll(async () => {
  const rows = await sql`SELECT id FROM roles WHERE name = 'USER' LIMIT 1`;
  userRoleId = rows[0].id as string;
});

afterAll(async () => {
  if (userId) {
    await sql`DELETE FROM user_roles WHERE user_id = ${userId}`;
    await sql`DELETE FROM users WHERE id = ${userId}`;
  }
  await sql.end();
});

describe('Permissions', () => {
  it('admin receives full permissions', async () => {
    const me = await getCurrentUser((await sql`SELECT id FROM users WHERE username = 'admin' LIMIT 1`)[0].id as string);
    expect(me.permissions).toContain('asset.create');
    expect(me.permissions).toContain('user.create');
    expect(me.permissions).toContain('role.read');
  });

  it('a user receives only own-scoped permissions', async () => {
    const u = await userSvc.create({ employeeCode: 'QA_USER', name: 'QA User', username: `qauser${Date.now().toString(36)}`, password: 'password123', roleId: userRoleId });
    userId = u.id;
    const me = await getCurrentUser(u.id);
    expect(me.permissions).toContain('asset.read.own');
    expect(me.permissions).toContain('maintenance.read.own');
    expect(me.permissions).toContain('ticket.create');
    expect(me.permissions).toContain('ticket.read.own');
    expect(me.permissions).toContain('ticket.comment.own');
    expect(me.permissions).toContain('notification.read');
    expect(me.permissions).toContain('profile.update');
    expect(me.permissions).not.toContain('asset.read');
    expect(me.permissions).not.toContain('maintenance.read');
    expect(me.permissions).not.toContain('ticket.read');
    expect(me.permissions).not.toContain('asset.create');
    expect(me.permissions).not.toContain('user.create');
    expect(me.permissions).not.toContain('analytics.read');
    expect(me.permissions).not.toContain('master_data.read');
  });
});
