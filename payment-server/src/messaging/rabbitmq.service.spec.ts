import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import type { ConfirmChannel } from 'amqplib';
import { Logger } from '@nestjs/common';
import { RabbitMqService } from './rabbitmq.service';

const contract = (name: string): Record<string, unknown> =>
  JSON.parse(
    readFileSync(
      join(
        process.env.PAYMENT_CONTRACTS_PATH ??
          join(__dirname, '../../../docs/contracts/payments'),
        `${name}.v1.json`,
      ),
      'utf8',
    ),
  ) as Record<string, unknown>;

describe('RabbitMqService event contracts', () => {
  const loggerError = jest
    .spyOn(Logger.prototype, 'error')
    .mockImplementation(() => undefined);
  const publish = jest.fn<boolean, Parameters<ConfirmChannel['publish']>>();
  const waitForConfirms = jest.fn<Promise<void>, []>();
  const channel = {
    publish,
    waitForConfirms,
  } as unknown as ConfirmChannel;

  beforeEach(() => {
    jest.clearAllMocks();
    publish.mockReturnValue(true);
    waitForConfirms.mockResolvedValue();
  });

  afterAll(() => loggerError.mockRestore());

  it.each([
    ['invoice.completed', contract('invoice.completed')],
    ['invoice.failed', contract('invoice.failed')],
  ] as const)(
    'serializes the %s version one contract fixture',
    async (type, rawFixture) => {
      const fixture = rawFixture as {
        correlation_id: string;
        event_id: string;
      };
      const rabbitMq = new RabbitMqService();
      (rabbitMq as unknown as { channel: ConfirmChannel }).channel = channel;

      await rabbitMq.publishEvent(fixture as never);

      expect(JSON.parse(publish.mock.calls[0][2].toString())).toEqual(fixture);
      expect(publish).toHaveBeenCalledWith(
        'payments.events',
        type,
        expect.any(Buffer),
        expect.objectContaining({
          correlationId: fixture.correlation_id,
          messageId: fixture.event_id,
          contentType: 'application/json',
          deliveryMode: 2,
        }),
      );
      expect(waitForConfirms).toHaveBeenCalledTimes(1);
    },
  );

  it('dead-letters a malformed command before calling the invoice handler', async () => {
    const ack = jest.fn();
    const commandPublish = jest.fn().mockReturnValue(true);
    const commandChannel = {
      ack,
      publish: commandPublish,
      waitForConfirms: jest.fn().mockResolvedValue(undefined),
    } as unknown as ConfirmChannel;
    const handler = jest.fn<Promise<void>, [unknown]>();
    const rabbitMq = new RabbitMqService();

    await (
      rabbitMq as unknown as {
        handleCommand: (
          channel: ConfirmChannel,
          message: unknown,
          callback: (message: never) => Promise<void>,
        ) => Promise<void>;
      }
    ).handleCommand(
      commandChannel,
      {
        content: Buffer.from('{'),
        fields: { routingKey: 'invoice.generate' },
        properties: { headers: {} },
      },
      handler as never,
    );

    expect(handler).not.toHaveBeenCalled();
    const publishCall = commandPublish.mock.calls[0] as unknown as [
      string,
      string,
      Buffer,
      { headers: Record<string, unknown> },
    ];
    expect(publishCall[0]).toBe('payments.commands.dead');
    expect(publishCall[1]).toBe('invoice.generate');
    expect(publishCall[2].toString()).toBe('{');
    expect(publishCall[3].headers['x-retry-count']).toBe(1);
    expect(ack).toHaveBeenCalledTimes(1);
  });
});
