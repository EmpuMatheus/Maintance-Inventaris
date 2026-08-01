import { useState } from 'react';
import { Loader2 } from 'lucide-react';

export default function PasswordResetDialog({
  open,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (password: string) => void;
}) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  if (!open) return null;

  const submit = () => {
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setError('');
    onSubmit(password);
    setPassword('');
    setConfirm('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 pt-12" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-slate-200 px-6 py-4"><h3 className="text-lg font-semibold text-slate-900">Reset Password</h3></div>
        <div className="space-y-4 px-6 py-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">New Password *</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Confirm Password *</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={submit} disabled={isSubmitting} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />} Reset Password
          </button>
        </div>
      </div>
    </div>
  );
}
