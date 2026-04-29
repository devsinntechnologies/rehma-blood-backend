import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'blood_donations' })
export class BloodDonation {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  donorName!: string;

  @Column()
  bloodGroup!: string;

  @Column({ default: 'completed' })
  status!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}