import { AppStorageService } from '../storage/app-storage.service';
import { ConfigService } from '@nestjs/config';
import {
  CompositePushDeliveryProvider,
  MockPushDeliveryProvider,
  PushDeliveryService,
} from './push-delivery.service';
import { FcmPushDeliveryProvider } from './fcm-push-delivery.provider';

describe('PushDeliveryService (mock provider)', () => {
  it('delivers to registered device tokens', async () => {
    const storage = new AppStorageService();
    await storage.onModuleInit();
    storage.upsertDeviceToken(42, 'android', 'token-abc');
    const mock = new MockPushDeliveryProvider();
    const config = { get: () => undefined } as unknown as ConfigService;
    const composite = new CompositePushDeliveryProvider(config, new FcmPushDeliveryProvider(config), mock);
    const service = new PushDeliveryService(storage, composite);

    await service.deliverToUser(42, 'Hello', 'Body', { deepLink: 'rehma://request/1' });

    expect(mock.sent.length).toBe(1);
    expect(mock.sent[0].title).toBe('Hello');
  });
});
