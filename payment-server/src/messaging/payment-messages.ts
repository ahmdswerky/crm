export type PaymentCommandType = 'invoice.generate';

export type PaymentEventType = 'invoice.completed' | 'invoice.failed';

export interface PaymentCommandMessage {
  message_id: string;
  correlation_id: string;
  type: PaymentCommandType;
  version: number;
  source: string;
  occurred_at: string;
  payload: {
    invoicable_type: string;
    invoicable_id: number;
    type: string;
    value: string;
  };
}

export interface PaymentEventMessage {
  event_id: string;
  correlation_id: string;
  type: PaymentEventType;
  version: number;
  source: 'payments';
  occurred_at: string;
  payload: Record<string, unknown>;
}
