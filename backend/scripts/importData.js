/**
 * CLI Script: Import Master Data
 *
 * Usage:
 *   node scripts/importData.js --entity faculty --file ./data/faculty.sample.csv
 *   node scripts/importData.js --entity students --file ./data/students.sample.csv
 *
 * Supported file formats: .csv, .xlsx, .json
 */

const path = require('path');
const parseFile = require('../src/imports/parsers');
const { runImport } = require('../src/imports');

// Parse CLI arguments
const args = process.argv.slice(2);
const entityIndex = args.indexOf('--entity');
const fileIndex = args.indexOf('--file');

if (entityIndex === -1 || fileIndex === -1 || !args[entityIndex + 1] || !args[fileIndex + 1]) {
  console.error('Usage: node scripts/importData.js --entity <faculty|students> --file <path>');
  process.exit(1);
}

const entityType = args[entityIndex + 1];
const filePath = path.resolve(args[fileIndex + 1]);

async function main() {
  console.log(`\n📂 Importing ${entityType} from: ${filePath}`);
  console.log('─'.repeat(60));

  try {
    // 1. Parse the file
    const rows = parseFile(filePath);
    console.log(`📋 Parsed ${rows.length} row(s) from file.\n`);

    if (rows.length === 0) {
      console.log('⚠️  File contains no data rows. Nothing to import.');
      process.exit(0);
    }

    // 2. Run the import
    const results = await runImport(entityType, rows);

    // 3. Print summary
    console.log('\n' + '─'.repeat(60));
    console.log('📊 Import Summary:');
    console.log(`   ✅ Created:  ${results.created}`);
    console.log(`   🔄 Updated:  ${results.updated}`);
    console.log(`   ⏭️  Skipped:  ${results.skipped}`);
    console.log(`   ❌ Failed:   ${results.failed}`);

    if (results.errors.length > 0) {
      console.log('\n⚠️  Validation Errors:');
      results.errors.forEach(e => {
        console.log(`   Row ${e.row}: ${e.message}`);
      });
    }

    console.log('\n✅ Import complete.\n');
  } catch (err) {
    console.error(`\n❌ Import failed: ${err.message}\n`);
    process.exit(1);
  } finally {
    const prisma = require('../src/config/prisma');
    await prisma.$disconnect();
  }
}

main();
