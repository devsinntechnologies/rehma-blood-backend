import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleAuth } from 'google-auth-library';
import { PushDeliveryProvider } from './push-delivery.service';
import { isInvalidFcmTokenError, stringifyFcmData } from './fcm-v1.util';

const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

@Injectable()
export class FcmPushDeliveryProvider implements PushDeliveryProvider {
  private readonly logger = new Logger(FcmPushDeliveryProvider.name);
  private auth: GoogleAuth | null = null;

  constructor(private readonly config: ConfigService) {}

  /** True when project id is set and credentials can be resolved (ADC or GOOGLE_APPLICATION_CREDENTIALS). */
  isConfigured(): boolean {
    return Boolean(this.config.get<string>('FCM_PROJECT_ID'));
  }

  private googleAuth(): GoogleAuth {
    if (!this.auth) {
      this.auth = new GoogleAuth({ scopes: [FCM_SCOPE] });
    }
    return this.auth;
  }

  private async accessToken(): Promise<string | null> {
    if (!this.isConfigured()) return null;
    try {
      const client = await this.googleAuth().getClient();
      const tokenResponse = await client.getAccessToken();
      return tokenResponse.token ?? null;
    } catch (e) {
      this.logger.warn(
        `FCM auth failed (check GOOGLE_APPLICATION_CREDENTIALS or ADC): ${e instanceof Error ? e.message : String(e)}`,
      );
      return null;
    }
  }

  async send(
    tokens: string[],
    payload: { title: string; body: string; data?: Record<string, string> },
  ): Promise<{ delivered: number; invalidTokens: string[] }> {
    const projectId = this.config.get<string>('FCM_PROJECT_ID');
    if (!projectId || tokens.length === 0) {
      return { delivered: 0, invalidTokens: [] };
    }

    const accessToken = await this.accessToken();
    if (!accessToken) {
      return { delivered: 0, invalidTokens: [] };
    }

    const invalidTokens: string[] = [];
    let delivered = 0;
    const data = stringifyFcmData(payload.data);
    const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    for (const token of tokens) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              token,
              notification: { title: payload.title, body: payload.body },
              data,
            },
          }),
        });

        if (response.ok) {
          delivered += 1;
          continue;
        }

        const json = (await response.json()) as {
          error?: { status?: string; message?: string; details?: { errorCode?: string }[] };
        };
        const detailCode = json.error?.details?.find((d) => d.errorCode)?.errorCode;
        if (isInvalidFcmTokenError(detailCode) || response.status === 404) {
          invalidTokens.push(token);
        }
        this.logger.warn(
          `FCM v1 send failed for token prefix ${token.slice(0, 8)}: ${json.error?.status ?? response.status} ${json.error?.message ?? ''}`,
        );
      } catch (e) {
        this.logger.warn(`FCM network error: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return { delivered, invalidTokens };
  }
}
