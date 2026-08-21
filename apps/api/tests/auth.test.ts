import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { env } from '@/config/env';
import { login, getCurrentUser } from '@/modules/auth/auth.service';
import * as userSvc from '@/modules/users/user.service';

const sql = postgres(env.DATABASE_URL, { max: 1 });
const tempIds: string[] = [];
const RUN = Date.now().toString(36);
let adminId: string;
let userRoleId: string;

async function createTempUser(label: string): Promise<string> {
  const username = `qa${label}${RUN}`;
  const u = await userSvc.create({
    employeeCode: `QA${label}${RUN}`.toUpperCase().slice(0, 30),
    name: `QA ${label}`,
    username,
    password: 'password123',
    roleId: userRoleId,
  });
  tempIds.push(u.id);
  return u.id;
}

beforeAll(async () => {
  const rows = await sql`SELECT id FROM users WHERE username = 'admin' LIMIT 1`;
  adminId = rows[0].id as string;
  const roleRows = await sql`SELECT id FROM roles WHERE name = 'USER' LIMIT 1`;
  userRoleId = roleRows[0].id as string;
});

afterAll(async () => {
  for (const id of tempIds) {
    await sql`DELETE FROM user_roles WHERE user_id = ${id}`;
    await sql`DELETE FROM users WHERE id = ${id}`;
  }
  await sql.end();
});

describe('Authentication', () => {
  it('logs in with valid credentials', async () => {
    const result = await login('admin', 'admin123');
    expect(result.accessToken).toBeTruthy();
    expect(result.user.username).toBe('admin');
    expect(result.user.roles).toContain('SUPER_ADMIN');
  });

  it('rejects a wrong password', async () => {
    await expect(login('admin', 'wrong-password')).rejects.toThrow('Invalid username or password.');
  });

  it('rejects an unknown user', async () => {
    await expect(login(`no_such_user_${RUN}`, 'password123')).rejects.toThrow('Invalid username or password.');
  });

  it('rejects a disabled user', async () => {
    const id = await createTempUser('dis');
    await userSvc.setActive(id, false);
    await expect(login(`qadis${RUN}`, 'password123')).rejects.toThrow('Invalid username or password.');
  });

  it('returns current user with roles and permissions', async () => {
    const me = await getCurrentUser(adminId);
    expect(me.username).toBe('admin');
    expect(me.permissions).toContain('asset.read');
    expect(me.permissions).toContain('audit.read');
  });

  it('supports concurrent logins', async () => {
    const [a, b] = await Promise.all([login('admin', 'admin123'), login('admin', 'admin123')]);
    expect(a.accessToken).toBeTruthy();
    expect(b.accessToken).toBeTruthy();
    expect(a.user.id).toBe(b.user.id);
  });

  it('allows password reset then login with the new password', async () => {
    const id = await createTempUser('pw');
    await userSvc.setPassword(id, 'newpass456');
    const result = await login(`qapw${RUN}`, 'newpass456');
    expect(result.user.username).toBe(`qapw${RUN}`);
  });

  it('rejects the old password after a reset', async () => {
    const id = await createTempUser('pw2');
    await userSvc.setPassword(id, 'newpass456');
    await expect(login(`qapw2${RUN}`, 'password123')).rejects.toThrow('Invalid username or password.');
  });
});
