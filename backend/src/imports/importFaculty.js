const prisma = require('../config/prisma');
const bcrypt = require('bcrypt');
const Joi = require('joi');

const SALT_ROUNDS = 10;

// Validation schema for each faculty row
const facultyRowSchema = Joi.object({
  name: Joi.string().required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  role: Joi.string().valid('SUPER_ADMIN', 'FACULTY').default('FACULTY'),
});

/**
 * Imports faculty records from parsed rows.
 * Uses upsert for idempotency: inserts new, updates existing, skips unchanged.
 * Wrapped in a Prisma transaction for database safety.
 *
 * @param {Array<Object>} rows - Parsed rows from any supported file format.
 * @returns {Object} Summary of import results.
 */
async function importFaculty(rows) {
  const results = { created: 0, updated: 0, skipped: 0, failed: 0, errors: [] };

  // 1. Validate all rows first
  const validRows = [];
  for (let i = 0; i < rows.length; i++) {
    const { error, value } = facultyRowSchema.validate(rows[i], { abortEarly: false, stripUnknown: true });
    if (error) {
      results.failed++;
      results.errors.push({ row: i + 1, message: error.details.map(d => d.message).join(', ') });
    } else {
      validRows.push(value);
    }
  }

  if (validRows.length === 0) {
    console.log('⚠️  No valid rows to import.');
    return results;
  }

  // 2. Check for duplicate emails within the import file itself
  const emailSet = new Set();
  const deduplicatedRows = [];
  for (const row of validRows) {
    const normalizedEmail = row.email.toLowerCase();
    if (emailSet.has(normalizedEmail)) {
      results.skipped++;
      continue;
    }
    emailSet.add(normalizedEmail);
    deduplicatedRows.push({ ...row, email: normalizedEmail });
  }

  // 3. Hash passwords and upsert inside a transaction
  try {
    await prisma.$transaction(async (tx) => {
      for (const row of deduplicatedRows) {
        const hashedPassword = await bcrypt.hash(row.password, SALT_ROUNDS);

        const existing = await tx.faculty.findUnique({ where: { email: row.email } });

        if (existing) {
          // Check if data has actually changed
          const nameChanged = existing.name !== row.name;
          const roleChanged = existing.role !== row.role;

          if (nameChanged || roleChanged) {
            await tx.faculty.update({
              where: { email: row.email },
              data: {
                name: row.name,
                role: row.role,
                password: hashedPassword,
              },
            });
            results.updated++;
          } else {
            results.skipped++;
          }
        } else {
          await tx.faculty.create({
            data: {
              name: row.name,
              email: row.email,
              password: hashedPassword,
              role: row.role,
            },
          });
          results.created++;
        }
      }
    });
  } catch (err) {
    console.error('❌ Transaction failed, rolling back:', err.message);
    throw err;
  }

  return results;
}

module.exports = importFaculty;
