-- CreateTable
CREATE TABLE `attribute_values` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `attribute_id` INTEGER NOT NULL,
    `value` VARCHAR(191) NOT NULL,

    INDEX `attribute_values_attribute_id_idx`(`attribute_id` ASC),
    UNIQUE INDEX `attribute_values_attribute_id_value_key`(`attribute_id` ASC, `value` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attributes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `attributes_name_key`(`name` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `brands` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `brands_slug_key`(`slug` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `path` VARCHAR(500) NOT NULL,
    `depth` INTEGER NOT NULL DEFAULT 1,
    `parent_id` INTEGER NULL,

    INDEX `categories_depth_idx`(`depth` ASC),
    INDEX `categories_parent_id_idx`(`parent_id` ASC),
    UNIQUE INDEX `categories_path_key`(`path` ASC),
    UNIQUE INDEX `categories_slug_key`(`slug` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `faq_items` (
    `id` VARCHAR(191) NOT NULL,
    `question` TEXT NOT NULL,
    `answer` TEXT NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `deleted_at` DATETIME(3) NULL,
    `deleted_by` VARCHAR(191) NULL,

    INDEX `faq_items_deleted_at_idx`(`deleted_at` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `import_quarantine` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `row_number` INTEGER NOT NULL,
    `woo_id` VARCHAR(50) NULL,
    `issues` VARCHAR(500) NOT NULL,
    `raw_data` MEDIUMTEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pc_build_quotes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(32) NOT NULL,
    `content_hash` VARCHAR(64) NOT NULL,
    `items` LONGTEXT NOT NULL,
    `subtotal` DECIMAL(14, 2) NOT NULL,
    `assembly_fee` DECIMAL(14, 2) NOT NULL,
    `total` DECIMAL(14, 2) NOT NULL,
    `item_count` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `pc_build_quotes_code_key`(`code` ASC),
    UNIQUE INDEX `pc_build_quotes_content_hash_key`(`content_hash` ASC),
    INDEX `pc_build_quotes_created_at_idx`(`created_at` ASC),
    INDEX `pc_build_quotes_updated_at_idx`(`updated_at` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `policy_pages` (
    `slug` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`slug` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_attributes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `product_id` INTEGER NOT NULL,
    `attribute_id` INTEGER NOT NULL,
    `value_id` INTEGER NOT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,

    INDEX `product_attributes_attribute_id_idx`(`attribute_id` ASC),
    UNIQUE INDEX `product_attributes_product_id_attribute_id_value_id_key`(`product_id` ASC, `attribute_id` ASC, `value_id` ASC),
    INDEX `product_attributes_product_id_idx`(`product_id` ASC),
    INDEX `product_attributes_value_id_idx`(`value_id` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_categories` (
    `product_id` INTEGER NOT NULL,
    `category_id` INTEGER NOT NULL,
    `is_primary` BOOLEAN NOT NULL DEFAULT false,

    INDEX `product_categories_category_id_idx`(`category_id` ASC),
    PRIMARY KEY (`product_id` ASC, `category_id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_images` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `product_id` INTEGER NOT NULL,
    `url` VARCHAR(1000) NOT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `is_primary` BOOLEAN NOT NULL DEFAULT false,

    INDEX `product_images_product_id_position_idx`(`product_id` ASC, `position` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userName` VARCHAR(191) NOT NULL,
    `product_id` INTEGER NOT NULL,
    `product_name` VARCHAR(500) NOT NULL,
    `action` VARCHAR(100) NOT NULL,
    `field_affected` VARCHAR(100) NOT NULL,
    `old_value` TEXT NULL,
    `new_value` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `product_logs_created_at_idx`(`created_at` ASC),
    INDEX `product_logs_product_id_idx`(`product_id` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_tags` (
    `product_id` INTEGER NOT NULL,
    `tag_id` INTEGER NOT NULL,

    INDEX `product_tags_tag_id_idx`(`tag_id` ASC),
    PRIMARY KEY (`product_id` ASC, `tag_id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `products` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `woo_id` INTEGER NOT NULL,
    `type` ENUM('SIMPLE', 'VARIABLE', 'VARIATION', 'GROUPED', 'EXTERNAL') NOT NULL,
    `status` ENUM('PUBLISHED', 'DRAFT', 'PRIVATE') NOT NULL DEFAULT 'DRAFT',
    `visibility` ENUM('VISIBLE', 'CATALOG', 'SEARCH', 'HIDDEN') NOT NULL DEFAULT 'VISIBLE',
    `sku` VARCHAR(100) NULL,
    `gtin` VARCHAR(50) NULL,
    `name` VARCHAR(500) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `short_description` TEXT NULL,
    `description` MEDIUMTEXT NULL,
    `regular_price` DECIMAL(14, 2) NULL,
    `sale_price` DECIMAL(14, 2) NULL,
    `stock_status` ENUM('INSTOCK', 'OUTOFSTOCK', 'ONBACKORDER') NULL,
    `stock_qty` INTEGER NULL,
    `backorders_allowed` BOOLEAN NULL,
    `sold_individually` BOOLEAN NULL,
    `reviews_allowed` BOOLEAN NULL,
    `featured` BOOLEAN NOT NULL DEFAULT false,
    `view_count` INTEGER NOT NULL DEFAULT 0,
    `parent_id` INTEGER NULL,
    `brand_id` INTEGER NULL,
    `import_notes` TEXT NULL,
    `imported_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `video_url` VARCHAR(1000) NULL,
    `sale_end_date` DATETIME(3) NULL,

    INDEX `products_brand_id_idx`(`brand_id` ASC),
    FULLTEXT INDEX `products_name_idx`(`name`),
    INDEX `products_parent_id_idx`(`parent_id` ASC),
    INDEX `products_regular_price_idx`(`regular_price` ASC),
    UNIQUE INDEX `products_sku_key`(`sku` ASC),
    UNIQUE INDEX `products_slug_key`(`slug` ASC),
    INDEX `products_status_idx`(`status` ASC),
    INDEX `products_status_type_idx`(`status` ASC, `type` ASC),
    INDEX `products_type_idx`(`type` ASC),
    UNIQUE INDEX `products_woo_id_key`(`woo_id` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `promo_banners` (
    `id` VARCHAR(191) NOT NULL,
    `tag` VARCHAR(100) NULL,
    `title` VARCHAR(255) NOT NULL,
    `subtitle` VARCHAR(500) NULL,
    `cta_label` VARCHAR(100) NULL,
    `cta_href` VARCHAR(1000) NULL,
    `image_url` VARCHAR(1000) NULL,
    `bg_class` VARCHAR(100) NOT NULL DEFAULT 'bg-primary',
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `starts_at` DATETIME(3) NULL,
    `ends_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `display_mode` ENUM('IMAGE_ONLY', 'IMAGE_TEXT') NOT NULL DEFAULT 'IMAGE_TEXT',

    INDEX `promo_banners_is_active_sort_order_idx`(`is_active` ASC, `sort_order` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `settings` (
    `key` VARCHAR(100) NOT NULL,
    `value` LONGTEXT NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `store_hours` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `store_id` VARCHAR(191) NOT NULL,
    `day_of_week` TINYINT NOT NULL,
    `is_closed` BOOLEAN NOT NULL DEFAULT false,
    `opens_at` VARCHAR(5) NOT NULL,
    `closes_at` VARCHAR(5) NOT NULL,

    UNIQUE INDEX `store_hours_store_id_day_of_week_key`(`store_id` ASC, `day_of_week` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stores` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `address` TEXT NOT NULL,
    `maps_url` VARCHAR(191) NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `deleted_at` DATETIME(3) NULL,
    `deleted_by` VARCHAR(191) NULL,
    `google_place_id` VARCHAR(191) NULL,
    `latitude` DECIMAL(12, 9) NULL,
    `longitude` DECIMAL(12, 9) NULL,
    `phone` VARCHAR(191) NOT NULL DEFAULT '',

    INDEX `stores_deleted_at_idx`(`deleted_at` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tags` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `tags_slug_key`(`slug` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `image` VARCHAR(1000) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `password_changed_at` DATETIME(3) NULL,
    `username` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email` ASC),
    UNIQUE INDEX `users_username_key`(`username` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `attribute_values` ADD CONSTRAINT `attribute_values_attribute_id_fkey` FOREIGN KEY (`attribute_id`) REFERENCES `attributes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `categories` ADD CONSTRAINT `categories_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `categories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_attributes` ADD CONSTRAINT `product_attributes_attribute_id_fkey` FOREIGN KEY (`attribute_id`) REFERENCES `attributes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_attributes` ADD CONSTRAINT `product_attributes_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_attributes` ADD CONSTRAINT `product_attributes_value_id_fkey` FOREIGN KEY (`value_id`) REFERENCES `attribute_values`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_categories` ADD CONSTRAINT `product_categories_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_categories` ADD CONSTRAINT `product_categories_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_images` ADD CONSTRAINT `product_images_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_tags` ADD CONSTRAINT `product_tags_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_tags` ADD CONSTRAINT `product_tags_tag_id_fkey` FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_brand_id_fkey` FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `products`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `store_hours` ADD CONSTRAINT `store_hours_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

