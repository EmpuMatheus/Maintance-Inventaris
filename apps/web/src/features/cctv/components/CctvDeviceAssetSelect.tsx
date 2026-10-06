import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { listAssets } from '@/features/inventory/api/inventory';

export interface CctvAssetOption {
  id: string;
  assetCode: string;
  assetName: string;
  subcategoryName?: string | null;
  roomName?: string | null;
}

/**
 * Asset picker for a CCTV Device. Mirrors NetworkDeviceAssetSelect.
 *
 * Only eligible assets are returned by the backend (`cctvEligible`): their
 * subcategory is a CCTV/discovery-relevant one (CCTV / DVR / NVR) and they are
 * not already linked to another CCTV device. On edit, `excludeCctvDeviceId`
 * keeps the device's own current asset selectable.
 */
export default function CctvDeviceAssetSelect({
  value,
  initialAsset,
  excludeCctvDeviceId,
  onChange,
  hasError,
}: {
  value: string;
  initialAsset?: CctvAssetOption | null;
  excludeCctvDeviceId?: string;
  onChange: (asset: CctvAssetOption) => void;
  hasError?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<CctvAssetOption | null>(initialAsset ?? null);

  const { data, isLoading } = useQuery({
    queryKey: ['cctv-eligible-assets', query, excludeCctvDeviceId],
    queryFn: () =>
      listAssets({
        search: query || undefined,
        limit: 20,
        cctvEligible: 'true',
        excludeCctvDeviceId: excludeCctvDeviceId || undefined,
      }),
    enabled: open,
  });

  const assets = (data?.data ?? []) as CctvAssetOption[];

  useEffect(() => {
    if (!value) setSelected(null);
  }, [value]);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={selected ? `${selected.assetCode} - ${selected.assetName}` : query}
          placeholder="Search asset by code or name..."
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(null);
            setOpen(true);
          }}
          className={`mt-1 block w-full rounded-lg border py-2 pl-10 pr-3 text-sm focus:outline-none focus:ring-1 ${
            hasError ? 'border-red-300' : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500'
          }`}
        />
        {selected && (
          <span className="absolute right-3 top-1/2 mt-0.5 -translate-y-1/2 text-[11px] font-medium text-emerald-600">
            Selected
          </span>
        )}
      </div>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            {isLoading && <p className="px-3 py-3 text-sm text-slate-400">Searching...</p>}
            {!isLoading && assets.length === 0 && (
              <p className="px-3 py-3 text-sm text-slate-400">No eligible assets found.</p>
            )}
            {assets.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  setSelected(a);
                  onChange(a);
                  setOpen(false);
                }}
                className="block w-full px-3 py-2 text-left hover:bg-slate-50"
              >
                <span className="block font-mono text-xs text-slate-500">{a.assetCode}</span>
                <span className="block text-sm text-slate-800">{a.assetName}</span>
                {(a.subcategoryName || a.roomName) && (
                  <span className="mt-0.5 block text-xs text-slate-400">
                    {[a.subcategoryName, a.roomName].filter(Boolean).join(' · ')}
                  </span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
