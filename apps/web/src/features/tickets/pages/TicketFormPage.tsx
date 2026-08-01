import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { createTicket, updateTicket, getTicket, ticketKeys } from '../api/tickets';
import TicketForm from '../components/TicketForm';

export default function TicketFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ticketKeys.detail(id ?? ''),
    queryFn: () => getTicket(id!),
    enabled: isEdit,
  });

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => (isEdit ? updateTicket(id!, payload) : createTicket(payload)),
    onSuccess: (res) => {
      toast.success(isEdit ? 'Ticket updated.' : 'Ticket created.');
      queryClient.invalidateQueries({ queryKey: ticketKeys.all });
      navigate(`/tickets/${res.data.id}`, { replace: true });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>;
  }

  return (
    <TicketForm
      ticket={data?.data}
      isSubmitting={mutation.isPending}
      onSubmit={(payload) => mutation.mutate(payload)}
    />
  );
}
