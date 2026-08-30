import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { PaymentEventCodec } from './payment-event-codec';
import { PaymentMessageValidationError } from './payment-message-validation.error';

const fixture = (name: string): Buffer =>
  readFileSync(
    join(
      process.env.PAYMENT_CONTRACTS_PATH ??
        join(__dirname, '../../../docs/contracts/payments'),
      `${name}.v1.json`,
    ),
  );

describe('PaymentEventCodec', () => {
  const codec = new PaymentEventCodec();

  it.each(['invoice.completed', 'invoice.failed'])(
    'round-trips the shared %s fixture',
    (name) => {
      const event = codec.decode(fixture(name));

      expect(JSON.parse(codec.serialize(event).toString())).toEqual(event);
    },
  );

  it.each([
    ['malformed JSON', Buffer.from('{')],
    [
      'unsupported type',
      Buffer.from(
        JSON.stringify({
          ...JSON.parse(fixture('invoice.completed').toString()),
          type: 'invoice.cancelled',
        }),
      ),
    ],
    [
      'wrong source',
      Buffer.from(
        JSON.stringify({
          ...JSON.parse(fixture('invoice.completed').toString()),
          source: 'crm',
        }),
      ),
    ],
  ])('rejects %s', (_case, body) => {
    expect(() => codec.decode(body)).toThrow(PaymentMessageValidationError);
  });
});
