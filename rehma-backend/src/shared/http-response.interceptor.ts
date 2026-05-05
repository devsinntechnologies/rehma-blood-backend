import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { map, Observable } from 'rxjs';

@Injectable()
export class HttpResponseInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((value) => {
        if (value && typeof value === 'object' && 'success' in (value as Record<string, unknown>)) {
          return value;
        }

        if (value && typeof value === 'object' && 'message' in (value as Record<string, unknown>)) {
          const response = value as Record<string, unknown>;
          const { message, ...rest } = response;
          return {
            success: true,
            message: String(message),
            data: Object.keys(rest).length > 0 ? rest : null,
          };
        }

        return {
          success: true,
          message: 'Request successful',
          data: value ?? null,
        };
      }),
    );
  }
}