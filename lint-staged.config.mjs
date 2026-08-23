const quote = (file) => JSON.stringify(file)

const command = (executable, files) => `${executable} ${files.map(quote).join(' ')}`

export default {
  'dashboard/**/*.{ts,tsx}': (files) => command('npm --prefix dashboard exec eslint --', files),
  'payment-server/**/*.{ts,tsx}': (files) => command('npm --prefix payment-server exec -- eslint --config payment-server/eslint.config.mjs --', files),
  'server/**/*.php': (files) => command('server/vendor/bin/pint --test', files),
}
