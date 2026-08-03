import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

// Phase 0: seeds only what the app needs to boot (one admin user + the
// singleton Setting row). The full realistic dataset described in
// docs/architecture.md §7 (30-50 cars, 100 clients, 200 rentals, payments,
// expenses, maintenance, audit logs via @faker-js/faker) is filled in during
// Phase 9, once every entity's shape has been finalized by its own phase —
// seeding it earlier would mean rewriting it as each module lands.
//
// Safe to re-run: upserts by unique key instead of blindly inserting.

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to run the seed script against NODE_ENV=production.');
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@agence.tn';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash,
      fullName: 'Administrateur',
      role: 'ADMIN',
    },
  });
  console.log(`Admin user ready: ${admin.email}`);

  const existingSetting = await prisma.setting.findFirst();
  if (!existingSetting) {
    await prisma.setting.create({
      data: {
        agencyName: "Agence de Location de Voitures",
        currencyCode: 'TND',
        contractPrimaryLanguage: 'fr',
        contractSecondaryLanguage: 'ar',
      },
    });
    console.log('Default agency settings created (TND, fr/ar).');
  } else {
    console.log('Agency settings already present, skipping.');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
