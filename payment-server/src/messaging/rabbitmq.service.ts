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
import { randomUUID } from 'node:crypto';
import { PaymentCommandMessage } from './payment-messages';

const COMMANDS_EXCHANGE =
  process.env.RABBITMQ_COMMANDS_EXCHANGE ?? 'payments.commands';
const COMMANDS_QUEUE = process.env.RABBITMQ_COMMANDS_QUEUE ?? 'payments';
const EVENTS_EXCHANGE =
  process.env.RABBITMQ_EVENTS_EXCHANGE ?? 'payments.events';
const EVENTS_QUEUE = process.env.RABBITMQ_EVENTS_QUEUE ?? 'crm.payment-events';
const RETRY_LIMIT = 3;

type MessageHandler = (message: PaymentCommandMessage) => Promise<void>;

export class PermanentPaymentCommandError extends Error {}

@Injectable()
export class RabbitMqService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqService.name);
  private connection?: ChannelModel;
  private channel?: ConfirmChannel;
  private connectionPromise?: Promise<ConfirmChannel>;

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.channel?.close();
      await this.connection?.close();
    } catch {
      // The broker may already have closed the connection during shutdown.
    }
  }

  async publishEvent(
    type: 'invoice.completed' | 'invoice.failed',
    correlationId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const channel = await this.getChannel();
    const body = Buffer.from(
      JSON.stringify({
        event_id: randomUUID(),
        correlation_id: correlationId,
        type,
        version: 1,
        source: 'payments',
        occurred_at: new Date().toISOString(),
        payload,
      }),
    );
    const published = channel.publish(EVENTS_EXCHANGE, type, body, {
      contentType: 'application/json',
      deliveryMode: 2,
      type,
      correlationId,
      messageId: randomUUID(),
      appId: 'payments',
    });

    if (!published) {
      throw new Error('RabbitMQ event publish buffer is full');
    }
    await channel.waitForConfirms();
  }

  async consumeCommands(handler: MessageHandler): Promise<void> {
    const channel = await this.getChannel();
    await channel.prefetch(10);
    await channel.consume(COMMANDS_QUEUE, (message) => {
      if (message) {
        void this.handleCommand(channel, message, handler);
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
      const parsed = JSON.parse(
        message.content.toString(),
      ) as PaymentCommandMessage;
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
      await this.declareTopology(this.channel);

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

  private async declareTopology(channel: ConfirmChannel): Promise<void> {
    const retryExchange = `${COMMANDS_EXCHANGE}.retry`;
    const deadExchange = `${COMMANDS_EXCHANGE}.dead`;
    const eventDeadExchange = `${EVENTS_EXCHANGE}.dead`;

    await channel.assertExchange(COMMANDS_EXCHANGE, 'topic', { durable: true });
    await channel.assertExchange(retryExchange, 'topic', { durable: true });
    await channel.assertExchange(deadExchange, 'topic', { durable: true });
    await channel.assertQueue(COMMANDS_QUEUE, {
      durable: true,
      arguments: { 'x-dead-letter-exchange': deadExchange },
    });
    await channel.bindQueue(COMMANDS_QUEUE, COMMANDS_EXCHANGE, '#');
    await channel.assertQueue(`${COMMANDS_QUEUE}.retry`, {
      durable: true,
      arguments: {
        'x-message-ttl': 10000,
        'x-dead-letter-exchange': COMMANDS_EXCHANGE,
      },
    });
    await channel.bindQueue(`${COMMANDS_QUEUE}.retry`, retryExchange, '#');
    await channel.assertQueue(`${COMMANDS_QUEUE}.dead`, { durable: true });
    await channel.bindQueue(`${COMMANDS_QUEUE}.dead`, deadExchange, '#');

    await channel.assertExchange(EVENTS_EXCHANGE, 'topic', { durable: true });
    await channel.assertExchange(eventDeadExchange, 'topic', { durable: true });
    await channel.assertQueue(EVENTS_QUEUE, {
      durable: true,
      arguments: { 'x-dead-letter-exchange': eventDeadExchange },
    });
    await channel.bindQueue(EVENTS_QUEUE, EVENTS_EXCHANGE, '#');
    await channel.assertQueue(`${EVENTS_QUEUE}.dead`, { durable: true });
    await channel.bindQueue(`${EVENTS_QUEUE}.dead`, eventDeadExchange, '#');
  }
}
