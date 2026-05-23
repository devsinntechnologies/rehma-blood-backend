# Chat Module Integration Guide

This document explains how the chat module works, how the backend is wired, how the admin dashboard in `rehma-blood` should integrate it, and how a Flutter mobile app should consume the same chat APIs and sockets.

## 1. What The Chat Module Covers

The chat module supports:

- 1:1 conversations between admin and donor.
- Request-based conversations tied to a blood request or donor profile.
- Text messages.
- Voice messages.
- Image, video, and file attachments.
- Read receipts and unread counts.
- Typing indicators.
- Conversation archiving and muting.
- Socket-based live updates.

The current backend implementation is already added under `src/chat/` and is mounted in the app root module.

## 2. Current Backend Architecture

The backend uses the existing NestJS structure and reuses the same JWT auth pattern used elsewhere in the project.

Key points:

- Socket namespace: `/chat`
- JWT auth source: `Authorization: Bearer <token>` in HTTP and socket handshake auth/headers/query.
- Conversation room pattern: `chat:conversation:<conversationId>`
- Per-user room pattern: `chat:user:<role>:<userId>`
- Message files are stored locally in `uploads/chat`.
- Notifications are still sent separately through the existing notifications module.

Important limitation:

- The current chat state is backed by the in-memory storage service. That is fine for development and a first release, but production chat history should move to a database-backed model.

## 3. Backend Data Model

The backend stores chat in the shared storage layer with these concepts:

- Conversation
  - `id`
  - `type`: `direct`, `group`, `request`, `support`
  - `title`
  - `contextType`
  - `contextId`
  - `participants`
  - `lastMessageId`
  - `lastMessagePreview`
  - `lastMessageAt`
- Participant
  - `role`: `superadmin`, `donor`, `user`
  - `userId`
  - `displayName`
  - `unreadCount`
  - `lastReadMessageId`
  - `archived`
  - `muted`
  - `isTyping`
- Message
  - `id`
  - `conversationId`
  - `senderRole`
  - `senderUserId`
  - `senderName`
  - `body`
  - `messageType`: `text`, `voice`, `image`, `video`, `file`, `mixed`
  - `replyToMessageId`
  - `status`
  - `attachments`
- Attachment
  - `id`
  - `messageId`
  - `originalName`
  - `fileName`
  - `mimeType`
  - `kind`
  - `size`
  - `url`
  - `previewUrl`

## 4. Backend API Contract

### 4.1 HTTP endpoints

Base path: `/chat`

#### Conversations

- `GET /chat/conversations`
  - List conversations for the authenticated account.
- `POST /chat/conversations`
  - Create a conversation.
- `GET /chat/conversations/:id`
  - Fetch conversation details.
- `PATCH /chat/conversations/:id/archive`
  - Archive or unarchive the conversation for the current user.
- `PATCH /chat/conversations/:id/mute`
  - Mute or unmute the conversation for the current user.

#### Messages

- `GET /chat/conversations/:id/messages?limit=50&beforeMessageId=123`
  - List messages with pagination.
- `POST /chat/conversations/:id/messages`
  - Send a message with optional attachments.

#### Read state

- `PATCH /chat/conversations/:id/read`
  - Mark a conversation as read.
- `GET /chat/unread-count`
  - Get total unread count for the authenticated user.

#### Attachments

- `GET /chat/attachments/:id`
  - Download or stream a stored attachment.

### 4.2 Message upload payload

The send-message endpoint accepts multipart form data.

Typical fields:

- `body`: optional text.
- `messageType`: optional explicit type.
- `replyToMessageId`: optional thread reference.
- `files[]`: optional one or more attachments.

Supported mime families:

- `image/*`
- `video/*`
- `audio/*`
- other files such as PDF, DOCX, XLSX, ZIP

## 5. Socket Contract

### 5.1 Connect

Connect to the socket namespace `/chat` using the same JWT that is used for HTTP.

Server emits:

- `chat:connected`
  - Includes authenticated user and unread count.

### 5.2 Events sent by client

- `chat:join`
  - Join a conversation room.
- `chat:leave`
  - Leave a conversation room.
- `chat:typing`
  - Notify typing state.
- `chat:read`
  - Mark conversation as read.
- `chat:message`
  - Send a text message through socket.

### 5.3 Events broadcast by server

- `chat:joined`
- `chat:left`
- `chat:typing`
- `chat:read`
- `chat:message`
- `chat:conversation-updated`
- `chat:unread-count`

### 5.4 Suggested socket usage

- Use HTTP for initial page load and pagination.
- Use socket events for real-time sending, typing, read receipts, and unread badges.
- Use the notifications socket only for cross-feature alerts, not for message delivery itself.

## 6. How Admin Can Message Any Donor

This is the key admin-dashboard flow.

The `rehma-blood` dashboard is admin-only, so the admin can start a direct conversation with any donor by selecting a donor from the donor list and creating a conversation with these participants:

- `superadmin` = current admin user
- `donor` = selected donor

Recommended flow:

1. Admin opens `/admin/messages`.
2. Admin searches donors from the donor directory or donor list.
3. Admin clicks `New Message` or `Chat` on a donor row.
4. Frontend calls `POST /chat/conversations` with `type: direct` and the two participants.
5. If the conversation already exists, the backend returns the existing one.
6. Admin opens the thread and sends text, voice, picture, video, or file.
7. Donor receives the message in the donor app and also gets a notification fallback.

Suggested payload for a direct admin-to-donor thread:

```json
{
  "type": "direct",
  "title": "Chat with donor",
  "contextType": "donor_profile",
  "contextId": 45,
  "participants": [
    { "role": "superadmin", "userId": 1 },
    { "role": "donor", "userId": 45 }
  ]
}
```

For request-linked support, set `contextType` to something like `blood_request` and attach the request id in `contextId`.

## 7. Admin Dashboard Integration (`rehma-blood`)

The dashboard already has a `Messages` route at `/admin/messages`, so the integration should replace the current placeholder UI with real API and socket state.

### 7.1 Where the dashboard should connect

- Auth token already lives in local storage under the dashboard auth slice.
- Base API URL is defined in `src/contant.ts`.
- The admin shell already blocks unauthenticated users in `src/app/admin/layout.tsx`.
- The sidebar already exposes `Messages` in `src/components/dashboard/Sidebar.tsx`.

### 7.2 Recommended dashboard layout

Use a 3-panel or 2-panel layout:

- Left panel: donor search and conversation list.
- Main panel: active thread.
- Optional right panel: donor profile, blood group, availability, last donation, verification status, and contact metadata.

### 7.3 Recommended admin UI behavior

- Show all conversations for the signed-in admin.
- Show a `New Chat` button that opens donor search.
- Allow creating a new thread directly from a donor row or donor profile drawer.
- Support attachments from the same composer:
  - text input
  - upload image
  - upload file
  - record voice note
  - upload video
- Show delivery and read state.
- Show typing indicator.
- Show unread badges on threads.
- Show socket connectivity status.

### 7.4 Suggested admin data flow

On page load:

1. Fetch `GET /chat/conversations`.
2. Fetch `GET /chat/unread-count`.
3. Connect to socket namespace `/chat`.
4. Subscribe to conversation updates and unread count updates.

When admin selects a donor:

1. Create or load a direct conversation.
2. Open `GET /chat/conversations/:id/messages`.
3. Join the socket room for that conversation.
4. Mark the conversation read.

When admin sends a message:

1. Optimistically render the message in the composer thread.
2. POST to `/chat/conversations/:id/messages` with multipart form data.
3. Reconcile the returned message id and timestamps.
4. Update thread preview and unread badges.

### 7.5 Redux/state suggestions for the dashboard

Add a dedicated chat slice or RTK Query API layer for:

- conversations
- messages per conversation
- active conversation id
- unread count
- socket connection state
- upload progress
- typing state

The existing `Messages` page currently has static sample data, so this is the screen to convert first.

## 8. Flutter Mobile App Integration

The Flutter app should use the same backend and socket namespace.

### 8.1 Packages

Suggested Flutter packages:

- `dio` or `http` for REST calls
- `socket_io_client` for realtime chat
- `image_picker` for images and videos
- `file_picker` for documents
- `record` or a similar audio recorder package for voice messages
- `flutter_secure_storage` for JWT persistence
- `permission_handler` for camera, microphone, and storage permissions

### 8.2 Flutter login/session flow

1. User logs in and receives JWT.
2. Persist JWT securely.
3. On app start, fetch conversations from `/chat/conversations`.
4. Open the `/chat` socket with the JWT.
5. Join the current conversation room when a thread is opened.

### 8.3 Flutter chat screens

Recommended screens:

- Conversation inbox
- Conversation detail
- Media picker / attachment composer
- Voice recorder
- Donor or admin profile details if needed

### 8.4 Flutter send-message flow

For text only:

1. POST `/chat/conversations/:id/messages`
2. Include `body`
3. Listen for returned message and socket echo

For media:

1. Use multipart upload to the same endpoint.
2. Add one or more files to the `files` field.
3. Set `messageType` when you want explicit behavior.

For voice notes:

1. Record audio locally.
2. Upload the audio file as multipart.
3. Set `messageType` to `voice` when sending the attachment.

### 8.5 Flutter realtime behavior

Use socket events to keep the UI responsive:

- `chat:message` to append new messages.
- `chat:typing` to show typing indicators.
- `chat:read` to update read receipts.
- `chat:conversation-updated` to refresh archive/mute state.
- `chat:unread-count` to refresh badge counts.

### 8.6 Flutter offline and retry handling

- Queue outgoing messages when offline.
- Retry failed uploads.
- Show pending state for media until server confirms.
- Refresh unread counts when reconnecting.

## 9. End-to-End Flow Examples

### 9.1 Admin starts a conversation with a donor

1. Admin opens the Messages page.
2. Admin searches for a donor.
3. Admin starts a new direct chat.
4. Backend creates the conversation and stores both participants.
5. Socket rooms are joined.
6. Admin sends the first message.
7. Donor receives a live socket event and a notification fallback.

### 9.2 Donor replies from mobile app

1. Donor opens the app.
2. App loads conversations and unread count.
3. Donor opens the admin chat thread.
4. Donor sends a reply with text or media.
5. Admin dashboard receives the socket event immediately.

### 9.3 Admin sends an image or file

1. Admin selects the donor thread.
2. Admin attaches a picture, PDF, or video.
3. Message is sent as multipart form data.
4. Backend stores the file under `uploads/chat`.
5. Attachment metadata is returned with the message.

## 10. Implementation Checklist

### Backend

- [x] Chat module added.
- [x] Socket namespace created.
- [x] JWT handshake added.
- [x] Conversation and message APIs added.
- [x] Attachment download endpoint added.
- [x] Notifications triggered on message send.
- [ ] Move persistence from in-memory storage to database entities.
- [ ] Add pagination cursor support for large threads.
- [ ] Add upload limits and mime validation policies.
- [ ] Add thumbnail generation for images/video.

### Admin dashboard

- [ ] Replace the static `/admin/messages` page with live data.
- [ ] Connect to `/chat` socket namespace.
- [ ] Add donor search and `New Chat` action.
- [ ] Add message composer with attachments.
- [ ] Add read receipts and typing indicator.
- [ ] Add unread badges in the sidebar and messages list.

### Flutter app

- [ ] Add REST client for chat endpoints.
- [ ] Add socket connection on login.
- [ ] Add inbox and conversation screens.
- [ ] Add image/video/file picking.
- [ ] Add voice recording and upload.
- [ ] Add offline retry and socket reconnection handling.

## 11. Recommended Next Production Step

The current backend works, but the next serious step should be to move chat storage out of memory and into TypeORM/Postgres so messages, attachments, and read state survive restarts and can be queried efficiently.

That upgrade should happen before you treat chat as production-ready.
