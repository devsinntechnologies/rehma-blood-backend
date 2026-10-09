-- Idempotent column patches for existing production DBs (TypeORM camelCase quoted names).
-- Run if the app crashes with PostgreSQL code 42703 (undefined column).

-- blood_requests (BloodBridge fields)
ALTER TABLE blood_requests ADD COLUMN IF NOT EXISTS "hospitalName" VARCHAR(255);
ALTER TABLE blood_requests ADD COLUMN IF NOT EXISTS "deadlineAt" TIMESTAMPTZ;
ALTER TABLE blood_requests ADD COLUMN IF NOT EXISTS "contactPhone" VARCHAR(64);
ALTER TABLE blood_requests ADD COLUMN IF NOT EXISTS "contactEmail" VARCHAR(255);
ALTER TABLE blood_requests ADD COLUMN IF NOT EXISTS "matchingStopped" BOOLEAN DEFAULT FALSE;
ALTER TABLE blood_requests ADD COLUMN IF NOT EXISTS "cancelReason" TEXT;
ALTER TABLE blood_requests ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMPTZ;
ALTER TABLE blood_requests ADD COLUMN IF NOT EXISTS "inviteRound" INTEGER DEFAULT 0;
ALTER TABLE blood_requests ADD COLUMN IF NOT EXISTS "legacyMigrationVersion" INTEGER DEFAULT 0;

-- notifications
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS "readAt" TIMESTAMPTZ;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS metadata JSONB;

-- request_participations (if table existed before 002 with an incomplete schema)
ALTER TABLE request_participations ADD COLUMN IF NOT EXISTS "historicalOwnerUserId" INTEGER;
ALTER TABLE request_participations ADD COLUMN IF NOT EXISTS "responseType" VARCHAR(32);
ALTER TABLE request_participations ADD COLUMN IF NOT EXISTS "unitsCommitted" INTEGER DEFAULT 1;
ALTER TABLE request_participations ADD COLUMN IF NOT EXISTS "unitsReported" INTEGER DEFAULT 0;
ALTER TABLE request_participations ADD COLUMN IF NOT EXISTS "unitsConfirmed" INTEGER DEFAULT 0;
ALTER TABLE request_participations ADD COLUMN IF NOT EXISTS "legacyMigrated" BOOLEAN DEFAULT FALSE;
ALTER TABLE request_participations ADD COLUMN IF NOT EXISTS "needsAdminReconciliation" BOOLEAN DEFAULT FALSE;
ALTER TABLE request_participations ADD COLUMN IF NOT EXISTS "quantityConfidence" VARCHAR(32);
ALTER TABLE request_participations ADD COLUMN IF NOT EXISTS "offeredAt" TIMESTAMPTZ;
ALTER TABLE request_participations ADD COLUMN IF NOT EXISTS "agreedAt" TIMESTAMPTZ;
ALTER TABLE request_participations ADD COLUMN IF NOT EXISTS "inviteExpiresAt" TIMESTAMPTZ;
ALTER TABLE request_participations ADD COLUMN IF NOT EXISTS "reportedAt" TIMESTAMPTZ;
ALTER TABLE request_participations ADD COLUMN IF NOT EXISTS "receiptConfirmedAt" TIMESTAMPTZ;
ALTER TABLE request_participations ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 0;
ALTER TABLE request_participations ADD COLUMN IF NOT EXISTS "lastEventId" VARCHAR(64);
ALTER TABLE request_participations ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE request_participations ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW();

-- donors (claim / promo fields sometimes missing on older DBs)
ALTER TABLE donors ADD COLUMN IF NOT EXISTS "isClaimed" BOOLEAN DEFAULT FALSE;
ALTER TABLE donors ADD COLUMN IF NOT EXISTS "isVerifiedAccount" BOOLEAN DEFAULT FALSE;
ALTER TABLE donors ADD COLUMN IF NOT EXISTS "claimedAt" TIMESTAMPTZ;
ALTER TABLE donors ADD COLUMN IF NOT EXISTS "createdByUserId" INTEGER;
ALTER TABLE donors ADD COLUMN IF NOT EXISTS "claimedByUserId" INTEGER;
ALTER TABLE donors ADD COLUMN IF NOT EXISTS "linkedUserId" INTEGER;
ALTER TABLE donors ADD COLUMN IF NOT EXISTS "promoCodeExpiresAt" TIMESTAMPTZ;
ALTER TABLE donors ADD COLUMN IF NOT EXISTS "claimStatus" VARCHAR(32);

-- chat_messages (older DBs)
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS "replyToMessageId" INTEGER;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS "editedAt" TIMESTAMPTZ;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ;

-- blood_requests: received flags (ensure present)
ALTER TABLE blood_requests ADD COLUMN IF NOT EXISTS received BOOLEAN DEFAULT FALSE;
ALTER TABLE blood_requests ADD COLUMN IF NOT EXISTS "receivedAt" TIMESTAMPTZ;
