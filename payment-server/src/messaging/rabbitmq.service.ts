import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  ConfirmChannel,
  ChannelModel,
  ConsumeMessage,
  Message,
  connect,
} from 'amqplib';
import { PaymentCommandMessage, PaymentEventMessage } from './payment-messages';
import { PaymentCommandCodec } from './payment-command-codec';
import { PaymentEventCodec } from './payment-event-codec';
import { PermanentPaymentCommandError } from './payment-message-validation.error';

const COMMANDS_EXCHANGE =
  process.env.RABBITMQ_COMMANDS_EXCHANGE ?? 'payments.commands';
const COMMANDS_QUEUE = process.env.RABBITMQ_COMMANDS_QUEUE ?? 'payments';
const EVENTS_EXCHANGE =
  process.env.RABBITMQ_EVENTS_EXCHANGE ?? 'payments.events';
const RETRY_LIMIT = 3;
const RECONNECT_INITIAL_DELAY_MS = Number(
  process.env.RABBITMQ_RECONNECT_INITIAL_DELAY_MS ?? 250,
);
const RECONNECT_MAX_DELAY_MS = Number(
  process.env.RABBITMQ_RECONNECT_MAX_DELAY_MS ?? 10000,
);

type MessageHandler = (message: PaymentCommandMessage) => Promise<void>;

export { PermanentPaymentCommandError } from './payment-message-validation.error';

@Injectable()
export class RabbitMqService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqService.name);
  private connection?: ChannelModel;
  private channel?: ConfirmChannel;
  private connectionPromise?: Promise<ConfirmChannel>;
  private recoveryPromise?: Promise<void>;
  private stopping = false;
  private readonly commandHandlers = new Set<MessageHandler>();
  private readonly commandCodec = new PaymentCommandCodec();
  private readonly eventCodec = new PaymentEventCodec();

  async onModuleInit(): Promise<void> {
    try {
      await this.connect();
    } catch (error) {
      this.logger.warn(
        `RabbitMQ is unavailable at startup; recovery will retry: ${this.errorMessage(error)}`,
      );
      void this.recoverConsumers();
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.stopping = true;
    try {
      await this.channel?.close();
      await this.connection?.close();
    } catch {
      // The broker may already have closed the connection during shutdown.
    }
  }

  async publishEvent(event: PaymentEventMessage): Promise<void> {
    const channel = await this.getChannel();
    const body = this.eventCodec.serialize(event);
    const published = channel.publish(EVENTS_EXCHANGE, event.type, body, {
      contentType: 'application/json',
      deliveryMode: 2,
      type: event.type,
      correlationId: event.correlation_id,
      messageId: event.event_id,
      appId: 'payments',
    });

    if (!published) {
      throw new Error('RabbitMQ event publish buffer is full');
    }
    await channel.waitForConfirms();
  }

  async consumeCommands(handler: MessageHandler): Promise<void> {
    this.commandHandlers.add(handler);

    try {
      const channel = await this.getChannel();
      await this.registerCommandConsumer(channel, handler);
    } catch (error) {
      this.logger.warn(
        `RabbitMQ command consumer is unavailable; recovery will retry: ${this.errorMessage(error)}`,
      );
      void this.recoverConsumers();
    }
  }

  private async registerCommandConsumer(
    channel: ConfirmChannel,
    handler: MessageHandler,
  ): Promise<void> {
    await channel.prefetch(10);
    await channel.consume(COMMANDS_QUEUE, (message) => {
      if (message) {
        void this.handleCommand(channel, message, handler).catch((error) => {
          this.logger.error(
            'Unable to settle payment command delivery after a broker interruption',
            this.errorMessage(error),
          );
        });
      }
    });
    this.logger.log(`Consuming RabbitMQ queue ${COMMANDS_QUEUE}`);
  }

  private async handleCommand(
    channel: ConfirmChannel,
    message: ConsumeMessage,
    handler: MessageHandler,
  ): Promise<void> {
    try {
      const parsed = this.commandCodec.decode(message.content);
      await handler(parsed);
      channel.ack(message);
    } catch (error) {
      const retryCount = this.retryCount(message.properties.headers);
      const retryable = !(error instanceof PermanentPaymentCommandError);
      const shouldRetry = retryable && retryCount < RETRY_LIMIT;
      const targetExchange = shouldRetry
        ? `${COMMANDS_EXCHANGE}.retry`
        : `${COMMANDS_EXCHANGE}.dead`;
      const headers = {
        ...message.properties.headers,
        'x-retry-count': retryCount + 1,
      };

      channel.publish(
        targetExchange,
        message.fields.routingKey,
        message.content,
        {
          ...message.properties,
          headers,
          deliveryMode: 2,
        },
      );
      await channel.waitForConfirms();
      channel.ack(message);

      this.logger.error(
        `Payment command ${shouldRetry ? 'scheduled for retry' : 'sent to dead letter queue'}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private retryCount(
    headers: Message['properties']['headers'] | undefined,
  ): number {
    const value: unknown = headers?.['x-retry-count'];
    return typeof value === 'number' ? value : Number(value ?? 0);
  }

  private async connect(): Promise<ConfirmChannel> {
    if (this.channel) {
      return this.channel;
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = (async () => {
      this.connection = await connect({
        hostname: process.env.RABBITMQ_HOST ?? '127.0.0.1',
        port: Number(process.env.RABBITMQ_PORT ?? 5672),
        username: process.env.RABBITMQ_USER ?? 'crm',
        password: process.env.RABBITMQ_PASSWORD,
        vhost: process.env.RABBITMQ_VHOST ?? '/',
        heartbeat: Number(process.env.RABBITMQ_HEARTBEAT ?? 30),
        timeout: Number(process.env.RABBITMQ_CONNECTION_TIMEOUT ?? 3000),
      });
      this.channel = await this.connection.createConfirmChannel();
      this.observeLifecycle(this.connection, this.channel);

      return this.channel;
    })();

    try {
      return await this.connectionPromise;
    } catch (error) {
      this.connectionPromise = undefined;
      this.channel = undefined;
      await this.connection?.close().catch(() => undefined);
      this.connection = undefined;
      throw error;
    }
  }

  private async getChannel(): Promise<ConfirmChannel> {
    return this.channel ?? this.connect();
  }

  private observeLifecycle(
    connection: ChannelModel,
    channel: ConfirmChannel,
  ): void {
    const recover = (reason: string) => {
      this.handleDisconnect(connection, channel, reason);
    };

    connection.once('error', (error) => recover(this.errorMessage(error)));
    connection.once('close', () => recover('connection closed'));
    channel.once('error', (error) => recover(this.errorMessage(error)));
    channel.once('close', () => recover('channel closed'));
  }

  private handleDisconnect(
    connection: ChannelModel,
    channel: ConfirmChannel,
    reason: string,
  ): void {
    if (
      this.stopping ||
      (this.connection !== connection && this.channel !== channel)
    ) {
      return;
    }

    this.connection = undefined;
    this.channel = undefined;
    this.connectionPromise = undefined;
    this.logger.warn(`RabbitMQ disconnected: ${reason}`);
    void this.recoverConsumers();
  }

  private async recoverConsumers(): Promise<void> {
    if (this.recoveryPromise) {
      return this.recoveryPromise;
    }

    if (this.stopping) {
      return;
    }

    this.recoveryPromise = (async () => {
      let attempt = 0;

      while (!this.stopping) {
        try {
          const channel = await this.connect();
          await Promise.all(
            [...this.commandHandlers].map((handler) =>
              this.registerCommandConsumer(channel, handler),
            ),
          );
          this.logger.log(
            `RabbitMQ recovery succeeded after ${attempt + 1} attempt(s)`,
          );
          return;
        } catch (error) {
          const delay = this.reconnectDelay(attempt);
          attempt += 1;
          this.logger.warn(
            `RabbitMQ recovery attempt ${attempt} failed; retrying in ${delay}ms: ${this.errorMessage(error)}`,
          );
          await this.delay(delay);
        }
      }
    })().finally(() => {
      this.recoveryPromise = undefined;
    });

    return this.recoveryPromise;
  }

  private reconnectDelay(attempt: number): number {
    const exponential = Math.min(
      RECONNECT_MAX_DELAY_MS,
      RECONNECT_INITIAL_DELAY_MS * 2 ** Math.min(attempt, 16),
    );
    const jitter = Math.floor(exponential * Math.random() * 0.2);

    return exponential + jitter;
  }

  private async delay(milliseconds: number): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
