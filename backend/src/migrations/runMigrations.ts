import fs from 'fs';
import path from 'path';
import pool from '../config/db';

async function runMigrations() {
  console.log('🔄 Starting Database Migrations...');
  const connection = await pool.getConnection();

  try {
    // 1. Ensure migrations_meta table exists
    await connection.query(`
      CREATE TABLE IF NOT EXISTS migrations_meta (
        id INT AUTO_INCREMENT PRIMARY KEY,
        migration_name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 2. Read all .sql files in migrations dir
    const possibleDirs = [
      __dirname,
      path.join(__dirname, '../../src/migrations'),
      path.join(process.cwd(), 'src/migrations'),
      path.join(process.cwd(), 'backend/src/migrations'),
    ];
    let migrationsDir = __dirname;
    for (const d of possibleDirs) {
      if (fs.existsSync(d) && fs.readdirSync(d).some((f) => f.endsWith('.sql'))) {
        migrationsDir = d;
        break;
      }
    }
    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const [rows] = await connection.query<any[]>(
        'SELECT * FROM migrations_meta WHERE migration_name = ?',
        [file]
      );

      if (rows.length === 0) {
        console.log(`⏳ Executing migration: ${file}`);
        const sqlPath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // Execute queries
        await connection.query(sql);

        // Record execution
        await connection.query(
          'INSERT INTO migrations_meta (migration_name) VALUES (?)',
          [file]
        );
        console.log(`✅ Successfully executed migration: ${file}`);
      } else {
        console.log(`⏩ Migration already applied: ${file}`);
      }
    }

    console.log('✨ All migrations completed successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    connection.release();
    await pool.end();
  }
}

if (require.main === module) {
  runMigrations();
}

export default runMigrations;
