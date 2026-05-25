import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from root or current directory
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn('Warning: DATABASE_URL is not set in environment variables.');
}

export const pool = new Pool({
  connectionString,
  ssl: false, // The VM runs local/internal PG, no SSL is required
});

export const query = (text: string, params?: any[]) => {
  return pool.query(text, params);
};
