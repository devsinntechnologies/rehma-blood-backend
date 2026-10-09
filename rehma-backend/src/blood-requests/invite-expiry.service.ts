import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ParticipationLifecycleService } from './participation-lifecycle.service';

@Injectable()
export class InviteExpiryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InviteExpiryService.name);
  private timer?: ReturnType<typeof setInterval>;

  constructor(private readonly lifecycle: ParticipationLifecycleService) {}

  onModuleInit(): void {
    const intervalMs = Number(process.env.INVITE_EXPIRY_POLL_MS ?? 60_000);
    this.timer = setInterval(() => {
      void this.lifecycle.processExpiredInvites().catch((err) => {
        this.logger.warn(`Invite expiry sweep failed: ${err instanceof Error ? err.message : String(err)}`);
      });
    }, intervalMs);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
