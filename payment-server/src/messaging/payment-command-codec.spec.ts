import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { PaymentCommandCodec } from './payment-command-codec';
import { PaymentMessageValidationError } from './payment-message-validation.error';

const fixture = (name: string): Buffer =>
  readFileSync(
    join(
      process.env.PAYMENT_CONTRACTS_PATH ??
        join(__dirname, '../../../docs/contracts/payments'),
      `${name}.v1.json`,
    ),
  );

describe('PaymentCommandCodec', () => {
  const codec = new PaymentCommandCodec();

  it('decodes the shared invoice command fixture', () => {
    const body = fixture('invoice.generate');

    expect(codec.decode(body)).toEqual(JSON.parse(body.toString()));
  });

  it.each([
    ['malformed JSON', Buffer.from('{')],
    [
      'unsupported source',
      Buffer.from(
        JSON.stringify({
          ...JSON.parse(fixture('invoice.generate').toString()),
          source: 'other-service',
        }),
      ),
    ],
    [
      'unsupported version',
      Buffer.from(
        JSON.stringify({
          ...JSON.parse(fixture('invoice.generate').toString()),
          version: 2,
        }),
      ),
    ],
    [
      'invalid invoice payload',
      Buffer.from(
        JSON.stringify({
          ...JSON.parse(fixture('invoice.generate').toString()),
          payload: { invoicable_type: 'deal', invoicable_id: '12' },
        }),
      ),
    ],
  ])('rejects %s as a permanent command failure', (_case, body) => {
    expect(() => codec.decode(body)).toThrow(PaymentMessageValidationError);
  });
});
