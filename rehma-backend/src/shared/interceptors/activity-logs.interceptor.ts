import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { ActivityLogsService, CreateActivityLogDto } from '../../activity-logs/activity-logs.service';

@Injectable()
export class ActivityLogsInterceptor implements NestInterceptor {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const startTime = Date.now();

    const method = request.method;
    const endpoint = request.path;
    const ipAddress = request.ip || request.connection.remoteAddress;
    const userAgent = request.get('user-agent');
    const user = request.user;

    // Serialize request body (limit size to prevent huge logs)
    let requestBody = '';
    if (request.body && Object.keys(request.body).length > 0) {
      try {
        requestBody = JSON.stringify(request.body).substring(0, 2000);
      } catch (e) {
        requestBody = '[Unable to serialize request body]';
      }
    }

    return next.handle().pipe(
      tap((data: any) => {
        const duration = Date.now() - startTime;
        const statusCode = response.statusCode;

        // Serialize response body (limit size)
        let responseBody = '';
        if (data) {
          try {
            responseBody = JSON.stringify(data).substring(0, 2000);
          } catch (e) {
            responseBody = '[Unable to serialize response body]';
          }
        }

        // Create activity log
        const activityLog: CreateActivityLogDto = {
          method,
          endpoint,
          userId: user?.sub,
          userEmail: user?.email,
          userRole: user?.role,
          requestBody: requestBody || undefined,
          responseBody: responseBody || undefined,
          statusCode,
          ipAddress,
          userAgent,
          duration,
        };

        // Log asynchronously (don't wait for it)
        this.activityLogsService.create(activityLog).catch((err: any) => {
          console.error('Failed to create activity log:', err);
        });
      }),
      catchError((error: any) => {
        const duration = Date.now() - startTime;
        const statusCode = error.status || 500;

        // Log the error
        const activityLog: CreateActivityLogDto = {
          method,
          endpoint,
          userId: user?.sub,
          userEmail: user?.email,
          userRole: user?.role,
          requestBody: requestBody || undefined,
          statusCode,
          ipAddress,
          userAgent,
          duration,
          errorMessage: error.message || 'Unknown error',
        };

        // Log asynchronously (don't wait for it)
        this.activityLogsService.create(activityLog).catch((err: any) => {
          console.error('Failed to create activity log:', err);
        });

        throw error;
      }),
    );
  }
}
