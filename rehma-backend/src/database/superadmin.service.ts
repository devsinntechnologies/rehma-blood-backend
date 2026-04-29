import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { SuperAdmin } from './entities/superadmin.entity';

@Injectable()
export class SuperAdminService implements OnModuleInit {
  constructor(
    @InjectRepository(SuperAdmin)
    private readonly superAdminRepository: Repository<SuperAdmin>,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const email = this.configService.get<string>('SUPERADMIN_EMAIL');
    const password = this.configService.get<string>('SUPERADMIN_PASSWORD');
    const fullName = 'Super Admin';

    if (!email || !password) {
      return;
    }

    const existingAdmin = await this.superAdminRepository.findOne({ where: { email } });

    if (existingAdmin) {
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const superAdmin = this.superAdminRepository.create({ email, passwordHash, fullName });
    await this.superAdminRepository.save(superAdmin);
  }

  findByEmail(email: string): Promise<SuperAdmin | null> {
    return this.superAdminRepository.findOne({ where: { email } });
  }
}