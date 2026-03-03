require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const sqlFileArg = process.argv[2];

if (!sqlFileArg) {
  console.error('Usage: node runSqlFile.js <sql-file>');
  process.exit(1);
}

const sqlFilePath = path.isAbsolute(sqlFileArg)
  ? sqlFileArg
  : path.join(__dirname, sqlFileArg);

if (!fs.existsSync(sqlFilePath)) {
  console.error(`SQL file not found: ${sqlFilePath}`);
  process.exit(1);
}

const db = new Pool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'japanese_learning',
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5433,
});

const run = async () => {
  try {
    const sql = fs.readFileSync(sqlFilePath, 'utf8');
    await db.query(sql);
    console.log(`✅ Applied SQL file: ${path.basename(sqlFilePath)}`);
    await db.end();
  } catch (error) {
    console.error(`❌ Failed to apply SQL file: ${path.basename(sqlFilePath)}`);
    console.error(error.message);
    await db.end();
    process.exit(1);
  }
};

run();
