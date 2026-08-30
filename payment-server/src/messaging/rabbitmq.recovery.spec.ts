import { EventEmitter } from 'node:events';
import type { ChannelModel, ConfirmChannel } from 'amqplib';
import { Logger } from '@nestjs/common';
import { connect } from 'amqplib';
import { RabbitMqService } from './rabbitmq.service';

jest.mock('amqplib', () => ({ connect: jest.fn() }));

const createChannel = () => {
  const consume = jest.fn().mockResolvedValue({ consumerTag: 'consumer-tag' });

  return {
    channel: Object.assign(new EventEmitter(), {
      close: jest.fn().mockResolvedValue(undefined),
      consume,
      prefetch: jest.fn().mockResolvedValue(undefined),
    }) as unknown as ConfirmChannel,
    consume,
  };
};

const createConnection = (channel: ConfirmChannel): ChannelModel =>
  Object.assign(new EventEmitter(), {
    close: jest.fn().mockResolvedValue(undefined),
    createConfirmChannel: jest.fn().mockResolvedValue(channel),
  }) as unknown as ChannelModel;

describe('RabbitMqService recovery', () => {
  const loggerWarn = jest
    .spyOn(Logger.prototype, 'warn')
    .mockImplementation(() => undefined);
  const connectMock = connect as jest.MockedFunction<typeof connect>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => loggerWarn.mockRestore());

  it('reconnects and registers stored command consumers after a channel closes', async () => {
    const initial = createChannel();
    const recovered = createChannel();
    const initialConnection = createConnection(initial.channel);
    const recoveredConnection = createConnection(recovered.channel);
    connectMock
      .mockResolvedValueOnce(initialConnection)
      .mockResolvedValueOnce(recoveredConnection);
    const service = new RabbitMqService();
    const handler = jest.fn<Promise<void>, [never]>().mockResolvedValue();

    await service.onModuleInit();
    await service.consumeCommands(handler);
    (initial.channel as unknown as EventEmitter).emit('close');

    await (service as unknown as { recoveryPromise: Promise<void> })
      .recoveryPromise;

    expect(connectMock).toHaveBeenCalledTimes(2);
    expect(initial.consume).toHaveBeenCalledTimes(1);
    expect(recovered.consume).toHaveBeenCalledTimes(1);
  });
});
