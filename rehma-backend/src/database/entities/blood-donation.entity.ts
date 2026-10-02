import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Mirrors BloodDonationRecord (storage/app-storage.service.ts). IDs are assigned by the app. */
@Entity({ name: 'blood_donations' })
export class BloodDonation {
  @PrimaryColumn({ type: 'int' })
  id!: number;

  @Column({ type: 'int', nullable: true })
  requestId!: number | null;

  @Column({ type: 'int' })
  donorId!: number;

  @Column({ type: 'varchar' })
  donorName!: string;

  @Column({ type: 'varchar' })
  bloodGroup!: string;

  @Column({ type: 'varchar' })
  status!: string;

  @Column({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz' })
  updatedAt!: Date;
}
