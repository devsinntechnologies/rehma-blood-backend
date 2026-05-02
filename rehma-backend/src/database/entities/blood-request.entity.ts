import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'blood_requests' })
export class BloodRequest {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', nullable: true })
  requesterName!: string | null;

  @Column({ type: 'varchar', nullable: true })
  requesterContact!: string | null;

  @Column()
  bloodGroup!: string;

  @Column({ type: 'int' })
  requiredUnits!: number;

  @Column({ default: 'normal' })
  urgency!: 'urgent' | 'normal';

  @Column({ type: 'varchar', nullable: true })
  notes!: string | null;

  @Column({ type: 'float' })
  latitude!: number;

  @Column({ type: 'float' })
  longitude!: number;

  @Column({ default: 'active' })
  status!: 'active' | 'accepted' | 'on_the_way' | 'arrived_at_hospital' | 'donation_completed';

  @Column({ type: 'int', nullable: true })
  acceptedByDonorId!: number | null;

  @Column({ type: 'varchar', nullable: true })
  acceptedByDonorName!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  acceptedAt!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  completedAt!: Date | null;

  @Column({ type: 'int', nullable: true })
  fulfilledByDonorId!: number | null;

  @Column({ type: 'varchar', nullable: true })
  fulfilledByDonorName!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}