import { describe, it, expect } from 'vitest';
import { createUserSchema, updateUserSchema, setStatusSchema, setPasswordSchema, setRoleSchema } from '@/modules/users/user.schema';

const UUID = '00000000-0000-0000-0000-000000000001';

describe('User schema validation', () => {
  it('accepts a valid create payload', () => {
    const r = createUserSchema.safeParse({
      employeeCode: '8000001',
      name: 'John Doe',
      username: 'john',
      password: 'secret123',
      roleId: UUID,
    });
    expect(r.success).toBe(true);
  });

  it('rejects short password', () => {
    expect(createUserSchema.safeParse({ employeeCode: '1', name: 'A', username: 'u', password: '123' }).success).toBe(false);
  });

  it('rejects invalid email', () => {
    expect(createUserSchema.safeParse({ employeeCode: '1', name: 'A', username: 'u', password: '123456', email: 'bad' }).success).toBe(false);
  });

  it('allows partial updates', () => {
    expect(updateUserSchema.safeParse({ name: 'Jane' }).success).toBe(true);
    expect(updateUserSchema.safeParse({ email: null }).success).toBe(true);
  });

  it('validates status/password/role', () => {
    expect(setStatusSchema.safeParse({ isActive: false }).success).toBe(true);
    expect(setStatusSchema.safeParse({ isActive: 'yes' }).success).toBe(false);
    expect(setPasswordSchema.safeParse({ password: 'newpass1' }).success).toBe(true);
    expect(setRoleSchema.safeParse({ roleId: UUID }).success).toBe(true);
    expect(setRoleSchema.safeParse({ roleId: UUID, categoryId: UUID }).success).toBe(true);
  });
});
