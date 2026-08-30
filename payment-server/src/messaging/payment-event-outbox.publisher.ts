import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, Repository } from 'typeorm';
import { PaymentEventOutbox } from './entities/payment-event-outbox.entity';
import { PaymentEventMessage } from './payment-messages';
import { RabbitMqService } from './rabbitmq.service';

const BATCH_SIZE = Number(process.env.PAYMENT_EVENT_OUTBOX_BATCH_SIZE ?? 50);
const POLL_INTERVAL_MS = Number(
  process.env.PAYMENT_EVENT_OUTBOX_POLL_INTERVAL_MS ?? 1000,
);
const CLAIM_LEASE_MS = Number(
  process.env.PAYMENT_EVENT_OUTBOX_CLAIM_LEASE_MS ?? 30000,
);

@Injectable()
export class PaymentEventOutboxPublisher
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PaymentEventOutboxPublisher.name);
  private timer?: NodeJS.Timeout;
  private publishing = false;

  constructor(
    @InjectDataSource('payments') private readonly dataSource: DataSource,
    @InjectRepository(PaymentEventOutbox, 'payments')
    private readonly outboxRepository: Repository<PaymentEventOutbox>,
    private readonly rabbitMq: RabbitMqService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.publishPending();
    this.timer = setInterval(() => {
      void this.publishPending();
    }, POLL_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async publishPending(): Promise<number> {
    if (this.publishing) {
      return 0;
    }

    this.publishing = true;
    try {
      const events = await this.claimPending(BATCH_SIZE);
      for (const event of events) {
        try {
          await this.rabbitMq.publishEvent(this.toMessage(event));
          await this.outboxRepository.update(
            { eventId: event.eventId, claimToken: event.claimToken },
            {
              publishedAt: new Date(),
              claimedAt: null,
              claimToken: null,
              lastError: null,
            },
          );
        } catch (error) {
          await this.outboxRepository.update(
            { eventId: event.eventId, claimToken: event.claimToken },
            {
              claimedAt: null,
              claimToken: null,
              lastError: error instanceof Error ? error.message : String(error),
            },
          );
          this.logger.error(
            `Unable to publish payment event ${event.eventId}`,
            error instanceof Error ? error.stack : String(error),
          );
        }
      }

      return events.length;
    } finally {
      this.publishing = false;
    }
  }

  private async claimPending(limit: number): Promise<PaymentEventOutbox[]> {
    const claimedAt = new Date();
    const staleBefore = new Date(claimedAt.getTime() - CLAIM_LEASE_MS);
    const claimToken = randomUUID();

    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(PaymentEventOutbox);
      const events = await repository
        .createQueryBuilder('event')
        .where('event.publishedAt IS NULL')
        .andWhere(
          '(event.claimedAt IS NULL OR event.claimedAt < :staleBefore)',
          {
            staleBefore,
          },
        )
        .orderBy('event.occurredAt', 'ASC')
        .take(limit)
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .getMany();

      for (const event of events) {
        event.claimedAt = claimedAt;
        event.claimToken = claimToken;
        event.attempts += 1;
      }

      return repository.save(events);
    });
  }

  private toMessage(event: PaymentEventOutbox): PaymentEventMessage {
    return {
      event_id: event.eventId,
      correlation_id: event.correlationId,
      type: event.type as PaymentEventMessage['type'],
      version: event.version,
      source: 'payments',
      occurred_at: event.occurredAt.toISOString(),
      payload: event.payload,
    };
  }
}
