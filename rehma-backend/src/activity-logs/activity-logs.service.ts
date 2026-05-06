import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { ActivityLog } from '../database/entities/activity-log.entity';

export interface CreateActivityLogDto {
  method: string;
  endpoint: string;
  userId?: number;
  userEmail?: string;
  userRole?: string;
  requestBody?: string;
  responseBody?: string;
  statusCode: number;
  ipAddress?: string;
  userAgent?: string;
  duration: number;
  errorMessage?: string;
}

export interface FilterActivityLogsDto {
  startDate?: Date;
  endDate?: Date;
  method?: string;
  endpoint?: string;
  statusCode?: number;
  userEmail?: string;
  userRole?: string;
  limit?: number;
  offset?: number;
  page?: number;
}

export interface PaginatedActivityLogsResponse {
  data: ActivityLog[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    page: number;
    totalPages: number;
  };
}

@Injectable()
export class ActivityLogsService {
  constructor(
    @InjectRepository(ActivityLog)
    private readonly activityLogRepository: Repository<ActivityLog>,
  ) {}

  async create(createActivityLogDto: CreateActivityLogDto): Promise<ActivityLog> {
    const activityLog = this.activityLogRepository.create(createActivityLogDto);
    return this.activityLogRepository.save(activityLog);
  }

  async findAll(filters: FilterActivityLogsDto = {}): Promise<PaginatedActivityLogsResponse> {
    const query = this.activityLogRepository.createQueryBuilder('activity');

    // Apply filters
    if (filters.startDate && filters.endDate) {
      query.where('activity.createdAt BETWEEN :startDate AND :endDate', {
        startDate: filters.startDate,
        endDate: filters.endDate,
      });
    } else if (filters.startDate) {
      query.where('activity.createdAt >= :startDate', {
        startDate: filters.startDate,
      });
    } else if (filters.endDate) {
      query.where('activity.createdAt <= :endDate', {
        endDate: filters.endDate,
      });
    }

    if (filters.method) {
      query.andWhere('activity.method = :method', { method: filters.method });
    }

    if (filters.endpoint) {
      query.andWhere('activity.endpoint LIKE :endpoint', { endpoint: `%${filters.endpoint}%` });
    }

    if (filters.statusCode) {
      query.andWhere('activity.statusCode = :statusCode', { statusCode: filters.statusCode });
    }

    if (filters.userEmail) {
      query.andWhere('activity.userEmail LIKE :userEmail', { userEmail: `%${filters.userEmail}%` });
    }

    if (filters.userRole) {
      query.andWhere('activity.userRole = :userRole', { userRole: filters.userRole });
    }

    // Order by creation date descending
    query.orderBy('activity.createdAt', 'DESC');

    // Apply pagination
    const limit = filters.limit || 50;
    const page = filters.page || 1;
    const offset = (page - 1) * limit;

    query.take(limit).skip(offset);

    const [data, total] = await query.getManyAndCount();
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        total,
        limit,
        offset,
        page,
        totalPages,
      },
    };
  }

  async findOne(id: number): Promise<ActivityLog | null> {
    return this.activityLogRepository.findOne({ where: { id } });
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<ActivityLog[]> {
    return this.activityLogRepository.find({
      where: {
        createdAt: Between(startDate, endDate),
      },
      order: { createdAt: 'DESC' },
    });
  }

  async findByUserEmail(userEmail: string, limit: number = 50, page: number = 1): Promise<PaginatedActivityLogsResponse> {
    const offset = (page - 1) * limit;
    const query = this.activityLogRepository
      .createQueryBuilder('activity')
      .where('activity.userEmail = :userEmail', { userEmail })
      .orderBy('activity.createdAt', 'DESC')
      .take(limit)
      .skip(offset);

    const [data, total] = await query.getManyAndCount();
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        total,
        limit,
        offset,
        page,
        totalPages,
      },
    };
  }

  async findByEndpoint(endpoint: string, limit: number = 50, page: number = 1): Promise<PaginatedActivityLogsResponse> {
    const offset = (page - 1) * limit;
    const query = this.activityLogRepository
      .createQueryBuilder('activity')
      .where('activity.endpoint LIKE :endpoint', { endpoint: `%${endpoint}%` })
      .orderBy('activity.createdAt', 'DESC')
      .take(limit)
      .skip(offset);

    const [data, total] = await query.getManyAndCount();
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        total,
        limit,
        offset,
        page,
        totalPages,
      },
    };
  }

  async getStatistics() {
    const totalRequests = await this.activityLogRepository.count();

    // Get requests by method
    const requestsByMethod = await this.activityLogRepository
      .createQueryBuilder('activity')
      .select('activity.method', 'method')
      .addSelect('COUNT(*)', 'count')
      .groupBy('activity.method')
      .getRawMany();

    // Get requests by status code
    const requestsByStatus = await this.activityLogRepository
      .createQueryBuilder('activity')
      .select('activity.statusCode', 'statusCode')
      .addSelect('COUNT(*)', 'count')
      .groupBy('activity.statusCode')
      .getRawMany();

    // Get top endpoints
    const topEndpoints = await this.activityLogRepository
      .createQueryBuilder('activity')
      .select('activity.endpoint', 'endpoint')
      .addSelect('COUNT(*)', 'count')
      .groupBy('activity.endpoint')
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany();

    // Get average response time
    const avgResponseTime = await this.activityLogRepository
      .createQueryBuilder('activity')
      .select('AVG(activity.duration)', 'avgDuration')
      .getRawOne();

    return {
      totalRequests,
      requestsByMethod: requestsByMethod.map(r => ({ method: r.method, count: parseInt(r.count) })),
      requestsByStatus: requestsByStatus.map(r => ({ statusCode: r.statusCode, count: parseInt(r.count) })),
      topEndpoints: topEndpoints.map(r => ({ endpoint: r.endpoint, count: parseInt(r.count) })),
      avgResponseTime: parseFloat(avgResponseTime?.avgDuration || 0),
    };
  }

  async deleteOlderThan(days: number): Promise<any> {
    const date = new Date();
    date.setDate(date.getDate() - days);

    return this.activityLogRepository.delete({
      createdAt: LessThanOrEqual(date),
    });
  }
}
