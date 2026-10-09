# Push notifications (FCM HTTP v1)

## Backend

- Provider: `FcmPushDeliveryProvider` uses **FCM HTTP v1** (`POST /v1/projects/{project}/messages:send`) with OAuth2 from `google-auth-library`.
- When `FCM_PROJECT_ID` is unset, `CompositePushDeliveryProvider` uses the in-process mock (dev/CI).
- Credentials (never commit):
  - `FCM_PROJECT_ID` — Firebase project id
  - `GOOGLE_APPLICATION_CREDENTIALS` — path to a Firebase Admin service account JSON, **or** Application Default Credentials on GCP

Legacy `FCM_SERVER_KEY` / `https://fcm.googleapis.com/fcm/send` is **not** supported.

## Flutter

- `firebase_messaging` is integrated behind `REHMA_FIREBASE_CONFIGURED=true` and `lib/firebase_options.dart` from `flutterfire configure`.
- Background taps persist via `PendingDeepLinkStore` (SharedPreferences) so terminated/background launches can navigate after login.
- Without Firebase config, the app registers a stable **local** token only; end-to-end push is unverified.

## Deep links

- Scheme: `rehma://request/{requestId}?p={participationId}` (optional `p`).
- Push `data` should include `deepLink` or `requestId` / `participationId` string fields.
