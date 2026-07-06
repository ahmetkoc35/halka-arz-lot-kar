import { json, requireAdmin, type Env } from '../../types';

export const onRequestDelete: PagesFunction<Env> = async ({ env, params, request }) => {
  if (!requireAdmin(request, env)) {
    return json({ error: 'Admin yetkisi gerekli.' }, { status: 401 });
  }

  const id = String(params.id || '');
  if (!id) {
    return json({ error: 'Tablo bulunamadı.' }, { status: 400 });
  }

  await env.DB.prepare('DELETE FROM shared_tables WHERE id = ?').bind(id).run();
  return json({ ok: true });
};
