import { apiGet } from '@/lib/api-client';

export function getQrInfo(assetId: string) {
  return apiGet<any>(`/qr/assets/${assetId}/qr`);
}

export function lookupByAssetCode(assetCode: string) {
  return apiGet<any>(`/qr/assets/${assetCode}`);
}
