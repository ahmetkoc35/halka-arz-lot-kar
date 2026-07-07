import type { SharedTable, SharedTableDraft, TableResponse, TablesResponse } from '../types/sharedTable';

const DEFAULT_PUBLIC_TABLES_URL =
  'https://api.github.com/repos/ahmetkoc35/halka-arz-lot-kar/contents/public/published-tables.json?ref=main';
const PUBLIC_TABLES_URL = import.meta.env.VITE_PUBLIC_TABLES_URL ?? DEFAULT_PUBLIC_TABLES_URL;
const ADMIN_API_BASE_URL = (import.meta.env.VITE_ADMIN_API_BASE_URL ?? '').replace(/\/$/, '');

const adminApiUrl = (path: string) => `${ADMIN_API_BASE_URL}${path}`;

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
  const separator = PUBLIC_TABLES_URL.includes('?') ? '&' : '?';
  const response = await fetch(`${PUBLIC_TABLES_URL}${separator}t=${Date.now()}`, { cache: 'no-store' });
  const data = (await response.json().catch(() => null)) as TablesResponse | { content?: string; error?: string } | null;

  if (!response.ok) {
    const message = data && 'error' in data && typeof data.error === 'string' ? data.error : 'Yayınlanan tablolar alınamadı.';
    throw new Error(message);
  }

  if (data && 'content' in data && typeof data.content === 'string') {
    const bytes = Uint8Array.from(atob(data.content.replace(/\s/g, '')), (char) => char.charCodeAt(0));
    return (JSON.parse(new TextDecoder().decode(bytes)) as TablesResponse).tables;
  }

  return (data as TablesResponse).tables;
};

export const fetchAdminTables = async (adminToken: string) => {
  const data = await parseJson<TablesResponse>(
    await fetch(adminApiUrl('/api/tables?includeUnpublished=1'), {
      headers: { 'x-admin-secret': adminToken }
    })
  );
  return data.tables;
};

export const saveSharedTable = async (table: SharedTableDraft, adminToken: string): Promise<SharedTable> => {
  const data = await parseJson<TableResponse>(
    await fetch(adminApiUrl('/api/tables'), {
      method: 'POST',
      headers: adminHeaders(adminToken),
      body: JSON.stringify(table)
    })
  );

  return data.table;
};

export const deleteSharedTable = async (id: string, adminToken: string) => {
  await parseJson<{ ok: boolean }>(
    await fetch(adminApiUrl(`/api/tables/${encodeURIComponent(id)}`), {
      method: 'DELETE',
      headers: { 'x-admin-secret': adminToken }
    })
  );
};

export const verifyAdminSecret = async (secret: string) => {
  await parseJson<{ ok: boolean }>(
    await fetch(adminApiUrl('/api/admin/verify'), {
      method: 'POST',
      headers: adminHeaders(secret),
      body: JSON.stringify({})
    })
  );
};
