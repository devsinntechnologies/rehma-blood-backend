/** FCM HTTP v1 error codes that mean the device token should be removed. */
export function isInvalidFcmTokenError(code: string | undefined): boolean {
  if (!code) return false;
  const normalized = code.toUpperCase();
  return (
    normalized === 'UNREGISTERED' ||
    normalized === 'NOT_FOUND' ||
    normalized === 'INVALID_ARGUMENT'
  );
}

export function stringifyFcmData(data?: Record<string, string>): Record<string, string> {
  if (!data) return {};
  return Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, v == null ? '' : String(v)]),
  );
}
