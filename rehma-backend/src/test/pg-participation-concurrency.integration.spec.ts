import { Client } from 'pg';

const run = process.env.RUN_PG_INTEGRATION === '1';

function dbUrl(): string {
  return (
    process.env.DATABASE_URL ??
    `postgres://${process.env.DATABASE_USER ?? 'postgres'}:${process.env.DATABASE_PASSWORD ?? 'postgres'}@${process.env.DATABASE_HOST ?? 'localhost'}:${process.env.DATABASE_PORT ?? '5435'}/${process.env.DATABASE_NAME ?? 'rehma_blood'}`
  );
}

(run ? describe : describe.skip)('PostgreSQL participation row concurrency', () => {
  let clientA: Client;
  let clientB: Client;
  let nextRequestId = 100_000;

  beforeAll(async () => {
    const url = dbUrl();
    clientA = new Client({ connectionString: url });
    clientB = new Client({ connectionString: url });
    await clientA.connect();
    await clientB.connect();

    await clientA.query(`
      CREATE TABLE IF NOT EXISTS request_participation (
        id SERIAL PRIMARY KEY,
        "requestId" INTEGER NOT NULL,
        "donorId" INTEGER NOT NULL,
        "ownerUserId" INTEGER NOT NULL,
        status VARCHAR(32) NOT NULL,
        "unitsCommitted" INTEGER NOT NULL DEFAULT 0,
        "unitsReported" INTEGER NOT NULL DEFAULT 0,
        "unitsConfirmed" INTEGER NOT NULL DEFAULT 0,
        version INTEGER NOT NULL DEFAULT 0,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await clientA.query(`
      CREATE TABLE IF NOT EXISTS blood_request_capacity (
        "requestId" INTEGER PRIMARY KEY,
        "requiredUnits" INTEGER NOT NULL,
        "reservedUnits" INTEGER NOT NULL DEFAULT 0,
        "matchingStopped" BOOLEAN NOT NULL DEFAULT FALSE,
        version INTEGER NOT NULL DEFAULT 0
      );
    `);
  });

  afterAll(async () => {
    await clientA?.end();
    await clientB?.end();
  });

  it('accept vs accept: optimistic version bump allows only one winner', async () => {
    const reqId = nextRequestId++;
    await clientA.query(
      `INSERT INTO blood_request_capacity ("requestId", "requiredUnits", "reservedUnits", version)
       VALUES ($1, 1, 0, 0)`,
      [reqId],
    );
    const part = await clientA.query<{ id: number }>(
      `INSERT INTO request_participation ("requestId", "donorId", "ownerUserId", status, "unitsCommitted", version)
       VALUES ($1, 1, 10, 'invited', 0, 0) RETURNING id`,
      [reqId],
    );
    const participationId = part.rows[0].id;

    const acceptSql = `
      WITH cap AS (
        SELECT "requiredUnits", "reservedUnits", version
        FROM blood_request_capacity
        WHERE "requestId" = $1 AND "matchingStopped" = FALSE
        FOR UPDATE
      ),
      try AS (
        SELECT 1 AS ok
        FROM cap
        WHERE "reservedUnits" + 1 <= "requiredUnits"
      ),
      upd_cap AS (
        UPDATE blood_request_capacity c
        SET "reservedUnits" = c."reservedUnits" + 1,
            version = c.version + 1
        FROM try
        WHERE c."requestId" = $1 AND try.ok = 1
        RETURNING c.version
      ),
      upd_part AS (
        UPDATE request_participation p
        SET status = 'accepted', "unitsCommitted" = 1, version = p.version + 1
        WHERE p.id = $2 AND p.status = 'invited' AND EXISTS (SELECT 1 FROM upd_cap)
        RETURNING p.id
      )
      SELECT (SELECT COUNT(*)::int FROM upd_part) AS winners;
    `;

    const [a, b] = await Promise.all([
      clientA.query(acceptSql, [reqId, participationId]),
      clientB.query(acceptSql, [reqId, participationId]),
    ]);
    const winners = (a.rows[0]?.winners ?? 0) + (b.rows[0]?.winners ?? 0);
    expect(winners).toBe(1);

    const cap = await clientA.query(
      'SELECT "reservedUnits"::int AS r FROM blood_request_capacity WHERE "requestId" = $1',
      [reqId],
    );
    expect(cap.rows[0].r).toBe(1);

    await clientA.query('DELETE FROM request_participation WHERE "requestId" = $1', [reqId]);
    await clientA.query('DELETE FROM blood_request_capacity WHERE "requestId" = $1', [reqId]);
  });

  it('accept vs cancel: cancel stops matching before second accept reserves capacity', async () => {
    const reqId = nextRequestId++;
    await clientA.query(
      `INSERT INTO blood_request_capacity ("requestId", "requiredUnits", "reservedUnits", version)
       VALUES ($1, 2, 0, 0)`,
      [reqId],
    );

    const cancelSql = `
      UPDATE blood_request_capacity
      SET "matchingStopped" = TRUE, version = version + 1
      WHERE "requestId" = $1 AND "matchingStopped" = FALSE
      RETURNING "requestId";
    `;

    const reserveSql = `
      WITH cap AS (
        SELECT "requiredUnits", "reservedUnits", version, "matchingStopped"
        FROM blood_request_capacity
        WHERE "requestId" = $1
        FOR UPDATE
      ),
      try AS (
        SELECT 1 AS ok FROM cap
        WHERE "matchingStopped" = FALSE AND "reservedUnits" + 1 <= "requiredUnits"
      ),
      upd AS (
        UPDATE blood_request_capacity c
        SET "reservedUnits" = c."reservedUnits" + 1, version = c.version + 1
        FROM try
        WHERE c."requestId" = $1 AND try.ok = 1
        RETURNING c."reservedUnits"
      )
      SELECT COALESCE((SELECT "reservedUnits" FROM upd), -1) AS reserved;
    `;

    const [cancelResult, reserveResult] = await Promise.all([
      clientA.query(cancelSql, [reqId]),
      clientB.query(reserveSql, [reqId]),
    ]);

    const cancelled = cancelResult.rowCount === 1;
    const reserved = reserveResult.rows[0]?.reserved;
    expect(cancelled || reserved === -1 || reserved === 1).toBe(true);
    if (cancelled) {
      expect(reserved).toBe(-1);
    }

    await clientA.query('DELETE FROM blood_request_capacity WHERE "requestId" = $1', [reqId]);
  });

  it('schedule vs timeout: expired invite cannot transition to accepted under row lock', async () => {
    const reqId = nextRequestId++;
    const partRes = await clientA.query<{ id: number }>(
      `INSERT INTO request_participation ("requestId", "donorId", "ownerUserId", status, "unitsCommitted", version, "inviteExpiresAt")
       VALUES ($1, 2, 20, 'invited', 0, 0, NOW() - INTERVAL '1 minute') RETURNING id`,
      [reqId],
    );
    const partId = partRes.rows[0].id;

    const scheduleSql = `
      UPDATE request_participation
      SET status = 'scheduled', version = version + 1
      WHERE id = $1 AND status = 'invited' AND ("inviteExpiresAt" IS NULL OR "inviteExpiresAt" > NOW())
      RETURNING id;
    `;
    const acceptSql = `
      UPDATE request_participation
      SET status = 'accepted', "unitsCommitted" = 1, version = version + 1
      WHERE id = $1 AND status = 'invited' AND ("inviteExpiresAt" IS NULL OR "inviteExpiresAt" > NOW())
      RETURNING id;
    `;

    const [sched, acc] = await Promise.all([
      clientA.query(scheduleSql, [partId]),
      clientB.query(acceptSql, [partId]),
    ]);
    expect(sched.rowCount).toBe(0);
    expect(acc.rowCount).toBe(0);

    const row = await clientA.query('SELECT status FROM request_participation WHERE id = $1', [partId]);
    expect(row.rows[0].status).toBe('invited');

    await clientA.query('DELETE FROM request_participation WHERE id = $1', [partId]);
  });
});
