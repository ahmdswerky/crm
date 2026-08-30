import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { PaymentEventOutbox } from '../../messaging/entities/payment-event-outbox.entity';
import {
  PaymentCommandMessage,
  PaymentEventType,
} from '../../messaging/payment-messages';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { Invoice } from './entities/invoice.entity';
import { PaymentJobReceipt } from './entities/payment-job-receipt.entity';

@Injectable()
export class InvoiceService {
  constructor(
    @InjectDataSource('payments')
    private readonly paymentsDataSource: DataSource,
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
    await this.paymentsDataSource.transaction(async (manager) => {
      const invoiceRepository = manager.getRepository(Invoice);
      const receiptRepository = manager.getRepository(PaymentJobReceipt);
      const outboxRepository = manager.getRepository(PaymentEventOutbox);
      const existingReceipt = await receiptRepository.findOneBy({
        messageId: message.message_id,
      });

      if (existingReceipt) {
        await this.ensureOutbox(message, existingReceipt, outboxRepository);
        return;
      }

      try {
        this.validatePayload(message);
      } catch (error) {
        const receipt = await receiptRepository.save(
          receiptRepository.create({
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
        await this.ensureOutbox(message, receipt, outboxRepository);
        return;
      }

      let invoice = await invoiceRepository.findOneBy({
        invoicableType: message.payload.invoicable_type,
        invoicableId: message.payload.invoicable_id,
        type: message.payload.type,
      });
      if (!invoice) {
        try {
          invoice = await invoiceRepository.save(
            invoiceRepository.create({
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
          invoice = await invoiceRepository.findOneBy({
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
        receipt = await receiptRepository.save(
          receiptRepository.create({
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
        receipt = await receiptRepository.findOneByOrFail({
          messageId: message.message_id,
        });
      }

      await this.ensureOutbox(message, receipt, outboxRepository);
    });
  }

  private async ensureOutbox(
    message: PaymentCommandMessage,
    receipt: PaymentJobReceipt,
    outboxRepository: Repository<PaymentEventOutbox>,
  ): Promise<void> {
    const existingEvent = await outboxRepository.findOneBy({
      commandMessageId: message.message_id,
    });
    if (existingEvent) {
      return;
    }

    const type: PaymentEventType =
      receipt.status === 'failed' ? 'invoice.failed' : 'invoice.completed';
    const payload =
      type === 'invoice.failed'
        ? {
            failure_code: receipt.failureCode,
            failure_message: receipt.failureMessage,
          }
        : {
            ...(receipt.result ?? {}),
            message_id: message.message_id,
          };

    try {
      await outboxRepository.save(
        outboxRepository.create({
          eventId: randomUUID(),
          commandMessageId: message.message_id,
          correlationId: message.correlation_id,
          type,
          version: 1,
          source: 'payments',
          occurredAt: new Date(),
          payload,
          publishedAt: null,
          attempts: 0,
          lastError: null,
          claimedAt: null,
          claimToken: null,
        }),
      );
    } catch (error) {
      if (!(error instanceof QueryFailedError)) {
        throw error;
      }

      const concurrentEvent = await outboxRepository.findOneBy({
        commandMessageId: message.message_id,
      });
      if (!concurrentEvent) {
        throw error;
      }
    }
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
