import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoiceController } from './invoice.controller';
import { InvoiceService } from './invoice.service';
import { Invoice } from './entities/invoice.entity';
import { PaymentJobReceipt } from './entities/payment-job-receipt.entity';
import { InvoiceCommandConsumer } from './invoice-command.consumer';
import { RabbitMqService } from '../../messaging/rabbitmq.service';
import { PaymentEventOutbox } from '../../messaging/entities/payment-event-outbox.entity';
import { PaymentEventOutboxPublisher } from '../../messaging/payment-event-outbox.publisher';

@Module({
  imports: [
    TypeOrmModule.forFeature(
      [Invoice, PaymentJobReceipt, PaymentEventOutbox],
      'payments',
    ),
  ],
  controllers: [InvoiceController],
  providers: [
    InvoiceService,
    InvoiceCommandConsumer,
    PaymentEventOutboxPublisher,
    RabbitMqService,
  ],
})
export class InvoiceModule {}
