import { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Loader2, Package, Upload, Trash2, XCircle, FileText, Image, Activity, QrCode, User, MapPin, Printer, Eye, AlertCircle, ChevronLeft, ChevronRight, CheckCircle2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { getAsset, uploadPhoto, listDocuments, uploadDocument, deleteDocument, assignAsset, getAssignmentHistory, getMovementHistory, listMaster, retireAsset, deleteAssetPermanently, getComponents, deleteComponent, getActiveTransfer, getLatestTransfer, getTransferById, createTransfer, confirmTransfer, rejectTransfer, getReceiverContext } from '../api/inventory';
import { apiGet, apiPatch } from '@/lib/api-client';
import ConditionBadge from '@/components/ui/ConditionBadge';
import QrModal from '@/features/qr/components/QrModal';
import RetireDialog from '../components/RetireDialog';
import DeleteDialog from '../components/DeleteDialog';
import { listSchedules } from '@/features/maintenance-schedules/api/schedules';
import { buildBeritaAcaraHtml } from '../transferProof';

const ASGN_STYLES: Record<string, string> = { ACTIVE: 'bg-green-50 text-green-700', RETURNED: 'bg-slate-100 text-slate-500' };

const TRANSFER_ROLE_LABELS: Record<string, string> = {
  PREVIOUS_HOLDER: 'Pemegang Sebelumnya',
  NEXT_RECEIVER: 'Penerima Selanjutnya',
  CREATOR: 'Pembuat Transfer',
  KNOWER: 'Pihak Mengetahui',
};

function roleLabel(roles?: string[] | null): string {
  if (!roles || roles.length === 0) return '-';
  return roles.map((r) => TRANSFER_ROLE_LABELS[r] || r).join(' / ');
}

function fmtDateTime(value?: string | Date | null): string {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

function printBeritaAcara(html: string) {
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.onload = () => w.print();
}

/**
 * Renders the Berita Acara document inside a fixed-size card. The iframe is
 * laid out at true A4 width. On load the real document height is measured and a
 * uniform scale is computed so the ENTIRE document fits inside the card (both
 * width and height) — no internal scrollbar, no clipping, and the card never
 * grows. Fonts only shrink when the content genuinely exceeds the page.
 */
function TransferProofPreview({ html }: { html: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [scale, setScale] = useState(1);
  const [contentHeight, setContentHeight] = useState(1123);
  const A4_WIDTH = 794; // ~210mm at 96dpi
  const A4_HEIGHT = 1123; // ~297mm at 96dpi

  const recompute = useCallback((docHeight?: number) => {
    const el = containerRef.current;
    if (!el) return;
    const availW = el.clientWidth;
    const availH = el.clientHeight;
    const h = docHeight ?? contentHeight;
    if (availW <= 0 || availH <= 0 || h <= 0) return;
    setScale(Math.min(1, availW / A4_WIDTH, availH / h));
  }, [contentHeight]);

  const handleLoad = useCallback(() => {
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    const h = doc?.body?.scrollHeight || doc?.documentElement?.scrollHeight || A4_HEIGHT;
    setContentHeight(h);
    recompute(h);
  }, [recompute]);

  useEffect(() => {
    recompute();
    const ro = new ResizeObserver(() => recompute());
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [recompute]);

  const scaledW = A4_WIDTH * scale;
  const scaledH = contentHeight * scale;

  return (
    <div ref={containerRef} className="flex h-[80vh] w-full items-start justify-center overflow-hidden">
      <div style={{ width: scaledW, height: scaledH }}>
        <div style={{ width: A4_WIDTH, height: contentHeight, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          <iframe
            ref={iframeRef}
            srcDoc={html}
            title="Berita Acara Transfer Aset"
            scrolling="no"
            onLoad={handleLoad}
            className="border-0"
            style={{ width: A4_WIDTH, height: contentHeight }}
          />
        </div>
      </div>
    </div>
  );
}

export default function AssetDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can, user } = useAuth();
  const qc = useQueryClient();
  const photoRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState('OTHER');
  const [uploading, setUploading] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [showCond, setShowCond] = useState(false);
  const [condForm, setCondForm] = useState({ condition: '', reason: '', notes: '' });
  const [showAssign, setShowAssign] = useState(false);

  const [showTransfer, setShowTransfer] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [viewingReject, setViewingReject] = useState<{ userName: string; reason: string } | null>(null);
  const [viewingTransferProof, setViewingTransferProof] = useState<string | null>(null);
  const [asnForm, setAsnForm] = useState({ userId: '', assignedDate: '', notes: '' });

  const [trfForm, setTrfForm] = useState({ siteId: '', buildingId: '', floorId: '', roomId: '', departmentId: '', receiverUserId: '', witnessUserIds: [] as string[], reason: '', notes: '' });
  const [showRetire, setShowRetire] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showDeleteComponent, setShowDeleteComponent] = useState(false);
  const [componentToDelete, setComponentToDelete] = useState<{ id: string; componentName: string } | null>(null);
  const [movementPage, setMovementPage] = useState(1);
  const MOVEMENTS_PER_PAGE = 5;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['asset', id], queryFn: () => getAsset(id!), enabled: !!id,
  });
  const { data: history, refetch: refetchH } = useQuery({
    queryKey: ['asset-condition-history', id], queryFn: () => apiGet<any>(`/assets/${id}/condition-history`), enabled: !!id,
  });
  const { data: docs, refetch: refetchD } = useQuery({
    queryKey: ['asset-documents', id], queryFn: () => listDocuments(id!), enabled: !!id,
  });
  const { data: asnHist, refetch: refetchAH } = useQuery({
    queryKey: ['asset-assignments', id], queryFn: () => getAssignmentHistory(id!), enabled: !!id,
  });
  const { data: movHist, refetch: refetchMH } = useQuery({
    queryKey: ['asset-movements', id], queryFn: () => getMovementHistory(id!), enabled: !!id,
  });
  const { data: activeTransferData, refetch: refetchAT } = useQuery({
    queryKey: ['asset-active-transfer', id], queryFn: () => getActiveTransfer(id!), enabled: !!id,
  });
  const { data: latestTransferData, refetch: refetchLT } = useQuery({
    queryKey: ['asset-latest-transfer', id], queryFn: () => getLatestTransfer(id!), enabled: !!id,
  });
  const { data: transferProofData, isLoading: transferProofLoading } = useQuery({
    queryKey: ['asset-transfer-proof', viewingTransferProof],
    queryFn: () => getTransferById(viewingTransferProof!),
    enabled: !!viewingTransferProof,
  });
  const { data: components } = useQuery({
    queryKey: ['asset-components', id], queryFn: () => getComponents(id!), enabled: !!id,
  });
  const { data: schedules } = useQuery({
    queryKey: ['maintenance-schedules', 'list', { assetId: id }],
    queryFn: () => listSchedules({ assetId: id!, limit: 10 }),
    enabled: !!id,
  });

  const { data: picList } = useQuery({ queryKey: ['master', 'users'], queryFn: () => apiGet<any>('/master/users'), enabled: showAssign || showTransfer });
  const selectedAssignUser = picList?.data?.find((u: any) => u.id === asnForm.userId);
  const { data: siteList } = useQuery({ queryKey: ['master', 'active', 'sites'], queryFn: () => listMaster('sites', { isActive: 'true' }), enabled: showTransfer });
  const { data: bldgList } = useQuery({ queryKey: ['master', 'active', 'buildings', trfForm.siteId], queryFn: () => listMaster('buildings', { siteId: trfForm.siteId, isActive: 'true' }), enabled: !!trfForm.siteId });
  const { data: flrList } = useQuery({ queryKey: ['master', 'active', 'floors', trfForm.buildingId], queryFn: () => listMaster('floors', { buildingId: trfForm.buildingId, isActive: 'true' }), enabled: !!trfForm.buildingId });
  const { data: rmList } = useQuery({ queryKey: ['master', 'active', 'rooms', trfForm.floorId], queryFn: () => listMaster('rooms', { floorId: trfForm.floorId, isActive: 'true' }), enabled: !!trfForm.floorId });
  const { data: receiverCtx } = useQuery({
    queryKey: ['transfer-receiver-context', trfForm.receiverUserId],
    queryFn: () => getReceiverContext(trfForm.receiverUserId),
    enabled: showTransfer && !!trfForm.receiverUserId,
  });
  const receiverAutoLocation = !!(receiverCtx?.data?.location);

  useEffect(() => {
    const ctx = receiverCtx?.data;
    if (!showTransfer || !ctx) return;
    setTrfForm((p) => ({
      ...p,
      departmentId: ctx.departmentId ?? '',
      // When the receiver has an active location, follow it; otherwise clear any
      // stale location carried over from a previously selected PIC.
      siteId: ctx.location?.siteId ?? '',
      buildingId: ctx.location?.buildingId ?? '',
      floorId: ctx.location?.floorId ?? '',
      roomId: ctx.location?.roomId ?? '',
    }));
  }, [receiverCtx, showTransfer]);

  const photoMut = useMutation({
    mutationFn: (f: File) => uploadPhoto(id!, f),
    onSuccess: () => { toast.success('Photo uploaded'); qc.invalidateQueries({ queryKey: ['asset', id] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const docMut = useMutation({
    mutationFn: ({ file, type }: { file: File; type: string }) => uploadDocument(id!, file, type),
    onSuccess: () => { toast.success('Document uploaded'); refetchD(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delDocMut = useMutation({
    mutationFn: (docId: string) => deleteDocument(id!, docId),
    onSuccess: () => { toast.success('Document deleted'); refetchD(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const condMut = useMutation({
    mutationFn: (b: Record<string, unknown>) => apiPatch<any>(`/assets/${id}/condition`, b),
    onSuccess: () => { toast.success('Condition updated'); setShowCond(false); setCondForm({ condition: '', reason: '', notes: '' }); qc.invalidateQueries({ queryKey: ['asset', id] }); refetchH(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const asnMut = useMutation({
    mutationFn: (b: Record<string, unknown>) => assignAsset(id!, b),
    onSuccess: () => { toast.success('Asset assigned'); setShowAssign(false); qc.invalidateQueries({ queryKey: ['asset', id] }); refetchAH(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const trfMut = useMutation({
    mutationFn: (b: Record<string, unknown>) => createTransfer(id!, b),
    onSuccess: () => { toast.success('Transfer created'); setShowTransfer(false); qc.invalidateQueries({ queryKey: ['asset', id] }); qc.invalidateQueries({ queryKey: ['asset-active-transfer', id] }); qc.invalidateQueries({ queryKey: ['asset-latest-transfer', id] }); refetchAT(); refetchLT(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const confirmTrfMut = useMutation({
    mutationFn: (transferId: string) => confirmTransfer(transferId),
    onSuccess: (res: any) => {
      toast.success(res?.data?.completed ? 'All parties confirmed — transfer completed' : 'Confirmation recorded');
      setShowConfirmDialog(false);
      qc.invalidateQueries({ queryKey: ['asset', id] });
      qc.invalidateQueries({ queryKey: ['asset-active-transfer', id] });
      qc.invalidateQueries({ queryKey: ['asset-latest-transfer', id] });
      qc.invalidateQueries({ queryKey: ['asset-movements', id] });
      refetchAT();
      refetchLT();
      refetchMH();
      refetchAH();
    },
    onError: (e: Error) => { toast.error(e.message); refetchAT(); refetchLT(); },
  });
  const rejectTrfMut = useMutation({
    mutationFn: ({ transferId, reason }: { transferId: string; reason: string }) => rejectTransfer(transferId, reason),
    onSuccess: () => {
      toast.success('Transfer rejected');
      setRejectTarget(null);
      setRejectReason('');
      qc.invalidateQueries({ queryKey: ['asset', id] });
      qc.invalidateQueries({ queryKey: ['asset-active-transfer', id] });
      qc.invalidateQueries({ queryKey: ['asset-latest-transfer', id] });
      refetchAT();
      refetchLT();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const retireMut = useMutation({
    mutationFn: (b: { reason: string; notes?: string }) => retireAsset(id!, b),
    onSuccess: () => { toast.success('Asset retired.'); setShowRetire(false); qc.invalidateQueries({ queryKey: ['asset', id] }); qc.invalidateQueries({ queryKey: ['assets'] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: (b: { notes?: string }) => deleteAssetPermanently(id!, b),
    onSuccess: () => { toast.success('Asset permanently deleted.'); setShowDelete(false); qc.invalidateQueries({ queryKey: ['assets'] }); navigate('/inventory'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteComponentMut = useMutation({
    mutationFn: (componentId: string) => deleteComponent(id!, componentId),
    onSuccess: () => {
      toast.success('Component deleted successfully');
      setShowDeleteComponent(false);
      setComponentToDelete(null);
      qc.invalidateQueries({ queryKey: ['asset-components', id] });
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setShowDeleteComponent(false);
    },
  });

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) { setUploading(true); photoMut.mutate(f, { onSettled: () => setUploading(false) }); } };
  const handleDoc = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) { setUploading(true); docMut.mutate({ file: f, type: docType }, { onSettled: () => setUploading(false) }); } e.target.value = ''; };

  if (isLoading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>;
  if (isError) return <div className="p-6 text-center text-red-500">{(error as any)?.message || 'Asset not found.'}</div>;
  if (!data?.data) return <div className="p-6 text-center text-slate-400">Asset not found.</div>;

  const a = data.data;
  const InfoRow = ({ label, value }: { label: string; value?: string | null | number }) => (
    <div className="flex justify-between border-b border-slate-100 py-2 text-sm"><span className="text-slate-500">{label}</span><span className="font-medium text-slate-900">{value != null && value !== '' ? String(value) : '-'}</span></div>
  );
  const hData = ((history as any)?.data || (history as any[]) || []) as any[];
  const asnData = ((asnHist as any)?.data || (asnHist as any[]) || []) as any[];
  const movData = ((movHist as any)?.data || (movHist as any[]) || []) as any[];
  const scheduleData = (schedules?.data ?? []) as any[];
  const activeAsn = asnData.find((x: any) => x.status === 'ACTIVE');
  const conds = ['GOOD', 'FAIR', 'NEED_ATTENTION', 'BROKEN', 'CRITICAL'];

  if (viewingTransferProof) {
    const transfer = transferProofData?.data;
    return (
      <div className="mx-auto max-w-4xl p-4 md:p-6">
        <button onClick={() => setViewingTransferProof(null)} className="mb-4 inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
          <ArrowLeft className="h-4 w-4" /> Kembali ke Detail Asset
        </button>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          {transferProofLoading || !transfer ? <div className="p-8 text-center text-slate-500">Memuat bukti transfer...</div> : <TransferProofPreview html={buildBeritaAcaraHtml(transfer, a, components?.data)} />}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-6">
      <button onClick={() => navigate('/inventory')} className="mb-4 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"><ArrowLeft className="h-4 w-4" /> Inventory</button>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-100">
              {a.photoUrl ? <img src={a.photoUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-slate-300"><Package className="h-8 w-8" /></div>}
              {can('asset.update') && <button onClick={() => photoRef.current?.click()} className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100"><Upload className="h-5 w-5 text-white" /></button>}
              <input ref={photoRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhoto} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{a.assetName || 'Unnamed Asset'}</h1>
              <p className="font-mono text-sm text-slate-400">{a.assetCode}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <ConditionBadge condition={a.condition} size="lg" />
                <span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-medium ${a.status === 'RETIRED' ? 'bg-slate-200 text-slate-600' : a.status === 'ASSIGNED' ? 'bg-indigo-50 text-indigo-700' : a.status === 'AVAILABLE' ? 'bg-blue-50 text-blue-700' : a.status === 'IN_USE' ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-600'}`}>{a.status?.replace(/_/g, ' ')}</span>
                {can('asset.update') && <button onClick={() => { setCondForm({ condition: a.condition || '', reason: '', notes: '' }); setShowCond(true); }} className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"><Activity className="h-3.5 w-3.5" /> Update Condition</button>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowQr(true)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"><QrCode className="h-4 w-4" /> QR</button>
            {can('asset.update') && a.status !== 'RETIRED' && <button onClick={() => navigate(`/assets/${id}/edit`)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"><Pencil className="h-4 w-4" /> Edit</button>}
            {can('asset.retire') && a.status !== 'RETIRED' && <button onClick={() => setShowRetire(true)} className="inline-flex items-center gap-2 rounded-lg border border-amber-300 px-3 py-2 text-sm text-amber-700 hover:bg-amber-50"><Trash2 className="h-4 w-4" /> Retire</button>}
            {can('asset.delete') && <button onClick={() => setShowDelete(true)} className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50"><XCircle className="h-4 w-4" /> Delete Permanently</button>}
          </div>
        </div>
      </div>

      {a.status === 'RETIRED' && (
        <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-700">Asset Retired</p>
          <p className="mt-1 text-xs text-slate-500">This asset has been retired and is no longer available for assignment, transfer, maintenance or tickets.</p>
          <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
            <div><span className="font-medium text-slate-500">Reason: </span>{a.retireReason?.replace(/_/g, ' ') || '-'}</div>
            <div><span className="font-medium text-slate-500">Retired by: </span>{a.retiredByName || '-'}</div>
            <div><span className="font-medium text-slate-500">Date: </span>{a.retiredAt ? new Date(a.retiredAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</div>
          </div>
          {a.retireNote && <p className="mt-2 text-xs text-slate-500"><span className="font-medium text-slate-500">Notes: </span>{a.retireNote}</p>}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Asset Info */}
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">Asset Information</h2>
          <InfoRow label="Category" value={a.categoryCode && a.categoryName ? `${a.categoryCode} - ${a.categoryName}` : a.categoryName} />
          <InfoRow label="Subcategory" value={a.subcategoryCode && a.subcategoryName ? `${a.subcategoryCode} - ${a.subcategoryName}` : a.subcategoryName} />
          <InfoRow label="Brand" value={a.brandName} /><InfoRow label="Model" value={a.model} />
          <InfoRow label="Serial Number" value={a.serialNumber} /><InfoRow label="Manufacturer" value={a.manufacturer} />
          <InfoRow label="Specification" value={a.specification} />
        </div>

        {/* Assignment */}
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">Assignment</h2>
          {activeAsn ? (
            <>
              <InfoRow label="Assigned To" value={activeAsn.userName || '-'} />
              <InfoRow label="Department" value={activeAsn.departmentName || '-'} />
              <InfoRow label="Assigned Since" value={activeAsn.assignedDate} />
              <div className="mt-3 flex gap-2">
              </div>
            </>
          ) : (
            <>
              <p className="mb-3 text-sm text-slate-400">Not currently assigned.</p>
              {can('asset.assign') && a.status !== 'RETIRED' && <button onClick={() => { setAsnForm({ userId: '', assignedDate: new Date().toISOString().slice(0, 10), notes: '' }); setShowAssign(true); }} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"><User className="h-4 w-4" /> Assign Asset</button>}
            </>
          )          }
          {(!!latestTransferData?.data || !!activeTransferData?.data || (activeAsn && can('asset.transfer'))) && a.status !== 'RETIRED' && (
            <div className="mt-2">
              {(() => {
                const lt = latestTransferData?.data;
                const at = activeTransferData?.data;
                // Prefer the still-open transfer; otherwise the latest terminal one.
                const transfer = at || lt;
                const status = transfer?.status as string | undefined;
                const isPending = status === 'PENDING' || status === 'IN_PROGRESS';
                const confirmations = (transfer?.confirmations || []) as any[];
                const myConfirmation = confirmations.find((c) => c.userId === user?.id);

                // No transfer yet: only offer Transfer Location with an active assignment.
                if (!transfer) {
                  if (!activeAsn || !can('asset.transfer')) return null;
                  return (
                    <button onClick={() => { setTrfForm({ siteId: '', buildingId: '', floorId: '', roomId: '', departmentId: '', receiverUserId: '', witnessUserIds: [], reason: '', notes: '' }); setShowTransfer(true); }} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"><MapPin className="h-4 w-4" /> Transfer Location</button>
                  );
                }

                return (
                  <div className="space-y-2">
                    {/* PENDING: status + confirmation block + actions */}
                    {transfer && isPending && (
                      <>
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                          <span className="font-medium">Menunggu Konfirmasi</span>
                          <div className="mt-1 text-xs text-slate-500">
                            {transfer.fromRoomName || '-'} → {transfer.toRoomName || '-'}
                          </div>
                        </div>

                        {confirmations.length > 0 && (
                          <div className="space-y-1.5 rounded-lg border border-slate-100 bg-slate-50/60 p-3">
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Transfer Confirmation</p>
                            {confirmations.map((c) => {
                              const cs = c.status as string;
                              const rejected = cs === 'REJECTED';
                              return (
                                <div
                                  key={c.userId}
                                  className={`flex items-start gap-2 text-sm ${rejected && c.reason ? 'cursor-pointer rounded px-1 -mx-1 hover:bg-red-50' : ''}`}
                                  onClick={() => rejected && c.reason && setViewingReject({ userName: c.userName || 'User', reason: c.reason })}
                                >
                                  <span className="mt-0.5 shrink-0">
                                    {cs === 'CONFIRMED' ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                                      : rejected ? <XCircle className="h-4 w-4 text-red-500" />
                                      : <Clock className="h-4 w-4 text-slate-400" />}
                                  </span>
                                  <div className="min-w-0">
                                    <p className="font-medium text-slate-700">{c.userName || 'Unknown User'}</p>
                                    <p className="text-xs text-slate-500">{roleLabel(c.roles)}</p>
                                    <p className="text-xs text-slate-400">
                                      {cs === 'CONFIRMED' ? `Confirmed — ${fmtDateTime(c.confirmedAt)}`
                                        : rejected ? 'Rejected (klik untuk alasan)'
                                        : 'Pending'}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => printBeritaAcara(buildBeritaAcaraHtml(transfer, a, components?.data))}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                          >
                            <Printer className="h-3.5 w-3.5" /> Print Bukti Transfer
                          </button>
                          {myConfirmation?.status === 'PENDING' && (
                            <>
                              <button
                                onClick={() => setShowConfirmDialog(true)}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs text-white hover:bg-indigo-700"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" /> Confirm Transfer
                              </button>
                              <button
                                onClick={() => { setRejectReason(''); setRejectTarget(transfer.id); }}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
                              >
                                <XCircle className="h-3.5 w-3.5" /> Reject
                              </button>
                            </>
                          )}
                        </div>
                      </>
                    )}

                    {/* COMPLETED: concise summary only (no confirmation list) */}
                    {transfer && status === 'COMPLETED' && (
                      <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                        <span className="inline-flex items-center gap-1.5 font-medium"><CheckCircle2 className="h-4 w-4" /> Selesai</span>
                        <div className="mt-1 text-xs text-slate-500">
                          {transfer.fromRoomName || '-'} → {transfer.toRoomName || '-'}
                        </div>
                      </div>
                    )}

                    {/* REJECTED: concise summary, click to view reason (no confirmation list) */}
                    {transfer && status === 'REJECTED' && (
                      <button
                        type="button"
                        onClick={() => setViewingReject({ userName: transfer.rejectedByName || 'User', reason: transfer.rejectionReason || '' })}
                        className="w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-left text-sm text-red-700 hover:bg-red-100"
                      >
                        <span className="font-medium">Ditolak</span>
                        <div className="mt-1 text-xs text-slate-500">
                          {transfer.fromRoomName || '-'} → {transfer.toRoomName || '-'}
                        </div>
                        <div className="mt-1 text-xs text-red-600">
                          Ditolak oleh: <span className="font-medium">{transfer.rejectedByName || '-'}</span>
                        </div>
                        <div className="text-xs text-red-500">{fmtDateTime(transfer.rejectedAt)}</div>
                        <div className="mt-0.5 text-[11px] text-red-400 underline">Klik untuk melihat alasan</div>
                      </button>
                    )}

                    {/* Transfer Location is only offered for a fresh transfer and
                        only when the asset currently has an ACTIVE assignment. */}
                    {(status === 'COMPLETED' || status === 'REJECTED' || status === 'CANCELLED') && activeAsn && can('asset.transfer') && (
                      <button onClick={() => { setTrfForm({ siteId: '', buildingId: '', floorId: '', roomId: '', departmentId: '', receiverUserId: '', witnessUserIds: [], reason: '', notes: '' }); setShowTransfer(true); }} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"><MapPin className="h-4 w-4" /> Transfer Location</button>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* Purchase & Warranty */}
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">Purchase & Warranty</h2>
          <InfoRow label="Purchase Date" value={a.purchaseDate} /><InfoRow label="Price" value={a.purchasePrice ? String(a.purchasePrice) : undefined} />
          <InfoRow label="Vendor" value={a.vendorName} /><InfoRow label="Invoice" value={a.invoiceNumber} />
          <InfoRow label="Warranty Start" value={a.warrantyStart} /><InfoRow label="Warranty End" value={a.warrantyEnd} />
        </div>

        {/* Location */}
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">Location</h2>
          <InfoRow label="Site" value={a.siteCode && a.siteName ? `${a.siteCode} - ${a.siteName}` : a.siteName} />
          <InfoRow label="Building" value={a.buildingCode && a.buildingName ? `${a.buildingCode} - ${a.buildingName}` : a.buildingName} />
          <InfoRow label="Floor" value={a.floorCode && a.floorName ? `${a.floorCode} - ${a.floorName}` : a.floorName} />
          <InfoRow label="Room" value={a.roomCode && a.roomName ? `${a.roomCode} - ${a.roomName}` : a.roomName} />
          <InfoRow label="Department" value={a.departmentCode && a.departmentName ? `${a.departmentCode} - ${a.departmentName}` : a.departmentName} />
          <InfoRow label="PIC" value={a.picName} />
        </div>

        {/* Preventive Maintenance */}
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Preventive Maintenance</h2>
            {a.status !== 'RETIRED' && <button onClick={() => navigate('/maintenance/schedules')} className="text-xs font-medium text-indigo-600 hover:underline">Schedules</button>}
          </div>
          {scheduleData.length === 0 ? (
            <p className="text-sm text-slate-400">No preventive maintenance schedule for this asset.</p>
          ) : (
            <div className="space-y-3">
              {scheduleData.map((sc: any) => (
                <div key={sc.id} className="rounded-lg border border-slate-100 p-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-700">{sc.maintenanceType?.name || 'Preventive'}</span>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      sc.state === 'OVERDUE' ? 'bg-red-50 text-red-700' : sc.state === 'DUE_TODAY' ? 'bg-amber-50 text-amber-700' : sc.isActive === false ? 'bg-slate-100 text-slate-500' : 'bg-blue-50 text-blue-700'
                    }`}>
                      {sc.isActive === false ? 'Inactive' : (sc.state || 'Upcoming').replace(/_/g, ' ')}
                    </span>
                  </div>
                  <InfoRow label="Frequency" value={sc.frequencyValue > 1 ? `${sc.frequencyType.replace(/_/g, ' ')} × ${sc.frequencyValue}` : sc.frequencyType.replace(/_/g, ' ')} />
                  <InfoRow label="Next Due" value={sc.nextMaintenanceDate || '-'} />
                  <InfoRow label="Last Maintenance" value={sc.lastMaintenanceDate || '-'} />
                  {sc.state === 'OVERDUE' && sc.daysOverdue != null && <p className="mt-1 text-xs font-medium text-red-600">{sc.daysOverdue} days overdue</p>}
                  {sc.state === 'UPCOMING' && sc.daysUntil != null && <p className="mt-1 text-xs font-medium text-blue-600">due in {sc.daysUntil} days</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* History Sections */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Condition History */}
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">Condition History</h2>
          {hData.length === 0 && <p className="text-sm text-slate-400">No condition history recorded.</p>}
          <div className="space-y-3">{hData.map((h: any, i: number) => (
            <div key={h.id || i} className="relative pl-5 before:absolute before:left-1.5 before:top-2 before:h-2 before:w-2 before:rounded-full before:bg-slate-300">
              <div className="mb-1 text-xs text-slate-400">{new Date(h.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} {new Date(h.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
              <div className="flex items-center gap-2"><ConditionBadge condition={h.previousCondition} /> <span className="text-sm text-slate-400">→</span> <ConditionBadge condition={h.newCondition} /></div>
              {h.reason && <p className="mt-0.5 text-sm text-slate-500">{h.reason}</p>}
              <p className="mt-0.5 text-xs text-slate-400">{i === hData.length - 1 && h.newCondition === a.condition ? 'Created during asset registration' : 'Changed by Administrator'}</p>
            </div>
          ))}</div>
        </div>

        {/* Assignment History */}
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">Assignment History</h2>
          {asnData.length === 0 && <p className="text-sm text-slate-400">No assignment history.</p>}
          <div className="space-y-3">{asnData.map((h: any, i: number) => (
            <div key={h.id || i} className="relative pl-5 before:absolute before:left-1.5 before:top-2 before:h-2 before:w-2 before:rounded-full before:bg-slate-300">
              <div className="mb-1 text-xs text-slate-400">{h.assignedDate}{h.returnedDate ? ` → ${h.returnedDate}` : ' → Present'}</div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-slate-700">{h.userName || 'Unknown User'}</p>
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ASGN_STYLES[h.status] || 'bg-slate-100 text-slate-500'}`}>{h.status}</span>
              </div>
              {h.departmentName && <p className="text-xs text-slate-500">{h.departmentName}</p>}
            </div>
          ))}</div>
        </div>
      </div>

      {/* Movement History */}
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">Movement History</h2>
        {movData.length === 0 && <p className="text-sm text-slate-400">No movement history.</p>}
        {movData.length > 0 && (() => {
          const totalPages = Math.max(1, Math.ceil(movData.length / MOVEMENTS_PER_PAGE));
          const currentPage = Math.min(movementPage, totalPages);
          const pageRows = movData.slice((currentPage - 1) * MOVEMENTS_PER_PAGE, currentPage * MOVEMENTS_PER_PAGE);
          return (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500">
                      <th className="px-3 py-2 font-medium">Tanggal</th>
                      <th className="px-3 py-2 font-medium">Dari</th>
                      <th className="px-3 py-2 font-medium">Ke</th>
                      <th className="px-3 py-2 text-right font-medium">Bukti</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((h: any, i: number) => (
                      <tr key={h.id || i} className="border-b border-slate-100 last:border-0">
                        <td className="whitespace-nowrap px-3 py-3 text-slate-500">{h.movementDate || new Date(h.createdAt).toLocaleDateString('en-GB')}</td>
                        <td className="px-3 py-3 text-slate-500">{h.fromRoomName || '-'}</td>
                        <td className="px-3 py-3 font-medium text-slate-700">{h.toRoomName || '-'}</td>
                        <td className="px-3 py-3 text-right">
                          {h.transferId ? (
                            <button
                              onClick={() => setViewingTransferProof(h.transferId)}
                              className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800"
                            >
                              <Eye className="h-3.5 w-3.5" /> Lihat Bukti
                            </button>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
                  <span>Page {currentPage} of {totalPages} ({movData.length} total)</span>
                  <div className="flex items-center gap-2">
                    <button disabled={currentPage <= 1} onClick={() => setMovementPage((p) => Math.max(1, p - 1))} className="rounded-lg border border-slate-300 p-2 disabled:opacity-30 hover:bg-slate-50"><ChevronLeft className="h-4 w-4" /></button>
                    <button disabled={currentPage >= totalPages} onClick={() => setMovementPage((p) => Math.min(totalPages, p + 1))} className="rounded-lg border border-slate-300 p-2 disabled:opacity-30 hover:bg-slate-50"><ChevronRight className="h-4 w-4" /></button>
                  </div>
                </div>
              )}
            </>
          );
        })()}
      </div>

      {/* Documents */}
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Documents</h2>
          {can('asset.update') && (
            <div className="flex items-center gap-2">
              <select value={docType} onChange={(e) => setDocType(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs">
                <option value="OTHER">Other</option><option value="INVOICE">Invoice</option><option value="WARRANTY">Warranty</option><option value="MANUAL">Manual</option><option value="PURCHASE_DOCUMENT">Purchase Document</option>
              </select>
              <button onClick={() => docRef.current?.click()} disabled={uploading} className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs text-white hover:bg-indigo-700 disabled:opacity-50">
                {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />} Upload
              </button>
              <input ref={docRef} type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" className="hidden" onChange={handleDoc} />
            </div>
          )}
        </div>
        {(!docs?.data || docs.data.length === 0) && <p className="text-sm text-slate-400">No documents uploaded.</p>}
        <div className="space-y-2">{docs?.data?.map((d: any) => (
          <div key={d.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
            <div className="flex items-center gap-3">
              <div className="text-slate-400">{d.documentType === 'PHOTO' ? <Image className="h-4 w-4" /> : <FileText className="h-4 w-4" />}</div>
              <div><p className="text-sm font-medium text-slate-700">{d.fileName}</p><p className="text-xs text-slate-400">{d.documentType}</p></div>
            </div>
            <div className="flex items-center gap-2">
              <a href={d.fileUrl} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline">View</a>
              {can('asset.update') && <button onClick={() => delDocMut.mutate(d.id)} className="rounded p-1 text-slate-400 hover:text-red-600"><Trash2 className="h-3 w-3" /></button>}
            </div>
          </div>
        ))}</div>
      </div>

      {/* Components */}
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">Components</h2>
        {(!components?.data || components.data.length === 0) && <p className="text-sm text-slate-400">No components.</p>}
        <div className="space-y-2">
          {components?.data?.map((comp: any, idx: number) => (
            <div key={comp.id} className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Component {idx + 1}</span>
                {can('asset.update') && (
                  <button
                    onClick={() => {
                      setComponentToDelete({ id: comp.id, componentName: comp.componentName });
                      setShowDeleteComponent(true);
                    }}
                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-slate-500 hover:bg-red-50 hover:text-red-600"
                    title="Delete component"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-xs text-slate-400">Component Name</p>
                  <p className="font-medium text-slate-900">{comp.componentName}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Model</p>
                  <p className="font-medium text-slate-900">{comp.model}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Serial Number</p>
                  <p className="font-medium text-slate-900">{comp.serialNumber}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showQr && <QrModal assetCode={a.assetCode} assetName={a.assetName} onClose={() => setShowQr(false)} />}

      <RetireDialog
        open={showRetire}
        assetCode={a.assetCode}
        assetName={a.assetName}
        isSubmitting={retireMut.isPending}
        onClose={() => setShowRetire(false)}
        onConfirm={(payload) => retireMut.mutate(payload)}
      />

      <DeleteDialog
        open={showDelete}
        assetCode={a.assetCode}
        assetName={a.assetName}
        isSubmitting={deleteMut.isPending}
        onClose={() => setShowDelete(false)}
        onConfirm={(payload) => deleteMut.mutate(payload)}
      />

      {/* Condition Modal */}
      {showCond && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 pt-12" onClick={() => setShowCond(false)}>
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-slate-200 px-6 py-4"><h3 className="text-lg font-semibold text-slate-900">Update Asset Condition</h3></div>
            <div className="space-y-4 px-6 py-4">
              <div className="rounded-lg bg-slate-50 px-4 py-3"><p className="text-xs font-medium uppercase tracking-wider text-slate-400">Asset</p><p className="font-mono text-sm text-slate-700">{a.assetCode}</p><p className="text-sm text-slate-600">{a.assetName}</p></div>
              <div className="flex items-center gap-3">
                <div><p className="text-xs text-slate-400">Current</p><ConditionBadge condition={a.condition} size="md" /></div>
                <span className="text-slate-300">→</span>
                <div><p className="text-xs text-slate-400">New *</p>
                  <select value={condForm.condition} onChange={(e) => setCondForm(p => ({ ...p, condition: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none">
                    <option value="">Select...</option>{conds.filter(c => c !== a.condition).map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
              </div>
              <div><label className="block text-sm font-medium text-slate-700">Reason</label><input type="text" value={condForm.reason} onChange={(e) => setCondForm(p => ({ ...p, reason: e.target.value }))} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" placeholder="e.g. Battery swollen" /></div>
              <div><label className="block text-sm font-medium text-slate-700">Notes</label><textarea value={condForm.notes} onChange={(e) => setCondForm(p => ({ ...p, notes: e.target.value }))} rows={3} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" /></div>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button onClick={() => setShowCond(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={() => { if (!condForm.condition) { toast.error('Please select a condition'); return; } condMut.mutate(condForm); }} disabled={condMut.isPending} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50">
                {condMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Update Condition
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {showAssign && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 pt-12" onClick={() => setShowAssign(false)}>
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-slate-200 px-6 py-4"><h3 className="text-lg font-semibold text-slate-900">Assign Asset</h3></div>
            <div className="space-y-4 px-6 py-4">
              <div className="rounded-lg bg-slate-50 px-4 py-3"><p className="text-xs font-medium uppercase tracking-wider text-slate-400">Asset</p><p className="font-mono text-sm text-slate-700">{a.assetCode}</p><p className="text-sm text-slate-600">{a.assetName}</p></div>
              <div><label className="block text-sm font-medium text-slate-700">Assign To *</label>
                <select value={asnForm.userId} onChange={(e) => setAsnForm(p => ({ ...p, userId: e.target.value }))} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none">
                  <option value="">Select user...</option>
                  {picList?.data?.map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.username})</option>)}
                </select>
              </div>
              <div><label className="block text-sm font-medium text-slate-700">Department</label>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={
                    !asnForm.userId
                      ? ''
                      : selectedAssignUser?.departmentName
                      ? `${selectedAssignUser.departmentCode ? selectedAssignUser.departmentCode + ' - ' : ''}${selectedAssignUser.departmentName}`
                      : '-'
                  }
                  placeholder="Otomatis dari data user"
                  className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-600 cursor-not-allowed"
                />
                {asnForm.userId && !selectedAssignUser?.departmentName && (
                  <p className="mt-1 text-xs text-amber-600">User yang dipilih belum memiliki department.</p>
                )}
              </div>
              <div><label className="block text-sm font-medium text-slate-700">Assignment Date</label><input type="date" value={asnForm.assignedDate} onChange={(e) => setAsnForm(p => ({ ...p, assignedDate: e.target.value }))} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" /></div>
              <div><label className="block text-sm font-medium text-slate-700">Notes</label><textarea value={asnForm.notes} onChange={(e) => setAsnForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" /></div>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button onClick={() => setShowAssign(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={() => asnMut.mutate(asnForm)} disabled={asnMut.isPending || !asnForm.userId} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50">
                {asnMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Assign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransfer && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 pt-12" onClick={() => setShowTransfer(false)}>
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-slate-200 px-6 py-4"><h3 className="text-lg font-semibold text-slate-900">Transfer Asset</h3></div>
            <div className="space-y-4 px-6 py-4">
              <div className="rounded-lg bg-slate-50 px-4 py-3"><p className="text-xs font-medium uppercase tracking-wider text-slate-400">Asset</p><p className="font-mono text-sm text-slate-700">{a.assetCode}</p><p className="text-sm text-slate-600">{a.assetName}</p></div>
              <div className="rounded-lg bg-slate-50 px-4 py-3"><p className="text-xs text-slate-400">Current Location</p><p className="text-sm text-slate-700">{a.siteName || '-'} / {a.buildingName || '-'} / {a.floorName || '-'} / {a.roomName || '-'}</p></div>

              <div className="rounded-lg border border-slate-200 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Pihak yang Terlibat</p>
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-500">Pemegang Sebelumnya</label>
                    <p className="text-sm text-slate-700">{activeAsn?.userName || a.picName || 'Tidak ada (tidak ter-assign)'}</p>
                  </div>
                  <div className="border-t border-slate-100 pt-2">
                    <label className="block text-xs font-medium text-slate-500">Pembuat Transfer</label>
                    <p className="text-sm text-slate-700">{user?.name || '-'}</p>
                  </div>
                  <div className="border-t border-slate-100 pt-2">
                    <label className="block text-sm font-medium text-slate-700">Penerima Selanjutnya *</label>
                    <select value={trfForm.receiverUserId} onChange={(e) => setTrfForm(p => ({ ...p, receiverUserId: e.target.value }))} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none">
                      <option value="">Select user...</option>
                      {picList?.data?.map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.username})</option>)}
                    </select>
                    {receiverCtx?.data && (
                      <div className="mt-2 grid gap-1 text-xs text-slate-500">
                        <div><span className="text-slate-400">Department: </span><span className="font-medium text-slate-700">{receiverCtx.data.departmentName || '-'}</span></div>
                        {receiverCtx.data.location ? (
                          <div><span className="text-slate-400">Lokasi Tujuan: </span><span className="font-medium text-slate-700">{[receiverCtx.data.location.siteName, receiverCtx.data.location.buildingName, receiverCtx.data.location.floorName, receiverCtx.data.location.roomName].filter(Boolean).join(' / ') || '-'}</span></div>
                        ) : (
                          <div className="text-amber-600">PIC ini belum memiliki lokasi aktif; tentukan lokasi tujuan secara manual.</div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="border-t border-slate-100 pt-2">
                    <label className="block text-sm font-medium text-slate-700">Pihak yang Mengetahui</label>
                    <p className="mb-1 text-xs text-slate-400">Pihak yang perlu mengetahui transfer ini.</p>
                    <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
                      {picList?.data?.length ? picList.data.map((u: any) => (
                        <label key={u.id} className="flex items-center gap-2 text-sm text-slate-600">
                          <input
                            type="checkbox"
                            checked={trfForm.witnessUserIds.includes(u.id)}
                            onChange={(e) => setTrfForm((p) => ({
                              ...p,
                              witnessUserIds: e.target.checked ? [...p.witnessUserIds, u.id] : p.witnessUserIds.filter((x) => x !== u.id),
                            }))}
                          />
                          {u.name} ({u.username})
                        </label>
                      )) : <p className="text-xs text-slate-400">No users available.</p>}
                    </div>
                  </div>
                </div>
              </div>

              {receiverAutoLocation ? (
                <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-xs text-indigo-700">
                  Lokasi tujuan otomatis mengikuti PIC yang dipilih.
                </div>
              ) : (
                <>
                  <div><label className="block text-sm font-medium text-slate-700">New Site *</label>
                    <select value={trfForm.siteId} onChange={(e) => setTrfForm(p => ({ ...p, siteId: e.target.value, buildingId: '', floorId: '', roomId: '' }))} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none">
                      <option value="">Select site...</option>
                      {siteList?.data?.map((s: any) => <option key={s.id} value={s.id}>{s.code} - {s.name}</option>)}
                    </select>
                  </div>
                  <div><label className="block text-sm font-medium text-slate-700">Building *</label>
                    <select value={trfForm.buildingId} onChange={(e) => setTrfForm(p => ({ ...p, buildingId: e.target.value, floorId: '', roomId: '' }))} disabled={!trfForm.siteId} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none disabled:bg-slate-50">
                      <option value="">Select building...</option>
                      {bldgList?.data?.map((b: any) => <option key={b.id} value={b.id}>{b.code} - {b.name}</option>)}
                    </select>
                  </div>
                  <div><label className="block text-sm font-medium text-slate-700">Floor *</label>
                    <select value={trfForm.floorId} onChange={(e) => setTrfForm(p => ({ ...p, floorId: e.target.value, roomId: '' }))} disabled={!trfForm.buildingId} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none disabled:bg-slate-50">
                      <option value="">Select floor...</option>
                      {flrList?.data?.map((f: any) => <option key={f.id} value={f.id}>{f.code} - {f.name}</option>)}
                    </select>
                  </div>
                  <div><label className="block text-sm font-medium text-slate-700">Room *</label>
                    <select value={trfForm.roomId} onChange={(e) => setTrfForm(p => ({ ...p, roomId: e.target.value }))} disabled={!trfForm.floorId} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none disabled:bg-slate-50">
                      <option value="">Select room...</option>
                      {rmList?.data?.map((r: any) => <option key={r.id} value={r.id}>{r.code} - {r.name}</option>)}
                    </select>
                  </div>
                </>
              )}
               <div><label className="block text-sm font-medium text-slate-700">Reason</label><textarea value={trfForm.reason} onChange={(e) => setTrfForm(p => ({ ...p, reason: e.target.value }))} rows={2} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" /></div>
             </div>
            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button onClick={() => setShowTransfer(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={() => {
                if (!trfForm.siteId || !trfForm.buildingId || !trfForm.floorId || !trfForm.roomId) { toast.error('Please select a complete location'); return; }
                if (!trfForm.receiverUserId) { toast.error('Please select the next receiver'); return; }
                trfMut.mutate(trfForm);
              }} disabled={trfMut.isPending} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50">
                {trfMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Transfer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Transfer Dialog */}
      {showConfirmDialog && (activeTransferData?.data?.id || latestTransferData?.data?.id) && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 pt-12" onClick={() => setShowConfirmDialog(false)}>
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-slate-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-slate-900">Confirm Transfer</h3>
            </div>
            <div className="space-y-4 px-6 py-4">
              <div className="rounded-lg bg-slate-50 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Asset</p>
                <p className="font-mono text-sm text-slate-700">{a.assetCode}</p>
              </div>
              <div className="rounded-lg bg-slate-50 px-4 py-3">
                <p className="text-xs text-slate-400 mb-2">Transfer Location</p>
                <p className="text-sm text-slate-700">
                  From: {(activeTransferData?.data?.fromRoomName || latestTransferData?.data?.fromRoomName) || '-'}
                  <br />
                  To: {(activeTransferData?.data?.toRoomName || latestTransferData?.data?.toRoomName) || '-'}
                </p>
              </div>
              <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-800">
                  Konfirmasi Anda akan dicatat. Aset hanya berpindah setelah SEMUA pihak yang terlibat menyelesaikan konfirmasi.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => confirmTrfMut.mutate(activeTransferData?.data?.id || latestTransferData?.data?.id)}
                disabled={confirmTrfMut.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {confirmTrfMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Confirm Transfer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Transfer Dialog */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 pt-12" onClick={() => { setRejectTarget(null); setRejectReason(''); }}>
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-slate-200 px-6 py-4"><h3 className="text-lg font-semibold text-slate-900">Reject Transfer</h3></div>
            <div className="space-y-4 px-6 py-4">
              <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                <p className="text-sm text-red-800">Menolak transfer ini akan langsung menghentikan proses transfer. Aset tidak akan berpindah. Alasan wajib diisi.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Alasan Reject *</label>
                <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" placeholder="Tulis alasan penolakan..." />
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button onClick={() => { setRejectTarget(null); setRejectReason(''); }} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Batal</button>
              <button
                onClick={() => { if (!rejectReason.trim()) { toast.error('Alasan reject wajib diisi'); return; } rejectTrfMut.mutate({ transferId: rejectTarget, reason: rejectReason.trim() }); }}
                disabled={rejectTrfMut.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
              >
                {rejectTrfMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Reject Transfer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Reason Detail Dialog */}
      {viewingReject && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 pt-12" onClick={() => setViewingReject(null)}>
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-slate-200 px-6 py-4"><h3 className="text-lg font-semibold text-slate-900">Alasan Reject</h3></div>
            <div className="space-y-3 px-6 py-4">
              <p className="text-sm text-slate-500">Ditolak oleh <span className="font-medium text-slate-700">{viewingReject.userName}</span></p>
              <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">{viewingReject.reason}</div>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button onClick={() => setViewingReject(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Tutup</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Component Confirmation Dialog */}
      {showDeleteComponent && componentToDelete && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 pt-12" onClick={() => setShowDeleteComponent(false)}>
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-slate-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-slate-900">Delete Component?</h3>
            </div>
            <div className="space-y-4 px-6 py-4">
              <p className="text-sm text-slate-600">
                Are you sure you want to delete this component?
              </p>
              <div className="rounded-lg bg-slate-50 px-4 py-3">
                <p className="text-xs font-medium text-slate-500">Component</p>
                <p className="mt-1 font-medium text-slate-900">{componentToDelete.componentName}</p>
              </div>
              <p className="text-xs text-slate-500">This action cannot be undone.</p>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                onClick={() => setShowDeleteComponent(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteComponentMut.mutate(componentToDelete.id)}
                disabled={deleteComponentMut.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteComponentMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Delete Component
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
