import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityNotFoundError, Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { PaymentEventOutbox } from '../../messaging/entities/payment-event-outbox.entity';
import {
  PaymentCommandMessage,
  PaymentEventType,
} from '../../messaging/payment-messages';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { Invoice } from './entities/invoice.entity';
import { PaymentJobReceipt } from './entities/payment-job-receipt.entity';
import { ListInvoiceDto } from './dto/list-invoice.dto';
import { type Paginated } from '../../common/types/response';
import { InvoiceStatus } from './enums/invoice-status.enum';

@Injectable()
export class InvoiceService {
  constructor(
    @InjectDataSource('payments')
    private readonly paymentsDataSource: DataSource,
    @InjectRepository(Invoice, 'payments')
    private invoiceRepository: Repository<Invoice>,
  ) {}

  create(_createInvoiceDto: CreateInvoiceDto) {
    void _createInvoiceDto;
    return 'This action adds a new invoice';
  }

  async paginate(_listInvoiceDto: ListInvoiceDto): Paginated<Invoice> {
    const { page, per_page } = _listInvoiceDto;
    const [data, count] = await this.invoiceRepository.findAndCount({
      skip: (page - 1) * per_page,
      take: per_page,
    });

    return {
      data,
      count,
      page,
      per_page,
    };
  }

  async findOne(id: number): Promise<Invoice> {
    return this.invoiceRepository.findOneByOrFail({ id });
  }

  async update(
    id: number,
    _updateInvoiceDto: UpdateInvoiceDto,
  ): Promise<Invoice> {
    const data = await this.invoiceRepository.preload({
      id,
      ..._updateInvoiceDto,
    });

    if (!data) {
      throw EntityNotFoundError;
    }

    return this.invoiceRepository.save(data);
  }

  async remove(id: number): Promise<boolean> {
    const { affected } = await this.invoiceRepository.delete(id);

    return !!affected;
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
        const receipt = await this.claimReceipt(receiptRepository, {
          messageId: message.message_id,
          correlationId: message.correlation_id,
          commandType: message.type,
          status: InvoiceStatus.Failed,
          payload: message.payload,
          result: null,
          failureCode: 'invalid_payload',
          failureMessage:
            error instanceof Error ? error.message : String(error),
        });
        await this.ensureOutbox(message, receipt, outboxRepository);
        return;
      }

      let invoice = await invoiceRepository.findOneBy({
        invoicableType: message.payload.invoicable_type,
        invoicableId: message.payload.invoicable_id,
        type: message.payload.type,
      });
      if (!invoice) {
        // ponytail: ON CONFLICT DO NOTHING. Catching the unique violation
        // instead aborts the surrounding Postgres transaction, so every later
        // statement fails with "current transaction is aborted".
        await invoiceRepository
          .createQueryBuilder()
          .insert()
          .values({
            invoicableType: message.payload.invoicable_type,
            invoicableId: message.payload.invoicable_id,
            type: message.payload.type,
            value: message.payload.value,
            status: InvoiceStatus.Generated,
          })
          .orIgnore()
          .execute();
        invoice = await invoiceRepository.findOneByOrFail({
          invoicableType: message.payload.invoicable_type,
          invoicableId: message.payload.invoicable_id,
          type: message.payload.type,
        });
      }

      const receipt = await this.claimReceipt(receiptRepository, {
        messageId: message.message_id,
        correlationId: message.correlation_id,
        commandType: message.type,
        status: 'completed',
        payload: message.payload,
        result: { invoice_id: invoice.id, status: invoice.status },
        failureCode: null,
        failureMessage: null,
      });

      await this.ensureOutbox(message, receipt, outboxRepository);
    });
  }

  private async claimReceipt(
    receiptRepository: Repository<PaymentJobReceipt>,
    values: Omit<PaymentJobReceipt, 'createdAt' | 'updatedAt'>,
  ): Promise<PaymentJobReceipt> {
    await receiptRepository
      .createQueryBuilder()
      .insert()
      .values(values as QueryDeepPartialEntity<PaymentJobReceipt>)
      .orIgnore()
      .execute();

    return receiptRepository.findOneByOrFail({
      messageId: values.messageId,
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

    await outboxRepository
      .createQueryBuilder()
      .insert()
      .values({
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
      } as QueryDeepPartialEntity<PaymentEventOutbox>)
      .orIgnore()
      .execute();
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
