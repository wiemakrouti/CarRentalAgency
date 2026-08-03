-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN');

-- CreateEnum
CREATE TYPE "CarCategory" AS ENUM ('ECONOMY', 'COMPACT', 'SUV', 'LUXURY', 'VAN');

-- CreateEnum
CREATE TYPE "Transmission" AS ENUM ('MANUAL', 'AUTOMATIC');

-- CreateEnum
CREATE TYPE "FuelType" AS ENUM ('GASOLINE', 'DIESEL', 'HYBRID', 'ELECTRIC');

-- CreateEnum
CREATE TYPE "CarStatus" AS ENUM ('AVAILABLE', 'RENTED', 'MAINTENANCE', 'OUT_OF_SERVICE');

-- CreateEnum
CREATE TYPE "ClientDocumentType" AS ENUM ('ID_CARD', 'DRIVING_LICENSE', 'PASSPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "RentalStatus" AS ENUM ('RESERVED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'BANK_TRANSFER', 'CHECK');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('RENTAL_PAYMENT', 'DEPOSIT', 'DEPOSIT_REFUND', 'EXTENSION_PAYMENT', 'LATE_FEE', 'DAMAGE_FEE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('FUEL', 'INSURANCE', 'REPAIR', 'REGISTRATION', 'OTHER');

-- CreateEnum
CREATE TYPE "MaintenanceType" AS ENUM ('OIL_CHANGE', 'TIRE_CHANGE', 'REPAIR', 'INSPECTION', 'CLEANING', 'OTHER');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'ADMIN',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cars" (
    "id" TEXT NOT NULL,
    "licensePlate" TEXT NOT NULL,
    "vin" TEXT,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "color" TEXT NOT NULL,
    "category" "CarCategory" NOT NULL,
    "transmission" "Transmission" NOT NULL,
    "fuelType" "FuelType" NOT NULL,
    "seats" INTEGER NOT NULL,
    "mileage" INTEGER NOT NULL,
    "dailyRate" DECIMAL(10,3) NOT NULL,
    "status" "CarStatus" NOT NULL DEFAULT 'AVAILABLE',
    "purchaseDate" TIMESTAMP(3),
    "purchasePrice" DECIMAL(10,3),
    "insuranceExpiryDate" TIMESTAMP(3),
    "technicalInspectionExpiryDate" TIMESTAMP(3),
    "registrationExpiryDate" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "car_images" (
    "id" TEXT NOT NULL,
    "carId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "car_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "nationalIdNumber" TEXT,
    "drivingLicenseNumber" TEXT NOT NULL,
    "drivingLicenseExpiry" TIMESTAMP(3),
    "dateOfBirth" TIMESTAMP(3),
    "blacklisted" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_documents" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "type" "ClientDocumentType" NOT NULL,
    "url" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rentals" (
    "id" TEXT NOT NULL,
    "rentalNumber" TEXT NOT NULL,
    "carId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "pickupDate" TIMESTAMP(3) NOT NULL,
    "plannedReturnDate" TIMESTAMP(3) NOT NULL,
    "actualReturnDate" TIMESTAMP(3),
    "dailyRate" DECIMAL(10,3) NOT NULL,
    "totalAmount" DECIMAL(10,3) NOT NULL,
    "depositAmount" DECIMAL(10,3) NOT NULL,
    "depositReturned" BOOLEAN NOT NULL DEFAULT false,
    "mileageAtPickup" INTEGER,
    "mileageAtReturn" INTEGER,
    "fuelLevelAtPickup" TEXT,
    "fuelLevelAtReturn" TEXT,
    "status" "RentalStatus" NOT NULL DEFAULT 'RESERVED',
    "cancelledReason" TEXT,
    "notes" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rentals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_extensions" (
    "id" TEXT NOT NULL,
    "rentalId" TEXT NOT NULL,
    "previousReturnDate" TIMESTAMP(3) NOT NULL,
    "newReturnDate" TIMESTAMP(3) NOT NULL,
    "additionalAmount" DECIMAL(10,3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rental_extensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "rentalId" TEXT NOT NULL,
    "amount" DECIMAL(10,3) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "type" "PaymentType" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'COMPLETED',
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_attachments" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_documents" (
    "id" TEXT NOT NULL,
    "rentalId" TEXT NOT NULL,
    "pdfUrl" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "amount" DECIMAL(10,3) NOT NULL,
    "carId" TEXT,
    "description" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "receiptUrl" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_records" (
    "id" TEXT NOT NULL,
    "carId" TEXT NOT NULL,
    "type" "MaintenanceType" NOT NULL,
    "description" TEXT,
    "cost" DECIMAL(10,3) NOT NULL,
    "mileageAtService" INTEGER NOT NULL,
    "serviceDate" TIMESTAMP(3) NOT NULL,
    "nextDueDate" TIMESTAMP(3),
    "nextDueMileage" INTEGER,
    "garageName" TEXT,
    "invoiceUrl" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL,
    "agencyName" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "logoUrl" TEXT,
    "currencyCode" TEXT NOT NULL DEFAULT 'TND',
    "contractPrimaryLanguage" TEXT NOT NULL DEFAULT 'fr',
    "contractSecondaryLanguage" TEXT NOT NULL DEFAULT 'ar',
    "defaultDepositAmount" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "taxRatePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "previousValues" JSONB,
    "newValues" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "cars_licensePlate_idx" ON "cars"("licensePlate");

-- CreateIndex
CREATE INDEX "cars_status_idx" ON "cars"("status");

-- CreateIndex
CREATE INDEX "cars_deletedAt_idx" ON "cars"("deletedAt");

-- CreateIndex
CREATE INDEX "car_images_carId_idx" ON "car_images"("carId");

-- CreateIndex
CREATE INDEX "clients_email_idx" ON "clients"("email");

-- CreateIndex
CREATE INDEX "clients_phone_idx" ON "clients"("phone");

-- CreateIndex
CREATE INDEX "clients_deletedAt_idx" ON "clients"("deletedAt");

-- CreateIndex
CREATE INDEX "client_documents_clientId_idx" ON "client_documents"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "rentals_rentalNumber_key" ON "rentals"("rentalNumber");

-- CreateIndex
CREATE INDEX "rentals_status_idx" ON "rentals"("status");

-- CreateIndex
CREATE INDEX "rentals_carId_pickupDate_plannedReturnDate_idx" ON "rentals"("carId", "pickupDate", "plannedReturnDate");

-- CreateIndex
CREATE INDEX "rentals_clientId_idx" ON "rentals"("clientId");

-- CreateIndex
CREATE INDEX "rentals_deletedAt_idx" ON "rentals"("deletedAt");

-- CreateIndex
CREATE INDEX "rental_extensions_rentalId_idx" ON "rental_extensions"("rentalId");

-- CreateIndex
CREATE INDEX "payments_rentalId_idx" ON "payments"("rentalId");

-- CreateIndex
CREATE INDEX "payments_type_idx" ON "payments"("type");

-- CreateIndex
CREATE INDEX "payments_deletedAt_idx" ON "payments"("deletedAt");

-- CreateIndex
CREATE INDEX "payment_attachments_paymentId_idx" ON "payment_attachments"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "contract_documents_rentalId_key" ON "contract_documents"("rentalId");

-- CreateIndex
CREATE INDEX "expenses_carId_idx" ON "expenses"("carId");

-- CreateIndex
CREATE INDEX "expenses_date_idx" ON "expenses"("date");

-- CreateIndex
CREATE INDEX "expenses_deletedAt_idx" ON "expenses"("deletedAt");

-- CreateIndex
CREATE INDEX "maintenance_records_carId_idx" ON "maintenance_records"("carId");

-- CreateIndex
CREATE INDEX "maintenance_records_deletedAt_idx" ON "maintenance_records"("deletedAt");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_createdAt_idx" ON "audit_logs"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "car_images" ADD CONSTRAINT "car_images_carId_fkey" FOREIGN KEY ("carId") REFERENCES "cars"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_documents" ADD CONSTRAINT "client_documents_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_carId_fkey" FOREIGN KEY ("carId") REFERENCES "cars"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_extensions" ADD CONSTRAINT "rental_extensions_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "rentals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "rentals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_attachments" ADD CONSTRAINT "payment_attachments_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_documents" ADD CONSTRAINT "contract_documents_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "rentals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_carId_fkey" FOREIGN KEY ("carId") REFERENCES "cars"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_carId_fkey" FOREIGN KEY ("carId") REFERENCES "cars"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Partial unique indexes for soft-deleted records (hand-added, see docs/database.md):
-- uniqueness only applies among non-archived rows, so a re-issued license
-- plate/VIN/email doesn't collide with an archived record. Prisma's schema
-- DSL has no syntax for partial indexes, so these are not represented in
-- schema.prisma and must be kept in sync by hand if these columns change.
CREATE UNIQUE INDEX "cars_license_plate_active_key" ON "cars"("licensePlate") WHERE "deletedAt" IS NULL;
CREATE UNIQUE INDEX "cars_vin_active_key" ON "cars"("vin") WHERE "deletedAt" IS NULL AND "vin" IS NOT NULL;
CREATE UNIQUE INDEX "clients_email_active_key" ON "clients"("email") WHERE "deletedAt" IS NULL AND "email" IS NOT NULL;
