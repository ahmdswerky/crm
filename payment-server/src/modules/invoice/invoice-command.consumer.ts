import { Injectable, OnModuleInit } from '@nestjs/common';
import { InvoiceService } from './invoice.service';
import { RabbitMqService } from '../../messaging/rabbitmq.service';
import { PaymentCommandMessage } from '../../messaging/payment-messages';

@Injectable()
export class InvoiceCommandConsumer implements OnModuleInit {
  constructor(
    private readonly rabbitMq: RabbitMqService,
    private readonly invoices: InvoiceService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.rabbitMq.consumeCommands((message: PaymentCommandMessage) =>
      this.invoices.handleCommand(message),
    );
  }
}
