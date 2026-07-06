import type { SharedTable } from '../src/types/sharedTable';

export type Env = {
  DB: D1Database;
  ADMIN_SECRET: string;
};

export type TableRecord = {
  id: string;
  title: string;
  subtitle: string;
  summary_cards: string;
  columns: string;
  rows: string;
  updated_at: string;
  published: number;
};

export const json = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...(init.headers ?? {})
    }
  });

export const getAdminSecret = (request: Request) => request.headers.get('x-admin-secret') ?? '';

export const requireAdmin = (request: Request, env: Env) => {
  const configuredSecret = env.ADMIN_SECRET;
  if (!configuredSecret) return false;
  return getAdminSecret(request) === configuredSecret;
};

export const mapRecord = (record: TableRecord): SharedTable => ({
  id: record.id,
  title: record.title,
  subtitle: record.subtitle,
  summaryCards: JSON.parse(record.summary_cards || '[]'),
  columns: JSON.parse(record.columns || '[]'),
  rows: JSON.parse(record.rows || '[]'),
  updatedAt: record.updated_at,
  published: Boolean(record.published)
});
