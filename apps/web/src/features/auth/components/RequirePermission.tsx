import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

interface RequirePermissionProps {
  permission: string;
  children: ReactNode;
}

/** Renders children only when the user holds the given permission. */
export default function RequirePermission({ permission, children }: RequirePermissionProps) {
  const { can } = useAuth();

  if (!can(permission)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <p className="text-6xl font-black text-slate-200">403</p>
        <h1 className="mt-4 text-2xl font-bold text-slate-900">Access denied</h1>
        <p className="mt-2 max-w-sm text-sm text-slate-500">
          You do not have permission to view this page.
        </p>
        <Link
          to="/"
          className="mt-6 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
