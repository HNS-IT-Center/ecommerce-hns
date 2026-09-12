-- AlterTable
ALTER TABLE `customers` ADD COLUMN `email_verified_at` DATETIME(3) NULL,
    ADD COLUMN `password_hash` VARCHAR(255) NULL,
    MODIFY `google_sub` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `customer_verification_tokens` (
    `id` VARCHAR(191) NOT NULL,
    `customer_id` VARCHAR(191) NOT NULL,
    `token_hash` VARCHAR(64) NOT NULL,
    `purpose` VARCHAR(32) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `customer_verification_tokens_token_hash_key`(`token_hash`),
    INDEX `customer_verification_tokens_customer_id_purpose_idx`(`customer_id`, `purpose`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `customers_email_key` ON `customers`(`email`);

-- AddForeignKey
ALTER TABLE `customer_verification_tokens` ADD CONSTRAINT `customer_verification_tokens_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

