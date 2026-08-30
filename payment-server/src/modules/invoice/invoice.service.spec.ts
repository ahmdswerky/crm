import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { InvoiceService } from './invoice.service';
import { Invoice } from './entities/invoice.entity';
import { PaymentJobReceipt } from './entities/payment-job-receipt.entity';

jest.mock('node:crypto', () => ({ randomUUID: jest.fn() }));

describe('InvoiceService', () => {
  let service: InvoiceService;
  const invoiceRepository = {
    create: jest.fn((value: unknown) => value),
    findOneBy: jest.fn(),
    save: jest.fn(),
  };
  const receiptRepository = {
    create: jest.fn((value: unknown) => value),
    findOneBy: jest.fn(),
    findOneByOrFail: jest.fn(),
    save: jest.fn(),
  };
  const outboxRepository = {
    create: jest.fn((value: unknown) => value),
    findOneBy: jest.fn(),
    save: jest.fn(),
  };
  const manager = {
    getRepository: jest.fn((entity: unknown) => {
      if (entity === Invoice) return invoiceRepository;
      if (entity === PaymentJobReceipt) return receiptRepository;
      return outboxRepository;
    }),
  };
  const paymentsDataSource = {
    transaction: jest.fn(
      (callback: (transactionManager: typeof manager) => Promise<unknown>) =>
        callback(manager),
    ),
  };
  const command = {
    message_id: '11111111-1111-4111-8111-111111111111',
    correlation_id: '22222222-2222-4222-8222-222222222222',
    type: 'invoice.generate' as const,
    version: 1,
    source: 'crm' as const,
    occurred_at: '2026-08-25T00:00:00.000Z',
    payload: {
      invoicable_type: 'deal',
      invoicable_id: 12,
      type: 'deposit',
      value: '1000.00',
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-08-25T00:00:00.000Z'));
    (randomUUID as jest.Mock).mockReturnValue(
      '33333333-3333-4333-8333-333333333333',
    );
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceService,
        {
          provide: getDataSourceToken('payments'),
          useValue: paymentsDataSource,
        },
      ],
    }).compile();
    service = module.get<InvoiceService>(InvoiceService);
  });

  afterEach(() => jest.useRealTimers());

  it('creates an invoice, receipt, and stable event in one transaction', async () => {
    receiptRepository.findOneBy.mockResolvedValueOnce(null);
    invoiceRepository.findOneBy.mockResolvedValueOnce(null);
    invoiceRepository.save.mockResolvedValueOnce({
      id: 7,
      status: 'completed',
    });
    receiptRepository.save.mockResolvedValueOnce({
      messageId: command.message_id,
      status: 'completed',
      result: { invoice_id: 7, status: 'completed' },
    });
    outboxRepository.findOneBy.mockResolvedValueOnce(null);
    outboxRepository.save.mockImplementationOnce((event: unknown) =>
      Promise.resolve(event),
    );

    await service.handleCommand(command);

    expect(paymentsDataSource.transaction).toHaveBeenCalledTimes(1);
    expect(outboxRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: '33333333-3333-4333-8333-333333333333',
        commandMessageId: command.message_id,
        correlationId: command.correlation_id,
        type: 'invoice.completed',
        occurredAt: new Date('2026-08-25T00:00:00.000Z'),
        payload: {
          invoice_id: 7,
          status: 'completed',
          message_id: command.message_id,
        },
        publishedAt: null,
      }),
    );
  });

  it('reuses the existing receipt and event for a duplicate command', async () => {
    receiptRepository.findOneBy.mockResolvedValueOnce({
      messageId: command.message_id,
      status: 'completed',
      result: { invoice_id: 7, status: 'completed' },
      failureCode: null,
      failureMessage: null,
    });
    outboxRepository.findOneBy.mockResolvedValueOnce({
      eventId: '33333333-3333-4333-8333-333333333333',
    });

    await service.handleCommand(command);

    expect(invoiceRepository.save).not.toHaveBeenCalled();
    expect(receiptRepository.save).not.toHaveBeenCalled();
    expect(outboxRepository.save).not.toHaveBeenCalled();
  });
});
