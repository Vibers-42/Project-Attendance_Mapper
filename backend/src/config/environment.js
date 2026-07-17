const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

const environment = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  db: {
    databaseUrl: process.env.DATABASE_URL || '',
    directUrl: process.env.DIRECT_URL || '',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'super_secret_jwt_key',
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  },
  bcrypt: {
    saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 10,
  },
};

// ============================================================
// Fail-Fast Configuration Validation
// ============================================================
// The server must refuse to start in production if critical
// security configuration is missing or still set to defaults.

const validateConfig = () => {
  const validEnvs = ['development', 'production', 'test'];
  if (!validEnvs.includes(environment.nodeEnv)) {
    console.warn(`⚠️ WARNING: NODE_ENV is set to an unsupported value: '${environment.nodeEnv}'. Defaulting to 'development'.`);
    environment.nodeEnv = 'development';
  }

  const isProduction = environment.nodeEnv === 'production';

  if (isProduction && (!environment.jwt.secret || environment.jwt.secret === 'super_secret_jwt_key')) {
    console.error('❌ FATAL: JWT_SECRET must be configured with a strong secret key in production.');
    process.exit(1);
  }

  if (isProduction && !environment.db.databaseUrl) {
    console.error('❌ FATAL: DATABASE_URL is required in production.');
    process.exit(1);
  }
};

validateConfig();

module.exports = environment;
