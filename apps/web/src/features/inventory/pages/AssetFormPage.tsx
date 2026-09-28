import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { createAsset, updateAsset, getAsset, listMaster, getComponents, deleteComponent } from '../api/inventory';
import ComponentsSection from '../components/ComponentsSection';

const CONDITIONS = ['GOOD', 'FAIR', 'NEED_ATTENTION', 'BROKEN', 'CRITICAL'];
const STATUSES = ['AVAILABLE', 'ASSIGNED', 'IN_USE', 'IN_MAINTENANCE', 'BROKEN', 'SPARE', 'LOST', 'RETIRED', 'DISPOSED'];

interface ExistingComponent {
  id: string;
  componentName: string;
  model: string;
  serialNumber: string;
}

interface NewComponent {
  temporaryId: string;
  componentName: string;
  model: string;
  serialNumber: string;
}

function FormField({ label, name, type = 'text', options, required, form, errors, onChange }: {
  label: string; name: string; type?: string; options?: { value: string; label: string }[];
  required?: boolean; form: Record<string, string>; errors: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">{label}{required ? ' *' : ''}</label>
      {type === 'select' ? (
        <select value={form[name] ?? ''} onChange={(e) => onChange(name, e.target.value)}
          className={`mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${errors[name] ? 'border-red-300' : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500'}`}>
          <option value="">None</option>
          {options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input type={type} value={form[name] ?? ''} onChange={(e) => onChange(name, e.target.value)}
          className={`mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${errors[name] ? 'border-red-300' : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500'}`} />
      )}
      {errors[name] && <p className="mt-1 text-xs text-red-500">{errors[name]}</p>}
    </div>
  );
}

function Field(p: { label: string; name: string; type?: string; options?: { value: string; label: string }[];
  required?: boolean; form: Record<string, string>; errors: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  return <FormField {...p} />;
}

export default function AssetFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = useAuth();

  const [form, setForm] = useState<Record<string, string>>({ condition: 'GOOD', status: 'AVAILABLE' });
  const [existingComponents, setExistingComponents] = useState<ExistingComponent[]>([]);
  const [newComponents, setNewComponents] = useState<NewComponent[]>([]);
  const [deletedComponentIds, setDeletedComponentIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: assetData } = useQuery({
    queryKey: ['asset', id],
    queryFn: () => getAsset(id!),
    enabled: isEdit,
  });

  const { data: componentsData } = useQuery({
    queryKey: ['asset-components', id],
    queryFn: () => getComponents(id!),
    enabled: isEdit,
  });

  const { data: categories } = useQuery({ queryKey: ['master', 'active', 'categories'], queryFn: () => listMaster('categories', { isActive: 'true' }) });
  const { data: brands } = useQuery({ queryKey: ['master', 'active', 'brands'], queryFn: () => listMaster('brands', { isActive: 'true' }) });
  const { data: departments } = useQuery({ queryKey: ['master', 'active', 'departments'], queryFn: () => listMaster('departments', { isActive: 'true' }) });
  const { data: sites } = useQuery({ queryKey: ['master', 'active', 'sites'], queryFn: () => listMaster('sites', { isActive: 'true' }) });
  const { data: vendors } = useQuery({ queryKey: ['master', 'active', 'vendors'], queryFn: () => listMaster('vendors', { isActive: 'true' }) });

  const categoryId = form.categoryId;
  const { data: subcategories } = useQuery({
    queryKey: ['master', 'active', 'subcategories', categoryId],
    queryFn: () => listMaster('subcategories', { categoryId, isActive: 'true' }),
    enabled: !!categoryId,
  });

  const siteId = form.siteId;
  const { data: buildings } = useQuery({
    queryKey: ['master', 'active', 'buildings', siteId],
    queryFn: () => listMaster('buildings', { siteId, isActive: 'true' }),
    enabled: !!siteId,
  });
  const buildingId = form.buildingId;
  const { data: floors } = useQuery({
    queryKey: ['master', 'active', 'floors', buildingId],
    queryFn: () => listMaster('floors', { buildingId, isActive: 'true' }),
    enabled: !!buildingId,
  });
  const floorId = form.floorId;
  const { data: rooms } = useQuery({
    queryKey: ['master', 'active', 'rooms', floorId],
    queryFn: () => listMaster('rooms', { floorId, isActive: 'true' }),
    enabled: !!floorId,
  });

  useEffect(() => {
    if (assetData?.data) {
      const a = assetData.data;
      const f: Record<string, string> = {};
      for (const key of ['assetName', 'model', 'serialNumber', 'manufacturer', 'specification', 'purchaseDate', 'purchasePrice', 'invoiceNumber', 'warrantyStart', 'warrantyEnd', 'notes', 'condition', 'status']) {
        f[key] = String(a[key] ?? '');
      }
      for (const key of ['categoryId', 'subcategoryId', 'brandId', 'vendorId', 'departmentId', 'siteId', 'buildingId', 'floorId', 'roomId', 'currentPicId']) {
        f[key] = String(a[key] ?? '');
      }
      setForm(f);
    }
  }, [assetData]);

  // Load existing components when in edit mode
  useEffect(() => {
    if (isEdit && componentsData?.data) {
      setExistingComponents(componentsData.data as ExistingComponent[]);
      setNewComponents([]);
      setDeletedComponentIds([]);
    } else if (!isEdit) {
      // Create mode: reset all component state
      setExistingComponents([]);
      setNewComponents([]);
      setDeletedComponentIds([]);
    }
  }, [isEdit, componentsData]);

  const mutate = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(form)) {
        if (v) payload[k] = k === 'purchasePrice' ? Number(v) : v;
      }
      
      // Add only new components to payload (not existing ones)
      if (newComponents.length > 0) {
        payload.components = newComponents.map(c => ({
          componentName: c.componentName,
          model: c.model,
          serialNumber: c.serialNumber,
        }));
      }
      
      if (isEdit) {
        const result = await updateAsset(id!, payload);
        
        // Handle deletion of existing components after asset update
        for (const componentId of deletedComponentIds) {
          try {
            await deleteComponent(id!, componentId);
          } catch (err) {
            console.error(`Failed to delete component ${componentId}:`, err);
          }
        }
        
        return result;
      }
      return createAsset(payload);
    },
    onSuccess: (res) => {
      toast.success(`Asset ${isEdit ? 'updated' : 'created'} successfully`);
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      navigate(`/assets/${res.data.id}`, { replace: true });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function setVal(key: string, value: string) {
    setForm(p => ({ ...p, [key]: value }));
    if (key === 'categoryId') setForm(p => ({ ...p, subcategoryId: '' }));
    if (key === 'siteId') setForm(p => ({ ...p, buildingId: '', floorId: '', roomId: '' }));
    if (key === 'buildingId') setForm(p => ({ ...p, floorId: '', roomId: '' }));
    if (key === 'floorId') setForm(p => ({ ...p, roomId: '' }));
  }

  function handleChange(key: string, value: string) {
    setVal(key, value);
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.assetName?.trim()) e.assetName = 'Asset name is required.';
    
    // Validate only NEW components (existing components are read-only and already validated in DB)
    for (let i = 0; i < newComponents.length; i++) {
      const c = newComponents[i];
      if (!c.componentName?.trim()) {
        e[`new_components.${i}.componentName`] = 'Component name is required.';
      }
      if (!c.model?.trim()) {
        e[`new_components.${i}.model`] = 'Model is required.';
      }
      if (!c.serialNumber?.trim()) {
        e[`new_components.${i}.serialNumber`] = 'Serial number is required.';
      }
    }
    
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleAddComponent() {
    // Check if last new component is complete before allowing a new one
    if (newComponents.length > 0) {
      const lastComponent = newComponents[newComponents.length - 1];
      if (!lastComponent.componentName?.trim() || !lastComponent.model?.trim() || !lastComponent.serialNumber?.trim()) {
        toast.error('Please complete all fields in the current component before adding a new one.');
        return;
      }
    }
    
    const temporaryId = `temp-${Date.now()}-${Math.random()}`;
    setNewComponents([...newComponents, { temporaryId, componentName: '', model: '', serialNumber: '' }]);
  }

  function handleRemoveExistingComponent(componentId: string) {
    setExistingComponents(existingComponents.filter(c => c.id !== componentId));
    setDeletedComponentIds([...deletedComponentIds, componentId]);
  }

  function handleRemoveNewComponent(temporaryId: string) {
    setNewComponents(newComponents.filter(c => c.temporaryId !== temporaryId));
  }

  function handleNewComponentChange(temporaryId: string, field: string, value: string) {
    setNewComponents(newComponents.map(c =>
      c.temporaryId === temporaryId ? { ...c, [field]: value } : c
    ));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (validate()) mutate.mutate();
  }

  if (!can(isEdit ? 'asset.update' : 'asset.create')) {
    return <div className="p-6 text-center text-slate-500">You do not have permission to {isEdit ? 'edit' : 'create'} assets.</div>;
  }

  const fp = { form, errors, onChange: handleChange };

  const catOpts = categories?.data?.map((c: any) => ({ value: c.id, label: `${c.code} - ${c.name}` })) ?? [];
  const subOpts = subcategories?.data?.map((c: any) => ({ value: c.id, label: `${c.code} - ${c.name}` })) ?? [];
  const brandOpts = brands?.data?.map((c: any) => ({ value: c.id, label: c.name })) ?? [];
  const deptOpts = departments?.data?.map((c: any) => ({ value: c.id, label: `${c.code} - ${c.name}` })) ?? [];
  const siteOpts = sites?.data?.map((c: any) => ({ value: c.id, label: `${c.code} - ${c.name}` })) ?? [];
  const bldgOpts = buildings?.data?.map((c: any) => ({ value: c.id, label: `${c.code} - ${c.name}` })) ?? [];
  const flrOpts = floors?.data?.map((c: any) => ({ value: c.id, label: `${c.code} - ${c.name}` })) ?? [];
  const rmOpts = rooms?.data?.map((c: any) => ({ value: c.id, label: `${c.code} - ${c.name}` })) ?? [];
  const vendOpts = vendors?.data?.map((c: any) => ({ value: c.id, label: `${c.code} - ${c.name}` })) ?? [];
  const condOpts = CONDITIONS.map((c) => ({ value: c, label: c.replace(/_/g, ' ') }));
  const statOpts = STATUSES.map((c) => ({ value: c, label: c.replace(/_/g, ' ') }));

  const selectedCat = categories?.data?.find((c: any) => c.id === form.categoryId);
  const selectedSub = subcategories?.data?.find((c: any) => c.id === form.subcategoryId);
  const codePreview = selectedCat && selectedSub ? `${selectedCat.code}-${selectedSub.code}` : null;

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-6">
      <button onClick={() => navigate(-1)} className="mb-4 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"><ArrowLeft className="h-4 w-4" /> Back</button>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">{isEdit ? 'Edit Asset' : 'New Asset'}</h1>

      <form onSubmit={handleSubmit} className="space-y-8">
        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Basic Information</h2>
          <div className="mb-4 rounded-lg bg-slate-50 px-4 py-3">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Asset Code</span>
            <p className="font-mono text-sm text-slate-700">
              {isEdit ? form.assetCode || '-' : codePreview ? `AST-${codePreview}-XXXX` : 'AUTO GENERATED'}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Asset Name" name="assetName" required {...fp} />
            <Field label="Model" name="model" {...fp} />
            <Field label="Serial Number" name="serialNumber" {...fp} />
            <Field label="Manufacturer" name="manufacturer" {...fp} />
            <div className="sm:col-span-2"><Field label="Specification" name="specification" type="textarea" {...fp} /></div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Classification</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category" name="categoryId" type="select" options={catOpts} {...fp} />
            <Field label="Subcategory" name="subcategoryId" type="select" options={subOpts} {...fp} />
            <Field label="Brand" name="brandId" type="select" options={brandOpts} {...fp} />
            <Field label="Department" name="departmentId" type="select" options={deptOpts} {...fp} />
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Location</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Site" name="siteId" type="select" options={siteOpts} {...fp} />
            <Field label="Building" name="buildingId" type="select" options={bldgOpts} {...fp} />
            <Field label="Floor" name="floorId" type="select" options={flrOpts} {...fp} />
            <Field label="Room" name="roomId" type="select" options={rmOpts} {...fp} />
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Purchase & Warranty</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Purchase Date" name="purchaseDate" type="date" {...fp} />
            <Field label="Purchase Price" name="purchasePrice" type="number" {...fp} />
            <Field label="Vendor" name="vendorId" type="select" options={vendOpts} {...fp} />
            <Field label="Invoice Number" name="invoiceNumber" {...fp} />
            <Field label="Warranty Start" name="warrantyStart" type="date" {...fp} />
            <Field label="Warranty End" name="warrantyEnd" type="date" {...fp} />
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Status & Notes</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Condition" name="condition" type="select" options={condOpts} {...fp} />
            <Field label="Status" name="status" type="select" options={statOpts} {...fp} />
            <div className="sm:col-span-2"><Field label="Notes" name="notes" type="textarea" {...fp} /></div>
          </div>
        </section>

        <ComponentsSection
          existingComponents={existingComponents}
          newComponents={newComponents}
          errors={errors}
          onAddNew={handleAddComponent}
          onRemoveExisting={handleRemoveExistingComponent}
          onRemoveNew={handleRemoveNewComponent}
          onChangeNew={handleNewComponentChange}
        />

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate(-1)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={mutate.isPending} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
            {mutate.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            <Save className="h-4 w-4" /> {isEdit ? 'Update' : 'Create'} Asset
          </button>
        </div>
      </form>
    </div>
  );
}
