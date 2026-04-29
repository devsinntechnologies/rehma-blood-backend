import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'blood_requests' })
export class BloodRequest {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  requesterName!: string;

  @Column()
  bloodGroup!: string;

  @Column({ default: 'pending' })
  status!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}