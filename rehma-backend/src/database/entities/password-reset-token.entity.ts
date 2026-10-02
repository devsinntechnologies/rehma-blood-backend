import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Mirrors ResetTokenRecord (storage/app-storage.service.ts). */
@Entity({ name: 'password_reset_tokens' })
export class PasswordResetToken {
  @PrimaryColumn({ type: 'varchar' })
  token!: string;

  @Column({ type: 'varchar' })
  email!: string;

  @Column({ type: 'varchar' })
  userType!: string;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'boolean', default: false })
  used!: boolean;
}
