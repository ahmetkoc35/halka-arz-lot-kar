# Halka Arz Tabloları

Public, shareable halka arz table app built with Vite, React, TypeScript, Capacitor, Cloudflare Pages Functions, and Cloudflare D1.

## Architecture

- `src/App.tsx` is the shell. It loads published tables for all users, keeps existing local tools under `Araçlar`, and shows admin controls only after hidden activation.
- `src/components/PublicTables.tsx` renders published tables and share/download actions.
- `src/components/AdminPanel.tsx` provides create, edit, delete, duplicate, publish, unpublish, row, column, and summary-card management.
- `src/components/ShareableTableCard.tsx` renders the premium PNG export card.
- `src/services/tablesApi.ts` is the frontend API client.
- `functions/api/*` are Cloudflare Pages Functions.
- `migrations/0001_create_shared_tables.sql` creates the D1 schema.

## Routing

There is no traditional router or login page.

- Normal users open `/` and automatically see published tables.
- Admin activation uses a hidden query parameter: `/?admin=YOUR_ADMIN_SECRET`.
- After successful activation, the secret is stored locally on that device only.
- Admin deactivation is available from the `Yönetim` tab.

## Storage

- Published/shared data is stored in Cloudflare D1, not `localStorage`.
- Local calculator data in `Araçlar` still uses `localStorage` to preserve the existing app behavior.
- D1 stores title, subtitle, summary cards, columns, rows, updated date, and published state.

## Why Cloudflare Pages + D1

Cloudflare Pages hosts the Vite app from GitHub and stays online when your computer is off. Pages Functions add a serverless API without a traditional server. D1 is the best storage fit because this app stores structured table records that need filtering by published state and ordered updated dates. KV is excellent for key-value cache data, but D1 is cleaner for editable table records.

## Local Setup

```bash
npm install
npm run typecheck
npm run build
```

## Cloudflare Setup

1. Create a Cloudflare account.
2. Create a D1 database named `halka-arz-lot-kar-db`.
3. Copy the generated D1 database ID.
4. Replace `REPLACE_WITH_CLOUDFLARE_D1_DATABASE_ID` in `wrangler.toml`.
5. Run the migration:

```bash
npx wrangler d1 migrations apply halka-arz-lot-kar-db --remote
```

6. In Cloudflare dashboard, go to Workers & Pages.
7. Create a Pages project from the GitHub repository.
8. Use these Pages build settings:

```text
Framework preset: Vite
Build command: npm run build
Build output directory: dist
Root directory: /
Node.js version: 22
```

9. Add a D1 binding in Pages:

```text
Binding name: DB
D1 database: halka-arz-lot-kar-db
```

10. Add an environment variable:

```text
ADMIN_SECRET=use-a-long-random-secret
```

Set it for Production and Preview if you want admin mode to work in preview deployments.

## GitHub Setup

- Connect the GitHub repository from Cloudflare Pages.
- Enable automatic production deployments from the main branch.
- Enable preview deployments for pull requests if desired.
- No GitHub Actions secret is required when using Cloudflare Pages Git integration.

## Admin Activation

Open:

```text
https://YOUR_SITE.pages.dev/?admin=YOUR_ADMIN_SECRET
```

After activation, the `Yönetim` tab appears on that device. The URL is cleaned automatically. To remove admin access from the device, use `Admin çıkışı`.

For the installed Android app, tap the `Halka Arz Tabloları` title 7 times. A hidden admin prompt appears. Enter the same `ADMIN_SECRET`; if it verifies successfully, only that phone stores admin access locally.

## Publishing Tables

1. Activate admin mode.
2. Open `Yönetim`.
3. Create or edit a table.
4. Add summary cards, columns, and rows.
5. Turn on `Yayında`.
6. Save.

Published tables become visible to all users automatically.

## Sharing Tables

Every published table includes:

- native share support when the browser supports Web Share API with files
- automatic PNG fallback download
- high-resolution dark finance-card image
- Turkish character support
- mobile-friendly story-style image ratio

## APK Download

Latest Android APK:

https://github.com/ahmetkoc35/halka-arz-lot-kar/raw/main/android/app/build/outputs/apk/debug/HalkaArzTabloları.apk

The web app remains public on Cloudflare Pages even when your computer is powered off. The APK is still available from GitHub.

## Required Environment Variables

```text
ADMIN_SECRET
VITE_API_BASE_URL
```

This must match the hidden activation secret you use in `/?admin=...`.

`VITE_PUBLIC_TABLES_URL` points to the public GitHub JSON file that APK users read. The app defaults to GitHub's Contents API for `public/published-tables.json` so newly published tables appear faster than the raw-file cache.

For local PC admin publishing, run `npm run dev`, open `http://localhost:5173`, and use the `Yönetim` tab. The default local admin secret is `local-dev-admin` unless you set `ADMIN_SECRET` in your local environment. Saving a published table updates `public/published-tables.json`, commits it, and pushes it to GitHub.

## Future Maintenance

- Use Pull Requests for changes.
- Run `npm install`, `npm run typecheck`, and `npm run build` before merging.
- Add database migrations under `migrations/`.
- Apply D1 migrations with Wrangler after schema changes.
- Rotate `ADMIN_SECRET` in Cloudflare if the secret is exposed.
