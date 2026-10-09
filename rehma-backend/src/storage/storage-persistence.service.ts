import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { DataSource, EntityManager, EntityTarget, In, ObjectLiteral } from 'typeorm';
import { AppUser } from '../database/entities/app-user.entity';
import { BloodDonation } from '../database/entities/blood-donation.entity';
import { BloodRequest } from '../database/entities/blood-request.entity';
import { ChatAttachment } from '../database/entities/chat-attachment.entity';
import { ChatConversation } from '../database/entities/chat-conversation.entity';
import { ChatMessage } from '../database/entities/chat-message.entity';
import { Donor } from '../database/entities/donor.entity';
import { Notification } from '../database/entities/notification.entity';
import { PasswordResetToken } from '../database/entities/password-reset-token.entity';
import { SuperAdmin } from '../database/entities/superadmin.entity';
import { RequestParticipation } from '../database/entities/request-participation.entity';
import { IdempotencyRecordEntity } from '../database/entities/idempotency-record.entity';
import { NotificationEvent } from '../database/entities/notification-event.entity';
import { DeviceToken } from '../database/entities/device-token.entity';
import { ParticipationAudit } from '../database/entities/participation-audit.entity';
import { AppStorageService, ChatConversationRecord, StorageState } from './app-storage.service';

type AnyRecord = Record<string, unknown>;

type CollectionSpec = {
  key: keyof StorageState;
  entity: EntityTarget<ObjectLiteral>;
  idField: string;
  /** Turns a loaded row back into the in-memory record shape. */
  fromRow?: (row: AnyRecord) => AnyRecord;
};

const COLLECTIONS: CollectionSpec[] = [
  {
    key: 'superAdmins',
    entity: SuperAdmin,
    idField: 'id',
    // The in-memory record has no timestamps; the table fills them in.
    fromRow: ({ id, email, passwordHash, fullName }) => ({ id, email, passwordHash, fullName }),
  },
  { key: 'users', entity: AppUser, idField: 'id' },
  { key: 'donors', entity: Donor, idField: 'id' },
  { key: 'bloodRequests', entity: BloodRequest, idField: 'id' },
  { key: 'bloodDonations', entity: BloodDonation, idField: 'id' },
  { key: 'notifications', entity: Notification, idField: 'id' },
  {
    key: 'chatConversations',
    entity: ChatConversation,
    idField: 'id',
    // jsonb hands dates back as strings.
    fromRow: (row) => ({
      ...row,
      participants: ((row.participants as ChatConversationRecord['participants']) ?? []).map((participant) => ({
        ...participant,
        joinedAt: new Date(participant.joinedAt),
      })),
    }),
  },
  { key: 'chatMessages', entity: ChatMessage, idField: 'id' },
  { key: 'chatAttachments', entity: ChatAttachment, idField: 'id' },
  { key: 'resetTokens', entity: PasswordResetToken, idField: 'token' },
  { key: 'requestParticipations', entity: RequestParticipation, idField: 'id' },
  { key: 'idempotencyRecords', entity: IdempotencyRecordEntity, idField: 'key' },
  { key: 'notificationEvents', entity: NotificationEvent, idField: 'eventId' },
  { key: 'deviceTokens', entity: DeviceToken, idField: 'token' },
  { key: 'participationAudits', entity: ParticipationAudit, idField: 'id' },
];

const WRITE_CHUNK_SIZE = 500;
const SAVE_DELAY_MS = 50;

/**
 * Makes AppStorageService durable. At startup it loads every table into memory; afterwards it
 * diffs each collection against the last saved state and writes only the rows that changed.
 *
 * HTTP requests wait for the save (see PersistenceInterceptor), so a successful response means the
 * data is in Postgres. Anything else that touches storage (sockets, timers) is saved shortly after.
 */
@Injectable()
export class StoragePersistenceService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(StoragePersistenceService.name);

  /** Last saved JSON of every record, per collection, keyed by id. */
  private saved = new Map<keyof StorageState, Map<string, string>>();
  private columns = new Map<keyof StorageState, string[]>();
  private ready = false;

  private chain: Promise<void> = Promise.resolve();
  private queued: Promise<void> | null = null;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly dataSource: DataSource,
    private readonly storage: AppStorageService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    for (const spec of COLLECTIONS) {
      this.columns.set(
        spec.key,
        this.dataSource.getMetadata(spec.entity).columns.map((column) => column.propertyName),
      );
    }

    const loaded = {} as Record<keyof StorageState, AnyRecord[]>;
    for (const spec of COLLECTIONS) {
      const rows = (await this.dataSource.getRepository(spec.entity).find()) as AnyRecord[];
      loaded[spec.key] = rows.map((row) => (spec.fromRow ? spec.fromRow({ ...row }) : { ...row }));
    }

    // Rows just loaded are, by definition, what the database holds.
    for (const spec of COLLECTIONS) {
      this.saved.set(
        spec.key,
        new Map(loaded[spec.key].map((row) => [String(row[spec.idField]), this.serialize(spec.key, row)])),
      );
    }

    const envAdmins = this.storage.exportState().superAdmins;
    this.storage.hydrate({
      ...(loaded as unknown as StorageState),
      superAdmins: await this.reconcileSuperAdmins(loaded.superAdmins as StorageState['superAdmins'], envAdmins),
    });
    const current = this.storage.exportState();

    this.ready = true;
    this.storage.setChangeListener(() => this.scheduleSave());
    await this.flush(); // writes the superadmin row if it was only configured via env

    this.logger.log(
      `Loaded from database: ${current.users.length} users, ${current.donors.length} donors, ` +
        `${current.bloodRequests.length} blood requests, ${current.bloodDonations.length} donations, ` +
        `${current.chatConversations.length} chats`,
    );
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    await this.flush();
  }

  /** Saves everything changed so far. Resolves once a save that started after this call finishes. */
  flush(): Promise<void> {
    if (!this.ready) return Promise.resolve();
    if (!this.queued) {
      this.queued = this.chain.then(() => {
        // From here on, new changes need another run.
        this.queued = null;
        return this.persistChanges();
      });
      this.chain = this.queued.catch(() => undefined);
    }
    return this.queued;
  }

  private scheduleSave(): void {
    if (!this.ready || this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush().catch(() => undefined);
    }, SAVE_DELAY_MS);
  }

  private async persistChanges(): Promise<void> {
    const state = this.storage.exportState();
    const failures: string[] = [];

    for (const spec of COLLECTIONS) {
      const saved = this.saved.get(spec.key) ?? new Map<string, string>();
      const current = new Map<string, { json: string; record: AnyRecord }>();
      for (const record of state[spec.key] as unknown as AnyRecord[]) {
        current.set(String(record[spec.idField]), { json: this.serialize(spec.key, record), record });
      }

      const changed = [...current].filter(([id, { json }]) => saved.get(id) !== json);
      const removed = [...saved.keys()].filter((id) => !current.has(id));
      if (changed.length === 0 && removed.length === 0) continue;

      try {
        await this.dataSource.transaction(async (manager: EntityManager) => {
          for (let index = 0; index < changed.length; index += WRITE_CHUNK_SIZE) {
            const rows = changed.slice(index, index + WRITE_CHUNK_SIZE).map(([, { record }]) => this.toRow(spec.key, record));
            await manager.upsert(spec.entity, rows, [spec.idField]);
          }
          if (removed.length) {
            await manager.delete(spec.entity, { [spec.idField]: In(this.toIds(spec, removed)) });
          }
        });
        changed.forEach(([id, { json }]) => saved.set(id, json));
        removed.forEach((id) => saved.delete(id));
      } catch {
        // Retry one row at a time so a single bad record can't hold back everything else.
        for (const [id, { json, record }] of changed) {
          try {
            await this.dataSource.manager.upsert(spec.entity, [this.toRow(spec.key, record)], [spec.idField]);
            saved.set(id, json);
          } catch (error) {
            failures.push(`${spec.key}#${id}: ${(error as Error).message}`);
          }
        }
        for (const id of removed) {
          try {
            await this.dataSource.manager.delete(spec.entity, { [spec.idField]: In(this.toIds(spec, [id])) });
            saved.delete(id);
          } catch (error) {
            failures.push(`${spec.key}#${id} (delete): ${(error as Error).message}`);
          }
        }
      }
      this.saved.set(spec.key, saved);
    }

    if (failures.length) {
      // Unsaved rows stay "changed", so every later save retries them.
      const message = `Could not save ${failures.length} record(s) to the database: ${failures.slice(0, 5).join('; ')}`;
      this.logger.error(message);
      throw new Error(message);
    }
  }

  private toIds(spec: CollectionSpec, ids: string[]): Array<string | number> {
    return spec.idField === 'token' ? ids : ids.map(Number);
  }

  /** Only the entity's columns, with undefined normalised to null so cleared fields are cleared in the DB too. */
  private toRow(key: keyof StorageState, record: AnyRecord): AnyRecord {
    const row: AnyRecord = {};
    for (const column of this.columns.get(key) ?? []) {
      if (column in record || !['createdAt', 'updatedAt'].includes(column)) {
        row[column] = record[column] ?? null;
      }
    }
    return row;
  }

  private serialize(key: keyof StorageState, record: AnyRecord): string {
    return JSON.stringify(this.toRow(key, record));
  }

  /**
   * The superadmin in the database wins (it keeps its id and any later password change), except
   * that SUPERADMIN_PASSWORD, when set, still resets the password on restart — as it always has.
   */
  private async reconcileSuperAdmins(
    fromDatabase: StorageState['superAdmins'],
    fromEnv: StorageState['superAdmins'],
  ): Promise<StorageState['superAdmins']> {
    const admins = fromDatabase.map((admin) => ({ ...admin }));
    if (admins.length === 0) return fromEnv;

    const envPassword = process.env.SUPERADMIN_PASSWORD;
    for (const envAdmin of fromEnv) {
      const match = admins.find((admin) => admin.email === envAdmin.email);
      if (!match) {
        admins.push({ ...envAdmin, id: Math.max(...admins.map((admin) => admin.id)) + 1 });
      } else if (envPassword && !(await bcrypt.compare(envPassword, match.passwordHash))) {
        match.passwordHash = envAdmin.passwordHash;
      }
    }
    return admins;
  }
}
