-- AlterTable
ALTER TABLE `customers` ADD COLUMN `phone_number` VARCHAR(20) NULL,
    ADD COLUMN `username` VARCHAR(32) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `customers_username_key` ON `customers`(`username`);

