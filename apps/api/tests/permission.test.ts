import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { env } from '@/config/env';
import { getCurrentUser } from '@/modules/auth/auth.service';
import * as userSvc from '@/modules/users/user.service';

const sql = postgres(env.DATABASE_URL, { max: 1 });
let viewerRoleId: string;
let viewerId: string;

beforeAll(async () => {
  const rows = await sql`SELECT id FROM roles WHERE name = 'VIEWER' LIMIT 1`;
  viewerRoleId = rows[0].id as string;
});

afterAll(async () => {
  if (viewerId) {
    await sql`DELETE FROM user_roles WHERE user_id = ${viewerId}`;
    await sql`DELETE FROM users WHERE id = ${viewerId}`;
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

  it('a viewer receives only read permissions', async () => {
    const u = await userSvc.create({ employeeCode: 'QA_VIEW', name: 'QA Viewer', username: `qaviewer${Date.now().toString(36)}`, password: 'password123', roles: [viewerRoleId] });
    viewerId = u.id;
    const me = await getCurrentUser(u.id);
    expect(me.permissions).toContain('asset.read');
    expect(me.permissions).toContain('audit.read');
    expect(me.permissions).not.toContain('asset.create');
    expect(me.permissions).not.toContain('user.create');
    expect(me.permissions).not.toContain('report.export');
  });
});
