import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const useSsl =
  process.env.DB_SSL === 'true' ||
  (Boolean(process.env.DB_HOST) &&
    process.env.DB_HOST !== 'localhost' &&
    process.env.DB_HOST !== '127.0.0.1');

export const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'vardhamrit',
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  decimalNumbers: true,
  multipleStatements: true,
  timezone: 'Z',
  ssl: useSsl ? { minVersion: 'TLSv1.2', rejectUnauthorized: true } : undefined,
});

export async function testConnection(): Promise<boolean> {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    return true;
  } catch (err) {
    console.error('Database connection failed:', err);
    return false;
  }
}

export default pool;
