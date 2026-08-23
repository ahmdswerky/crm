if (process.env.CI === 'true' || process.env.NODE_ENV === 'production') process.exit(0)

const { default: husky } = await import('husky')
console.log(husky())
