import { PaymentEventMessage } from './payment-messages';
import { PaymentMessageValidationError } from './payment-message-validation.error';

export class PaymentEventCodec {
  decode(body: Buffer): PaymentEventMessage {
    let value: unknown;
    try {
      value = JSON.parse(body.toString());
    } catch {
      throw new PaymentMessageValidationError('Malformed payment event.');
    }

    return this.validate(value);
  }

  serialize(value: unknown): Buffer {
    return Buffer.from(JSON.stringify(this.validate(value)));
  }

  private validate(value: unknown): PaymentEventMessage {
    if (!this.isRecord(value) || !this.isValidEvent(value)) {
      throw new PaymentMessageValidationError('Unsupported payment event.');
    }

    return value;
  }

  private isValidEvent(
    value: Record<string, unknown>,
  ): value is PaymentEventMessage {
    const payload = value.payload;
    if (
      !this.isUuid(value.event_id) ||
      !this.isUuid(value.correlation_id) ||
      (value.type !== 'invoice.completed' && value.type !== 'invoice.failed') ||
      value.version !== 1 ||
      value.source !== 'payments' ||
      !this.isTimestamp(value.occurred_at) ||
      !this.isRecord(payload)
    ) {
      return false;
    }

    return value.type === 'invoice.completed'
      ? Number.isInteger(payload.invoice_id) &&
          typeof payload.status === 'string' &&
          payload.status !== '' &&
          this.isUuid(payload.message_id)
      : typeof payload.failure_code === 'string' &&
          payload.failure_code !== '' &&
          typeof payload.failure_message === 'string' &&
          payload.failure_message !== '';
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private isUuid(value: unknown): value is string {
    return (
      typeof value === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      )
    );
  }

  private isTimestamp(value: unknown): value is string {
    return typeof value === 'string' && !Number.isNaN(Date.parse(value));
  }
}
