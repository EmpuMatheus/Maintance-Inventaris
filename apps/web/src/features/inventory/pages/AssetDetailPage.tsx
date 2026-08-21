import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Loader2, Package, Upload, Trash2, XCircle, FileText, Image, Activity, QrCode, User, MapPin, ArrowLeftRight } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { getAsset, uploadPhoto, listDocuments, uploadDocument, deleteDocument, assignAsset, returnAsset, getAssignmentHistory, transferAsset, getMovementHistory, listMaster, retireAsset, deleteAssetPermanently } from '../api/inventory';
import { apiGet, apiPatch } from '@/lib/api-client';
import ConditionBadge from '@/components/ui/ConditionBadge';
import QrModal from '@/features/qr/components/QrModal';
import RetireDialog from '../components/RetireDialog';
import DeleteDialog from '../components/DeleteDialog';
import { listSchedules } from '@/features/maintenance-schedules/api/schedules';

const ASGN_STYLES: Record<string, string> = { ACTIVE: 'bg-green-50 text-green-700', RETURNED: 'bg-slate-100 text-slate-500' };

export default function AssetDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const qc = useQueryClient();
  const photoRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState('OTHER');
  const [uploading, setUploading] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [showCond, setShowCond] = useState(false);
  const [condForm, setCondForm] = useState({ condition: '', reason: '', notes: '' });
  const [showAssign, setShowAssign] = useState(false);
  const [showReturn, setShowReturn] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [asnForm, setAsnForm] = useState({ userId: '', departmentId: '', assignedDate: '', notes: '' });
  const [retForm, setRetForm] = useState({ returnedDate: '', notes: '' });
  const [trfForm, setTrfForm] = useState({ siteId: '', buildingId: '', floorId: '', roomId: '', reason: '', notes: '' });
  const [showRetire, setShowRetire] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

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
  const { data: schedules } = useQuery({
    queryKey: ['maintenance-schedules', 'list', { assetId: id }],
    queryFn: () => listSchedules({ assetId: id!, limit: 10 }),
    enabled: !!id,
  });

  const { data: picList } = useQuery({ queryKey: ['master', 'users'], queryFn: () => apiGet<any>('/master/users'), enabled: showAssign });
  const { data: deptList } = useQuery({ queryKey: ['master', 'departments'], queryFn: () => listMaster('departments'), enabled: showAssign });
  const { data: siteList } = useQuery({ queryKey: ['master', 'sites'], queryFn: () => listMaster('sites'), enabled: showTransfer });
  const { data: bldgList } = useQuery({ queryKey: ['master', 'buildings', trfForm.siteId], queryFn: () => listMaster('buildings', { siteId: trfForm.siteId }), enabled: !!trfForm.siteId });
  const { data: flrList } = useQuery({ queryKey: ['master', 'floors', trfForm.buildingId], queryFn: () => listMaster('floors', { buildingId: trfForm.buildingId }), enabled: !!trfForm.buildingId });
  const { data: rmList } = useQuery({ queryKey: ['master', 'rooms', trfForm.floorId], queryFn: () => listMaster('rooms', { floorId: trfForm.floorId }), enabled: !!trfForm.floorId });

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
  const retMut = useMutation({
    mutationFn: (b: Record<string, unknown>) => returnAsset(id!, b),
    onSuccess: () => { toast.success('Asset returned'); setShowReturn(false); qc.invalidateQueries({ queryKey: ['asset', id] }); refetchAH(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const trfMut = useMutation({
    mutationFn: (b: Record<string, unknown>) => transferAsset(id!, b),
    onSuccess: () => { toast.success('Asset transferred'); setShowTransfer(false); qc.invalidateQueries({ queryKey: ['asset', id] }); refetchMH(); },
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
                {can('asset.assign') && a.status !== 'RETIRED' && <button onClick={() => { setRetForm({ returnedDate: new Date().toISOString().slice(0, 10), notes: '' }); setShowReturn(true); }} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">Return Asset</button>}
              </div>
            </>
          ) : (
            <>
              <p className="mb-3 text-sm text-slate-400">Not currently assigned.</p>
              {can('asset.assign') && a.status !== 'RETIRED' && <button onClick={() => { setAsnForm({ userId: '', departmentId: '', assignedDate: new Date().toISOString().slice(0, 10), notes: '' }); setShowAssign(true); }} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"><User className="h-4 w-4" /> Assign Asset</button>}
            </>
          )}
          {can('asset.transfer') && a.status !== 'RETIRED' && <div className="mt-2"><button onClick={() => { setTrfForm({ siteId: '', buildingId: '', floorId: '', roomId: '', reason: '', notes: '' }); setShowTransfer(true); }} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"><MapPin className="h-4 w-4" /> Transfer Location</button></div>}
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
        <div className="space-y-3">{movData.map((h: any, i: number) => (
          <div key={h.id || i} className="rounded-lg border border-slate-100 p-3">
            <div className="mb-1 text-xs text-slate-400">{h.movementDate || new Date(h.createdAt).toLocaleDateString('en-GB')}</div>
            <div className="flex items-center gap-2 text-sm"><span className="text-slate-500">{h.fromRoomName || '-'}</span><ArrowLeftRight className="h-3 w-3 text-slate-300" /><span className="font-medium text-slate-700">{h.toRoomName || '-'}</span></div>
            {h.reason && <p className="mt-1 text-xs text-slate-500">{h.reason}</p>}
          </div>
        ))}</div>
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
                <select value={asnForm.departmentId} onChange={(e) => setAsnForm(p => ({ ...p, departmentId: e.target.value }))} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none">
                  <option value="">None</option>
                  {deptList?.data?.map((d: any) => <option key={d.id} value={d.id}>{d.code} - {d.name}</option>)}
                </select>
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

      {/* Return Modal */}
      {showReturn && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 pt-12" onClick={() => setShowReturn(false)}>
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-slate-200 px-6 py-4"><h3 className="text-lg font-semibold text-slate-900">Return Asset</h3></div>
            <div className="space-y-4 px-6 py-4">
              <div className="rounded-lg bg-slate-50 px-4 py-3"><p className="text-xs font-medium uppercase tracking-wider text-slate-400">Asset</p><p className="font-mono text-sm text-slate-700">{a.assetCode}</p><p className="text-sm text-slate-600">{a.assetName}</p></div>
              {activeAsn && <div className="rounded-lg bg-slate-50 px-4 py-3"><p className="text-xs text-slate-400">Currently assigned to</p><p className="text-sm font-medium text-slate-700">{activeAsn.userName || '-'} {activeAsn.departmentName ? `(${activeAsn.departmentName})` : ''}</p></div>}
              <div><label className="block text-sm font-medium text-slate-700">Return Date</label><input type="date" value={retForm.returnedDate} onChange={(e) => setRetForm(p => ({ ...p, returnedDate: e.target.value }))} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" /></div>
              <div><label className="block text-sm font-medium text-slate-700">Notes</label><textarea value={retForm.notes} onChange={(e) => setRetForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" /></div>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button onClick={() => setShowReturn(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={() => retMut.mutate(retForm)} disabled={retMut.isPending} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50">
                {retMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Confirm Return
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
              <div><label className="block text-sm font-medium text-slate-700">Reason</label><textarea value={trfForm.reason} onChange={(e) => setTrfForm(p => ({ ...p, reason: e.target.value }))} rows={2} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" /></div>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button onClick={() => setShowTransfer(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={() => { if (!trfForm.siteId || !trfForm.buildingId || !trfForm.floorId || !trfForm.roomId) { toast.error('Please select a complete location'); return; } trfMut.mutate(trfForm); }} disabled={trfMut.isPending} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50">
                {trfMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Transfer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
