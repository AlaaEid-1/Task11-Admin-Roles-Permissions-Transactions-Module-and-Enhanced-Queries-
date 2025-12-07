import { PrismaClient } from 'generated/prisma';
import { generateProductSeed } from './product.seeds.js';
import { generateUserSeed, getMerchantUser } from './user.seeds.js';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

async function main() {
  await prisma.product.deleteMany({});
  await prisma.user.deleteMany({});

  const userSeeds = faker.helpers.multiple(generateUserSeed, { count: 15 });
  await prisma.user.createMany({
    data: [...userSeeds, await getMerchantUser()],
  });

  const merchantUsers = await prisma.user.findMany({
    where: { role: 'MERCHANT' },
  });

  for (const merchant of merchantUsers) {
    const productSeeds = faker.helpers.multiple(
      () => generateProductSeed(merchant.id),
      {
        count: 5,
      },
    );
    await prisma.product.createMany({
      data: productSeeds,
    });
  }

  console.log('Database has been seeded successfully.');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
