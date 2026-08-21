import { apiGet, apiPatch } from '@/lib/api-client';

export interface Profile {
  id: string;
  employeeCode: string;
  name: string;
  email: string | null;
  username: string;
  phone: string | null;
  position: string | null;
  department: string | null;
  isActive: boolean;
  roles: string[];
  permissions: string[];
  createdAt: string;
  updatedAt: string;
}

export function getProfile() {
  return apiGet<{ success: boolean; data: Profile }>('/profile');
}

export function updateProfile(patch: { name?: string; email?: string | null; phone?: string | null; position?: string | null }) {
  return apiPatch<{ success: boolean; data: Profile }>('/profile', patch);
}

export function changePassword(currentPassword: string, newPassword: string) {
  return apiPatch<{ success: boolean; data: { success: boolean } }>('/profile/password', { currentPassword, newPassword });
}
