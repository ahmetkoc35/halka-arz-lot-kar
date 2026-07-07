import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { dirname, resolve } from 'node:path';
import { promisify } from 'node:util';
import { defineConfig, loadEnv, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';

type SharedTable = {
  id: string;
  title: string;
  subtitle: string;
  summaryCards: unknown[];
  columns: unknown[];
  rows: unknown[];
  updatedAt: string;
  published: boolean;
};

type SharedTableDraft = Omit<SharedTable, 'id' | 'updatedAt'> & {
  id?: string;
};

const execFileAsync = promisify(execFile);
const dataPath = resolve(process.cwd(), 'public/published-tables.json');

const sendJson = (response: ServerResponse, status: number, data: unknown) => {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(data));
};

const readBody = async <T>(request: IncomingMessage) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const text = Buffer.concat(chunks).toString('utf8');
  return (text ? JSON.parse(text) : {}) as T;
};

const readTables = async (): Promise<SharedTable[]> => {
  try {
    const file = await readFile(dataPath, 'utf8');
    const data = JSON.parse(file) as { tables?: SharedTable[] } | SharedTable[];
    return Array.isArray(data) ? data : data.tables ?? [];
  } catch {
    return [];
  }
};

const writeTables = async (tables: SharedTable[]) => {
  await mkdir(dirname(dataPath), { recursive: true });
  await writeFile(dataPath, `${JSON.stringify({ tables }, null, 2)}\n`, 'utf8');
};

const publishTables = async () => {
  await execFileAsync('git', ['add', 'public/published-tables.json']);

  try {
    await execFileAsync('git', ['diff', '--cached', '--quiet', '--', 'public/published-tables.json']);
    return;
  } catch {
    await execFileAsync('git', ['commit', '-m', 'Update published tables', '--', 'public/published-tables.json']);
    await execFileAsync('git', ['push', 'origin', 'main']);
  }
};

const cleanDraft = (draft: SharedTableDraft): SharedTable => ({
  id: draft.id || randomUUID(),
  title: String(draft.title || '').trim(),
  subtitle: String(draft.subtitle || '').trim(),
  summaryCards: Array.isArray(draft.summaryCards) ? draft.summaryCards : [],
  columns: Array.isArray(draft.columns) ? draft.columns : [],
  rows: Array.isArray(draft.rows) ? draft.rows : [],
  updatedAt: new Date().toISOString(),
  published: Boolean(draft.published)
});

const isAdminRequest = (secret: string | string[] | undefined, localAdminSecret: string) =>
  Boolean(localAdminSecret) && typeof secret === 'string' && secret === localAdminSecret;

const localGithubPublisher = (localAdminSecret: string) => ({
  name: 'local-github-table-publisher',
  configureServer(server: ViteDevServer) {
    server.middlewares.use(async (request, response, next) => {
      const method = request.method ?? 'GET';
      const url = new URL(request.url ?? '/', 'http://localhost:5173');
      const secret = request.headers['x-admin-secret'];

      try {
        if (url.pathname === '/api/admin/verify' && method === 'POST') {
          if (!isAdminRequest(secret, localAdminSecret)) {
            sendJson(response, 401, { error: 'Admin şifresi hatalı.' });
            return;
          }

          sendJson(response, 200, { ok: true });
          return;
        }

        if (url.pathname === '/api/tables' && method === 'GET') {
          const tables = await readTables();
          const includeUnpublished = url.searchParams.get('includeUnpublished') === '1';

          if (includeUnpublished && !isAdminRequest(secret, localAdminSecret)) {
            sendJson(response, 401, { error: 'Admin yetkisi gerekli.' });
            return;
          }

          sendJson(response, 200, {
            tables: includeUnpublished ? tables : tables.filter((table) => table.published)
          });
          return;
        }

        if (url.pathname === '/api/tables' && method === 'POST') {
          if (!isAdminRequest(secret, localAdminSecret)) {
            sendJson(response, 401, { error: 'Admin yetkisi gerekli.' });
            return;
          }

          const table = cleanDraft(await readBody<SharedTableDraft>(request));
          if (!table.title || table.columns.length === 0) {
            sendJson(response, 400, { error: 'Başlık ve en az bir kolon gerekli.' });
            return;
          }

          const tables = await readTables();
          const nextTables = [table, ...tables.filter((item) => item.id !== table.id)];
          await writeTables(nextTables);
          await publishTables();
          sendJson(response, 200, { table });
          return;
        }

        if (url.pathname.startsWith('/api/tables/') && method === 'DELETE') {
          if (!isAdminRequest(secret, localAdminSecret)) {
            sendJson(response, 401, { error: 'Admin yetkisi gerekli.' });
            return;
          }

          const id = decodeURIComponent(url.pathname.replace('/api/tables/', ''));
          const tables = await readTables();
          await writeTables(tables.filter((table) => table.id !== id));
          await publishTables();
          sendJson(response, 200, { ok: true });
          return;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'İşlem tamamlanamadı.';
        sendJson(response, 500, { error: message });
        return;
      }

      next();
    });
  }
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), localGithubPublisher(env.ADMIN_SECRET ?? '')],
    base: './',
    server: {
      // Make the dev server reachable on the LAN and allow the localtunnel host
      host: true,
      port: 5173,
      allowedHosts: ['stock-table-planner.loca.lt']
    }
  };
});
