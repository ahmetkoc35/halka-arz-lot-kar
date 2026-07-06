import { json, requireAdmin, type Env } from '../../types';

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  if (!requireAdmin(request, env)) {
    return json({ error: 'Admin sırrı geçersiz.' }, { status: 401 });
  }

  return json({ ok: true });
};
