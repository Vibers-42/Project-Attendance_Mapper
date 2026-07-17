const prisma = require('../config/prisma');
const Joi = require('joi');

// Validation schema for each student row
const studentRowSchema = Joi.object({
  rollNumber: Joi.string().required(),
  name: Joi.string().required(),
  barcode: Joi.string().required(),
  year: Joi.string().required(),      // Maps to AcademicYear.name
  section: Joi.string().required(),   // Maps to Section.name
});

/**
 * Imports student records from parsed rows.
 * Automatically resolves (or creates) AcademicYear and Section references.
 * Uses upsert for idempotency inside a Prisma transaction.
 *
 * @param {Array<Object>} rows - Parsed rows from any supported file format.
 * @returns {Object} Summary of import results.
 */
async function importStudents(rows) {
  const results = { created: 0, updated: 0, skipped: 0, failed: 0, errors: [] };

  // 1. Validate all rows first
  const validRows = [];
  for (let i = 0; i < rows.length; i++) {
    const { error, value } = studentRowSchema.validate(rows[i], { abortEarly: false, stripUnknown: true });
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

  // 2. Check for duplicate rollNumbers within the import file itself
  const rollSet = new Set();
  const barcodeSet = new Set();
  const deduplicatedRows = [];
  for (const row of validRows) {
    const normalizedRoll = row.rollNumber.trim().toUpperCase();
    const normalizedBarcode = row.barcode.trim();

    if (rollSet.has(normalizedRoll)) {
      results.skipped++;
      results.errors.push({ row: validRows.indexOf(row) + 1, message: `Duplicate rollNumber "${normalizedRoll}" within file.` });
      continue;
    }
    if (barcodeSet.has(normalizedBarcode)) {
      results.skipped++;
      results.errors.push({ row: validRows.indexOf(row) + 1, message: `Duplicate barcode "${normalizedBarcode}" within file.` });
      continue;
    }

    rollSet.add(normalizedRoll);
    barcodeSet.add(normalizedBarcode);
    deduplicatedRows.push({ ...row, rollNumber: normalizedRoll, barcode: normalizedBarcode });
  }

  // 3. Resolve references and upsert inside a transaction
  try {
    await prisma.$transaction(async (tx) => {
      // Cache resolved AcademicYear and Section IDs to avoid repeated lookups
      const yearCache = {};
      const sectionCache = {};

      for (const row of deduplicatedRows) {
        // Resolve AcademicYear (create if not exists)
        if (!yearCache[row.year]) {
          const year = await tx.academicYear.upsert({
            where: { name: row.year },
            update: {},
            create: { name: row.year },
          });
          yearCache[row.year] = year.id;
        }

        // Resolve Section (create if not exists)
        if (!sectionCache[row.section]) {
          const section = await tx.section.upsert({
            where: { name: row.section },
            update: {},
            create: { name: row.section },
          });
          sectionCache[row.section] = section.id;
        }

        const existing = await tx.student.findUnique({ where: { rollNumber: row.rollNumber } });

        if (existing) {
          const nameChanged = existing.name !== row.name;
          const barcodeChanged = existing.barcode !== row.barcode;
          const yearChanged = existing.academicYearId !== yearCache[row.year];
          const sectionChanged = existing.sectionId !== sectionCache[row.section];

          if (nameChanged || barcodeChanged || yearChanged || sectionChanged) {
            await tx.student.update({
              where: { rollNumber: row.rollNumber },
              data: {
                name: row.name,
                barcode: row.barcode,
                academicYearId: yearCache[row.year],
                sectionId: sectionCache[row.section],
              },
            });
            results.updated++;
          } else {
            results.skipped++;
          }
        } else {
          await tx.student.create({
            data: {
              rollNumber: row.rollNumber,
              name: row.name,
              barcode: row.barcode,
              academicYearId: yearCache[row.year],
              sectionId: sectionCache[row.section],
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

module.exports = importStudents;
