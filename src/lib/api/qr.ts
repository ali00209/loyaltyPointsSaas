import { client } from "./client";

export interface StoreQrData {
  tenantId: string;
  tenantName: string;
  portalUrl: string;
  qrDataUrl: string;
}

export async function fetchStoreQr(): Promise<StoreQrData> {
  const { data } = await client.get<StoreQrData>("/tenant/qr");
  return data;
}
