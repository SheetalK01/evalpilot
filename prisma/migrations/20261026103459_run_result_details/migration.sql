-- AlterTable
ALTER TABLE `test_results` ADD COLUMN `error` VARCHAR(1000) NULL,
    ADD COLUMN `est_cost_usd` DECIMAL(12, 6) NOT NULL DEFAULT 0,
    ADD COLUMN `position` INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX `test_results_run_id_position_idx` ON `test_results`(`run_id`, `position`);
