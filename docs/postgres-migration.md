# PostgreSQL migration

The Hub currently stores its complete state in `data/kayan-hub-store.json`. The migration keeps that JSON backup intact and imports the current snapshot plus backup payloads into PostgreSQL/Neon.

Vercel's current storage flow provisions PostgreSQL through the Neon Marketplace integration and exposes a `DATABASE_URL` environment variable. Add the integration to the Vercel project, then copy the generated variable to the deployment environment. Do not commit its value.

## Tables

- `hub_state`: one protected singleton row containing the typed `HubStateSnapshot` as JSONB. The JSONB envelope is intentional: it preserves nested CMS, CRM, media, audit, backup metadata, and connector data without lossy flattening during the first migration.
- `hub_state_backups`: immutable backup payload records with checksum and provenance metadata.

Both tables are created by `db/migrations/001_hub_state.sql`.

## Run the migration

```bash
export DATABASE_URL='postgres://...'
export DATABASE_SSL=true
npm run db:migrate
npm run db:verify
```

The migration runs in one transaction. It refuses to overwrite an existing different `hub_state` row unless `ALLOW_MIGRATION_OVERWRITE=true` is explicitly set after reviewing the existing database backup. Missing backup payloads also abort the transaction.

The command prints the imported SHA-256 hash and counts for products, subscribers, subscriptions, and backups. The JSON files remain untouched until the PostgreSQL read path has been switched and verified in production.

## Vercel deployment note

The application should receive `DATABASE_URL` as an encrypted production environment variable. `KAYAN_AI_API_KEY`, `KAYAN_SESSION_SECRET`, and `KAYAN_WEBHOOK_SECRET` must also remain encrypted. Only the URL and non-secret configuration names belong in `.env.example`.
