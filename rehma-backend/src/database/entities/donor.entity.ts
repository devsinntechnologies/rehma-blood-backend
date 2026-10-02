import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** Mirrors DonorRecord (storage/app-storage.service.ts). IDs are assigned by the app. */
@Entity({ name: 'donors' })
export class Donor {
  @PrimaryColumn({ type: 'int' })
  id!: number;

  @Column({ type: 'varchar' })
  fullName!: string;

  @Index()
  @Column({ type: 'varchar', nullable: true })
  email!: string | null;

  @Index()
  @Column({ type: 'varchar', nullable: true })
  phone!: string | null;

  @Column({ type: 'int', nullable: true })
  userId!: number | null;

  @Column({ type: 'varchar', nullable: true })
  bloodGroup!: string | null;

  @Column({ type: 'varchar', nullable: true })
  passwordHash!: string | null;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'boolean', default: true })
  isAvailable!: boolean;

  @Column({ type: 'varchar', nullable: true })
  availabilityStatus!: string | null;

  @Column({ type: 'double precision', nullable: true })
  latitude!: number | null;

  @Column({ type: 'double precision', nullable: true })
  longitude!: number | null;

  @Column({ type: 'varchar', nullable: true })
  city!: string | null;

  @Column({ type: 'varchar', nullable: true })
  gender!: string | null;

  @Column({ type: 'varchar', nullable: true })
  dateOfBirth!: string | null;

  @Column({ type: 'varchar', nullable: true })
  cnic!: string | null;

  @Column({ type: 'text', nullable: true })
  profileImage!: string | null;

  @Column({ type: 'varchar', nullable: true })
  lastDonationDate!: string | null;

  @Column({ type: 'text', nullable: true })
  medicalNotes!: string | null;

  @Column({ type: 'int', default: 0 })
  totalDonations!: number;

  @Index()
  @Column({ type: 'varchar', nullable: true })
  promoCode!: string | null;

  @Column({ type: 'boolean', default: false })
  isClaimed!: boolean;

  @Column({ type: 'boolean', default: false })
  isVerifiedAccount!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  claimedAt!: Date | null;

  @Column({ type: 'int', nullable: true })
  createdByUserId!: number | null;

  @Column({ type: 'int', nullable: true })
  claimedByUserId!: number | null;

  @Column({ type: 'int', nullable: true })
  linkedUserId!: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  promoCodeExpiresAt!: Date | null;

  @Column({ type: 'varchar', nullable: true })
  claimStatus!: string | null;

  @Column({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz' })
  updatedAt!: Date;
}
