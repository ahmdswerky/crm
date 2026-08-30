import { join } from 'node:path';
import { DataSource } from 'typeorm';

// Load `.ts` migrations when this module is executed through ts-node (schema
// tooling), `.js` when it runs from the compiled `dist/` output (production).
const migrationExtension = __filename.endsWith('.ts') ? 'ts' : 'js';

export default new DataSource({
  type: 'postgres',
  host: process.env.PAYMENTS_DB_HOST ?? '127.0.0.1',
  port: Number(process.env.PAYMENTS_DB_PORT ?? 5432),
  username: process.env.PAYMENTS_DB_USER ?? 'payments_app',
  password: process.env.PAYMENTS_DB_PASSWORD,
  database: process.env.PAYMENTS_DB_NAME ?? 'payments',
  entities: [],
  migrations: [join(__dirname, 'migrations', `*.${migrationExtension}`)],
  synchronize: false,
  migrationsRun: false,
  retryAttempts: 1,
  connectTimeoutMS: 1000,
});
