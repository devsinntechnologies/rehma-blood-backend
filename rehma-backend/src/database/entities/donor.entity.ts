import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'donors' })
export class Donor {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  fullName!: string;

  @Column({ type: 'varchar', unique: true, nullable: true })
  email?: string;

  @Column({ type: 'varchar', unique: true, nullable: true })
  promoCode?: string;

  @Column({ default: false })
  isClaimed!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  claimedAt?: Date;

  @Column({ type: 'int', nullable: true })
  createdByUserId?: number;

  @Column({ type: 'int', nullable: true })
  claimedByUserId?: number;

  @Column({ type: 'int', nullable: true })
  linkedUserId?: number;

  @Column({ type: 'timestamp', nullable: true })
  promoCodeExpiresAt?: Date;

  @Column({ type: 'varchar', nullable: true })
  bloodGroup?: string;

  @Column({ default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}