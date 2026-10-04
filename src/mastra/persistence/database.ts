import { neon } from '@neondatabase/serverless';
import type { Query } from './store';

let sql: ReturnType<typeof neon> | undefined;
export const query: Query = async (statement, params) => {
  if (!sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('Database is not configured');
    sql = neon(url);
  }
  return await sql.query(statement, params) as Record<string, unknown>[];
};
