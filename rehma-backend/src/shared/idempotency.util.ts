import * as crypto from 'crypto';

export function hashRequestBody(body: unknown): string {
  const normalized = JSON.stringify(body ?? {});
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

export function buildIdempotencyKey(
  actorUserId: number,
  actorRole: string,
  operation: string,
  clientKey: string | undefined,
): string {
  const base = clientKey?.trim() || crypto.randomUUID();
  return `${actorRole}:${actorUserId}:${operation}:${base}`;
}
