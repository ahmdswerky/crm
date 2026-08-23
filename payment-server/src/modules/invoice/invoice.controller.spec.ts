import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InvoiceController } from './invoice.controller';
import { InvoiceService } from './invoice.service';
import { Invoice } from './entities/invoice.entity';
import { PaymentJobReceipt } from './entities/payment-job-receipt.entity';
import { RabbitMqService } from '../../messaging/rabbitmq.service';

describe('InvoiceController', () => {
  let controller: InvoiceController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InvoiceController],
      providers: [
        InvoiceService,
        { provide: getRepositoryToken(Invoice, 'payments'), useValue: {} },
        {
          provide: getRepositoryToken(PaymentJobReceipt, 'payments'),
          useValue: {},
        },
        { provide: RabbitMqService, useValue: {} },
      ],
    }).compile();

    controller = module.get<InvoiceController>(InvoiceController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
