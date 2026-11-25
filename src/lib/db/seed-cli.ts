import { seedDatabase } from './seed';

async function main() {
  console.log('Seeding THE CASE FILES PostgreSQL database and private object storage...');
  await seedDatabase({ force: true });
  console.log('Seed completed successfully.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
