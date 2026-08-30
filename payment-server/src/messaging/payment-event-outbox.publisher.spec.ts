import { Logger } from '@nestjs/common';
import { PaymentEventOutbox } from './entities/payment-event-outbox.entity';
import { PaymentEventOutboxPublisher } from './payment-event-outbox.publisher';

describe('PaymentEventOutboxPublisher', () => {
  const loggerError = jest
    .spyOn(Logger.prototype, 'error')
    .mockImplementation(() => undefined);
  const event: PaymentEventOutbox = {
    eventId: '33333333-3333-4333-8333-333333333333',
    commandMessageId: '11111111-1111-4111-8111-111111111111',
    correlationId: '22222222-2222-4222-8222-222222222222',
    type: 'invoice.completed',
    version: 1,
    source: 'payments',
    occurredAt: new Date('2026-08-25T00:00:00.000Z'),
    payload: {
      invoice_id: 7,
      status: 'completed',
      message_id: '11111111-1111-4111-8111-111111111111',
    },
    publishedAt: null,
    attempts: 0,
    lastError: null,
    claimedAt: null,
    claimToken: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const queryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    setLock: jest.fn().mockReturnThis(),
    setOnLocked: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  };
  const transactionRepository = {
    createQueryBuilder: jest.fn(() => queryBuilder),
    save: jest.fn(),
  };
  const dataSource = {
    transaction: jest.fn(
      (callback: (manager: { getRepository: jest.Mock }) => Promise<unknown>) =>
        callback({ getRepository: jest.fn(() => transactionRepository) }),
    ),
  };
  const outboxRepository = { update: jest.fn() };
  const rabbitMq = { publishEvent: jest.fn() };
  const publisher = new PaymentEventOutboxPublisher(
    dataSource as never,
    outboxRepository as never,
    rabbitMq as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    queryBuilder.getMany.mockResolvedValue([{ ...event }]);
    transactionRepository.save.mockImplementation((events: unknown) =>
      Promise.resolve(events),
    );
    outboxRepository.update.mockResolvedValue({ affected: 1 });
  });

  afterAll(() => loggerError.mockRestore());

  it('publishes the stored envelope then marks it published after confirmation', async () => {
    rabbitMq.publishEvent.mockResolvedValue();

    await publisher.publishPending();

    expect(rabbitMq.publishEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_id: event.eventId,
        correlation_id: event.correlationId,
        occurred_at: event.occurredAt.toISOString(),
      }),
    );
    const updates = outboxRepository.update.mock.calls as unknown as Array<
      [
        { eventId: string },
        { publishedAt: Date | null; lastError: string | null },
      ]
    >;
    expect(updates[0][0].eventId).toBe(event.eventId);
    expect(updates[0][1].publishedAt).toBeInstanceOf(Date);
    expect(updates[0][1].lastError).toBeNull();
  });

  it('keeps the stored event unpublished when broker confirmation fails', async () => {
    rabbitMq.publishEvent.mockRejectedValue(new Error('broker unavailable'));

    await publisher.publishPending();

    expect(outboxRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: event.eventId }),
      expect.objectContaining({
        claimedAt: null,
        lastError: 'broker unavailable',
      }),
    );
    const updates = outboxRepository.update.mock.calls as unknown as Array<
      [unknown, Record<string, unknown>]
    >;
    expect(updates[0][1]).not.toHaveProperty('publishedAt');
  });
});
