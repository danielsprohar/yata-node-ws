-- AlterTable
ALTER TABLE `Projects` ADD COLUMN `view` ENUM('BOARD', 'LIST', 'TABLE') NOT NULL DEFAULT 'LIST';