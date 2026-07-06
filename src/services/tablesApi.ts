import type { SharedTable, SharedTableDraft, TableResponse, TablesResponse } from '../types/sharedTable';

const DEFAULT_API_BASE_URL = 'https://halka-arz-lot-kar.pages.dev';
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL).replace(/\/$/, '');

const apiUrl = (path: string) => `${API_BASE_URL}${path}`;

const parseJson = async <T>(response: Response): Promise<T> => {
  const data = (await response.json().catch(() => null)) as { error?: string } | null;

  if (!response.ok) {
    const message = data && typeof data.error === 'string' ? data.error : 'İstek tamamlanamadı.';
    throw new Error(message);
  }

  return data as T;
};

const adminHeaders = (adminToken: string) => ({
  'Content-Type': 'application/json',
  'x-admin-secret': adminToken
});

export const fetchPublishedTables = async () => {
  const data = await parseJson<TablesResponse>(await fetch(apiUrl('/api/tables')));
  return data.tables;
};

export const fetchAdminTables = async (adminToken: string) => {
  const data = await parseJson<TablesResponse>(
    await fetch(apiUrl('/api/tables?includeUnpublished=1'), {
      headers: { 'x-admin-secret': adminToken }
    })
  );
  return data.tables;
};

export const saveSharedTable = async (table: SharedTableDraft, adminToken: string): Promise<SharedTable> => {
  const data = await parseJson<TableResponse>(
    await fetch(apiUrl('/api/tables'), {
      method: 'POST',
      headers: adminHeaders(adminToken),
      body: JSON.stringify(table)
    })
  );

  return data.table;
};

export const deleteSharedTable = async (id: string, adminToken: string) => {
  await parseJson<{ ok: boolean }>(
    await fetch(apiUrl(`/api/tables/${encodeURIComponent(id)}`), {
      method: 'DELETE',
      headers: { 'x-admin-secret': adminToken }
    })
  );
};

export const verifyAdminSecret = async (secret: string) => {
  await parseJson<{ ok: boolean }>(
    await fetch(apiUrl('/api/admin/verify'), {
      method: 'POST',
      headers: adminHeaders(secret),
      body: JSON.stringify({})
    })
  );
};
