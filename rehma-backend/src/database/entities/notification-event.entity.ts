import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'notification_events' })
export class NotificationEvent {
  @PrimaryColumn({ type: 'varchar' })
  eventId!: string;

  @Column({ type: 'int', nullable: true })
  participationId!: number | null;

  @Column({ type: 'int', nullable: true })
  requestId!: number | null;

  @Column({ type: 'varchar' })
  type!: string;

  @Column({ type: 'varchar', nullable: true })
  idempotencyKey!: string | null;

  @Column({ type: 'timestamptz' })
  createdAt!: Date;
}
