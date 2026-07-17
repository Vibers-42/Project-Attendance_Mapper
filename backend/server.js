const app = require('./src/app');
const prisma = require('./src/config/prisma');
const environment = require('./src/config/environment');

const startServer = async () => {
  try {
    // Authenticate database connection
    try {
      await prisma.$connect();
      console.log('✅ Prisma connected to Supabase PostgreSQL successfully.');
    } catch (dbError) {
      console.error('❌ Unable to connect to Supabase via Prisma:');
      console.error(`Error details: ${dbError.message}`);
      console.warn('⚠️ Server running without database connection (please configure .env)');
    }

    // Start Express server on all interfaces so physical phones can connect over Wi-Fi
    const PORT = environment.port || 3000;
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server is running on port ${PORT} in ${environment.nodeEnv || 'development'} mode.`);
    });
  } catch (error) {
    console.error('❌ Server startup error:');
    console.error(error.message);
    process.exit(1);
  }
};

startServer();
