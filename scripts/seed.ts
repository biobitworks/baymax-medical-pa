import { neon } from '@neondatabase/serverless';
import { seedDemo } from '../src/mastra/seed/seed';
try {
  if (!process.env.DATABASE_URL) throw new Error('missing config');
  const sql = neon(process.env.DATABASE_URL);
  await seedDemo(async (statement, params) => (await sql.query(statement, params)) as Record<string, unknown>[]);
  console.log('Demo user (Jordan Mercer) seeded.');
} catch (error) {
  console.error('Seeding failed. Check DATABASE_URL and run npm run db:migrate first.');
  if (process.env.DEBUG) console.error(error);
  process.exitCode = 1;
}
