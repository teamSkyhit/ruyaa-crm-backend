/*
  Warnings:

  - A unique constraint covering the columns `[sku]` on the table `products` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `hsnCode` to the `categories` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sku` to the `products` table without a default value. This is not possible if the table is not empty.
  - Added the required column `finalAmount` to the `sales` table without a default value. This is not possible if the table is not empty.
  - Added the required column `storeId` to the `sales` table without a default value. This is not possible if the table is not empty.
  - Added the required column `subtotal` to the `sales` table without a default value. This is not possible if the table is not empty.
  - Added the required column `taxableAmount` to the `sales` table without a default value. This is not possible if the table is not empty.
  - Added the required column `unitPrice` to the `sales` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ModelType" AS ENUM ('PLAIN', 'DESIGN', 'TWO_D', 'THREE_D');

-- CreateEnum
CREATE TYPE "PackType" AS ENUM ('PACK', 'LOOSE');

-- CreateEnum
CREATE TYPE "GST_RATE" AS ENUM ('ZERO', 'FIVE', 'TWELVE', 'EIGHTEEN');

-- CreateEnum
CREATE TYPE "StockTransferStatus" AS ENUM ('PENDING', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ShiftStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'UPI', 'CARD', 'WALLET');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'HANDED_OFF', 'PENDING_PAYMENT', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('LOW_STOCK', 'ORDER_EXPIRY', 'PAYMENT_RECEIVED', 'SHIFT_REMINDER', 'SYNC_COMPLETE', 'SYNC_FAILED', 'PRINTER_ERROR', 'NETWORK_OFFLINE', 'SYSTEM_UPDATE');

-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('PENDING', 'PROCESSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReturnReason" AS ENUM ('DEFECTIVE', 'WRONG_ITEM', 'CUSTOMER_REQUEST', 'OTHER');

-- AlterTable
ALTER TABLE "activity_logs" ADD COLUMN     "storeId" UUID;

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "gstInclusive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "gstRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "hsnCode" TEXT NOT NULL,
ADD COLUMN     "minStockLevel" INTEGER NOT NULL DEFAULT 5;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "allowNegativeStock" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "minStockLevel" INTEGER,
ADD COLUMN     "modelType" VARCHAR(500),
ADD COLUMN     "packType" VARCHAR(500),
ADD COLUMN     "salePrice" DECIMAL(10,2),
ADD COLUMN     "sku" VARCHAR(20) NOT NULL,
ALTER COLUMN "image" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "cgstAmount" DECIMAL(10,2),
ADD COLUMN     "consolidatedReceiptNumber" VARCHAR(50),
ADD COLUMN     "counterId" UUID,
ADD COLUMN     "customerEmail" VARCHAR(255),
ADD COLUMN     "customerName" VARCHAR(200),
ADD COLUMN     "customerPhone" VARCHAR(20),
ADD COLUMN     "discountAmount" DECIMAL(10,2),
ADD COLUMN     "discountPercent" DECIMAL(5,2),
ADD COLUMN     "expiresAt" TIMESTAMPTZ(6),
ADD COLUMN     "finalAmount" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "floorOrderRef" VARCHAR(50),
ADD COLUMN     "gstAmount" DECIMAL(10,2),
ADD COLUMN     "gstRate" DECIMAL(5,2),
ADD COLUMN     "handedOffAt" TIMESTAMPTZ(6),
ADD COLUMN     "igstAmount" DECIMAL(10,2),
ADD COLUMN     "mergedIntoReceipt" VARCHAR(50),
ADD COLUMN     "orderStatus" "OrderStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "saleNumber" VARCHAR(50),
ADD COLUMN     "sgstAmount" DECIMAL(10,2),
ADD COLUMN     "shiftId" UUID,
ADD COLUMN     "storeId" UUID NOT NULL,
ADD COLUMN     "subtotal" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "taxableAmount" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "unitPrice" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "withoutGst" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "storeId" UUID;

-- CreateTable
CREATE TABLE "product_attributes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "productId" UUID NOT NULL,
    "size" VARCHAR(100),
    "weight" DECIMAL(10,3),
    "price" DECIMAL(10,2),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "product_attributes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stores" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(50),
    "gstin" VARCHAR(15),
    "address" TEXT,
    "city" VARCHAR(100),
    "state" VARCHAR(100),
    "pincode" VARCHAR(10),
    "contact" VARCHAR(50),
    "email" VARCHAR(255),
    "website" VARCHAR(255),
    "logoUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "counters" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "storeId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_product_inventory" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "minStockLevel" INTEGER,
    "reservedQty" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "store_product_inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transfers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "transferNumber" VARCHAR(20) NOT NULL,
    "fromStoreId" UUID NOT NULL,
    "toStoreId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "StockTransferStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "requestedById" UUID,
    "approvedById" UUID,
    "shippedById" UUID,
    "receivedById" UUID,
    "requestedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMPTZ(6),
    "shippedAt" TIMESTAMPTZ(6),
    "receivedAt" TIMESTAMPTZ(6),
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "stock_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "shiftNumber" VARCHAR(20) NOT NULL,
    "counterId" UUID NOT NULL,
    "openedById" UUID NOT NULL,
    "closedById" UUID,
    "status" "ShiftStatus" NOT NULL DEFAULT 'OPEN',
    "openingBalance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "closingBalance" DECIMAL(10,2),
    "expectedBalance" DECIMAL(10,2),
    "actualBalance" DECIMAL(10,2),
    "difference" DECIMAL(10,2),
    "notes" TEXT,
    "openedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMPTZ(6),
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "saleId" UUID NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "transactionId" VARCHAR(100),
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "returns" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "returnNumber" VARCHAR(50) NOT NULL,
    "originalSaleId" UUID NOT NULL,
    "saleId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" "ReturnReason" NOT NULL,
    "reasonDetails" TEXT,
    "status" "ReturnStatus" NOT NULL DEFAULT 'PENDING',
    "isExchange" BOOLEAN NOT NULL DEFAULT false,
    "exchangeProductId" UUID,
    "exchangeQuantity" INTEGER,
    "differenceAmount" DECIMAL(10,2),
    "originalAmount" DECIMAL(10,2) NOT NULL,
    "returnAmount" DECIMAL(10,2) NOT NULL,
    "processedById" UUID,
    "processedAt" TIMESTAMPTZ(6),
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storeId" UUID NOT NULL,
    "receiptHeader" TEXT,
    "receiptFooter" TEXT,
    "receiptShowLogo" BOOLEAN NOT NULL DEFAULT true,
    "receiptShowGstin" BOOLEAN NOT NULL DEFAULT true,
    "receiptShowAddress" BOOLEAN NOT NULL DEFAULT true,
    "receiptShowPhone" BOOLEAN NOT NULL DEFAULT true,
    "defaultPrinterType" TEXT NOT NULL DEFAULT 'thermal',
    "thermalPaperWidth" INTEGER NOT NULL DEFAULT 80,
    "printerName" VARCHAR(100),
    "printerPort" VARCHAR(50),
    "printerConnection" VARCHAR(20),
    "autoPrintReceipt" BOOLEAN NOT NULL DEFAULT true,
    "printAfterPayment" BOOLEAN NOT NULL DEFAULT true,
    "currencySymbol" TEXT NOT NULL DEFAULT '₹',
    "currencyCode" TEXT NOT NULL DEFAULT 'INR',
    "dateFormat" TEXT NOT NULL DEFAULT 'DD-MM-YYYY',
    "timeFormat" TEXT NOT NULL DEFAULT '12h',
    "numberFormat" TEXT NOT NULL DEFAULT 'indian',
    "language" TEXT NOT NULL DEFAULT 'en',
    "orderExpiryHoursDraft" INTEGER NOT NULL DEFAULT 2,
    "orderExpiryHoursHandedOff" INTEGER NOT NULL DEFAULT 4,
    "autoCancelExpiredOrders" BOOLEAN NOT NULL DEFAULT true,
    "defaultGstRate" DECIMAL(5,2),
    "gstInclusive" BOOLEAN NOT NULL DEFAULT true,
    "showTaxBreakdown" BOOLEAN NOT NULL DEFAULT true,
    "maxDiscountPercent" DECIMAL(5,2),
    "allowManualDiscount" BOOLEAN NOT NULL DEFAULT true,
    "roundOffEnabled" BOOLEAN NOT NULL DEFAULT false,
    "roundOffMethod" VARCHAR(20),
    "allowNegativeStock" BOOLEAN NOT NULL DEFAULT true,
    "reserveStockOnHandoff" BOOLEAN NOT NULL DEFAULT true,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 10,
    "enableLowStockAlert" BOOLEAN NOT NULL DEFAULT true,
    "enableOrderExpiryAlert" BOOLEAN NOT NULL DEFAULT true,
    "autoSyncInterval" INTEGER NOT NULL DEFAULT 5,
    "enableOfflineMode" BOOLEAN NOT NULL DEFAULT true,
    "maxOfflineHours" INTEGER NOT NULL DEFAULT 24,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "store_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "counter_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "counterId" UUID NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'light',
    "fontSize" TEXT NOT NULL DEFAULT 'medium',
    "showProductImages" BOOLEAN NOT NULL DEFAULT true,
    "itemsPerPage" INTEGER NOT NULL DEFAULT 20,
    "enableSounds" BOOLEAN NOT NULL DEFAULT true,
    "soundOnSale" BOOLEAN NOT NULL DEFAULT true,
    "soundOnPayment" BOOLEAN NOT NULL DEFAULT true,
    "soundOnError" BOOLEAN NOT NULL DEFAULT true,
    "printerName" VARCHAR(100),
    "printerPort" VARCHAR(50),
    "autoPrintReceipt" BOOLEAN NOT NULL DEFAULT true,
    "requireShiftOpen" BOOLEAN NOT NULL DEFAULT true,
    "autoCloseShift" BOOLEAN NOT NULL DEFAULT false,
    "showStockWarning" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "counter_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "deviceId" VARCHAR(100) NOT NULL,
    "counterId" UUID,
    "deviceName" VARCHAR(100),
    "deviceType" VARCHAR(50),
    "osVersion" VARCHAR(50),
    "appVersion" VARCHAR(20),
    "apiBaseUrl" VARCHAR(255),
    "connectionType" VARCHAR(20),
    "lastSyncAt" TIMESTAMPTZ(6),
    "cacheProducts" BOOLEAN NOT NULL DEFAULT true,
    "cacheExpiryHours" INTEGER NOT NULL DEFAULT 24,
    "lastCacheUpdate" TIMESTAMPTZ(6),
    "printerConnected" BOOLEAN NOT NULL DEFAULT false,
    "printerLastTest" TIMESTAMPTZ(6),
    "printerStatus" VARCHAR(50),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "device_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" "NotificationType" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "message" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "storeId" UUID,
    "counterId" UUID,
    "userId" UUID,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isDismissed" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMPTZ(6),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_attributes_productId_idx" ON "product_attributes"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "stores_name_key" ON "stores"("name");

-- CreateIndex
CREATE UNIQUE INDEX "stores_code_key" ON "stores"("code");

-- CreateIndex
CREATE INDEX "stores_name_idx" ON "stores"("name");

-- CreateIndex
CREATE INDEX "stores_code_idx" ON "stores"("code");

-- CreateIndex
CREATE INDEX "stores_isActive_idx" ON "stores"("isActive");

-- CreateIndex
CREATE INDEX "counters_storeId_idx" ON "counters"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "counters_name_storeId_key" ON "counters"("name", "storeId");

-- CreateIndex
CREATE INDEX "store_product_inventory_storeId_idx" ON "store_product_inventory"("storeId");

-- CreateIndex
CREATE INDEX "store_product_inventory_productId_idx" ON "store_product_inventory"("productId");

-- CreateIndex
CREATE INDEX "store_product_inventory_quantity_idx" ON "store_product_inventory"("quantity");

-- CreateIndex
CREATE UNIQUE INDEX "store_product_inventory_storeId_productId_key" ON "store_product_inventory"("storeId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "stock_transfers_transferNumber_key" ON "stock_transfers"("transferNumber");

-- CreateIndex
CREATE INDEX "stock_transfers_fromStoreId_idx" ON "stock_transfers"("fromStoreId");

-- CreateIndex
CREATE INDEX "stock_transfers_toStoreId_idx" ON "stock_transfers"("toStoreId");

-- CreateIndex
CREATE INDEX "stock_transfers_productId_idx" ON "stock_transfers"("productId");

-- CreateIndex
CREATE INDEX "stock_transfers_status_idx" ON "stock_transfers"("status");

-- CreateIndex
CREATE INDEX "stock_transfers_transferNumber_idx" ON "stock_transfers"("transferNumber");

-- CreateIndex
CREATE UNIQUE INDEX "shifts_shiftNumber_key" ON "shifts"("shiftNumber");

-- CreateIndex
CREATE INDEX "shifts_counterId_idx" ON "shifts"("counterId");

-- CreateIndex
CREATE INDEX "shifts_openedById_idx" ON "shifts"("openedById");

-- CreateIndex
CREATE INDEX "shifts_closedById_idx" ON "shifts"("closedById");

-- CreateIndex
CREATE INDEX "shifts_status_idx" ON "shifts"("status");

-- CreateIndex
CREATE INDEX "shifts_shiftNumber_idx" ON "shifts"("shiftNumber");

-- CreateIndex
CREATE INDEX "shifts_openedAt_idx" ON "shifts"("openedAt");

-- CreateIndex
CREATE INDEX "payments_saleId_idx" ON "payments"("saleId");

-- CreateIndex
CREATE INDEX "payments_method_idx" ON "payments"("method");

-- CreateIndex
CREATE INDEX "payments_createdAt_idx" ON "payments"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "returns_returnNumber_key" ON "returns"("returnNumber");

-- CreateIndex
CREATE INDEX "returns_originalSaleId_idx" ON "returns"("originalSaleId");

-- CreateIndex
CREATE INDEX "returns_saleId_idx" ON "returns"("saleId");

-- CreateIndex
CREATE INDEX "returns_productId_idx" ON "returns"("productId");

-- CreateIndex
CREATE INDEX "returns_returnNumber_idx" ON "returns"("returnNumber");

-- CreateIndex
CREATE INDEX "returns_status_idx" ON "returns"("status");

-- CreateIndex
CREATE INDEX "returns_processedAt_idx" ON "returns"("processedAt");

-- CreateIndex
CREATE UNIQUE INDEX "store_settings_storeId_key" ON "store_settings"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "counter_settings_counterId_key" ON "counter_settings"("counterId");

-- CreateIndex
CREATE UNIQUE INDEX "device_settings_deviceId_key" ON "device_settings"("deviceId");

-- CreateIndex
CREATE INDEX "device_settings_deviceId_idx" ON "device_settings"("deviceId");

-- CreateIndex
CREATE INDEX "device_settings_counterId_idx" ON "device_settings"("counterId");

-- CreateIndex
CREATE INDEX "notifications_storeId_idx" ON "notifications"("storeId");

-- CreateIndex
CREATE INDEX "notifications_counterId_idx" ON "notifications"("counterId");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex
CREATE INDEX "notifications_isRead_idx" ON "notifications"("isRead");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt");

-- CreateIndex
CREATE INDEX "activity_logs_storeId_idx" ON "activity_logs"("storeId");

-- CreateIndex
CREATE INDEX "categories_hsnCode_idx" ON "categories"("hsnCode");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE INDEX "products_sku_idx" ON "products"("sku");

-- CreateIndex
CREATE INDEX "sales_storeId_idx" ON "sales"("storeId");

-- CreateIndex
CREATE INDEX "sales_counterId_idx" ON "sales"("counterId");

-- CreateIndex
CREATE INDEX "sales_shiftId_idx" ON "sales"("shiftId");

-- CreateIndex
CREATE INDEX "sales_saleNumber_idx" ON "sales"("saleNumber");

-- CreateIndex
CREATE INDEX "sales_orderStatus_idx" ON "sales"("orderStatus");

-- CreateIndex
CREATE INDEX "sales_floorOrderRef_idx" ON "sales"("floorOrderRef");

-- CreateIndex
CREATE INDEX "sales_customerPhone_idx" ON "sales"("customerPhone");

-- CreateIndex
CREATE INDEX "sales_consolidatedReceiptNumber_idx" ON "sales"("consolidatedReceiptNumber");

-- CreateIndex
CREATE INDEX "sales_expiresAt_idx" ON "sales"("expiresAt");

-- CreateIndex
CREATE INDEX "users_storeId_idx" ON "users"("storeId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_counterId_fkey" FOREIGN KEY ("counterId") REFERENCES "counters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_attributes" ADD CONSTRAINT "product_attributes_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counters" ADD CONSTRAINT "counters_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_product_inventory" ADD CONSTRAINT "store_product_inventory_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_product_inventory" ADD CONSTRAINT "store_product_inventory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_fromStoreId_fkey" FOREIGN KEY ("fromStoreId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_toStoreId_fkey" FOREIGN KEY ("toStoreId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_shippedById_fkey" FOREIGN KEY ("shippedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_counterId_fkey" FOREIGN KEY ("counterId") REFERENCES "counters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "returns" ADD CONSTRAINT "returns_originalSaleId_fkey" FOREIGN KEY ("originalSaleId") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "returns" ADD CONSTRAINT "returns_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "returns" ADD CONSTRAINT "returns_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "returns" ADD CONSTRAINT "returns_exchangeProductId_fkey" FOREIGN KEY ("exchangeProductId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "returns" ADD CONSTRAINT "returns_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_settings" ADD CONSTRAINT "store_settings_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counter_settings" ADD CONSTRAINT "counter_settings_counterId_fkey" FOREIGN KEY ("counterId") REFERENCES "counters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_settings" ADD CONSTRAINT "device_settings_counterId_fkey" FOREIGN KEY ("counterId") REFERENCES "counters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_counterId_fkey" FOREIGN KEY ("counterId") REFERENCES "counters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
