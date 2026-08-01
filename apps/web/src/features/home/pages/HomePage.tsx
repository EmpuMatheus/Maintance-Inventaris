import { Package } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 shadow-lg">
          <Package className="h-8 w-8 text-white" />
        </div>
        <h1 className="mb-2 text-3xl font-bold text-slate-900">
          Office Inventory Maintenance System
        </h1>
        <p className="text-lg text-slate-500">Development Environment Ready</p>
      </div>
    </div>
  );
}
