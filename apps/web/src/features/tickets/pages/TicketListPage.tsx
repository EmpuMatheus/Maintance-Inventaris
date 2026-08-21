import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { listTickets, ticketKeys } from '../api/tickets';
import TicketTable from '../components/TicketTable';
import { TICKET_STATUSES, TICKET_PRIORITIES } from '../constants';
import type { Ticket, TicketFilters } from '../types';

export default function TicketListPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');

  const filters: TicketFilters = {
    page,
    search: search || undefined,
    status: status || undefined,
    priority: priority || undefined,
  };

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ticketKeys.list(filters),
    queryFn: () => listTickets(filters),
  });

  const moreActions = (t: Ticket) => {
    const items: { label: string; onClick: () => void }[] = [];
    if (['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD'].includes(t.status) && can('ticket.update')) {
      items.push({ label: 'Assign Technician', onClick: () => navigate(`/tickets/${t.id}`) });
    }
    if (t.status === 'ASSIGNED' && can('ticket.update')) {
      items.push({ label: 'Start Work', onClick: () => navigate(`/tickets/${t.id}`) });
    }
    if (['IN_PROGRESS', 'ON_HOLD'].includes(t.status) && can('ticket.resolve')) {
      items.push({ label: 'Resolve', onClick: () => navigate(`/tickets/${t.id}`) });
    }
    if (['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD'].includes(t.status) && can('ticket.update') && t.assetId) {
      items.push({ label: 'Create Maintenance', onClick: () => navigate(`/tickets/${t.id}`) });
    }
    return items;
  };

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tickets</h1>
          <p className="mt-1 text-sm text-slate-500">Track reported issues and their resolution.</p>
        </div>
        {can('ticket.create') && (
          <button
            onClick={() => navigate('/tickets/new')}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" /> New Ticket
          </button>
        )}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="relative sm:col-span-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search code, subject..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">All Statuses</option>
          {TICKET_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <select value={priority} onChange={(e) => { setPriority(e.target.value); setPage(1); }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">All Priorities</option>
          {TICKET_PRIORITIES.map((p) => <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>)}
        </select>
      </div>

      <TicketTable
        data={data?.data ?? []}
        isLoading={isLoading}
        isError={isError}
        errorMessage={(error as Error)?.message}
        onRetry={() => refetch()}
        page={page}
        meta={data?.meta}
        onPageChange={setPage}
        canUpdate={can('ticket.update')}
        moreActions={moreActions}
      />
    </div>
  );
}
