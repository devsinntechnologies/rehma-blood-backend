import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'idempotency_records' })
export class IdempotencyRecordEntity {
  @PrimaryColumn({ type: 'varchar' })
  key!: string;

  @Column({ type: 'int' })
  actorUserId!: number;

  @Column({ type: 'varchar' })
  actorRole!: string;

  @Column({ type: 'varchar' })
  operation!: string;

  @Column({ type: 'varchar' })
  requestBodyHash!: string;

  @Column({ type: 'int' })
  statusCode!: number;

  @Column({ type: 'jsonb' })
  responseBody!: Record<string, unknown>;

  @Column({ type: 'timestamptz' })
  createdAt!: Date;
}
