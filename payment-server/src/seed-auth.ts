import { seedPaymentPermissions } from './modules/auth/payment-permission-seeder';

seedPaymentPermissions()
  .then(() => {
    console.log('Payment permissions seeded successfully.');
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
