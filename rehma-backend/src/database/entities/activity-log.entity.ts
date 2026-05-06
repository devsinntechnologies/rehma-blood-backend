import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'activity_logs' })
export class ActivityLog {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  method!: string; // GET, POST, PUT, PATCH, DELETE

  @Column()
  endpoint!: string; // /api/blood-donations, etc.

  @Column({ nullable: true })
  userId?: number; // ID of the user/donor/superadmin making the request

  @Column({ nullable: true })
  userEmail?: string; // Email of the user making the request

  @Column({ nullable: true })
  userRole?: string; // superadmin, donor, user, etc.

  @Column({ type: 'text', nullable: true })
  requestBody?: string; // JSON string of request body

  @Column({ type: 'text', nullable: true })
  responseBody?: string; // JSON string of response body

  @Column()
  statusCode!: number; // HTTP status code

  @Column({ nullable: true })
  ipAddress?: string; // Client IP address

  @Column({ nullable: true })
  userAgent?: string; // User agent string

  @Column({ type: 'float', default: 0 })
  duration!: number; // Request duration in milliseconds

  @Column({ nullable: true, type: 'text' })
  errorMessage?: string; // Error message if request failed

  @CreateDateColumn()
  createdAt!: Date;
}
