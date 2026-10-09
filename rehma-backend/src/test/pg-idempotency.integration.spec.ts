import { Client } from 'pg';

const run = process.env.RUN_PG_INTEGRATION === '1';

(run ? describe : describe.skip)('PostgreSQL idempotency (concurrent connections)', () => {
  let clientA: Client;
  let clientB: Client;

  beforeAll(async () => {
    const url =
      process.env.DATABASE_URL ??
      `postgres://${process.env.DATABASE_USER ?? 'postgres'}:${process.env.DATABASE_PASSWORD ?? 'postgres'}@${process.env.DATABASE_HOST ?? 'localhost'}:${process.env.DATABASE_PORT ?? '5435'}/${process.env.DATABASE_NAME ?? 'rehma_blood'}`;

    clientA = new Client({ connectionString: url });
    clientB = new Client({ connectionString: url });
    await clientA.connect();
    await clientB.connect();

    await clientA.query(`
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
    `);
  });

  afterAll(async () => {
    await clientA?.end();
    await clientB?.end();
  });

  it('allows only one concurrent insert for the same idempotency key', async () => {
    const key = `test-${Date.now()}-${Math.random()}`;
    const insert = `
      INSERT INTO idempotency_record (key, "actorUserId", "actorRole", operation, "requestBodyHash", "statusCode", "responseBody")
      VALUES ($1, 1, 'user', 'test', 'hash', 200, '{}')
      ON CONFLICT (key) DO NOTHING
      RETURNING key;
    `;

    const [a, b] = await Promise.all([clientA.query(insert, [key]), clientB.query(insert, [key])]);
    const winners = [a.rowCount, b.rowCount].filter((n) => n === 1).length;
    expect(winners).toBe(1);

    const count = await clientA.query('SELECT COUNT(*)::int AS c FROM idempotency_record WHERE key = $1', [key]);
    expect(count.rows[0].c).toBe(1);
    await clientA.query('DELETE FROM idempotency_record WHERE key = $1', [key]);
  });
});
