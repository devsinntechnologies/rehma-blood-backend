import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Mirrors ChatConversationRecord (storage/app-storage.service.ts); participants are stored inline. */
@Entity({ name: 'chat_conversations' })
export class ChatConversation {
  @PrimaryColumn({ type: 'int' })
  id!: number;

  @Column({ type: 'varchar' })
  type!: string;

  @Column({ type: 'varchar', nullable: true })
  title!: string | null;

  @Column({ type: 'varchar', nullable: true })
  contextType!: string | null;

  @Column({ type: 'int', nullable: true })
  contextId!: number | null;

  @Column({ type: 'varchar' })
  createdByRole!: string;

  @Column({ type: 'int' })
  createdByUserId!: number;

  @Column({ type: 'jsonb' })
  participants!: unknown[];

  @Column({ type: 'int', nullable: true })
  lastMessageId!: number | null;

  @Column({ type: 'text', nullable: true })
  lastMessagePreview!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastMessageAt!: Date | null;

  @Column({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz' })
  updatedAt!: Date;
}
