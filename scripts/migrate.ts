import { readFile, readdir } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
try {
  const migrationUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!migrationUrl) throw new Error('missing config');
  const sql = neon(migrationUrl);
  const directory = new URL('../migrations/', import.meta.url);
  const files = (await readdir(directory)).filter(file => file.endsWith('.sql')).sort();
  const statements: string[] = [];
  for (const file of files) statements.push(...(await readFile(new URL(file, directory), 'utf8')).split(';').map(statement => statement.trim()).filter(Boolean));
  await sql.transaction(statements.map(statement => sql.query(statement)));
  console.log('Baymax care workspace and Apple Health migrations applied.');
} catch {
  console.error('Migration failed. Check DATABASE_URL and database connectivity.');
  process.exitCode = 1;
}
