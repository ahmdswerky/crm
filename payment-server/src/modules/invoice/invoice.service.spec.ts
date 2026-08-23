import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InvoiceService } from './invoice.service';
import { Invoice } from './entities/invoice.entity';
import { PaymentJobReceipt } from './entities/payment-job-receipt.entity';
import { RabbitMqService } from '../../messaging/rabbitmq.service';

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
  const rabbitMq = { publishEvent: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceService,
        {
          provide: getRepositoryToken(Invoice, 'payments'),
          useValue: invoiceRepository,
        },
        {
          provide: getRepositoryToken(PaymentJobReceipt, 'payments'),
          useValue: receiptRepository,
        },
        { provide: RabbitMqService, useValue: rabbitMq },
      ],
    }).compile();

    service = module.get<InvoiceService>(InvoiceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('creates an invoice once and emits a completion event', async () => {
    invoiceRepository.findOneBy.mockResolvedValueOnce(null);
    invoiceRepository.save.mockResolvedValueOnce({
      id: 7,
      status: 'completed',
    });
    receiptRepository.findOneBy.mockResolvedValueOnce(null);
    receiptRepository.save.mockResolvedValueOnce({
      status: 'completed',
      result: { invoice_id: 7, status: 'completed' },
    });

    await service.handleCommand({
      message_id: '11111111-1111-4111-8111-111111111111',
      correlation_id: '22222222-2222-4222-8222-222222222222',
      type: 'invoice.generate',
      version: 1,
      source: 'crm',
      occurred_at: new Date().toISOString(),
      payload: {
        invoicable_type: 'deal',
        invoicable_id: 12,
        type: 'deposit',
        value: '1000.00',
      },
    });

    expect(rabbitMq.publishEvent).toHaveBeenCalledWith(
      'invoice.completed',
      '22222222-2222-4222-8222-222222222222',
      expect.objectContaining({ invoice_id: 7 }),
    );
  });

  it('replays the stored result without creating a second invoice', async () => {
    receiptRepository.findOneBy.mockResolvedValueOnce({
      messageId: '11111111-1111-4111-8111-111111111111',
      status: 'completed',
      result: { invoice_id: 7, status: 'completed' },
      failureCode: null,
      failureMessage: null,
    });

    await service.handleCommand({
      message_id: '11111111-1111-4111-8111-111111111111',
      correlation_id: '22222222-2222-4222-8222-222222222222',
      type: 'invoice.generate',
      version: 1,
      source: 'crm',
      occurred_at: new Date().toISOString(),
      payload: {
        invoicable_type: 'deal',
        invoicable_id: 12,
        type: 'deposit',
        value: '1000.00',
      },
    });

    expect(invoiceRepository.save).not.toHaveBeenCalled();
    expect(rabbitMq.publishEvent).toHaveBeenCalledWith(
      'invoice.completed',
      '22222222-2222-4222-8222-222222222222',
      expect.objectContaining({ invoice_id: 7 }),
    );
  });
});
