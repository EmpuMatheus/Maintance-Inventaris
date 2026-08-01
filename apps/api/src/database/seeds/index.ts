import postgres from 'postgres';
import { env } from '@/config/env';
import { logger } from '@/lib/logger';
import * as argon2 from 'argon2';

const ROLES = [
  { name: 'SUPER_ADMIN', description: 'Full system access' },
  { name: 'IT_ADMIN', description: 'IT operational administrator' },
  { name: 'TECHNICIAN', description: 'Maintenance technician' },
  { name: 'VIEWER', description: 'Read-only access' },
] as const;

const PERMISSIONS = [
  { code: 'asset.read', name: 'Read Asset' },
  { code: 'asset.create', name: 'Create Asset' },
  { code: 'asset.update', name: 'Update Asset' },
  { code: 'asset.retire', name: 'Retire Asset' },
  { code: 'asset.dispose', name: 'Dispose Asset' },
  { code: 'asset.transfer', name: 'Transfer Asset' },
  { code: 'asset.assign', name: 'Assign Asset' },
  { code: 'asset.condition.update', name: 'Update Asset Condition' },
  { code: 'maintenance.read', name: 'Read Maintenance' },
  { code: 'maintenance.create', name: 'Create Maintenance' },
  { code: 'maintenance.update', name: 'Update Maintenance' },
  { code: 'maintenance.complete', name: 'Complete Maintenance' },
  { code: 'maintenance.cancel', name: 'Cancel Maintenance' },
  { code: 'ticket.read', name: 'Read Ticket' },
  { code: 'ticket.create', name: 'Create Ticket' },
  { code: 'ticket.update', name: 'Update Ticket' },
  { code: 'ticket.resolve', name: 'Resolve Ticket' },
  { code: 'master_data.read', name: 'Read Master Data' },
  { code: 'master_data.manage', name: 'Manage Master Data' },
  { code: 'report.read', name: 'Read Report' },
  { code: 'report.export', name: 'Export Report' },
  { code: 'user.read', name: 'Read User' },
  { code: 'user.create', name: 'Create User' },
  { code: 'user.update', name: 'Update User' },
  { code: 'user.delete', name: 'Delete User' },
  { code: 'role.read', name: 'Read Role' },
  { code: 'role.create', name: 'Create Role' },
  { code: 'role.update', name: 'Update Role' },
  { code: 'role.delete', name: 'Delete Role' },
  { code: 'audit.read', name: 'Read Audit Log' },
  { code: 'notification.read', name: 'Read Notification' },
  { code: 'settings.manage', name: 'Manage System Settings' },
] as const;

const ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: PERMISSIONS.map((p) => p.code),
  IT_ADMIN: [
    'asset.read', 'asset.create', 'asset.update', 'asset.retire',
    'asset.transfer', 'asset.assign', 'asset.condition.update',
    'maintenance.read', 'maintenance.create', 'maintenance.update', 'maintenance.complete', 'maintenance.cancel',
    'ticket.read', 'ticket.create', 'ticket.update', 'ticket.resolve',
    'master_data.read', 'master_data.manage',
    'report.read', 'report.export',
    'user.read', 'user.create', 'user.update', 'role.read', 'audit.read', 'notification.read',
  ],
  TECHNICIAN: [
    'asset.read',
    'maintenance.read', 'maintenance.create', 'maintenance.update', 'maintenance.complete',
    'ticket.read', 'ticket.create', 'ticket.update', 'ticket.resolve',
    'notification.read',
  ],
  VIEWER: [
    'asset.read', 'maintenance.read', 'ticket.read',
    'master_data.read', 'report.read', 'audit.read', 'notification.read',
  ],
};

async function seed() {
  const sql = postgres(env.DATABASE_URL, { max: 1 });

  try {
    logger.info('Starting database seed...');

    const now = new Date();

    for (const role of ROLES) {
      await sql`
        INSERT INTO roles (id, name, description, created_at)
        VALUES (gen_random_uuid(), ${role.name}, ${role.description}, ${now})
        ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
      `;
    }
    logger.info(`Seeded ${ROLES.length} roles`);

    for (const perm of PERMISSIONS) {
      await sql`
        INSERT INTO permissions (id, code, name, created_at)
        VALUES (gen_random_uuid(), ${perm.code}, ${perm.name}, ${now})
        ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
      `;
    }
    logger.info(`Seeded ${PERMISSIONS.length} permissions`);

    for (const [roleName, permCodes] of Object.entries(ROLE_PERMISSIONS)) {
      for (const code of permCodes) {
        await sql`
          INSERT INTO role_permissions (id, role_id, permission_id, created_at)
          SELECT gen_random_uuid(), r.id, p.id, ${now}
          FROM roles r, permissions p
          WHERE r.name = ${roleName} AND p.code = ${code}
          ON CONFLICT DO NOTHING
        `;
      }
    }
    logger.info('Seeded role-permission mappings');

    const devUsername = process.env.DEV_ADMIN_USERNAME || 'admin';
    const devPassword = process.env.DEV_ADMIN_PASSWORD || 'admin123';
    const passwordHash = await argon2.hash(devPassword, { type: argon2.argon2id });

    await sql`
      INSERT INTO users (id, employee_code, name, email, username, password_hash, is_active, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        ${devUsername},
        ${'Development Admin'},
        ${devUsername + '@office.local'},
        ${devUsername},
        ${passwordHash},
        true,
        ${now},
        ${now}
      )
      ON CONFLICT (username) DO UPDATE SET
        name = EXCLUDED.name,
        password_hash = EXCLUDED.password_hash,
        updated_at = ${now}
    `;

    const superAdminRole = await sql`SELECT id FROM roles WHERE name = 'SUPER_ADMIN' LIMIT 1`;
    if (superAdminRole.length > 0) {
      await sql`
        INSERT INTO user_roles (id, user_id, role_id, created_at)
        SELECT gen_random_uuid(), u.id, ${superAdminRole[0].id}, ${now}
        FROM users u
        WHERE u.username = ${devUsername}
        ON CONFLICT DO NOTHING
      `;
    }

    logger.info({ username: devUsername }, 'Development admin user created');

    logger.info('Database seed completed successfully');
  } catch (error) {
    logger.error({ error }, 'Database seed failed');
    throw error;
  } finally {
    await sql.end();
  }
}

seed().catch(() => {
  process.exit(1);
});
