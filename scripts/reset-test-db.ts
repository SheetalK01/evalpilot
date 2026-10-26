/**
 * Empties every table in the TEST database (keeps the schema and migration history).
 * Used before integration and E2E runs. Refuses to run against a non-test database.
 */
import { PrismaClient } from '@prisma/client';

export async function truncateTestDatabase(url: string): Promise<string[]> {
  const database = new URL(url).pathname.replace(/^\//, '');
  if (!database.endsWith('_test')) {
    throw new Error(`Refusing to truncate "${database}": the test database name must end with _test`);
  }
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const rows = await prisma.$queryRaw<{ name: string }[]>`
      SELECT TABLE_NAME AS name FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ${database} AND TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME <> '_prisma_migrations'`;
    const tables = rows.map((row) => row.name);
    // Table names come from information_schema, never from user input.
    await prisma.$transaction([
      prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0'),
      ...tables.map((table) => prisma.$executeRawUnsafe(`TRUNCATE TABLE \`${table.replace(/`/g, '')}\``)),
      prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1'),
    ]);
    return tables;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    console.error('TEST_DATABASE_URL is not set');
    process.exit(1);
  }
  truncateTestDatabase(url)
    .then((tables) => {
      console.log(`✓ Test database emptied (${tables.length} tables)`);
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
