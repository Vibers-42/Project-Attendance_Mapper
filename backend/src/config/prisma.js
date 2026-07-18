const { PrismaClient } = require('@prisma/client');
const environment = require('./environment');

const prisma = new PrismaClient({
  log: environment.nodeEnv === 'development' ? ['warn', 'error'] : ['error'],
  transactionOptions: {
    maxWait: 10000,
    timeout: 30000,
  },
});

module.exports = prisma;
