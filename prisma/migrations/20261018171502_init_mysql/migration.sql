-- CreateTable
CREATE TABLE `Tenant` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `legalName` VARCHAR(191) NOT NULL,
    `bankType` VARCHAR(191) NOT NULL,
    `primaryColor` VARCHAR(191) NOT NULL DEFAULT '#0f5132',
    `accentColor` VARCHAR(191) NOT NULL DEFAULT '#c9a227',
    `logoText` VARCHAR(191) NOT NULL DEFAULT 'IB',
    `tagline` VARCHAR(191) NOT NULL DEFAULT '',
    `shariahBoardRef` VARCHAR(191) NOT NULL DEFAULT '',
    `settings` TEXT NOT NULL DEFAULT '{}',
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Tenant_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrgUnit` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `parentId` VARCHAR(191) NULL,
    `path` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `OrgUnit_tenantId_code_key`(`tenantId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL DEFAULT '',
    `mobile` VARCHAR(191) NOT NULL DEFAULT '',
    `employeeId` VARCHAR(191) NOT NULL DEFAULT '',
    `passwordHash` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL,
    `orgUnitId` VARCHAR(191) NULL,
    `customerId` VARCHAR(191) NULL,
    `approvalLimit` DOUBLE NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `failedLogins` INTEGER NOT NULL DEFAULT 0,
    `lastLoginAt` DATETIME(3) NULL,
    `passwordChangedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `User_tenantId_username_key`(`tenantId`, `username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Session` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `mfaVerified` BOOLEAN NOT NULL DEFAULT false,
    `ip` VARCHAR(191) NOT NULL DEFAULT '',
    `userAgent` TEXT NOT NULL DEFAULT '',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OtpChallenge` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `purpose` VARCHAR(191) NOT NULL,
    `refId` VARCHAR(191) NOT NULL DEFAULT '',
    `codeHash` VARCHAR(191) NOT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `expiresAt` DATETIME(3) NOT NULL,
    `consumedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Customer` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `cif` VARCHAR(191) NOT NULL,
    `legalName` VARCHAR(191) NOT NULL,
    `tradeName` VARCHAR(191) NOT NULL DEFAULT '',
    `legalForm` VARCHAR(191) NOT NULL,
    `ntn` VARCHAR(191) NOT NULL DEFAULT '',
    `strn` VARCHAR(191) NOT NULL DEFAULT '',
    `registrationNo` VARCHAR(191) NOT NULL DEFAULT '',
    `establishedOn` DATETIME(3) NULL,
    `sector` VARCHAR(191) NOT NULL,
    `businessActivity` TEXT NOT NULL DEFAULT '',
    `address` TEXT NOT NULL DEFAULT '',
    `city` VARCHAR(191) NOT NULL DEFAULT '',
    `annualTurnover` DOUBLE NOT NULL,
    `smeCategory` VARCHAR(191) NOT NULL,
    `isStartup` BOOLEAN NOT NULL DEFAULT false,
    `womenLed` BOOLEAN NOT NULL DEFAULT false,
    `riskCategory` VARCHAR(191) NOT NULL DEFAULT 'MEDIUM',
    `kycStatus` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `kycClearedAt` DATETIME(3) NULL,
    `kycClearedById` VARCHAR(191) NULL,
    `kycRemarks` TEXT NOT NULL DEFAULT '',
    `ecibCheckedAt` DATETIME(3) NULL,
    `ecibOverdue` BOOLEAN NOT NULL DEFAULT false,
    `ecibRemarks` TEXT NOT NULL DEFAULT '',
    `relatedParty` BOOLEAN NOT NULL DEFAULT false,
    `otherBankExposure` DOUBLE NOT NULL DEFAULT 0,
    `premisesLat` DOUBLE NULL,
    `premisesLng` DOUBLE NULL,
    `rmId` VARCHAR(191) NOT NULL,
    `orgUnitId` VARCHAR(191) NOT NULL,
    `orgPath` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Customer_tenantId_cif_key`(`tenantId`, `cif`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CustomerPerson` (
    `id` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `cnic` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL,
    `sharePct` DOUBLE NOT NULL DEFAULT 0,
    `isPep` BOOLEAN NOT NULL DEFAULT false,
    `mobile` VARCHAR(191) NOT NULL DEFAULT '',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CustomerDocument` (
    `id` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `docType` VARCHAR(191) NOT NULL,
    `fileId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'UPLOADED',
    `verifiedById` VARCHAR(191) NULL,
    `verifiedAt` DATETIME(3) NULL,
    `remarks` TEXT NOT NULL DEFAULT '',
    `uploadedById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FinancingCase` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `ref` VARCHAR(191) NOT NULL,
    `cptmNo` VARCHAR(191) NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `productCode` VARCHAR(191) NOT NULL,
    `purpose` TEXT NOT NULL,
    `amount` DOUBLE NOT NULL,
    `tenorMonths` INTEGER NOT NULL,
    `profitRate` DOUBLE NOT NULL,
    `benchmark` VARCHAR(191) NOT NULL DEFAULT '6M KIBOR',
    `repayment` VARCHAR(191) NOT NULL DEFAULT 'MONTHLY',
    `securityType` VARCHAR(191) NOT NULL DEFAULT 'SECURED',
    `collateral` TEXT NOT NULL DEFAULT '',
    `liquidLien` DOUBLE NOT NULL DEFAULT 0,
    `structure` TEXT NOT NULL DEFAULT '{}',
    `ecibJustification` TEXT NOT NULL DEFAULT '',
    `stage` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `classification` VARCHAR(191) NOT NULL DEFAULT 'REGULAR',
    `daysPastDue` INTEGER NOT NULL DEFAULT 0,
    `rmId` VARCHAR(191) NOT NULL,
    `orgUnitId` VARCHAR(191) NOT NULL,
    `orgPath` VARCHAR(191) NOT NULL,
    `submittedAt` DATETIME(3) NULL,
    `tatDueAt` DATETIME(3) NULL,
    `sanctionedAt` DATETIME(3) NULL,
    `offeredAt` DATETIME(3) NULL,
    `acceptedAt` DATETIME(3) NULL,
    `activatedAt` DATETIME(3) NULL,
    `closedAt` DATETIME(3) NULL,
    `shariahReviewStatus` VARCHAR(191) NOT NULL DEFAULT 'NOT_DUE',
    `shariahReviewedById` VARCHAR(191) NULL,
    `shariahReviewedAt` DATETIME(3) NULL,
    `shariahReviewComments` TEXT NOT NULL DEFAULT '',
    `shariahReviewChecklist` TEXT NOT NULL DEFAULT '{}',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `FinancingCase_tenantId_ref_key`(`tenantId`, `ref`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Clearance` (
    `id` VARCHAR(191) NOT NULL,
    `caseId` VARCHAR(191) NOT NULL,
    `track` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `checklist` TEXT NOT NULL DEFAULT '{}',
    `riskRating` VARCHAR(191) NOT NULL DEFAULT '',
    `comments` TEXT NOT NULL DEFAULT '',
    `decidedById` VARCHAR(191) NULL,
    `decidedAt` DATETIME(3) NULL,
    `round` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Clearance_caseId_track_key`(`caseId`, `track`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Approval` (
    `id` VARCHAR(191) NOT NULL,
    `caseId` VARCHAR(191) NOT NULL,
    `level` INTEGER NOT NULL,
    `role` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `limit` DOUBLE NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `decidedById` VARCHAR(191) NULL,
    `decidedAt` DATETIME(3) NULL,
    `comments` TEXT NOT NULL DEFAULT '',
    `round` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CaseComment` (
    `id` VARCHAR(191) NOT NULL,
    `caseId` VARCHAR(191) NOT NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `internal` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Template` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL,
    `body` MEDIUMTEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `shariahRef` VARCHAR(191) NOT NULL DEFAULT '',
    `shariahApprovedBy` VARCHAR(191) NULL,
    `shariahApprovedAt` DATETIME(3) NULL,
    `legalRef` VARCHAR(191) NOT NULL DEFAULT '',
    `legalApprovedBy` VARCHAR(191) NULL,
    `legalApprovedAt` DATETIME(3) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Template_tenantId_code_version_key`(`tenantId`, `code`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Document` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `caseId` VARCHAR(191) NOT NULL,
    `templateId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `content` MEDIUMTEXT NOT NULL,
    `contentHash` VARCHAR(191) NOT NULL,
    `signerPlan` TEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ISSUED',
    `stepKey` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `executedAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Signature` (
    `id` VARCHAR(191) NOT NULL,
    `documentId` VARCHAR(191) NOT NULL,
    `slot` INTEGER NOT NULL,
    `party` VARCHAR(191) NOT NULL,
    `capacity` VARCHAR(191) NOT NULL,
    `signerId` VARCHAR(191) NOT NULL,
    `signerName` VARCHAR(191) NOT NULL,
    `signerRole` VARCHAR(191) NOT NULL,
    `method` VARCHAR(191) NOT NULL,
    `decision` VARCHAR(191) NOT NULL,
    `reason` TEXT NOT NULL DEFAULT '',
    `docHash` VARCHAR(191) NOT NULL,
    `seal` VARCHAR(191) NOT NULL,
    `ip` VARCHAR(191) NOT NULL DEFAULT '',
    `userAgent` TEXT NOT NULL DEFAULT '',
    `lat` DOUBLE NULL,
    `lng` DOUBLE NULL,
    `accuracy` DOUBLE NULL,
    `signedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ExecutionStep` (
    `id` VARCHAR(191) NOT NULL,
    `caseId` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `seq` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'LOCKED',
    `config` TEXT NOT NULL DEFAULT '{}',
    `completedById` VARCHAR(191) NULL,
    `completedAt` DATETIME(3) NULL,
    `outcome` TEXT NOT NULL DEFAULT '{}',

    UNIQUE INDEX `ExecutionStep_caseId_key_key`(`caseId`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Evidence` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `caseId` VARCHAR(191) NOT NULL,
    `stepKey` VARCHAR(191) NULL,
    `category` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL DEFAULT '',
    `assetRef` VARCHAR(191) NOT NULL DEFAULT '',
    `fileId` VARCHAR(191) NOT NULL,
    `stampedFileId` VARCHAR(191) NULL,
    `lat` DOUBLE NULL,
    `lng` DOUBLE NULL,
    `accuracy` DOUBLE NULL,
    `locationNote` TEXT NOT NULL DEFAULT '',
    `serverTime` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `clientTime` VARCHAR(191) NOT NULL DEFAULT '',
    `device` TEXT NOT NULL DEFAULT '{}',
    `ip` VARCHAR(191) NOT NULL DEFAULT '',
    `capturedById` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'SUBMITTED',
    `verifiedById` VARCHAR(191) NULL,
    `verifiedAt` DATETIME(3) NULL,
    `verifyRemarks` TEXT NOT NULL DEFAULT '',

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StoredFile` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `sha256` VARCHAR(191) NOT NULL,
    `size` INTEGER NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `originalName` VARCHAR(255) NOT NULL,
    `storageKey` VARCHAR(191) NOT NULL,
    `iv` VARCHAR(191) NOT NULL,
    `authTag` VARCHAR(191) NOT NULL,
    `uploadedById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Installment` (
    `id` VARCHAR(191) NOT NULL,
    `caseId` VARCHAR(191) NOT NULL,
    `seq` INTEGER NOT NULL,
    `dueDate` DATETIME(3) NOT NULL,
    `principal` DOUBLE NOT NULL,
    `profit` DOUBLE NOT NULL,
    `total` DOUBLE NOT NULL,
    `units` DOUBLE NOT NULL DEFAULT 0,
    `bankShare` DOUBLE NOT NULL DEFAULT 0,
    `paidAmount` DOUBLE NOT NULL DEFAULT 0,
    `paidAt` DATETIME(3) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'DUE',

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditEvent` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `seq` INTEGER NOT NULL,
    `eventType` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `summary` TEXT NOT NULL,
    `caseId` VARCHAR(191) NULL,
    `customerId` VARCHAR(191) NULL,
    `entityType` VARCHAR(191) NOT NULL DEFAULT '',
    `entityId` VARCHAR(191) NOT NULL DEFAULT '',
    `actorId` VARCHAR(191) NULL,
    `actorName` VARCHAR(191) NOT NULL DEFAULT 'system',
    `actorRole` VARCHAR(191) NOT NULL DEFAULT 'SYSTEM',
    `before` MEDIUMTEXT NOT NULL DEFAULT '',
    `after` MEDIUMTEXT NOT NULL DEFAULT '',
    `docHash` VARCHAR(191) NOT NULL DEFAULT '',
    `ip` VARCHAR(191) NOT NULL DEFAULT '',
    `userAgent` TEXT NOT NULL DEFAULT '',
    `lat` DOUBLE NULL,
    `lng` DOUBLE NULL,
    `accuracy` DOUBLE NULL,
    `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `prevHash` VARCHAR(191) NOT NULL,
    `hash` VARCHAR(191) NOT NULL,

    INDEX `AuditEvent_tenantId_caseId_idx`(`tenantId`, `caseId`),
    UNIQUE INDEX `AuditEvent_tenantId_seq_key`(`tenantId`, `seq`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL DEFAULT '',
    `link` VARCHAR(191) NOT NULL DEFAULT '',
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `OrgUnit` ADD CONSTRAINT `OrgUnit_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrgUnit` ADD CONSTRAINT `OrgUnit_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `OrgUnit`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_orgUnitId_fkey` FOREIGN KEY (`orgUnitId`) REFERENCES `OrgUnit`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Customer` ADD CONSTRAINT `Customer_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Customer` ADD CONSTRAINT `Customer_rmId_fkey` FOREIGN KEY (`rmId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerPerson` ADD CONSTRAINT `CustomerPerson_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerDocument` ADD CONSTRAINT `CustomerDocument_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerDocument` ADD CONSTRAINT `CustomerDocument_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `StoredFile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FinancingCase` ADD CONSTRAINT `FinancingCase_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FinancingCase` ADD CONSTRAINT `FinancingCase_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FinancingCase` ADD CONSTRAINT `FinancingCase_rmId_fkey` FOREIGN KEY (`rmId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Clearance` ADD CONSTRAINT `Clearance_caseId_fkey` FOREIGN KEY (`caseId`) REFERENCES `FinancingCase`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Approval` ADD CONSTRAINT `Approval_caseId_fkey` FOREIGN KEY (`caseId`) REFERENCES `FinancingCase`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CaseComment` ADD CONSTRAINT `CaseComment_caseId_fkey` FOREIGN KEY (`caseId`) REFERENCES `FinancingCase`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Template` ADD CONSTRAINT `Template_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Document` ADD CONSTRAINT `Document_caseId_fkey` FOREIGN KEY (`caseId`) REFERENCES `FinancingCase`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Document` ADD CONSTRAINT `Document_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `Template`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Signature` ADD CONSTRAINT `Signature_documentId_fkey` FOREIGN KEY (`documentId`) REFERENCES `Document`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExecutionStep` ADD CONSTRAINT `ExecutionStep_caseId_fkey` FOREIGN KEY (`caseId`) REFERENCES `FinancingCase`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Evidence` ADD CONSTRAINT `Evidence_caseId_fkey` FOREIGN KEY (`caseId`) REFERENCES `FinancingCase`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Evidence` ADD CONSTRAINT `Evidence_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `StoredFile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Evidence` ADD CONSTRAINT `Evidence_stampedFileId_fkey` FOREIGN KEY (`stampedFileId`) REFERENCES `StoredFile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StoredFile` ADD CONSTRAINT `StoredFile_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Installment` ADD CONSTRAINT `Installment_caseId_fkey` FOREIGN KEY (`caseId`) REFERENCES `FinancingCase`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditEvent` ADD CONSTRAINT `AuditEvent_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
