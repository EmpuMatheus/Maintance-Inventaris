import { apiGet, apiPost, apiPatch, apiDelete, apiUpload } from '@/lib/api-client';

export function listAssets(params?: Record<string, string | number | undefined>) {
  return apiGet<any>('/assets', params);
}

export function getAsset(id: string) {
  return apiGet<any>(`/assets/${id}`);
}

export function createAsset(data: Record<string, unknown>) {
  return apiPost<any>('/assets', data);
}

export function updateAsset(id: string, data: Record<string, unknown>) {
  return apiPatch<any>(`/assets/${id}`, data);
}

export function listMaster(resource: string, params?: Record<string, string | undefined>) {
  return apiGet<any>(`/master/${resource}`, { ...params, limit: '100' });
}

export function uploadPhoto(id: string, file: File) {
  const fd = new FormData();
  fd.append('photo', file);
  return apiUpload<any>(`/assets/${id}/photo`, 'POST', fd);
}

export function listDocuments(id: string) {
  return apiGet<any>(`/assets/${id}/documents`);
}

export function uploadDocument(id: string, file: File, documentType: string) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('documentType', documentType);
  return apiUpload<any>(`/assets/${id}/documents`, 'POST', fd);
}

export function deleteDocument(assetId: string, documentId: string) {
  return apiDelete<any>(`/assets/${assetId}/documents/${documentId}`);
}

export function assignAsset(id: string, data: Record<string, unknown>) {
  return apiPost<any>(`/assets/${id}/assignments`, data);
}

export function returnAsset(id: string, data: Record<string, unknown>) {
  return apiPost<any>(`/assets/${id}/assignments/return`, data);
}

export function getAssignmentHistory(id: string) {
  return apiGet<any>(`/assets/${id}/assignments`);
}

export function transferAsset(id: string, data: Record<string, unknown>) {
  return apiPost<any>(`/assets/${id}/movements`, data);
}

export function getMovementHistory(id: string) {
  return apiGet<any>(`/assets/${id}/movements`);
}

export function listMaintenance(params?: Record<string, string | number | undefined>) { return apiGet<any>("/maintenance", params); }
export function getMaintenance(id: string) { return apiGet<any>(`/maintenance/${id}`); }
export function createMaintenance(data: Record<string, unknown>) { return apiPost<any>("/maintenance", data); }
export function assignMaintenance(id: string, data: Record<string, unknown>) { return apiPost<any>(`/maintenance/${id}/assign`, data); }
export function startMaintenance(id: string) { return apiPost<any>(`/maintenance/${id}/start`); }
export function waitingPartMaintenance(id: string, data: Record<string, unknown>) { return apiPost<any>(`/maintenance/${id}/waiting-part`, data); }
export function testingMaintenance(id: string) { return apiPost<any>(`/maintenance/${id}/testing`); }
export function completeMaintenance(id: string, data: Record<string, unknown>) { return apiPost<any>(`/maintenance/${id}/complete`, data); }
export function cancelMaintenance(id: string, data: Record<string, unknown>) { return apiPost<any>(`/maintenance/${id}/cancel`, data); }
export function listMaintenanceParts(id: string) { return apiGet<any>(`/maintenance/${id}/parts`); }
export function addMaintenancePart(id: string, data: Record<string, unknown>) { return apiPost<any>(`/maintenance/${id}/parts`, data); }
export function deleteMaintenancePart(id: string, partId: string) { return apiDelete<any>(`/maintenance/${id}/parts/${partId}`); }
export function listMaintenanceDocuments(id: string) { return apiGet<any>(`/maintenance/${id}/documents`); }