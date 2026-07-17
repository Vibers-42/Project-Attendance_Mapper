const { PrismaClient } = require('@prisma/client');
const environment = require('./environment');

// Initialize Prisma Client Singleton
const prisma = new PrismaClient({
  log: environment.nodeEnv === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
  transactionOptions: {
    maxWait: 10000,  // Max time to wait for a transaction slot (ms)
    timeout: 30000,  // Max time for the transaction to complete (ms)
  },
});

module.exports = prisma;
