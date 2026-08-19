import 'dotenv/config';
import { Prisma, PrismaClient, type RentalStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

// Phase 0: seeds only what the app needs to boot (one admin user + the
// singleton Setting row). The full realistic dataset described in
// docs/roadmap.md Phase 9 (30-50 cars, 100 clients, 200 rentals, payments,
// expenses, maintenance, audit logs via @faker-js/faker) is filled in during
// Phase 9, once every entity's shape has been finalized by its own phase —
// seeding it earlier would mean rewriting it as each module lands.
//
// The hand-curated DEMO_CARS below is a deliberate, narrow exception: Cars
// (Phase 2) is done and needed a realistic-looking fleet to demo/test its
// filters, sort, and expiry alerts *now*, ahead of Phase 9's faker-generated
// dataset. Phase 9 can replace this block wholesale once it lands.
//
// Safe to re-run: upserts by unique key instead of blindly inserting.

const prisma = new PrismaClient();

// Cars are seeded findFirst-then-create rather than upsert, same pattern
// already used below for Setting — kept as-is even though licensePlate is
// now a plain @unique field Prisma's typed upsert could target directly.
function daysFromNow(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(0, 0, 0, 0);
  return date;
}

const DEMO_CARS: Prisma.CarCreateManyInput[] = [
  {
    licensePlate: '201 TUN 5510',
    vin: 'VF15RFA0X6A123456',
    brand: 'Renault',
    model: 'Symbol',
    year: 2021,
    color: 'Blanc',
    category: 'ECONOMY',
    transmission: 'MANUAL',
    fuelType: 'GASOLINE',
    seats: 5,
    mileage: 48200,
    dailyRate: 55,
    status: 'AVAILABLE',
    purchaseDate: new Date('2021-03-10'),
    purchasePrice: 38500,
    insuranceExpiryDate: daysFromNow(12), // expiring soon
    technicalInspectionExpiryDate: daysFromNow(-6), // expired
    registrationExpiryDate: daysFromNow(310),
  },
  {
    licensePlate: '202 TUN 5511',
    vin: 'UU1LSDAAB55123457',
    brand: 'Dacia',
    model: 'Logan',
    year: 2020,
    color: 'Gris',
    category: 'ECONOMY',
    transmission: 'MANUAL',
    fuelType: 'DIESEL',
    seats: 5,
    mileage: 63500,
    dailyRate: 50,
    status: 'AVAILABLE',
    purchaseDate: new Date('2020-06-18'),
    purchasePrice: 34000,
    insuranceExpiryDate: daysFromNow(240),
    technicalInspectionExpiryDate: daysFromNow(190),
    registrationExpiryDate: daysFromNow(400),
  },
  {
    licensePlate: '203 TUN 5512',
    vin: 'VF3XXXXXX6X123458',
    brand: 'Peugeot',
    model: '208',
    year: 2022,
    color: 'Rouge',
    category: 'COMPACT',
    transmission: 'MANUAL',
    fuelType: 'GASOLINE',
    seats: 5,
    mileage: 27800,
    dailyRate: 75,
    status: 'AVAILABLE',
    purchaseDate: new Date('2022-01-22'),
    purchasePrice: 52000,
    insuranceExpiryDate: daysFromNow(-20), // expired
    technicalInspectionExpiryDate: null,
    registrationExpiryDate: null,
  },
  {
    licensePlate: '204 TUN 5513',
    vin: 'WVWZZZ1KZAW123459',
    brand: 'Volkswagen',
    model: 'Golf 8',
    year: 2023,
    color: 'Noir',
    category: 'COMPACT',
    transmission: 'AUTOMATIC',
    fuelType: 'GASOLINE',
    seats: 5,
    mileage: 14200,
    dailyRate: 95,
    status: 'RENTED',
    purchaseDate: new Date('2023-05-02'),
    purchasePrice: 68000,
    insuranceExpiryDate: daysFromNow(150),
    technicalInspectionExpiryDate: daysFromNow(20), // expiring soon
    registrationExpiryDate: daysFromNow(500),
  },
  {
    licensePlate: '205 TUN 5514',
    vin: 'KMHXX00XXXU123460',
    brand: 'Hyundai',
    model: 'i30',
    year: 2021,
    color: 'Bleu',
    category: 'COMPACT',
    transmission: 'MANUAL',
    fuelType: 'DIESEL',
    seats: 5,
    mileage: 39400,
    dailyRate: 80,
    status: 'AVAILABLE',
    purchaseDate: new Date('2021-09-14'),
    purchasePrice: 56000,
    insuranceExpiryDate: daysFromNow(365),
    technicalInspectionExpiryDate: daysFromNow(365),
    registrationExpiryDate: daysFromNow(365),
  },
  {
    licensePlate: '206 TUN 5515',
    vin: 'KNAPC81ADG7123461',
    brand: 'Kia',
    model: 'Sportage',
    year: 2022,
    color: 'Gris foncé',
    category: 'SUV',
    transmission: 'AUTOMATIC',
    fuelType: 'DIESEL',
    seats: 5,
    mileage: 22100,
    dailyRate: 140,
    status: 'AVAILABLE',
    purchaseDate: new Date('2022-04-11'),
    purchasePrice: 98000,
    insuranceExpiryDate: daysFromNow(45),
    technicalInspectionExpiryDate: daysFromNow(45),
    registrationExpiryDate: daysFromNow(45),
  },
  {
    licensePlate: '207 TUN 5516',
    vin: 'JTMBFREV5ND123462',
    brand: 'Toyota',
    model: 'RAV4',
    year: 2023,
    color: 'Blanc nacré',
    category: 'SUV',
    transmission: 'AUTOMATIC',
    fuelType: 'HYBRID',
    seats: 5,
    mileage: 17600,
    dailyRate: 165,
    status: 'AVAILABLE',
    purchaseDate: new Date('2023-02-28'),
    purchasePrice: 135000,
    insuranceExpiryDate: daysFromNow(180),
    technicalInspectionExpiryDate: daysFromNow(180),
    registrationExpiryDate: daysFromNow(180),
  },
  {
    licensePlate: '208 TUN 5517',
    vin: 'WVGZZZ5NZLW123463',
    brand: 'Volkswagen',
    model: 'Tiguan',
    year: 2020,
    color: 'Marron',
    category: 'SUV',
    transmission: 'AUTOMATIC',
    fuelType: 'DIESEL',
    seats: 5,
    mileage: 71200,
    dailyRate: 150,
    status: 'MAINTENANCE',
    purchaseDate: new Date('2020-11-05'),
    purchasePrice: 92000,
    insuranceExpiryDate: daysFromNow(-3), // expired
    technicalInspectionExpiryDate: daysFromNow(-40),
    registrationExpiryDate: daysFromNow(60),
  },
  {
    licensePlate: '209 TUN 5518',
    vin: 'SJNFAAJ11U1123464',
    brand: 'Nissan',
    model: 'Qashqai',
    year: 2021,
    color: 'Gris',
    category: 'SUV',
    transmission: 'MANUAL',
    fuelType: 'DIESEL',
    seats: 5,
    mileage: 55700,
    dailyRate: 130,
    status: 'AVAILABLE',
    purchaseDate: new Date('2021-07-19'),
    purchasePrice: 89000,
    insuranceExpiryDate: daysFromNow(300),
    technicalInspectionExpiryDate: daysFromNow(300),
    registrationExpiryDate: daysFromNow(300),
  },
  {
    licensePlate: '210 TUN 5519',
    vin: 'WDD2050441F123465',
    brand: 'Mercedes-Benz',
    model: 'Classe C',
    year: 2023,
    color: 'Noir',
    category: 'LUXURY',
    transmission: 'AUTOMATIC',
    fuelType: 'DIESEL',
    seats: 5,
    mileage: 11300,
    dailyRate: 280,
    status: 'AVAILABLE',
    purchaseDate: new Date('2023-08-01'),
    purchasePrice: 210000,
    insuranceExpiryDate: daysFromNow(200),
    technicalInspectionExpiryDate: daysFromNow(200),
    registrationExpiryDate: daysFromNow(200),
  },
  {
    licensePlate: '211 TUN 5520',
    vin: 'WBA5A5C50FD123466',
    brand: 'BMW',
    model: 'Série 3',
    year: 2022,
    color: 'Gris Sophisto',
    category: 'LUXURY',
    transmission: 'AUTOMATIC',
    fuelType: 'GASOLINE',
    seats: 5,
    mileage: 19500,
    dailyRate: 300,
    status: 'RENTED',
    purchaseDate: new Date('2022-10-12'),
    purchasePrice: 225000,
    insuranceExpiryDate: daysFromNow(90),
    technicalInspectionExpiryDate: daysFromNow(15), // expiring soon
    registrationExpiryDate: daysFromNow(400),
  },
  {
    licensePlate: '212 TUN 5521',
    vin: 'WAUZZZ8K9DA123467',
    brand: 'Audi',
    model: 'A4',
    year: 2021,
    color: 'Blanc',
    category: 'LUXURY',
    transmission: 'AUTOMATIC',
    fuelType: 'DIESEL',
    seats: 5,
    mileage: 31200,
    dailyRate: 290,
    status: 'AVAILABLE',
    purchaseDate: new Date('2021-12-03'),
    purchasePrice: 205000,
    insuranceExpiryDate: daysFromNow(120),
    technicalInspectionExpiryDate: daysFromNow(120),
    registrationExpiryDate: daysFromNow(120),
  },
  {
    licensePlate: '213 TUN 5522',
    vin: 'ZFA22300002123468',
    brand: 'Fiat',
    model: 'Doblo',
    year: 2019,
    color: 'Blanc',
    category: 'VAN',
    transmission: 'MANUAL',
    fuelType: 'DIESEL',
    seats: 7,
    mileage: 82400,
    dailyRate: 100,
    status: 'AVAILABLE',
    purchaseDate: new Date('2019-05-20'),
    purchasePrice: 61000,
    insuranceExpiryDate: daysFromNow(60),
    technicalInspectionExpiryDate: daysFromNow(60),
    registrationExpiryDate: daysFromNow(60),
  },
  {
    licensePlate: '214 TUN 5523',
    vin: 'VF3GJBHW6HS123469',
    brand: 'Peugeot',
    model: 'Partner',
    year: 2018,
    color: 'Gris',
    category: 'VAN',
    transmission: 'MANUAL',
    fuelType: 'DIESEL',
    seats: 5,
    mileage: 95300,
    dailyRate: 90,
    status: 'OUT_OF_SERVICE',
    purchaseDate: new Date('2018-09-09'),
    purchasePrice: 54000,
    insuranceExpiryDate: daysFromNow(-90),
    technicalInspectionExpiryDate: daysFromNow(-90),
    registrationExpiryDate: daysFromNow(-15), // expired
  },
  {
    licensePlate: '215 TUN 5524',
    vin: 'VF1AGA0X0R0123470',
    brand: 'Renault',
    model: 'Zoe',
    year: 2022,
    color: 'Bleu ciel',
    category: 'ECONOMY',
    transmission: 'AUTOMATIC',
    fuelType: 'ELECTRIC',
    seats: 5,
    mileage: 20800,
    dailyRate: 85,
    status: 'AVAILABLE',
    purchaseDate: new Date('2022-06-27'),
    purchasePrice: 78000,
    insuranceExpiryDate: daysFromNow(270),
    technicalInspectionExpiryDate: daysFromNow(270),
    registrationExpiryDate: daysFromNow(270),
  },
  {
    licensePlate: '216 TUN 5525',
    vin: 'KMHC851XXNU123471',
    brand: 'Hyundai',
    model: 'Kona Electric',
    year: 2023,
    color: 'Blanc',
    category: 'SUV',
    transmission: 'AUTOMATIC',
    fuelType: 'ELECTRIC',
    seats: 5,
    mileage: 13900,
    dailyRate: 175,
    status: 'AVAILABLE',
    purchaseDate: new Date('2023-03-15'),
    purchasePrice: 145000,
    insuranceExpiryDate: daysFromNow(330),
    technicalInspectionExpiryDate: daysFromNow(330),
    registrationExpiryDate: daysFromNow(330),
  },
];

// Shared by DEMO_CARS and CALENDAR_TEST_CARS below — both are seeded
// findFirst-then-create by licensePlate (see the partial-unique-index note
// at the top of this file), just against different lists.
async function seedCarBatch(cars: Prisma.CarCreateManyInput[], label: string) {
  const existing = await prisma.car.findMany({
    where: { licensePlate: { in: cars.map((c) => c.licensePlate) } },
    select: { licensePlate: true },
  });
  const existingPlates = new Set(existing.map((c) => c.licensePlate));
  const toCreate = cars.filter((c) => !existingPlates.has(c.licensePlate));

  if (toCreate.length === 0) {
    console.log(`${label} already present, skipping (0 new).`);
    return;
  }

  // skipDuplicates as a second line of defense against the partial unique
  // indexes on licensePlate/vin (belt-and-suspenders on top of the filter
  // above, which already avoids the common case).
  await prisma.car.createMany({ data: toCreate, skipDuplicates: true });

  console.log(`${label} added (${toCreate.length}):`);
  for (const car of toCreate) {
    console.log(
      `  - ${car.licensePlate}  ${car.brand} ${car.model} (${car.year})  ${car.category}/${car.status}`,
    );
  }
}

function seedDemoCars() {
  return seedCarBatch(DEMO_CARS, 'Demo cars');
}

// --- Demo rentals (calendar test data) -------------------------------------
//
// Gives each DEMO_CARS entry a realistic rental history so its calendar
// (GET /rentals?carId=) shows a full schedule: past/completed stays, a
// future/reserved booking or an in-progress one, gaps of pure availability,
// and — for two cars — a currently ACTIVE rental (one on-time, one overdue,
// exactly the read-side condition described in docs/api.md: OVERDUE is never
// a written status, just ACTIVE + plannedReturnDate in the past).
//
// Scoped to DEMO_CARS only — the two pre-existing real cars/rentals in this
// database aren't touched.

const DEMO_CLIENTS: Prisma.ClientCreateManyInput[] = [
  {
    firstName: 'Amine',
    lastName: 'Ben Salah',
    email: 'amine.bensalah@example.tn',
    phone: '20123456',
    city: 'Tunis',
    drivingLicenseNumber: 'TN-DL-100234',
  },
  {
    firstName: 'Sarra',
    lastName: 'Trabelsi',
    email: 'sarra.trabelsi@example.tn',
    phone: '22345678',
    city: 'Sousse',
    drivingLicenseNumber: 'TN-DL-100235',
  },
  {
    firstName: 'Karim',
    lastName: 'Jebali',
    email: 'karim.jebali@example.tn',
    phone: '24456789',
    city: 'Sfax',
    drivingLicenseNumber: 'TN-DL-100236',
  },
  {
    firstName: 'Ines',
    lastName: 'Chaabane',
    email: 'ines.chaabane@example.tn',
    phone: '25567890',
    city: 'Tunis',
    drivingLicenseNumber: 'TN-DL-100237',
  },
  {
    firstName: 'Youssef',
    lastName: 'Mabrouk',
    email: 'youssef.mabrouk@example.tn',
    phone: '27678901',
    city: 'Nabeul',
    drivingLicenseNumber: 'TN-DL-100238',
  },
  {
    firstName: 'Rania',
    lastName: 'Gharbi',
    email: 'rania.gharbi@example.tn',
    phone: '29789012',
    city: 'Bizerte',
    drivingLicenseNumber: 'TN-DL-100239',
  },
  {
    firstName: 'Mehdi',
    lastName: 'Ayari',
    email: 'mehdi.ayari@example.tn',
    phone: '21890123',
    city: 'Monastir',
    drivingLicenseNumber: 'TN-DL-100240',
  },
  {
    firstName: 'Nour',
    lastName: 'Zouari',
    email: 'nour.zouari@example.tn',
    phone: '23901234',
    city: 'Sfax',
    drivingLicenseNumber: 'TN-DL-100241',
  },
];

async function seedDemoClients(): Promise<{ id: string; email: string | null }[]> {
  const existing = await prisma.client.findMany({
    where: { deletedAt: null, email: { in: DEMO_CLIENTS.map((c) => c.email as string) } },
    select: { id: true, email: true },
  });
  const existingEmails = new Set(existing.map((c) => c.email));
  const toCreate = DEMO_CLIENTS.filter((c) => !existingEmails.has(c.email as string));

  if (toCreate.length > 0) {
    await prisma.client.createMany({ data: toCreate, skipDuplicates: true });
    console.log(`Demo clients added (${toCreate.length}).`);
  } else {
    console.log('Demo clients already present, skipping (0 new).');
  }

  return prisma.client.findMany({
    where: { deletedAt: null, email: { in: DEMO_CLIENTS.map((c) => c.email as string) } },
    select: { id: true, email: true },
  });
}

type CompletedLeg = { daysAgoStart: number; nights: number };
type FutureLeg =
  | { kind: 'reserved'; daysFromNowStart: number; nights: number }
  | { kind: 'active-ongoing'; daysAgoStart: number; nights: number }
  | { kind: 'active-overdue'; daysAgoStart: number; daysAgoEnd: number }
  | { kind: 'none' };
type CancelledLeg = { daysAgoStart: number; nights: number; reason: string };

type CarRentalScenario = {
  licensePlate: string;
  completed: CompletedLeg[]; // oldest first
  future: FutureLeg;
  cancelled?: CancelledLeg;
};

// Oldest-first, well-separated offsets so legs never overlap by construction
// (still verified empirically at the end of seedDemoRentals).
const RENTAL_SCENARIOS: CarRentalScenario[] = [
  {
    licensePlate: '201 TUN 5510', // Renault Symbol — reserved + a cancelled one
    completed: [
      { daysAgoStart: 150, nights: 4 },
      { daysAgoStart: 70, nights: 3 },
    ],
    future: { kind: 'reserved', daysFromNowStart: 15, nights: 3 },
    cancelled: {
      daysAgoStart: 30,
      nights: 2,
      reason: 'Client injoignable avant la prise en charge.',
    },
  },
  {
    licensePlate: '202 TUN 5511', // Dacia Logan — clean past + upcoming
    completed: [
      { daysAgoStart: 130, nights: 5 },
      { daysAgoStart: 55, nights: 2 },
    ],
    future: { kind: 'reserved', daysFromNowStart: 8, nights: 4 },
  },
  {
    licensePlate: '203 TUN 5512', // Peugeot 208 — nothing upcoming: pure "gap" example
    completed: [
      { daysAgoStart: 140, nights: 3 },
      { daysAgoStart: 45, nights: 6 },
    ],
    future: { kind: 'none' },
  },
  {
    licensePlate: '204 TUN 5513', // VW Golf 8 — Car.status RENTED, currently active, due soon
    completed: [
      { daysAgoStart: 120, nights: 3 },
      { daysAgoStart: 50, nights: 2 },
    ],
    future: { kind: 'active-ongoing', daysAgoStart: 2, nights: 5 },
  },
  {
    licensePlate: '205 TUN 5514', // Hyundai i30 — reserved soon + a cancelled one
    completed: [
      { daysAgoStart: 160, nights: 2 },
      { daysAgoStart: 80, nights: 4 },
    ],
    future: { kind: 'reserved', daysFromNowStart: 5, nights: 2 },
    cancelled: { daysAgoStart: 20, nights: 3, reason: 'Changement de dates du client.' },
  },
  {
    licensePlate: '206 TUN 5515', // Kia Sportage — deeper history (3 completed), far-out reservation
    completed: [
      { daysAgoStart: 200, nights: 6 },
      { daysAgoStart: 110, nights: 3 },
      { daysAgoStart: 35, nights: 2 },
    ],
    future: { kind: 'reserved', daysFromNowStart: 45, nights: 7 },
  },
  {
    licensePlate: '207 TUN 5516', // Toyota RAV4 — nothing upcoming
    completed: [
      { daysAgoStart: 100, nights: 4 },
      { daysAgoStart: 40, nights: 3 },
    ],
    future: { kind: 'none' },
  },
  {
    licensePlate: '208 TUN 5517', // VW Tiguan — Car.status MAINTENANCE, nothing upcoming
    completed: [
      { daysAgoStart: 170, nights: 5 },
      { daysAgoStart: 90, nights: 4 },
    ],
    future: { kind: 'none' },
  },
  {
    licensePlate: '209 TUN 5518', // Nissan Qashqai — short upcoming trip
    completed: [
      { daysAgoStart: 145, nights: 3 },
      { daysAgoStart: 60, nights: 5 },
    ],
    future: { kind: 'reserved', daysFromNowStart: 12, nights: 2 },
  },
  {
    licensePlate: '210 TUN 5519', // Mercedes Classe C — longer weekend booking soon
    completed: [
      { daysAgoStart: 175, nights: 3 },
      { daysAgoStart: 65, nights: 2 },
    ],
    future: { kind: 'reserved', daysFromNowStart: 20, nights: 3 },
  },
  {
    licensePlate: '211 TUN 5520', // BMW Série 3 — Car.status RENTED, ACTIVE + overdue
    completed: [
      { daysAgoStart: 130, nights: 4 },
      { daysAgoStart: 55, nights: 2 },
    ],
    future: { kind: 'active-overdue', daysAgoStart: 10, daysAgoEnd: 2 },
  },
  {
    licensePlate: '212 TUN 5521', // Audi A4 — cancelled + reserved
    completed: [
      { daysAgoStart: 155, nights: 3 },
      { daysAgoStart: 75, nights: 3 },
    ],
    future: { kind: 'reserved', daysFromNowStart: 25, nights: 4 },
    cancelled: { daysAgoStart: 18, nights: 2, reason: 'Voiture indisponible suite à un imprévu.' },
  },
  {
    licensePlate: '213 TUN 5522', // Fiat Doblo — frequent short van rentals
    completed: [
      { daysAgoStart: 90, nights: 2 },
      { daysAgoStart: 30, nights: 2 },
    ],
    future: { kind: 'reserved', daysFromNowStart: 6, nights: 3 },
  },
  {
    licensePlate: '214 TUN 5523', // Peugeot Partner — Car.status OUT_OF_SERVICE, nothing upcoming
    completed: [
      { daysAgoStart: 200, nights: 3 },
      { daysAgoStart: 100, nights: 4 },
    ],
    future: { kind: 'none' },
  },
  {
    licensePlate: '215 TUN 5524', // Renault Zoe — short city rental upcoming
    completed: [
      { daysAgoStart: 115, nights: 2 },
      { daysAgoStart: 48, nights: 2 },
    ],
    future: { kind: 'reserved', daysFromNowStart: 9, nights: 2 },
  },
  {
    licensePlate: '216 TUN 5525', // Hyundai Kona Electric — cancelled + reserved
    completed: [
      { daysAgoStart: 125, nights: 3 },
      { daysAgoStart: 52, nights: 3 },
    ],
    future: { kind: 'reserved', daysFromNowStart: 30, nights: 5 },
    cancelled: { daysAgoStart: 14, nights: 2, reason: 'Client a annulé le jour même.' },
  },
];

const FUEL_LEVELS = ['Plein', '3/4', 'Moitié', '1/4'];

// Deterministic, increasing mileage segments that land below the car's
// current (already-seeded) odometer reading, leaving a plausible "hasn't
// moved since its last return" gap up to the present.
function buildMileageSteps(
  currentMileage: number,
  count: number,
): { pickup: number; return: number }[] {
  const steps: { pickup: number; return: number }[] = [];
  let cursor = Math.max(currentMileage - count * 2200 - 1200, 0);
  for (let i = 0; i < count; i += 1) {
    const driven = 280 + i * 140;
    const pickup = cursor;
    const dropoff = pickup + driven;
    steps.push({ pickup, return: dropoff });
    cursor = dropoff + 350;
  }
  return steps;
}

function calcNights(pickup: Date, plannedReturn: Date): number {
  return Math.max(
    Math.ceil((plannedReturn.getTime() - pickup.getTime()) / (24 * 60 * 60 * 1000)),
    1,
  );
}

async function seedDemoRentals(adminUserId: string) {
  const cars = await prisma.car.findMany({
    where: { licensePlate: { in: RENTAL_SCENARIOS.map((s) => s.licensePlate) } },
  });
  const carByPlate = new Map(cars.map((c) => [c.licensePlate, c]));

  const clients = await seedDemoClients();
  if (clients.length === 0) {
    console.log('No demo clients available, skipping demo rentals.');
    return;
  }

  const rows: Prisma.RentalCreateManyInput[] = [];
  const summary: {
    plate: string;
    brand: string;
    model: string;
    rentalNumber: string;
    status: string;
    pickupDate: Date;
    plannedReturnDate: Date;
  }[] = [];
  let seq = 0;
  let clientCursor = 0;
  let skippedCars = 0;

  for (const scenario of RENTAL_SCENARIOS) {
    const carOrUndefined = carByPlate.get(scenario.licensePlate);
    if (!carOrUndefined) continue; // demo car itself wasn't found (e.g. seedDemoCars hasn't run) — nothing to attach rentals to
    const car = carOrUndefined; // narrowed to defined — nested functions below (pushRow) can't retain the `if` narrowing on their own

    const alreadyHasRentals = await prisma.rental.count({
      where: { carId: car.id, deletedAt: null },
    });
    if (alreadyHasRentals > 0) {
      skippedCars += 1;
      continue; // idempotency: a car with any rental already is assumed already seeded (or has real usage) — never layered on top
    }

    const dailyRate = Number(car.dailyRate);
    const depositAmount = Math.round(dailyRate * 2);
    const mileageSteps = buildMileageSteps(car.mileage, scenario.completed.length);

    function nextClient() {
      const client = clients[clientCursor % clients.length]!;
      clientCursor += 1;
      return client;
    }

    function pushRow(input: {
      pickupDate: Date;
      plannedReturnDate: Date;
      status: RentalStatus;
      actualReturnDate?: Date | null;
      mileageAtPickup?: number | null;
      mileageAtReturn?: number | null;
      fuelLevelAtPickup?: string | null;
      fuelLevelAtReturn?: string | null;
      cancelledReason?: string | null;
    }) {
      seq += 1;
      const nights = calcNights(input.pickupDate, input.plannedReturnDate);
      const rentalNumber = `LOC-SEED-${String(seq).padStart(4, '0')}`;
      const client = nextClient();
      rows.push({
        rentalNumber,
        carId: car.id,
        clientId: client.id,
        pickupDate: input.pickupDate,
        plannedReturnDate: input.plannedReturnDate,
        actualReturnDate: input.actualReturnDate ?? null,
        dailyRate,
        totalAmount: dailyRate * nights,
        depositAmount,
        depositReturned: input.status === 'COMPLETED',
        mileageAtPickup: input.mileageAtPickup ?? null,
        mileageAtReturn: input.mileageAtReturn ?? null,
        fuelLevelAtPickup: input.fuelLevelAtPickup ?? null,
        fuelLevelAtReturn: input.fuelLevelAtReturn ?? null,
        status: input.status,
        cancelledReason: input.cancelledReason ?? null,
        notes: 'Donnée de démonstration (seed).',
        createdByUserId: adminUserId,
      });
      summary.push({
        plate: car.licensePlate,
        brand: car.brand,
        model: car.model,
        rentalNumber,
        status: input.status,
        pickupDate: input.pickupDate,
        plannedReturnDate: input.plannedReturnDate,
      });
    }

    // Past, completed stays.
    scenario.completed.forEach((leg, i) => {
      const pickupDate = daysFromNow(-leg.daysAgoStart);
      const plannedReturnDate = daysFromNow(-leg.daysAgoStart + leg.nights);
      const { pickup: mileageAtPickup, return: mileageAtReturn } = mileageSteps[i]!;
      pushRow({
        pickupDate,
        plannedReturnDate,
        actualReturnDate: plannedReturnDate,
        status: 'COMPLETED',
        mileageAtPickup,
        mileageAtReturn,
        fuelLevelAtPickup: FUEL_LEVELS[i % FUEL_LEVELS.length],
        fuelLevelAtReturn: FUEL_LEVELS[(i + 1) % FUEL_LEVELS.length],
      });
    });

    // Optional cancelled reservation, in its own past slot.
    if (scenario.cancelled) {
      const pickupDate = daysFromNow(-scenario.cancelled.daysAgoStart);
      const plannedReturnDate = daysFromNow(
        -scenario.cancelled.daysAgoStart + scenario.cancelled.nights,
      );
      pushRow({
        pickupDate,
        plannedReturnDate,
        status: 'CANCELLED',
        cancelledReason: scenario.cancelled.reason,
      });
    }

    // Current/future leg.
    if (scenario.future.kind === 'reserved') {
      const pickupDate = daysFromNow(scenario.future.daysFromNowStart);
      const plannedReturnDate = daysFromNow(
        scenario.future.daysFromNowStart + scenario.future.nights,
      );
      pushRow({ pickupDate, plannedReturnDate, status: 'RESERVED' });
    } else if (scenario.future.kind === 'active-ongoing') {
      const pickupDate = daysFromNow(-scenario.future.daysAgoStart);
      const plannedReturnDate = daysFromNow(-scenario.future.daysAgoStart + scenario.future.nights);
      pushRow({
        pickupDate,
        plannedReturnDate,
        status: 'ACTIVE',
        mileageAtPickup: car.mileage,
        fuelLevelAtPickup: 'Plein',
      });
    } else if (scenario.future.kind === 'active-overdue') {
      const pickupDate = daysFromNow(-scenario.future.daysAgoStart);
      const plannedReturnDate = daysFromNow(-scenario.future.daysAgoEnd);
      pushRow({
        pickupDate,
        plannedReturnDate,
        status: 'ACTIVE',
        mileageAtPickup: car.mileage,
        fuelLevelAtPickup: 'Plein',
      });
    }
  }

  if (rows.length === 0) {
    console.log(
      skippedCars > 0
        ? `Demo rentals already present on ${skippedCars} car(s), skipping (0 new).`
        : 'No demo rentals to create (0 new).',
    );
    return;
  }

  await prisma.rental.createMany({ data: rows });

  // Verify no RESERVED/ACTIVE rental overlaps another for the same car —
  // the same half-open-interval rule RentalsService.create enforces
  // (backend/src/lib/rental-availability.ts), checked here empirically
  // rather than assumed from the by-construction spacing above.
  let conflicts = 0;
  for (const car of cars) {
    const active = await prisma.rental.findMany({
      where: { carId: car.id, deletedAt: null, status: { in: ['RESERVED', 'ACTIVE'] } },
      orderBy: { pickupDate: 'asc' },
    });
    for (let i = 1; i < active.length; i += 1) {
      const prevEnd = active[i - 1]!.plannedReturnDate;
      const currStart = active[i]!.pickupDate;
      if (currStart < prevEnd) {
        conflicts += 1;
        console.error(
          `  CONFLICT on ${car.licensePlate}: ${active[i - 1]!.rentalNumber} overlaps ${active[i]!.rentalNumber}`,
        );
      }
    }
  }

  console.log(`Demo rentals added (${rows.length}), ${skippedCars} car(s) already seeded/skipped.`);
  console.log(
    conflicts === 0
      ? 'Overlap check: OK, no date conflicts.'
      : `Overlap check: ${conflicts} CONFLICT(S) FOUND.`,
  );
  console.log('\nCar → Rental → dates/status:');
  for (const r of summary) {
    const pickup = r.pickupDate.toISOString().slice(0, 10);
    const ret = r.plannedReturnDate.toISOString().slice(0, 10);
    console.log(
      `  ${r.plate} (${r.brand} ${r.model}) → ${r.rentalNumber} → ${pickup} → ${ret}  [${r.status}]`,
    );
  }
}

// --- Calendar scenario test cars --------------------------------------------
//
// DEMO_CARS/RENTAL_SCENARIOS above give the fleet realistic *variety*. This
// block is narrower and more deliberate: one car per calendar edge case, so
// opening each car's 📅 in the frontend demonstrates exactly one scenario
// instead of a mixed bag. Kept as a separate car list (not layered onto
// DEMO_CARS) precisely so each one stays single-purpose and easy to find.

const CALENDAR_TEST_CARS: Prisma.CarCreateManyInput[] = [
  {
    licensePlate: '217 TUN 6001',
    vin: 'VF7CH0GTB12006001',
    brand: 'Citroën',
    model: 'C3',
    year: 2020,
    color: 'Blanc',
    category: 'ECONOMY',
    transmission: 'MANUAL',
    fuelType: 'GASOLINE',
    seats: 5,
    mileage: 31000,
    dailyRate: 55,
    status: 'AVAILABLE',
    purchaseDate: new Date('2020-08-12'),
    purchasePrice: 36000,
    insuranceExpiryDate: daysFromNow(365),
    technicalInspectionExpiryDate: daysFromNow(365),
    registrationExpiryDate: daysFromNow(365),
  },
  {
    licensePlate: '218 TUN 6002',
    vin: 'VF15RA10X6A006002',
    brand: 'Renault',
    model: 'Clio 4',
    year: 2019,
    color: 'Gris',
    category: 'COMPACT',
    transmission: 'MANUAL',
    fuelType: 'GASOLINE',
    seats: 5,
    mileage: 45500,
    dailyRate: 70,
    status: 'AVAILABLE',
    purchaseDate: new Date('2019-05-20'),
    purchasePrice: 44000,
    insuranceExpiryDate: daysFromNow(200),
    technicalInspectionExpiryDate: daysFromNow(200),
    registrationExpiryDate: daysFromNow(200),
  },
  {
    licensePlate: '219 TUN 6003',
    vin: 'W0L0XCF0X15006003',
    brand: 'Opel',
    model: 'Corsa',
    year: 2020,
    color: 'Rouge',
    category: 'COMPACT',
    transmission: 'MANUAL',
    fuelType: 'GASOLINE',
    seats: 5,
    mileage: 58000,
    dailyRate: 65,
    status: 'AVAILABLE',
    purchaseDate: new Date('2020-02-14'),
    purchasePrice: 46000,
    insuranceExpiryDate: daysFromNow(150),
    technicalInspectionExpiryDate: daysFromNow(150),
    registrationExpiryDate: daysFromNow(150),
  },
  {
    licensePlate: '220 TUN 6004',
    vin: 'VSSZZZ6JZNR006004',
    brand: 'Seat',
    model: 'Ibiza',
    year: 2022,
    color: 'Noir',
    category: 'COMPACT',
    transmission: 'MANUAL',
    fuelType: 'GASOLINE',
    seats: 5,
    mileage: 26000,
    dailyRate: 78,
    status: 'RENTED',
    purchaseDate: new Date('2022-03-09'),
    purchasePrice: 58000,
    insuranceExpiryDate: daysFromNow(280),
    technicalInspectionExpiryDate: daysFromNow(280),
    registrationExpiryDate: daysFromNow(280),
  },
  {
    licensePlate: '221 TUN 6005',
    vin: 'TMBJJ7NE5N0006005',
    brand: 'Skoda',
    model: 'Octavia',
    year: 2022,
    color: 'Bleu',
    category: 'COMPACT',
    transmission: 'AUTOMATIC',
    fuelType: 'DIESEL',
    seats: 5,
    mileage: 34000,
    dailyRate: 110,
    status: 'AVAILABLE',
    purchaseDate: new Date('2022-06-01'),
    purchasePrice: 82000,
    insuranceExpiryDate: daysFromNow(300),
    technicalInspectionExpiryDate: daysFromNow(300),
    registrationExpiryDate: daysFromNow(300),
  },
  {
    licensePlate: '222 TUN 6006',
    vin: 'WF0JXXGCDJNA06006',
    brand: 'Ford',
    model: 'Focus',
    year: 2021,
    color: 'Gris foncé',
    category: 'COMPACT',
    transmission: 'MANUAL',
    fuelType: 'DIESEL',
    seats: 5,
    mileage: 61000,
    dailyRate: 85,
    status: 'RENTED',
    purchaseDate: new Date('2021-09-17'),
    purchasePrice: 64000,
    insuranceExpiryDate: daysFromNow(220),
    technicalInspectionExpiryDate: daysFromNow(220),
    registrationExpiryDate: daysFromNow(220),
  },
  {
    licensePlate: '223 TUN 6007',
    vin: 'KL1SD6598HB006007',
    brand: 'Chevrolet',
    model: 'Aveo',
    year: 2018,
    color: 'Blanc',
    category: 'ECONOMY',
    transmission: 'MANUAL',
    fuelType: 'GASOLINE',
    seats: 5,
    mileage: 72000,
    dailyRate: 50,
    status: 'AVAILABLE',
    purchaseDate: new Date('2018-11-02'),
    purchasePrice: 31000,
    insuranceExpiryDate: daysFromNow(100),
    technicalInspectionExpiryDate: daysFromNow(100),
    registrationExpiryDate: daysFromNow(100),
  },
  {
    licensePlate: '224 TUN 6008',
    vin: 'TSMDF3BL3M4006008',
    brand: 'Suzuki',
    model: 'Swift',
    year: 2021,
    color: 'Jaune',
    category: 'ECONOMY',
    transmission: 'MANUAL',
    fuelType: 'GASOLINE',
    seats: 5,
    mileage: 40000,
    dailyRate: 60,
    status: 'AVAILABLE',
    purchaseDate: new Date('2021-04-22'),
    purchasePrice: 47000,
    insuranceExpiryDate: daysFromNow(240),
    technicalInspectionExpiryDate: daysFromNow(240),
    registrationExpiryDate: daysFromNow(240),
  },
  {
    licensePlate: '225 TUN 6009',
    vin: 'KMHCT41BAFU006009',
    brand: 'Hyundai',
    model: 'Accent',
    year: 2020,
    color: 'Bleu foncé',
    category: 'ECONOMY',
    transmission: 'MANUAL',
    fuelType: 'GASOLINE',
    seats: 5,
    mileage: 52000,
    dailyRate: 62,
    status: 'AVAILABLE',
    purchaseDate: new Date('2020-07-30'),
    purchasePrice: 42000,
    insuranceExpiryDate: daysFromNow(180),
    technicalInspectionExpiryDate: daysFromNow(180),
    registrationExpiryDate: daysFromNow(180),
  },
];

function seedCalendarTestCars() {
  return seedCarBatch(CALENDAR_TEST_CARS, 'Calendar test cars');
}

// Every leg is anchored by a single signed offset from today (negative =
// past, positive = future) rather than the separate daysAgoStart/
// daysFromNowStart split RENTAL_SCENARIOS uses above — these scenarios mix
// past/current/future on the *same* car, so one signed axis is simpler than
// two.
type RentalLeg =
  | { kind: 'completed'; startOffsetDays: number; nights: number; lateDays?: number }
  | { kind: 'active'; startOffsetDays: number; nights: number }
  | { kind: 'reserved'; startOffsetDays: number; nights: number }
  | { kind: 'cancelled'; startOffsetDays: number; nights: number; reason: string };

type CalendarScenario = {
  licensePlate: string;
  purpose: string;
  legs: RentalLeg[];
};

const CALENDAR_SCENARIOS: CalendarScenario[] = [
  {
    licensePlate: '217 TUN 6001',
    purpose: 'Empty calendar — no rentals at all',
    legs: [],
  },
  {
    licensePlate: '218 TUN 6002',
    purpose: 'Single past/completed rental, clearly dated',
    legs: [{ kind: 'completed', startOffsetDays: -25, nights: 4 }],
  },
  {
    licensePlate: '219 TUN 6003',
    purpose: 'Multiple past rentals with visible gaps between them',
    legs: [
      { kind: 'completed', startOffsetDays: -200, nights: 3 },
      { kind: 'completed', startOffsetDays: -140, nights: 5 },
      { kind: 'completed', startOffsetDays: -80, nights: 2 },
      { kind: 'completed', startOffsetDays: -25, nights: 4 },
    ],
  },
  {
    licensePlate: '220 TUN 6004',
    purpose: 'Current ACTIVE rental covering today (Car.status RENTED)',
    legs: [{ kind: 'active', startOffsetDays: -3, nights: 7 }],
  },
  {
    licensePlate: '221 TUN 6005',
    purpose: 'Multiple future RESERVED rentals, no history',
    legs: [
      { kind: 'reserved', startOffsetDays: 10, nights: 3 },
      { kind: 'reserved', startOffsetDays: 25, nights: 2 },
      { kind: 'reserved', startOffsetDays: 50, nights: 5 },
    ],
  },
  {
    licensePlate: '222 TUN 6006',
    purpose:
      'Mixed: past completed + current active + future reserved, with gaps (Car.status RENTED)',
    legs: [
      { kind: 'completed', startOffsetDays: -150, nights: 4 },
      { kind: 'completed', startOffsetDays: -80, nights: 3 },
      { kind: 'active', startOffsetDays: -2, nights: 6 },
      { kind: 'reserved', startOffsetDays: 20, nights: 3 },
      { kind: 'reserved', startOffsetDays: 45, nights: 6 },
    ],
  },
  {
    licensePlate: '223 TUN 6007',
    purpose: 'Different rental durations: 1 night, 5 nights, 14 nights',
    legs: [
      { kind: 'completed', startOffsetDays: -120, nights: 1 },
      { kind: 'completed', startOffsetDays: -80, nights: 5 },
      { kind: 'completed', startOffsetDays: -30, nights: 14 },
    ],
  },
  {
    licensePlate: '224 TUN 6008',
    purpose:
      'CANCELLED rental overlapped by a real RESERVED booking — proves a cancellation frees up availability',
    legs: [
      {
        kind: 'cancelled',
        startOffsetDays: 18,
        nights: 3,
        reason: 'Client a annulé sa réservation.',
      },
      { kind: 'reserved', startOffsetDays: 19, nights: 4 },
    ],
  },
  {
    licensePlate: '225 TUN 6009',
    purpose:
      'Completed rental returned 2 days after its planned return date (late return + late fee)',
    legs: [{ kind: 'completed', startOffsetDays: -15, nights: 3, lateDays: 2 }],
  },
];

async function seedCalendarTestRentals(adminUserId: string) {
  const cars = await prisma.car.findMany({
    where: { licensePlate: { in: CALENDAR_SCENARIOS.map((s) => s.licensePlate) } },
  });
  const carByPlate = new Map(cars.map((c) => [c.licensePlate, c]));
  const clients = await seedDemoClients(); // idempotent — reuses the same 8 demo clients

  const summary: {
    plate: string;
    brand: string;
    model: string;
    purpose: string;
    rentalNumber: string;
    status: string;
    pickupDate: Date;
    plannedReturnDate: Date;
  }[] = [];
  let seq = 0;
  let clientCursor = 0;
  let skippedCars = 0;
  let emptyCars = 0;

  for (const scenario of CALENDAR_SCENARIOS) {
    const carOrUndefined = carByPlate.get(scenario.licensePlate);
    if (!carOrUndefined) continue;
    const car = carOrUndefined;

    if (scenario.legs.length === 0) {
      emptyCars += 1;
      summary.push({
        plate: car.licensePlate,
        brand: car.brand,
        model: car.model,
        purpose: scenario.purpose,
        rentalNumber: '(none)',
        status: '—',
        pickupDate: daysFromNow(0),
        plannedReturnDate: daysFromNow(0),
      });
      continue; // "no rentals" is the scenario itself — nothing to create
    }

    const alreadyHasRentals = await prisma.rental.count({
      where: { carId: car.id, deletedAt: null },
    });
    if (alreadyHasRentals > 0) {
      skippedCars += 1;
      continue;
    }

    const dailyRate = Number(car.dailyRate);
    const depositAmount = Math.round(dailyRate * 2);
    const completedCount = scenario.legs.filter((l) => l.kind === 'completed').length;
    const mileageSteps = buildMileageSteps(car.mileage, completedCount);
    let mileageStepIndex = 0;

    for (const leg of scenario.legs) {
      seq += 1;
      const pickupDate = daysFromNow(leg.startOffsetDays);
      const plannedReturnDate = daysFromNow(leg.startOffsetDays + leg.nights);
      const nights = calcNights(pickupDate, plannedReturnDate);
      const rentalNumber = `LOC-SEED-CAL-${String(seq).padStart(3, '0')}`;
      const client = clients[clientCursor % clients.length]!;
      clientCursor += 1;

      let status: RentalStatus;
      let actualReturnDate: Date | null = null;
      let mileageAtPickup: number | null = null;
      let mileageAtReturn: number | null = null;
      let fuelLevelAtPickup: string | null = null;
      let fuelLevelAtReturn: string | null = null;
      let cancelledReason: string | null = null;
      let lateFeeAmount = 0;
      let lateDaysUsed = 0;

      if (leg.kind === 'completed') {
        status = 'COMPLETED';
        actualReturnDate = leg.lateDays
          ? daysFromNow(leg.startOffsetDays + leg.nights + leg.lateDays)
          : plannedReturnDate;
        const step = mileageSteps[mileageStepIndex]!;
        mileageStepIndex += 1;
        mileageAtPickup = step.pickup;
        mileageAtReturn = step.return;
        fuelLevelAtPickup = FUEL_LEVELS[seq % FUEL_LEVELS.length];
        fuelLevelAtReturn = FUEL_LEVELS[(seq + 1) % FUEL_LEVELS.length];
        if (leg.lateDays) {
          lateDaysUsed = leg.lateDays;
          lateFeeAmount = leg.lateDays * dailyRate;
        }
      } else if (leg.kind === 'active') {
        status = 'ACTIVE';
        mileageAtPickup = car.mileage;
        fuelLevelAtPickup = 'Plein';
      } else if (leg.kind === 'reserved') {
        status = 'RESERVED';
      } else {
        status = 'CANCELLED';
        cancelledReason = leg.reason;
      }

      const rental = await prisma.rental.create({
        data: {
          rentalNumber,
          carId: car.id,
          clientId: client.id,
          pickupDate,
          plannedReturnDate,
          actualReturnDate,
          dailyRate,
          totalAmount: dailyRate * nights,
          depositAmount,
          depositReturned: status === 'COMPLETED',
          mileageAtPickup,
          mileageAtReturn,
          fuelLevelAtPickup,
          fuelLevelAtReturn,
          status,
          cancelledReason,
          notes: `Donnée de démonstration (seed) — ${scenario.purpose}.`,
          createdByUserId: adminUserId,
        },
      });

      if (lateFeeAmount > 0) {
        await prisma.payment.create({
          data: {
            rentalId: rental.id,
            amount: lateFeeAmount,
            method: 'CASH',
            type: 'LATE_FEE',
            status: 'PENDING',
            notes: `Retard de ${lateDaysUsed} jour(s) (seed).`,
          },
        });
      }

      summary.push({
        plate: car.licensePlate,
        brand: car.brand,
        model: car.model,
        purpose: scenario.purpose,
        rentalNumber,
        status,
        pickupDate,
        plannedReturnDate,
      });
    }
  }

  const createdCount = summary.filter((s) => s.rentalNumber !== '(none)').length;

  // A rerun always re-derives the "(none)" placeholder for the empty-calendar
  // scenario (nothing to skip there — it's not a rental) — so the idempotent
  // no-op case is "nothing new AND nothing skipped", not an empty summary.
  if (createdCount === 0 && skippedCars === 0) {
    console.log('No calendar test rentals to create (0 new).');
    return;
  }
  if (createdCount === 0) {
    console.log(
      `Calendar test rentals already present on ${skippedCars} car(s), skipping (0 new).`,
    );
    return;
  }

  // Same empirical overlap check as seedDemoRentals — RESERVED/ACTIVE only,
  // matching RentalsService's own definition of "overlap".
  let conflicts = 0;
  for (const car of cars) {
    const active = await prisma.rental.findMany({
      where: { carId: car.id, deletedAt: null, status: { in: ['RESERVED', 'ACTIVE'] } },
      orderBy: { pickupDate: 'asc' },
    });
    for (let i = 1; i < active.length; i += 1) {
      const prevEnd = active[i - 1]!.plannedReturnDate;
      const currStart = active[i]!.pickupDate;
      if (currStart < prevEnd) {
        conflicts += 1;
        console.error(
          `  CONFLICT on ${car.licensePlate}: ${active[i - 1]!.rentalNumber} overlaps ${active[i]!.rentalNumber}`,
        );
      }
    }
  }

  console.log(
    `Calendar test rentals added (${createdCount}) across ${CALENDAR_SCENARIOS.length - skippedCars} car(s) (${emptyCars} intentionally left empty), ${skippedCars} car(s) already seeded/skipped.`,
  );
  console.log(
    conflicts === 0
      ? 'Overlap check: OK, no date conflicts.'
      : `Overlap check: ${conflicts} CONFLICT(S) FOUND.`,
  );
  console.log('\nCar → Rental → dates → status → purpose:');
  for (const r of summary) {
    const pickup = r.pickupDate.toISOString().slice(0, 10);
    const ret = r.plannedReturnDate.toISOString().slice(0, 10);
    console.log(
      `  ${r.plate} (${r.brand} ${r.model}) → ${r.rentalNumber} → ${pickup} → ${ret} → ${r.status} → ${r.purpose}`,
    );
  }
}

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
        agencyName: 'Agence de Location de Voitures',
        currencyCode: 'TND',
        contractPrimaryLanguage: 'fr',
        contractSecondaryLanguage: 'ar',
      },
    });
    console.log('Default agency settings created (TND, fr/ar).');
  } else {
    console.log('Agency settings already present, skipping.');
  }

  await seedDemoCars();
  await seedDemoRentals(admin.id);
  await seedCalendarTestCars();
  await seedCalendarTestRentals(admin.id);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
