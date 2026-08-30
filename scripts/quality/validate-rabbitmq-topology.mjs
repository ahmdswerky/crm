import { readFileSync } from 'node:fs'

const definitions = JSON.parse(
  readFileSync('docker/rabbitmq/definitions.json', 'utf8'),
)
const laravelConfig = readFileSync('server/config/services.php', 'utf8')
const laravelClient = readFileSync(
  'server/app/Services/Payments/RabbitMqClient.php',
  'utf8',
)
const nestService = readFileSync('payment-server/src/messaging/rabbitmq.service.ts', 'utf8')

const exchanges = new Set(definitions.exchanges.map(({ name }) => name))
const vhosts = new Set((definitions.vhosts ?? []).map(({ name }) => name))
const queues = new Map(definitions.queues.map((queue) => [queue.name, queue]))
const bindings = new Set(
  definitions.bindings.map(
    ({ source, destination, routing_key: routingKey }) =>
      `${source}:${destination}:${routingKey}`,
  ),
)

const expectedExchanges = [
  'payments.commands',
  'payments.commands.retry',
  'payments.commands.dead',
  'payments.events',
  'payments.events.dead',
]
const expectedBindings = [
  'payments.commands:payments:invoice.generate',
  'payments.commands.retry:payments.retry:invoice.generate',
  'payments.commands.dead:payments.dead:invoice.generate',
  'payments.events:crm.payment-events:invoice.completed',
  'payments.events:crm.payment-events:invoice.failed',
  'payments.events.dead:crm.payment-events.dead:invoice.completed',
  'payments.events.dead:crm.payment-events.dead:invoice.failed',
]

const fail = (message) => {
  throw new Error(`RabbitMQ topology mismatch: ${message}`)
}

if (!vhosts.has('/')) fail('missing default virtual host /')

for (const exchange of expectedExchanges) {
  if (!exchanges.has(exchange)) fail(`missing exchange ${exchange}`)
}

for (const binding of expectedBindings) {
  if (!bindings.has(binding)) fail(`missing binding ${binding}`)
}

if ([...bindings].some((binding) => binding.endsWith(':#'))) {
  fail('wildcard bindings are not allowed')
}

if (
  queues.get('payments')?.arguments?.['x-dead-letter-exchange'] !==
    'payments.commands.dead' ||
  queues.get('payments.retry')?.arguments?.['x-message-ttl'] !== 10000 ||
  queues.get('payments.retry')?.arguments?.['x-dead-letter-exchange'] !==
    'payments.commands' ||
  queues.get('crm.payment-events')?.arguments?.['x-dead-letter-exchange'] !==
    'payments.events.dead'
) {
  fail('queue retry or dead-letter arguments differ from the delivery contract')
}

for (const literal of [
  "'commands_exchange' => env('RABBITMQ_COMMANDS_EXCHANGE', 'payments.commands')",
  "'commands_queue' => env('RABBITMQ_COMMANDS_QUEUE', 'payments')",
  "'events_exchange' => env('RABBITMQ_EVENTS_EXCHANGE', 'payments.events')",
  "'events_queue' => env('RABBITMQ_EVENTS_QUEUE', 'crm.payment-events')",
]) {
  if (!laravelConfig.includes(literal)) fail(`Laravel config no longer matches ${literal}`)
}

for (const literal of [
  "'payments.commands'",
  "'payments'",
  "'payments.events'",
]) {
  if (!nestService.includes(literal)) fail(`Nest config no longer matches ${literal}`)
}

if (/declareTopology|assertExchange|assertQueue|bindQueue/.test(nestService)) {
  fail('NestJS must not provision topology at runtime')
}

if (/declareTopology|exchange_declare|queue_declare|queue_bind/.test(laravelClient)) {
  fail('Laravel must not provision topology at runtime')
}

console.log('RabbitMQ topology definition and runtime configuration agree.')
