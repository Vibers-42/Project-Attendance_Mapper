const prisma = require('../config/prisma');

/**
 * Roll-number prefixes per academic year label. Year membership is derived
 * from the roll number rather than the academicYearId FK, so a student shows
 * up under the right year even if their FK was never set.
 *
 *   2nd Year: 25B1 (2025 regular) + 26B[2-7] (2026 lateral entry)
 *   3rd Year: 24B1 (2024 regular) + 25B[2-7] (2025 lateral entry)
 *   4th Year: 23A91A61 (2023 regular) + 24A95A61 (2024 lateral entry)
 *             — temporary: this batch uses the older roll-number format.
 */
const YEAR_ROLL_PREFIXES = {
  '2nd Year': ['25B1', '26B2', '26B3', '26B4', '26B5', '26B6', '26B7'],
  '3rd Year': ['24B1', '25B2', '25B3', '25B4', '25B5', '25B6', '25B7'],
  '4th Year': ['23A91A61', '24A95A61'],
};

/** Prefix list for a year label, or null if the label isn't a known year. */
function prefixesForYear(yearName) {
  return YEAR_ROLL_PREFIXES[yearName] || null;
}

/** Year label a roll number belongs to, or null if it matches none. */
function yearForRollNumber(rollNumber) {
  const roll = String(rollNumber || '').toUpperCase();
  for (const [year, prefixes] of Object.entries(YEAR_ROLL_PREFIXES)) {
    if (prefixes.some((p) => roll.startsWith(p))) return year;
  }
  return null;
}

/** Prisma OR-clause matching `field` against any of the given prefixes. */
function prefixOrClause(field, prefixes) {
  return prefixes.map((p) => ({ [field]: { startsWith: p } }));
}

/**
 * Resolves an AcademicYear row by name. Known year labels are upserted so a
 * newly added year (e.g. "4th Year") works without a manual DB seed; unknown
 * names are only looked up, never created.
 */
async function findOrCreateAcademicYear(yearName) {
  if (!yearName) return null;
  if (YEAR_ROLL_PREFIXES[yearName]) {
    return prisma.academicYear.upsert({
      where: { name: yearName },
      update: {},
      create: { name: yearName },
    });
  }
  return prisma.academicYear.findFirst({ where: { name: yearName } });
}

module.exports = {
  YEAR_ROLL_PREFIXES,
  prefixesForYear,
  yearForRollNumber,
  prefixOrClause,
  findOrCreateAcademicYear,
};
