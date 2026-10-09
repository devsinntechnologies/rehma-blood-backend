import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'request_participations' })
export class RequestParticipation {
  @PrimaryColumn({ type: 'int' })
  id!: number;

  @Column({ type: 'int' })
  requestId!: number;

  @Column({ type: 'int' })
  donorId!: number;

  /** User authorized to act for this donor at last update (claim may transfer). */
  @Column({ type: 'int' })
  ownerUserId!: number;

  @Column({ type: 'int', nullable: true })
  historicalOwnerUserId!: number | null;

  @Column({ type: 'varchar' })
  status!: string;

  @Column({ type: 'varchar', nullable: true })
  responseType!: string | null;

  @Column({ type: 'int', default: 1 })
  unitsCommitted!: number;

  @Column({ type: 'int', default: 0 })
  unitsReported!: number;

  @Column({ type: 'int', default: 0 })
  unitsConfirmed!: number;

  @Column({ type: 'boolean', default: false })
  legacyMigrated!: boolean;

  @Column({ type: 'boolean', default: false })
  needsAdminReconciliation!: boolean;

  @Column({ type: 'varchar', nullable: true })
  quantityConfidence!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  offeredAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  agreedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  inviteExpiresAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  reportedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  receiptConfirmedAt!: Date | null;

  @Column({ type: 'int', default: 0 })
  version!: number;

  @Column({ type: 'varchar', nullable: true })
  lastEventId!: string | null;

  @Column({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz' })
  updatedAt!: Date;
}
