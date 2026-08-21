import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Lock, Save, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';
import { changePassword, getProfile, updateProfile } from '../api/profile';

function inputClass(hasError?: boolean) {
  return `mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
    hasError ? 'border-red-300' : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500'
  }`;
}

export default function ProfilePage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
  });

  const profile = data?.data;

  const [form, setForm] = useState({ name: '', email: '', phone: '', position: '' });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });

  const profileMut = useMutation({
    mutationFn: updateProfile,
    onSuccess: (res) => {
      toast.success('Profile updated.');
      qc.invalidateQueries({ queryKey: ['profile'] });
      setForm({
        name: res.data.name ?? '',
        email: res.data.email ?? '',
        phone: res.data.phone ?? '',
        position: res.data.position ?? '',
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const passwordMut = useMutation({
    mutationFn: () => changePassword(pw.currentPassword, pw.newPassword),
    onSuccess: () => {
      toast.success('Password changed.');
      setPw({ currentPassword: '', newPassword: '', confirmPassword: '' });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>;
  }
  if (!profile) {
    return <div className="p-6 text-center text-slate-400">Profile not found.</div>;
  }

  const saveProfile = () => {
    profileMut.mutate({
      name: form.name.trim() || undefined,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      position: form.position.trim() || null,
    });
  };

  const submitPassword = () => {
    if (pw.newPassword.length < 6) {
      toast.error('New password must be at least 6 characters.');
      return;
    }
    if (pw.newPassword !== pw.confirmPassword) {
      toast.error('New passwords do not match.');
      return;
    }
    passwordMut.mutate();
  };

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-6">
      <h1 className="text-2xl font-bold text-slate-900">Profile</h1>
      <p className="mt-1 text-sm text-slate-500">Manage your account details and password.</p>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
            <UserIcon className="h-6 w-6" />
          </div>
          <div>
            <p className="text-base font-semibold text-slate-900">{profile.name}</p>
            <p className="text-sm text-slate-500">@{profile.username} · {profile.employeeCode}</p>
          </div>
          <div className="ml-auto flex flex-wrap gap-1">
            {profile.roles.map((r) => (
              <span key={r} className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">{r}</span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700">Name *</label>
            <input type="text" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className={inputClass()} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Username</label>
            <input type="text" value={profile.username} disabled className={`${inputClass()} bg-slate-50 text-slate-500`} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} className={inputClass()} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Phone</label>
            <input type="text" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} className={inputClass()} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Position</label>
            <input type="text" value={form.position} onChange={(e) => setForm((p) => ({ ...p, position: e.target.value }))} className={inputClass()} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Department</label>
            <input type="text" value={profile.department ?? ''} disabled className={`${inputClass()} bg-slate-50 text-slate-500`} />
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={saveProfile}
            disabled={profileMut.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {profileMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Changes
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">Change Password</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-slate-700">Current Password *</label>
            <input type="password" value={pw.currentPassword} onChange={(e) => setPw((p) => ({ ...p, currentPassword: e.target.value }))} className={inputClass()} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">New Password *</label>
            <input type="password" value={pw.newPassword} onChange={(e) => setPw((p) => ({ ...p, newPassword: e.target.value }))} className={inputClass()} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Confirm New Password *</label>
            <input type="password" value={pw.confirmPassword} onChange={(e) => setPw((p) => ({ ...p, confirmPassword: e.target.value }))} className={inputClass()} />
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <button
            onClick={submitPassword}
            disabled={passwordMut.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {passwordMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} Change Password
          </button>
        </div>
      </div>
    </div>
  );
}
