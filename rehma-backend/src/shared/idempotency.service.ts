import { ConflictException, Injectable } from '@nestjs/common';
import { AppStorageService } from '../storage/app-storage.service';
import { buildIdempotencyKey, hashRequestBody } from './idempotency.util';

export type IdempotencyContext = {
  actorUserId: number;
  actorRole: string;
  operation: string;
  clientKey?: string;
  body: unknown;
};

@Injectable()
export class IdempotencyService {
  constructor(private readonly storage: AppStorageService) {}

  /**
   * Returns cached response if the same actor retries with the same key and body hash.
   * Throws if the key is reused with a different body.
   */
  async run<T extends Record<string, unknown>>(
    ctx: IdempotencyContext,
    handler: () => Promise<{ statusCode: number; body: T }>,
  ): Promise<{ statusCode: number; body: T; replayed: boolean }> {
    const key = buildIdempotencyKey(ctx.actorUserId, ctx.actorRole, ctx.operation, ctx.clientKey);
    const requestBodyHash = hashRequestBody(ctx.body);
    const existing = this.storage.findIdempotency(key);
    if (existing) {
      if (existing.requestBodyHash !== requestBodyHash) {
        throw new ConflictException('Idempotency-Key reused with a different request body');
      }
      return {
        statusCode: existing.statusCode,
        body: existing.responseBody as T,
        replayed: true,
      };
    }

    const result = await handler();
    this.storage.saveIdempotency({
      key,
      actorUserId: ctx.actorUserId,
      actorRole: ctx.actorRole,
      operation: ctx.operation,
      requestBodyHash,
      statusCode: result.statusCode,
      responseBody: result.body,
      createdAt: new Date(),
    });
    return { ...result, replayed: false };
  }
}
