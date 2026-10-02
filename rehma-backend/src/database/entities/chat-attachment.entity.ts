import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** Mirrors ChatAttachmentRecord (storage/app-storage.service.ts). The file itself stays in uploads/chat. */
@Entity({ name: 'chat_attachments' })
export class ChatAttachment {
  @PrimaryColumn({ type: 'int' })
  id!: number;

  @Index()
  @Column({ type: 'int' })
  messageId!: number;

  @Column({ type: 'varchar' })
  originalName!: string;

  @Column({ type: 'varchar' })
  fileName!: string;

  @Column({ type: 'varchar' })
  mimeType!: string;

  @Column({ type: 'varchar' })
  kind!: string;

  @Column({ type: 'int' })
  size!: number;

  @Column({ type: 'varchar' })
  url!: string;

  @Column({ type: 'varchar', nullable: true })
  previewUrl!: string | null;

  @Column({ type: 'int', nullable: true })
  durationMs!: number | null;

  @Column({ type: 'int', nullable: true })
  width!: number | null;

  @Column({ type: 'int', nullable: true })
  height!: number | null;

  @Column({ type: 'timestamptz' })
  createdAt!: Date;
}
