-- Run manually in staging/production (TYPEORM_SYNCHRONIZE=false).
-- Idempotent: safe to re-apply; uses IF NOT EXISTS where supported.

CREATE TABLE IF NOT EXISTS request_participation (
  id SERIAL PRIMARY KEY,
  "requestId" INTEGER NOT NULL,
  "donorId" INTEGER NOT NULL,
  "ownerUserId" INTEGER NOT NULL,
  "historicalOwnerUserId" INTEGER,
  status VARCHAR(32) NOT NULL,
  "responseType" VARCHAR(32),
  "unitsCommitted" INTEGER NOT NULL DEFAULT 0,
  "unitsReported" INTEGER NOT NULL DEFAULT 0,
  "unitsConfirmed" INTEGER NOT NULL DEFAULT 0,
  "legacyMigrated" BOOLEAN NOT NULL DEFAULT FALSE,
  "needsAdminReconciliation" BOOLEAN NOT NULL DEFAULT FALSE,
  "quantityConfidence" VARCHAR(32) NOT NULL DEFAULT 'exact',
  "offeredAt" TIMESTAMPTZ,
  "agreedAt" TIMESTAMPTZ,
  "inviteExpiresAt" TIMESTAMPTZ,
  "reportedAt" TIMESTAMPTZ,
  "receiptConfirmedAt" TIMESTAMPTZ,
  "disputeReason" TEXT,
  version INTEGER NOT NULL DEFAULT 0,
  "lastEventId" VARCHAR(64),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS idempotency_record (
  key VARCHAR(256) PRIMARY KEY,
  "actorUserId" INTEGER NOT NULL,
  "actorRole" VARCHAR(32) NOT NULL,
  operation VARCHAR(128) NOT NULL,
  "requestBodyHash" VARCHAR(128) NOT NULL,
  "statusCode" INTEGER NOT NULL,
  "responseBody" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_event (
  "eventId" VARCHAR(64) PRIMARY KEY,
  "participationId" INTEGER,
  "requestId" INTEGER,
  type VARCHAR(64) NOT NULL,
  "idempotencyKey" VARCHAR(256),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS device_token (
  token VARCHAR(512) PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  platform VARCHAR(16) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS participation_audit (
  id SERIAL PRIMARY KEY,
  "participationId" INTEGER,
  "requestId" INTEGER NOT NULL,
  "actorUserId" INTEGER NOT NULL,
  "actorRole" VARCHAR(32) NOT NULL,
  action VARCHAR(64) NOT NULL,
  reason TEXT,
  "fromStatus" VARCHAR(32),
  "toStatus" VARCHAR(32),
  metadata JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE blood_request ADD COLUMN IF NOT EXISTS "hospitalName" VARCHAR(255);
ALTER TABLE blood_request ADD COLUMN IF NOT EXISTS "deadlineAt" TIMESTAMPTZ;
ALTER TABLE blood_request ADD COLUMN IF NOT EXISTS "contactPhone" VARCHAR(64);
ALTER TABLE blood_request ADD COLUMN IF NOT EXISTS "matchingStopped" BOOLEAN DEFAULT FALSE;
ALTER TABLE blood_request ADD COLUMN IF NOT EXISTS "cancelReason" TEXT;
ALTER TABLE blood_request ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMPTZ;
ALTER TABLE blood_request ADD COLUMN IF NOT EXISTS "legacyMigrationVersion" INTEGER DEFAULT 0;
