import { readFile, readdir } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
try {
  if (!process.env.DATABASE_URL) throw new Error('missing config');
  const sql = neon(process.env.DATABASE_URL);
  const directory = new URL('../migrations/', import.meta.url);
  const files = (await readdir(directory)).filter(file => file.endsWith('.sql')).sort();
  const statements: string[] = [];
  for (const file of files) statements.push(...(await readFile(new URL(file, directory), 'utf8')).split(';').map(statement => statement.trim()).filter(Boolean));
  await sql.transaction(statements.map(statement => sql.query(statement)));
  console.log('Baymax care workspace migration applied.');
} catch {
  console.error('Migration failed. Check DATABASE_URL and database connectivity.');
  process.exitCode = 1;
}
