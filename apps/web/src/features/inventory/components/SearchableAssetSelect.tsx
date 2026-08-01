import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { listAssets } from '../api/inventory';

export interface AssetOption {
  id: string;
  assetCode: string;
  assetName: string;
}

/**
 * Combobox that searches assets by code/name and returns the selected asset id.
 */
export default function SearchableAssetSelect({
  value,
  onChange,
  hasError,
}: {
  value: string;
  onChange: (v: string) => void;
  hasError?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<AssetOption | null>(null);

  const { data } = useQuery({
    queryKey: ['assets', 'search', query],
    queryFn: () => listAssets({ search: query || undefined, limit: 20 }),
    enabled: open,
  });

  const assets = (data?.data ?? []) as AssetOption[];

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
            onChange('');
            setOpen(true);
          }}
          className={`mt-1 block w-full rounded-lg border py-2 pl-10 pr-3 text-sm focus:outline-none focus:ring-1 ${
            hasError ? 'border-red-300' : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500'
          }`}
        />
      </div>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            {assets.length === 0 && <p className="px-3 py-3 text-sm text-slate-400">No assets found.</p>}
            {assets.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => { setSelected(a); onChange(a.id); setOpen(false); }}
                className="block w-full px-3 py-2 text-left hover:bg-slate-50"
              >
                <span className="block font-mono text-xs text-slate-500">{a.assetCode}</span>
                <span className="block text-sm text-slate-800">{a.assetName}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
