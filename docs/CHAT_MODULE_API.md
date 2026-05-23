# Chat Module API

This document describes the Chat module REST and WebSocket APIs implemented in the backend.

Base path: `/chat` — All REST endpoints require Bearer JWT authentication.

**Auth**
- REST: `Authorization: Bearer <token>` header.
- WebSocket: provide token in `handshake.auth.token`, `Authorization` header, or `?token=` query param.

Implementation reference:
- Controller: [rehma-backend/src/chat/chat.controller.ts](rehma-backend/src/chat/chat.controller.ts#L1-L200)
- Service: [rehma-backend/src/chat/chat.service.ts](rehma-backend/src/chat/chat.service.ts#L1-L200)
- Gateway (Socket.IO): [rehma-backend/src/chat/chat.gateway.ts](rehma-backend/src/chat/chat.gateway.ts#L1-L200)
- DTOs: [rehma-backend/src/chat/dto](rehma-backend/src/chat/dto/create-chat-conversation.dto.ts#L1-L200)

---

**REST Endpoints**

- GET /chat/conversations
  - Auth: required
  - Description: List conversations for authenticated account.
  - Response: `Conversation[]` (conversation summary with participant-specific fields: `unreadCount`, `archived`, `muted`, `isTyping`).

- POST /chat/conversations
  - Auth: required
  - Body: `CreateChatConversationDto` — `type?`, `title?`, `contextType?`, `contextId?`, `participants: [{ role, userId }]` (non-empty)
  - Response: created conversation summary.
  - Side-effects: broadcasts conversation via gateway and creates notifications for recipients.

- GET /chat/conversations/:id
  - Auth: required
  - Description: Get conversation (participant only).
  - Response: conversation summary.

- GET /chat/conversations/:id/messages
  - Auth: required
  - Query: `limit?` (default 50, max 100), `beforeMessageId?` (cursor)
  - Response: `{ items: ChatMessage[], total, hasMore, nextCursor }`
  - ChatMessage includes: `id, conversationId, senderRole, senderUserId, senderName, body?, messageType, replyToMessageId?, status, attachments[], createdAt, updatedAt, editedAt?, deletedAt?, readBy[]`.

- POST /chat/conversations/:id/messages
  - Auth: required
  - Content-Type: `multipart/form-data` (up to 10 files under field `files`)
  - Body fields: `body?`, `messageType?` (`text|voice|image|video|file|mixed`), `replyToMessageId?`, `files[]`
  - Validation: must provide `body` or at least one attachment; otherwise 400.
  - Response: created `ChatMessage` (serialized). Broadcasts message and unread-count updates.

- PATCH /chat/conversations/:id/read
  - Auth: required
  - Body: `MarkChatReadDto` `{ lastReadMessageId?: number }`
  - Response: `{ conversation, unreadCount, lastReadMessageId }`.

- PATCH /chat/conversations/:id/archive
  - Auth: required
  - Body: `UpdateChatParticipantStateDto` `{ archived?: boolean, muted?: boolean }`
  - Response: updated conversation summary (participant state updated).

- PATCH /chat/conversations/:id/mute
  - Same as archive endpoint but intended for toggling `muted`.

- GET /chat/unread-count
  - Auth: required
  - Response: `{ unreadCount: number }`.

- GET /chat/attachments/:id
  - Auth: required
  - Streams attachment file (inline) with correct `Content-Type` and `Content-Disposition`.

---

**WebSocket (Socket.IO)**

- Namespace: `/chat` (CORS allowed). Server verifies JWT on connection.
- Rooms:
  - User room: `chat:user:{role}:{userId}` — per-account personal room for unread-count and conversation updates.
  - Conversation room: `chat:conversation:{conversationId}` — join to receive conversation events.

Client events → Server:
- `chat:join` { conversationId } → replies/emits `chat:joined` { conversation }
- `chat:leave` { conversationId } → emits `chat:left` { conversationId, user }
- `chat:typing` { conversationId, isTyping } → broadcasts `chat:typing` { conversationId, userId, role, isTyping }
- `chat:read` { conversationId, lastReadMessageId? } → emits `chat:read` (conversation room) and `chat:unread-count` (user room)
- `chat:message` { conversationId, body?, messageType?, replyToMessageId? } → creates message (no attachments), broadcasts `chat:message`
- `chat:state` { conversationId, archived?, muted? } → updates participant state and emits `chat:conversation-updated`

Server events → Client:
- `chat:connected` { user, unreadCount }
- `chat:joined` { conversation }
- `chat:left` { conversationId, user }
- `chat:typing` { conversationId, userId, role, isTyping }
- `chat:read` { conversationId, role, userId, lastReadMessageId, unreadCount }
- `chat:message` message object
- `chat:conversation-updated` conversation summary
- `chat:unread-count` { unreadCount }

Example connection (socket.io-client):
```js
import { io } from 'socket.io-client';
const socket = io('https://api.example.com/chat', { auth: { token: 'Bearer ' + TOKEN } });
socket.on('chat:connected', (payload) => console.log(payload));
```

---

**DTOs / Payload Summary**
- `CreateChatConversationDto` (see source): `type?`, `title?`, `contextType?`, `contextId?`, `participants: [{ role, userId }]`
- `SendChatMessageDto`: `body?`, `messageType?`, `replyToMessageId?`
- `ListChatMessagesDto`: `limit?`, `beforeMessageId?`
- `UpdateChatParticipantStateDto`: `archived?`, `muted?`
- `MarkChatReadDto`: `lastReadMessageId?`

Source DTOs: [rehma-backend/src/chat/dto/create-chat-conversation.dto.ts](rehma-backend/src/chat/dto/create-chat-conversation.dto.ts#L1-L200), [rehma-backend/src/chat/dto/send-chat-message.dto.ts](rehma-backend/src/chat/dto/send-chat-message.dto.ts#L1-L200)

---

**Errors & Status Codes**
- `401 Unauthorized` — missing/invalid JWT on REST or WS connect.
- `403 Forbidden` — authenticated but not a participant in a conversation.
- `404 Not Found` — conversation/message/attachment not found.
- `400 Bad Request` — invalid payload (e.g. sending message without body/attachments).

---

**Behavioral Notes**
- Attachments are stored under `uploads/chat` using a generated filename; accessible via `/chat/attachments/:id` if file exists. See `persistAttachments()` in service.
- Message type is inferred if not provided: text/voice/image/video/file/mixed rules in `inferMessageType()`.
- Notifications are created for conversation creation and messages using the `NotificationsService`.

---

If you want an OpenAPI (swagger) snippet, a Postman collection, or example JSON responses for each endpoint, tell me which format and I'll add it.
