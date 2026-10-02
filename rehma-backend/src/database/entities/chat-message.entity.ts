import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** Mirrors ChatMessageRecord (storage/app-storage.service.ts); attachments live in chat_attachments. */
@Entity({ name: 'chat_messages' })
export class ChatMessage {
  @PrimaryColumn({ type: 'int' })
  id!: number;

  @Index()
  @Column({ type: 'int' })
  conversationId!: number;

  @Column({ type: 'varchar' })
  senderRole!: string;

  @Column({ type: 'int' })
  senderUserId!: number;

  @Column({ type: 'varchar' })
  senderName!: string;

  @Column({ type: 'text', nullable: true })
  body!: string | null;

  @Column({ type: 'varchar' })
  messageType!: string;

  @Column({ type: 'int', nullable: true })
  replyToMessageId!: number | null;

  @Column({ type: 'varchar' })
  status!: string;

  @Column({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  editedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
