import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { downloadReport } from '../api/reports';

export default function ExportButton({
  report,
  filters,
  label = 'Export',
}: {
  report: string;
  filters?: Record<string, unknown>;
  label?: string;
}) {
  const [loading, setLoading] = useState(false);

  const onClick = async () => {
    setLoading(true);
    try {
      await downloadReport(report, filters);
      toast.success('Report exported.');
    } catch (e) {
      toast.error((e as Error).message || 'Export failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} {label}
    </button>
  );
}
