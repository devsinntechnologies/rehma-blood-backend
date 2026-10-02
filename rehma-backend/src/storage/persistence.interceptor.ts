import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { catchError, concatMap, from, Observable, throwError } from 'rxjs';
import { StoragePersistenceService } from './storage-persistence.service';

/**
 * Holds every HTTP response until the changes it made are saved to Postgres, so a client never
 * gets a success for data that would vanish on restart. If saving fails, the request still
 * succeeds (the data is in memory) and the next save retries; the failure is logged.
 */
@Injectable()
export class PersistenceInterceptor implements NestInterceptor {
  private readonly logger = new Logger(PersistenceInterceptor.name);

  constructor(private readonly persistence: StoragePersistenceService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const save = () =>
      this.persistence.flush().catch((error: Error) => this.logger.error(`Save after request failed: ${error.message}`));

    return next.handle().pipe(
      concatMap((value) => from(save().then(() => value))),
      catchError((error) => from(save()).pipe(concatMap(() => throwError(() => error)))),
    );
  }
}
