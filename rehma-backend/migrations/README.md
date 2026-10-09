# Database migrations

1. Set `TYPEORM_SYNCHRONIZE=false` in staging/production (see `.env.example`).
2. Apply SQL in numeric order against the target database (requires existing TypeORM core tables such as `blood_request`; on greenfield DBs run the app once with `TYPEORM_SYNCHRONIZE=true` in dev only, or restore from staging):

   ```bash
   psql "$DATABASE_URL" -f migrations/001_participation_and_ops.sql
   psql "$DATABASE_URL" -f migrations/002_typeorm_table_names.sql
   ```

   **Production (TypeORM):** always apply **`002_typeorm_table_names.sql`** — table names are plural (`blood_requests`, `request_participations`, etc.).

3. Start the API once so `ParticipationMigrationService` can backfill legacy rows (idempotent; skips reconciled participations).
4. Do **not** re-run destructive scripts against production without a backup.

Development may keep `TYPEORM_SYNCHRONIZE=true` for convenience; do not rely on it outside dev.

## Verify idempotent apply (non-production)

```bash
chmod +x scripts/verify-migration-idempotent.sh
DATABASE_URL=postgres://postgres:postgres@localhost:5435/rehma_blood ./scripts/verify-migration-idempotent.sh
```

## Push (FCM HTTP v1)

Set `FCM_PROJECT_ID` and service-account credentials via `GOOGLE_APPLICATION_CREDENTIALS` or ADC. Do not use legacy server keys. See `.env.example`.
