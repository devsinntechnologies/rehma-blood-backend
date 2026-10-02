import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** Mirrors UserRecord (storage/app-storage.service.ts): accounts registered through the mobile app. */
@Entity({ name: 'app_users' })
export class AppUser {
  @PrimaryColumn({ type: 'int' })
  id!: number;

  @Column({ type: 'varchar' })
  fullName!: string;

  @Index()
  @Column({ type: 'varchar' })
  email!: string;

  @Index()
  @Column({ type: 'varchar' })
  mobileNumber!: string;

  @Column({ type: 'varchar' })
  dateOfBirth!: string;

  @Column({ type: 'double precision' })
  weight!: number;

  @Column({ type: 'varchar' })
  bloodGroup!: string;

  @Column({ type: 'varchar', nullable: true })
  lastBloodDonation!: string | null;

  @Column({ type: 'varchar' })
  passwordHash!: string;

  @Column({ type: 'varchar', default: 'user' })
  role!: string;

  @Column({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz' })
  updatedAt!: Date;
}
