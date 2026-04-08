# Hisab Command Center

Business dashboard for partner investments, inventory, sales, expenses, withdrawals, cash in hand, and net worth.

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Production Build

```bash
npm run build
npm run start
```

## Data Storage Model

- Local development fallback: `data/hisab-state.json`
- Vercel production: Vercel KV via `@vercel/kv`

The API route automatically uses Vercel KV when KV env vars are available.

## Deploy to Vercel

1. Import this repository in Vercel.
2. Add KV to the Vercel project (Storage -> KV).
3. Ensure env vars are present in Vercel:
	- `KV_REST_API_URL`
	- `KV_REST_API_TOKEN`
4. Deploy.

## Important

- Keep periodic backups using the Admin export/import tools.
- Current data snapshot is included in `data/hisab-state.json` for local fallback/migration.
