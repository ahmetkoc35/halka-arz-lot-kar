# Halka Arz Tabloları

Android APK:

https://github.com/ahmetkoc35/halka-arz-lot-kar/raw/main/android/app/build/outputs/apk/debug/HalkaArzTabloları.apk

## Local Admin

Admin publishing works only from the trusted local PC at `http://localhost:5173`.

Create a private `.env` file on that PC:

```text
ADMIN_SECRET=your-private-secret
```

The `.env` file is ignored by Git and must not be committed. The repository does not contain the real admin password.

Run:

```bash
npm install
npm run dev
```

Open `http://localhost:5173`, go to the `Admin` tab, and enter the private password.

Publishing a table updates `public/published-tables.json`, commits it, and pushes it to GitHub using the Git credentials available on that PC.

Published tables can be created, but the app does not expose a published-table delete action.

Published tables are read from the public GitHub raw JSON file so the app does not depend on GitHub's stricter unauthenticated API rate limit.

## Build Checks

```bash
npm run typecheck
npm run build
```
