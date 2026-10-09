import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'device_tokens' })
export class DeviceToken {
  @PrimaryColumn({ type: 'varchar' })
  token!: string;

  @Column({ type: 'int' })
  userId!: number;

  @Column({ type: 'varchar' })
  platform!: string;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @Column({ type: 'timestamptz' })
  updatedAt!: Date;
}
