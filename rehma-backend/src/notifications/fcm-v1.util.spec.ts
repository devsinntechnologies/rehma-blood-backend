import { isInvalidFcmTokenError, stringifyFcmData } from './fcm-v1.util';

describe('FCM v1 helpers', () => {
  it('detects invalid token error codes', () => {
    expect(isInvalidFcmTokenError('UNREGISTERED')).toBe(true);
    expect(isInvalidFcmTokenError('INVALID_ARGUMENT')).toBe(true);
    expect(isInvalidFcmTokenError('RESOURCE_EXHAUSTED')).toBe(false);
  });

  it('stringifies data payload values', () => {
    expect(stringifyFcmData({ deepLink: 'rehma://request/1', n: '2' as unknown as string })).toEqual({
      deepLink: 'rehma://request/1',
      n: '2',
    });
  });
});
