import type { ReactNode } from 'react';

export interface SummaryCard {
  key: string;
  label: string;
  value: string | number;
  icon?: ReactNode;
  tone?: string;
}

export interface SummaryGroup {
  label: string;
  value: string | number;
  cls: string;
}

export default function ReportSummaryCards({
  cards,
  groups,
  cols = 'lg:grid-cols-5',
}: {
  cards: SummaryCard[];
  groups?: SummaryGroup[];
  cols?: string;
}) {
  return (
    <div className="mb-4">
      <div className={`grid grid-cols-2 gap-3 sm:grid-cols-3 ${cols}`}>
        {cards.map((card) => (
          <div key={card.key} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-400">{card.label}</span>
              {card.icon && <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${card.tone ?? 'bg-slate-50 text-slate-500'}`}>{card.icon}</span>}
            </div>
            <p className="truncate text-xl font-bold text-slate-900">{card.value}</p>
          </div>
        ))}
      </div>

      {groups && groups.length > 0 && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Distribution</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {groups.map((g) => (
              <div key={g.label} className={`rounded-lg px-3 py-2 text-center ${g.cls}`}>
                <p className="text-xl font-bold">{g.value}</p>
                <p className="text-xs font-medium">{g.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
