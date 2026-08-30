import { PaymentCommandMessage } from './payment-messages';
import { PaymentMessageValidationError } from './payment-message-validation.error';

export class PaymentCommandCodec {
  decode(body: Buffer): PaymentCommandMessage {
    let value: unknown;
    try {
      value = JSON.parse(body.toString());
    } catch {
      throw new PaymentMessageValidationError('Malformed payment command.');
    }

    if (!this.isRecord(value) || !this.isValidCommand(value)) {
      throw new PaymentMessageValidationError('Unsupported payment command.');
    }

    return value;
  }

  private isValidCommand(
    value: Record<string, unknown>,
  ): value is PaymentCommandMessage {
    const payload = value.payload;

    return (
      this.isUuid(value.message_id) &&
      this.isUuid(value.correlation_id) &&
      value.type === 'invoice.generate' &&
      value.version === 1 &&
      value.source === 'crm' &&
      this.isTimestamp(value.occurred_at) &&
      this.isRecord(payload) &&
      typeof payload.invoicable_type === 'string' &&
      payload.invoicable_type !== '' &&
      Number.isInteger(payload.invoicable_id) &&
      typeof payload.type === 'string' &&
      payload.type !== '' &&
      typeof payload.value === 'string' &&
      /^\d+(\.\d{1,2})?$/.test(payload.value)
    );
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
