import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** Mirrors NotificationRecord (storage/app-storage.service.ts). */
@Entity({ name: 'notifications' })
@Index(['recipientRole', 'recipientUserId'])
export class Notification {
  @PrimaryColumn({ type: 'int' })
  id!: number;

  @Column({ type: 'varchar' })
  recipientRole!: string;

  @Column({ type: 'int' })
  recipientUserId!: number;

  @Column({ type: 'varchar' })
  type!: string;

  @Column({ type: 'varchar' })
  title!: string;

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'varchar', nullable: true })
  entityType!: string | null;

  @Column({ type: 'int', nullable: true })
  entityId!: number | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @Column({ type: 'boolean', default: false })
  isRead!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  readAt!: Date | null;

  @Column({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz' })
  updatedAt!: Date;
}
