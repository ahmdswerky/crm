export const PAYMENT_PERMISSION_ACTIONS = [
  'view',
  'create',
  'edit',
  'delete',
  'restore',
] as const;

export const PAYMENT_PERMISSION_ENTITIES = ['invoice', 'payment'] as const;

export function paymentPermissionNames(): string[] {
  return PAYMENT_PERMISSION_ENTITIES.flatMap((entity) =>
    PAYMENT_PERMISSION_ACTIONS.map((action) => `${entity}.${action}`),
  );
}
