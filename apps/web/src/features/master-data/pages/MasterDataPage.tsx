import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MODULES } from '../config';
import MasterDataTable from '../components/MasterDataTable';
import { listResource } from '../api/master-data';
import type { ModuleConfig, MasterDataRecord } from '../types';

export default function MasterDataPage() {
  const [searchParams] = useSearchParams();
  const activeKey = searchParams.get('section') || 'categories';
  const [optionsCache, setOptionsCache] = useState<Record<string, { value: string; label: string }[]>>({});

  const activeModule = MODULES.find((m) => m.path === activeKey) ?? MODULES[0];

  useEffect(() => {
    async function loadOptions() {
      const cache: Record<string, { value: string; label: string }[]> = {};
      if (activeKey === 'subcategories') {
        const res = await listResource('categories', { limit: 100 });
        cache['categoryId'] = (res.data as MasterDataRecord[]).map((r) => ({ value: r.id, label: `${r.code} - ${r.name}` }));
      }
      if (activeKey === 'buildings') {
        const res = await listResource('sites', { limit: 100 });
        cache['siteId'] = (res.data as MasterDataRecord[]).map((r) => ({ value: r.id, label: `${r.code} - ${r.name}` }));
      }
      if (activeKey === 'floors') {
        const res = await listResource('buildings', { limit: 100 });
        cache['buildingId'] = (res.data as MasterDataRecord[]).map((r) => ({ value: r.id, label: `${r.code} - ${r.name}` }));
      }
      if (activeKey === 'rooms') {
        const res = await listResource('floors', { limit: 100 });
        cache['floorId'] = (res.data as MasterDataRecord[]).map((r) => ({ value: r.id, label: `${r.code} - ${r.name}` }));
      }
      setOptionsCache(cache);
    }
    loadOptions();
  }, [activeKey]);

  function enrichFields(module: ModuleConfig): ModuleConfig {
    return {
      ...module,
      fields: module.fields.map((f) => {
        if (f.type === 'select' && optionsCache[f.key]) {
          return { ...f, options: optionsCache[f.key] };
        }
        return f;
      }),
    };
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Master Data</h1>
        <p className="mt-1 text-sm text-slate-500">
          {activeModule.label} — Manage reference data.
        </p>
      </div>
      <MasterDataTable config={enrichFields(activeModule)} />
    </div>
  );
}
