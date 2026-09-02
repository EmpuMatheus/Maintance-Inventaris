import { Trash2, Plus } from 'lucide-react';

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

interface ComponentsSectionProps {
  existingComponents: ExistingComponent[];
  newComponents: NewComponent[];
  errors: Record<string, string>;
  onAddNew: () => void;
  onRemoveExisting: (componentId: string) => void;
  onRemoveNew: (temporaryId: string) => void;
  onChangeNew: (temporaryId: string, field: string, value: string) => void;
}

export default function ComponentsSection({
  existingComponents,
  newComponents,
  errors,
  onAddNew,
  onRemoveExisting,
  onRemoveNew,
  onChangeNew,
}: ComponentsSectionProps) {
  // Check if last new component is complete
  const lastNewComponentComplete = newComponents.length === 0 || (
    newComponents[newComponents.length - 1].componentName?.trim() &&
    newComponents[newComponents.length - 1].model?.trim() &&
    newComponents[newComponents.length - 1].serialNumber?.trim()
  );

  const totalComponents = existingComponents.length + newComponents.length;
  const hasComponents = totalComponents > 0;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">Components</h2>

      {!hasComponents && (
        <div className="mb-4 rounded-lg bg-slate-50 px-4 py-6 text-center">
          <p className="text-sm text-slate-500">No components added.</p>
        </div>
      )}

      {/* Existing Components (Read-only) */}
      {existingComponents.length > 0 && (
        <div className="mb-4 space-y-4">
          {existingComponents.map((component, idx) => (
            <div
              key={component.id}
              className="rounded-lg border border-slate-200 bg-slate-50 p-4"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-medium text-slate-900">Component {idx + 1}</h3>
                <button
                  type="button"
                  onClick={() => onRemoveExisting(component.id)}
                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-slate-500 hover:bg-red-50 hover:text-red-600"
                  title="Delete component"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-3 text-sm">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Component Name</p>
                  <p className="font-medium text-slate-900">{component.componentName}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Model</p>
                  <p className="font-medium text-slate-900">{component.model}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Serial Number</p>
                  <p className="font-medium text-slate-900">{component.serialNumber}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Components (Editable) */}
      {newComponents.length > 0 && (
        <div className="mb-4 space-y-4">
          {newComponents.map((component, idx) => (
            <div
              key={component.temporaryId}
              className="rounded-lg border border-slate-200 bg-slate-50 p-4"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-medium text-slate-900">
                  New Component {idx + 1}
                </h3>
                <button
                  type="button"
                  onClick={() => onRemoveNew(component.temporaryId)}
                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-slate-500 hover:bg-red-50 hover:text-red-600"
                  title="Remove component"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Component Name *
                  </label>
                  <input
                    type="text"
                    value={component.componentName}
                    onChange={(e) =>
                      onChangeNew(component.temporaryId, 'componentName', e.target.value)
                    }
                    className={`mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                      errors[`new_components.${idx}.componentName`]
                        ? 'border-red-300'
                        : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500'
                    }`}
                    placeholder="e.g., RAM"
                  />
                  {errors[`new_components.${idx}.componentName`] && (
                    <p className="mt-1 text-xs text-red-500">
                      {errors[`new_components.${idx}.componentName`]}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Model *
                  </label>
                  <input
                    type="text"
                    value={component.model}
                    onChange={(e) =>
                      onChangeNew(component.temporaryId, 'model', e.target.value)
                    }
                    className={`mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                      errors[`new_components.${idx}.model`]
                        ? 'border-red-300'
                        : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500'
                    }`}
                    placeholder="e.g., Samsung 8GB DDR4"
                  />
                  {errors[`new_components.${idx}.model`] && (
                    <p className="mt-1 text-xs text-red-500">
                      {errors[`new_components.${idx}.model`]}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Serial Number *
                  </label>
                  <input
                    type="text"
                    value={component.serialNumber}
                    onChange={(e) =>
                      onChangeNew(component.temporaryId, 'serialNumber', e.target.value)
                    }
                    className={`mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                      errors[`new_components.${idx}.serialNumber`]
                        ? 'border-red-300'
                        : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500'
                    }`}
                    placeholder="e.g., RAM001"
                  />
                  {errors[`new_components.${idx}.serialNumber`] && (
                    <p className="mt-1 text-xs text-red-500">
                      {errors[`new_components.${idx}.serialNumber`]}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={onAddNew}
        disabled={!lastNewComponentComplete}
        className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${
          !lastNewComponentComplete
            ? 'cursor-not-allowed bg-slate-100 text-slate-400'
            : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
        }`}
        title={
          !lastNewComponentComplete
            ? 'Complete all fields in the current component before adding a new one'
            : ''
        }
      >
        <Plus className="h-4 w-4" /> Add Component
      </button>
    </section>
  );
}
