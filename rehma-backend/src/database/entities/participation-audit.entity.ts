import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'participation_audits' })
export class ParticipationAudit {
  @PrimaryColumn({ type: 'int' })
  id!: number;

  @Column({ type: 'int', nullable: true })
  participationId!: number | null;

  @Column({ type: 'int' })
  requestId!: number;

  @Column({ type: 'int' })
  actorUserId!: number;

  @Column({ type: 'varchar' })
  actorRole!: string;

  @Column({ type: 'varchar' })
  action!: string;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @Column({ type: 'varchar', nullable: true })
  fromStatus!: string | null;

  @Column({ type: 'varchar', nullable: true })
  toStatus!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @Column({ type: 'timestamptz' })
  createdAt!: Date;
}
