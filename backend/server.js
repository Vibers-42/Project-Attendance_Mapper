const app = require('./src/app');
const prisma = require('./src/config/prisma');
const environment = require('./src/config/environment');

const startServer = async () => {
  try {
    // Authenticate database connection
    await prisma.$connect();
    console.log('✅ Prisma connected to Supabase PostgreSQL successfully.');

    // Start Express server on all interfaces so physical phones can connect over Wi-Fi
    const PORT = environment.port;
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server is running on port ${PORT} in ${environment.nodeEnv} mode.`);
    });
  } catch (error) {
    console.error('❌ Unable to connect to Supabase via Prisma:');
    console.error(`Error details: ${error.message}`);
    console.warn('⚠️ Server failed to start due to database connection issue.');
    // Fail gracefully
    process.exit(1);
  }
};

startServer();
