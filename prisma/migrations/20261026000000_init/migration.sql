-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `email` VARCHAR(254) NOT NULL,
    `password_hash` VARCHAR(100) NULL,
    `github_id` VARCHAR(40) NULL,
    `avatar_url` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    UNIQUE INDEX `users_github_id_key`(`github_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `projects` (
    `id` VARCHAR(191) NOT NULL,
    `owner_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `description` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `projects_owner_id_created_at_idx`(`owner_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `api_keys` (
    `id` VARCHAR(191) NOT NULL,
    `project_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(60) NOT NULL,
    `prefix` VARCHAR(20) NOT NULL,
    `key_hash` CHAR(64) NOT NULL,
    `last_used_at` DATETIME(3) NULL,
    `revoked_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `api_keys_key_hash_key`(`key_hash`),
    INDEX `api_keys_project_id_idx`(`project_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `targets` (
    `id` VARCHAR(191) NOT NULL,
    `project_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `type` ENUM('HTTP', 'SHOPBOT') NOT NULL,
    `url` VARCHAR(2048) NULL,
    `method` ENUM('GET', 'POST', 'PUT', 'PATCH') NOT NULL DEFAULT 'POST',
    `headers_json` TEXT NULL,
    `body_template` TEXT NULL,
    `response_path` VARCHAR(255) NULL,
    `timeout_ms` INTEGER NOT NULL DEFAULT 15000,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `targets_project_id_idx`(`project_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `test_suites` (
    `id` VARCHAR(191) NOT NULL,
    `project_id` VARCHAR(191) NOT NULL,
    `target_id` VARCHAR(191) NULL,
    `name` VARCHAR(120) NOT NULL,
    `description` VARCHAR(1000) NULL,
    `pass_threshold` DOUBLE NOT NULL DEFAULT 0.9,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `test_suites_project_id_idx`(`project_id`),
    INDEX `test_suites_target_id_idx`(`target_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `test_cases` (
    `id` VARCHAR(191) NOT NULL,
    `suite_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `input` TEXT NOT NULL,
    `checks_json` JSON NOT NULL,
    `tags` JSON NOT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `test_cases_suite_id_position_idx`(`suite_id`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `test_runs` (
    `id` VARCHAR(191) NOT NULL,
    `suite_id` VARCHAR(191) NOT NULL,
    `status` ENUM('QUEUED', 'RUNNING', 'PASSED', 'FAILED', 'ERROR', 'CANCELLED') NOT NULL DEFAULT 'QUEUED',
    `trigger` ENUM('UI', 'CLI', 'API') NOT NULL DEFAULT 'UI',
    `commit_sha` VARCHAR(40) NULL,
    `total` INTEGER NOT NULL DEFAULT 0,
    `passed` INTEGER NOT NULL DEFAULT 0,
    `failed` INTEGER NOT NULL DEFAULT 0,
    `pass_rate` DOUBLE NULL,
    `avg_latency_ms` INTEGER NULL,
    `total_tokens` INTEGER NOT NULL DEFAULT 0,
    `est_cost_usd` DECIMAL(12, 6) NOT NULL DEFAULT 0,
    `started_at` DATETIME(3) NULL,
    `finished_at` DATETIME(3) NULL,
    `error` VARCHAR(1000) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `test_runs_suite_id_created_at_idx`(`suite_id`, `created_at`),
    INDEX `test_runs_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `test_results` (
    `id` VARCHAR(191) NOT NULL,
    `run_id` VARCHAR(191) NOT NULL,
    `test_case_id` VARCHAR(191) NULL,
    `case_name` VARCHAR(120) NOT NULL,
    `status` ENUM('PASSED', 'FAILED', 'ERROR') NOT NULL,
    `output` TEXT NULL,
    `latency_ms` INTEGER NULL,
    `tokens` INTEGER NOT NULL DEFAULT 0,
    `check_results_json` JSON NOT NULL,
    `judge_score` DOUBLE NULL,
    `judge_reason` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `test_results_test_case_id_idx`(`test_case_id`),
    UNIQUE INDEX `test_results_run_id_test_case_id_key`(`run_id`, `test_case_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attacks` (
    `id` VARCHAR(191) NOT NULL,
    `category` ENUM('PROMPT_INJECTION', 'JAILBREAK', 'SYSTEM_PROMPT_LEAK', 'PII_LEAK', 'HARMFUL_CONTENT', 'OFF_TOPIC') NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `prompt` TEXT NOT NULL,
    `detection_json` JSON NOT NULL,
    `severity` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `attacks_name_key`(`name`),
    INDEX `attacks_category_idx`(`category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `redteam_runs` (
    `id` VARCHAR(191) NOT NULL,
    `project_id` VARCHAR(191) NOT NULL,
    `target_id` VARCHAR(191) NULL,
    `status` ENUM('QUEUED', 'RUNNING', 'COMPLETED', 'ERROR', 'CANCELLED') NOT NULL DEFAULT 'QUEUED',
    `total` INTEGER NOT NULL DEFAULT 0,
    `vulnerable` INTEGER NOT NULL DEFAULT 0,
    `risk_score` INTEGER NULL,
    `started_at` DATETIME(3) NULL,
    `finished_at` DATETIME(3) NULL,
    `error` VARCHAR(1000) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `redteam_runs_project_id_created_at_idx`(`project_id`, `created_at`),
    INDEX `redteam_runs_target_id_idx`(`target_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `redteam_findings` (
    `id` VARCHAR(191) NOT NULL,
    `redteam_run_id` VARCHAR(191) NOT NULL,
    `attack_id` VARCHAR(191) NOT NULL,
    `output` TEXT NULL,
    `vulnerable` BOOLEAN NOT NULL,
    `evidence` TEXT NULL,
    `severity` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `redteam_findings_attack_id_idx`(`attack_id`),
    UNIQUE INDEX `redteam_findings_redteam_run_id_attack_id_key`(`redteam_run_id`, `attack_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `traces` (
    `id` VARCHAR(191) NOT NULL,
    `project_id` VARCHAR(191) NOT NULL,
    `external_id` VARCHAR(100) NULL,
    `name` VARCHAR(120) NOT NULL,
    `input` TEXT NULL,
    `output` TEXT NULL,
    `model` VARCHAR(100) NULL,
    `latency_ms` INTEGER NOT NULL,
    `input_tokens` INTEGER NOT NULL DEFAULT 0,
    `output_tokens` INTEGER NOT NULL DEFAULT 0,
    `est_cost_usd` DECIMAL(12, 6) NOT NULL DEFAULT 0,
    `status` ENUM('OK', 'ERROR') NOT NULL DEFAULT 'OK',
    `error` VARCHAR(1000) NULL,
    `metadata_json` JSON NULL,
    `started_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `traces_project_id_started_at_idx`(`project_id`, `started_at`),
    UNIQUE INDEX `traces_project_id_external_id_key`(`project_id`, `external_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `projects` ADD CONSTRAINT `projects_owner_id_fkey` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `api_keys` ADD CONSTRAINT `api_keys_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `targets` ADD CONSTRAINT `targets_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `test_suites` ADD CONSTRAINT `test_suites_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `test_suites` ADD CONSTRAINT `test_suites_target_id_fkey` FOREIGN KEY (`target_id`) REFERENCES `targets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `test_cases` ADD CONSTRAINT `test_cases_suite_id_fkey` FOREIGN KEY (`suite_id`) REFERENCES `test_suites`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `test_runs` ADD CONSTRAINT `test_runs_suite_id_fkey` FOREIGN KEY (`suite_id`) REFERENCES `test_suites`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `test_results` ADD CONSTRAINT `test_results_run_id_fkey` FOREIGN KEY (`run_id`) REFERENCES `test_runs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `test_results` ADD CONSTRAINT `test_results_test_case_id_fkey` FOREIGN KEY (`test_case_id`) REFERENCES `test_cases`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `redteam_runs` ADD CONSTRAINT `redteam_runs_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `redteam_runs` ADD CONSTRAINT `redteam_runs_target_id_fkey` FOREIGN KEY (`target_id`) REFERENCES `targets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `redteam_findings` ADD CONSTRAINT `redteam_findings_redteam_run_id_fkey` FOREIGN KEY (`redteam_run_id`) REFERENCES `redteam_runs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `redteam_findings` ADD CONSTRAINT `redteam_findings_attack_id_fkey` FOREIGN KEY (`attack_id`) REFERENCES `attacks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `traces` ADD CONSTRAINT `traces_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

