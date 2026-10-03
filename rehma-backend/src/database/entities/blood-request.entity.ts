import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Mirrors BloodRequestRecord (storage/app-storage.service.ts). IDs are assigned by the app. */
@Entity({ name: 'blood_requests' })
export class BloodRequest {
  @PrimaryColumn({ type: 'int' })
  id!: number;

  @Column({ type: 'int', nullable: true })
  requesterUserId!: number | null;

  @Column({ type: 'varchar', nullable: true })
  requesterName!: string | null;

  @Column({ type: 'varchar', nullable: true })
  requesterContact!: string | null;

  @Column({ type: 'varchar' })
  bloodGroup!: string;

  @Column({ type: 'int' })
  requiredUnits!: number;

  @Column({ type: 'varchar' })
  urgency!: string;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'double precision' })
  latitude!: number;

  @Column({ type: 'double precision' })
  longitude!: number;

  @Column({ type: 'varchar' })
  status!: string;

  @Column({ type: 'int', nullable: true })
  requestedToDonorId!: number | null;

  @Column({ type: 'varchar', nullable: true })
  requestedToDonorName!: string | null;

  @Column({ type: 'int', nullable: true })
  acceptedByDonorId!: number | null;

  @Column({ type: 'varchar', nullable: true })
  acceptedByDonorName!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  acceptedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  scheduledDate!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @Column({ type: 'int', nullable: true })
  fulfilledByDonorId!: number | null;

  @Column({ type: 'varchar', nullable: true })
  fulfilledByDonorName!: string | null;

  @Column({ type: 'boolean', default: false })
  received!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  receivedAt!: Date | null;

  @Column({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz' })
  updatedAt!: Date;
}
