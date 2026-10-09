import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppStorageService } from '../storage/app-storage.service';
import { FcmPushDeliveryProvider } from './fcm-push-delivery.provider';

export type PushPayload = {
  userId: number;
  title: string;
  body: string;
  data?: Record<string, string>;
};

export interface PushDeliveryProvider {
  send(tokens: string[], payload: Omit<PushPayload, 'userId'>): Promise<{ delivered: number; invalidTokens: string[] }>;
}

/** Default provider for dev/CI — records sends without contacting FCM/APNs. */
@Injectable()
export class MockPushDeliveryProvider implements PushDeliveryProvider {
  readonly sent: PushPayload[] = [];

  async send(
    tokens: string[],
    payload: Omit<PushPayload, 'userId'>,
  ): Promise<{ delivered: number; invalidTokens: string[] }> {
    if (tokens.length) {
      this.sent.push({ userId: 0, title: payload.title, body: payload.body, data: payload.data });
    }
    return { delivered: tokens.length, invalidTokens: [] };
  }
}

@Injectable()
export class CompositePushDeliveryProvider implements PushDeliveryProvider {
  constructor(
    private readonly config: ConfigService,
    private readonly fcm: FcmPushDeliveryProvider,
    private readonly mock: MockPushDeliveryProvider,
  ) {}

  send(tokens: string[], payload: Omit<PushPayload, 'userId'>) {
    if (this.fcm.isConfigured()) {
      return this.fcm.send(tokens, payload);
    }
    return this.mock.send(tokens, payload);
  }
}

@Injectable()
export class PushDeliveryService {
  private readonly logger = new Logger(PushDeliveryService.name);

  constructor(
    private readonly storage: AppStorageService,
    private readonly provider: CompositePushDeliveryProvider,
  ) {}

  async deliverToUser(userId: number, title: string, body: string, data?: Record<string, string>): Promise<void> {
    const tokens = this.storage.listDeviceTokensForUser(userId).map((t) => t.token);
    if (!tokens.length) return;

    const result = await this.provider.send(tokens, { title, body, data });
    for (const invalid of result.invalidTokens) {
      this.storage.deactivateDeviceToken(invalid);
    }
    this.logger.debug(`Push to user ${userId}: delivered=${result.delivered}`);
  }
}
