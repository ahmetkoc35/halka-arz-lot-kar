import type { SharedTableDraft } from '../../../src/types/sharedTable';
import { json, mapRecord, requireAdmin, type Env, type TableRecord } from '../../types';

const createId = () => crypto.randomUUID();

const cleanDraft = (draft: SharedTableDraft) => ({
  id: draft.id || createId(),
  title: String(draft.title || '').trim(),
  subtitle: String(draft.subtitle || '').trim(),
  summaryCards: Array.isArray(draft.summaryCards) ? draft.summaryCards : [],
  columns: Array.isArray(draft.columns) ? draft.columns : [],
  rows: Array.isArray(draft.rows) ? draft.rows : [],
  published: Boolean(draft.published),
  updatedAt: new Date().toISOString()
});

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const url = new URL(request.url);
  const includeUnpublished = url.searchParams.get('includeUnpublished') === '1';

  if (includeUnpublished && !requireAdmin(request, env)) {
    return json({ error: 'Admin yetkisi gerekli.' }, { status: 401 });
  }

  const query = includeUnpublished
    ? 'SELECT * FROM shared_tables ORDER BY updated_at DESC'
    : 'SELECT * FROM shared_tables WHERE published = 1 ORDER BY updated_at DESC';
  const result = await env.DB.prepare(query).all<TableRecord>();

  return json({
    tables: (result.results ?? []).map(mapRecord)
  });
};

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  if (!requireAdmin(request, env)) {
    return json({ error: 'Admin yetkisi gerekli.' }, { status: 401 });
  }

  const payload = cleanDraft(await request.json<SharedTableDraft>());
  if (!payload.title || payload.columns.length === 0) {
    return json({ error: 'Başlık ve en az bir kolon gerekli.' }, { status: 400 });
  }

  await env.DB.prepare(
    `INSERT INTO shared_tables (id, title, subtitle, summary_cards, columns, rows, updated_at, published)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       subtitle = excluded.subtitle,
       summary_cards = excluded.summary_cards,
       columns = excluded.columns,
       rows = excluded.rows,
       updated_at = excluded.updated_at,
       published = excluded.published`
  )
    .bind(
      payload.id,
      payload.title,
      payload.subtitle,
      JSON.stringify(payload.summaryCards),
      JSON.stringify(payload.columns),
      JSON.stringify(payload.rows),
      payload.updatedAt,
      payload.published ? 1 : 0
    )
    .run();

  return json({
    table: {
      id: payload.id,
      title: payload.title,
      subtitle: payload.subtitle,
      summaryCards: payload.summaryCards,
      columns: payload.columns,
      rows: payload.rows,
      updatedAt: payload.updatedAt,
      published: payload.published
    }
  });
};
