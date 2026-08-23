import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { Invoice } from './entities/invoice.entity';
import { PaymentJobReceipt } from './entities/payment-job-receipt.entity';
import {
  PermanentPaymentCommandError,
  RabbitMqService,
} from '../../messaging/rabbitmq.service';
import { PaymentCommandMessage } from '../../messaging/payment-messages';

@Injectable()
export class InvoiceService {
  constructor(
    @InjectRepository(Invoice, 'payments')
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(PaymentJobReceipt, 'payments')
    private readonly receiptRepository: Repository<PaymentJobReceipt>,
    private readonly rabbitMq: RabbitMqService,
  ) {}

  create(_createInvoiceDto: CreateInvoiceDto) {
    void _createInvoiceDto;
    return 'This action adds a new invoice';
  }

  findAll() {
    return `This action returns all invoice`;
  }

  findOne(id: number) {
    return `This action returns a #${id} invoice`;
  }

  update(id: number, _updateInvoiceDto: UpdateInvoiceDto) {
    void _updateInvoiceDto;
    return `This action updates a #${id} invoice`;
  }

  remove(id: number) {
    return `This action removes a #${id} invoice`;
  }

  async handleCommand(message: PaymentCommandMessage): Promise<void> {
    if (message.type !== 'invoice.generate' || message.version !== 1) {
      throw new PermanentPaymentCommandError(
        `Unsupported payment command: ${message.type}@${message.version}`,
      );
    }

    console.log('consuming invoice', message);

    const existingReceipt = await this.receiptRepository.findOneBy({
      messageId: message.message_id,
    });
    if (existingReceipt) {
      await this.publishResult(message, existingReceipt);
      return;
    }

    try {
      this.validatePayload(message);
    } catch (error) {
      const receipt = await this.receiptRepository.save(
        this.receiptRepository.create({
          messageId: message.message_id,
          correlationId: message.correlation_id,
          commandType: message.type,
          status: 'failed',
          payload: message.payload,
          result: null,
          failureCode: 'invalid_payload',
          failureMessage:
            error instanceof Error ? error.message : String(error),
        }),
      );
      await this.publishResult(message, receipt);
      return;
    }
    let invoice = await this.invoiceRepository.findOneBy({
      invoicableType: message.payload.invoicable_type,
      invoicableId: message.payload.invoicable_id,
      type: message.payload.type,
    });
    if (!invoice) {
      try {
        invoice = await this.invoiceRepository.save(
          this.invoiceRepository.create({
            invoicableType: message.payload.invoicable_type,
            invoicableId: message.payload.invoicable_id,
            type: message.payload.type,
            value: message.payload.value,
            status: 'completed',
          }),
        );
      } catch (error) {
        if (!(error instanceof QueryFailedError)) {
          throw error;
        }
        invoice = await this.invoiceRepository.findOneBy({
          invoicableType: message.payload.invoicable_type,
          invoicableId: message.payload.invoicable_id,
          type: message.payload.type,
        });
        if (!invoice) {
          throw error;
        }
      }
    }

    let receipt: PaymentJobReceipt;
    try {
      receipt = await this.receiptRepository.save(
        this.receiptRepository.create({
          messageId: message.message_id,
          correlationId: message.correlation_id,
          commandType: message.type,
          status: 'completed',
          payload: message.payload,
          result: { invoice_id: invoice.id, status: invoice.status },
          failureCode: null,
          failureMessage: null,
        }),
      );
    } catch (error) {
      if (!(error instanceof QueryFailedError)) {
        throw error;
      }
      receipt = await this.receiptRepository.findOneByOrFail({
        messageId: message.message_id,
      });
    }

    await this.publishResult(message, receipt);
  }

  private async publishResult(
    message: PaymentCommandMessage,
    receipt: PaymentJobReceipt,
  ): Promise<void> {
    if (receipt.status === 'failed') {
      await this.rabbitMq.publishEvent(
        'invoice.failed',
        message.correlation_id,
        {
          failure_code: receipt.failureCode,
          failure_message: receipt.failureMessage,
        },
      );
      return;
    }

    await this.rabbitMq.publishEvent(
      'invoice.completed',
      message.correlation_id,
      {
        ...(receipt.result ?? {}),
        message_id: message.message_id,
      },
    );
  }

  private validatePayload(message: PaymentCommandMessage): void {
    const payload = message.payload;
    if (
      typeof payload.invoicable_type !== 'string' ||
      !Number.isInteger(payload.invoicable_id) ||
      typeof payload.type !== 'string' ||
      !/^\d+(\.\d{1,2})?$/.test(payload.value)
    ) {
      throw new Error('Invalid invoice.generate payload');
    }
  }
}
