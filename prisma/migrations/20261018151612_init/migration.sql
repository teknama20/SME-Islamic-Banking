-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "bankType" TEXT NOT NULL,
    "primaryColor" TEXT NOT NULL DEFAULT '#0f5132',
    "accentColor" TEXT NOT NULL DEFAULT '#c9a227',
    "logoText" TEXT NOT NULL DEFAULT 'IB',
    "tagline" TEXT NOT NULL DEFAULT '',
    "shariahBoardRef" TEXT NOT NULL DEFAULT '',
    "settings" TEXT NOT NULL DEFAULT '{}',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "OrgUnit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "path" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrgUnit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OrgUnit_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "OrgUnit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL DEFAULT '',
    "mobile" TEXT NOT NULL DEFAULT '',
    "employeeId" TEXT NOT NULL DEFAULT '',
    "passwordHash" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "orgUnitId" TEXT,
    "customerId" TEXT,
    "approvalLimit" REAL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "failedLogins" INTEGER NOT NULL DEFAULT 0,
    "lastLoginAt" DATETIME,
    "passwordChangedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "User_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "mfaVerified" BOOLEAN NOT NULL DEFAULT false,
    "ip" TEXT NOT NULL DEFAULT '',
    "userAgent" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OtpChallenge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "refId" TEXT NOT NULL DEFAULT '',
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" DATETIME NOT NULL,
    "consumedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "cif" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "tradeName" TEXT NOT NULL DEFAULT '',
    "legalForm" TEXT NOT NULL,
    "ntn" TEXT NOT NULL DEFAULT '',
    "strn" TEXT NOT NULL DEFAULT '',
    "registrationNo" TEXT NOT NULL DEFAULT '',
    "establishedOn" DATETIME,
    "sector" TEXT NOT NULL,
    "businessActivity" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "annualTurnover" REAL NOT NULL,
    "smeCategory" TEXT NOT NULL,
    "isStartup" BOOLEAN NOT NULL DEFAULT false,
    "womenLed" BOOLEAN NOT NULL DEFAULT false,
    "riskCategory" TEXT NOT NULL DEFAULT 'MEDIUM',
    "kycStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "kycClearedAt" DATETIME,
    "kycClearedById" TEXT,
    "kycRemarks" TEXT NOT NULL DEFAULT '',
    "ecibCheckedAt" DATETIME,
    "ecibOverdue" BOOLEAN NOT NULL DEFAULT false,
    "ecibRemarks" TEXT NOT NULL DEFAULT '',
    "relatedParty" BOOLEAN NOT NULL DEFAULT false,
    "otherBankExposure" REAL NOT NULL DEFAULT 0,
    "premisesLat" REAL,
    "premisesLng" REAL,
    "rmId" TEXT NOT NULL,
    "orgUnitId" TEXT NOT NULL,
    "orgPath" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Customer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Customer_rmId_fkey" FOREIGN KEY ("rmId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CustomerPerson" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "cnic" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "sharePct" REAL NOT NULL DEFAULT 0,
    "isPep" BOOLEAN NOT NULL DEFAULT false,
    "mobile" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerPerson_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CustomerDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UPLOADED',
    "verifiedById" TEXT,
    "verifiedAt" DATETIME,
    "remarks" TEXT NOT NULL DEFAULT '',
    "uploadedById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerDocument_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CustomerDocument_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "StoredFile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FinancingCase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "cptmNo" TEXT,
    "customerId" TEXT NOT NULL,
    "productCode" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "tenorMonths" INTEGER NOT NULL,
    "profitRate" REAL NOT NULL,
    "benchmark" TEXT NOT NULL DEFAULT '6M KIBOR',
    "repayment" TEXT NOT NULL DEFAULT 'MONTHLY',
    "securityType" TEXT NOT NULL DEFAULT 'SECURED',
    "collateral" TEXT NOT NULL DEFAULT '',
    "liquidLien" REAL NOT NULL DEFAULT 0,
    "structure" TEXT NOT NULL DEFAULT '{}',
    "ecibJustification" TEXT NOT NULL DEFAULT '',
    "stage" TEXT NOT NULL DEFAULT 'DRAFT',
    "classification" TEXT NOT NULL DEFAULT 'REGULAR',
    "daysPastDue" INTEGER NOT NULL DEFAULT 0,
    "rmId" TEXT NOT NULL,
    "orgUnitId" TEXT NOT NULL,
    "orgPath" TEXT NOT NULL,
    "submittedAt" DATETIME,
    "tatDueAt" DATETIME,
    "sanctionedAt" DATETIME,
    "offeredAt" DATETIME,
    "acceptedAt" DATETIME,
    "activatedAt" DATETIME,
    "closedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FinancingCase_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FinancingCase_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FinancingCase_rmId_fkey" FOREIGN KEY ("rmId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Clearance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "track" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "checklist" TEXT NOT NULL DEFAULT '{}',
    "riskRating" TEXT NOT NULL DEFAULT '',
    "comments" TEXT NOT NULL DEFAULT '',
    "decidedById" TEXT,
    "decidedAt" DATETIME,
    "round" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Clearance_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "FinancingCase" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "limit" REAL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decidedAt" DATETIME,
    "comments" TEXT NOT NULL DEFAULT '',
    "round" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Approval_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "FinancingCase" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CaseComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "internal" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CaseComment_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "FinancingCase" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "shariahRef" TEXT NOT NULL DEFAULT '',
    "shariahApprovedBy" TEXT,
    "shariahApprovedAt" DATETIME,
    "legalRef" TEXT NOT NULL DEFAULT '',
    "legalApprovedBy" TEXT,
    "legalApprovedAt" DATETIME,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Template_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "content" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "signerPlan" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ISSUED',
    "stepKey" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executedAt" DATETIME,
    CONSTRAINT "Document_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "FinancingCase" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Document_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Signature" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "party" TEXT NOT NULL,
    "capacity" TEXT NOT NULL,
    "signerId" TEXT NOT NULL,
    "signerName" TEXT NOT NULL,
    "signerRole" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "docHash" TEXT NOT NULL,
    "seal" TEXT NOT NULL,
    "ip" TEXT NOT NULL DEFAULT '',
    "userAgent" TEXT NOT NULL DEFAULT '',
    "lat" REAL,
    "lng" REAL,
    "accuracy" REAL,
    "signedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Signature_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExecutionStep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'LOCKED',
    "config" TEXT NOT NULL DEFAULT '{}',
    "completedById" TEXT,
    "completedAt" DATETIME,
    "outcome" TEXT NOT NULL DEFAULT '{}',
    CONSTRAINT "ExecutionStep_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "FinancingCase" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "stepKey" TEXT,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "assetRef" TEXT NOT NULL DEFAULT '',
    "fileId" TEXT NOT NULL,
    "stampedFileId" TEXT,
    "lat" REAL,
    "lng" REAL,
    "accuracy" REAL,
    "locationNote" TEXT NOT NULL DEFAULT '',
    "serverTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientTime" TEXT NOT NULL DEFAULT '',
    "device" TEXT NOT NULL DEFAULT '{}',
    "ip" TEXT NOT NULL DEFAULT '',
    "capturedById" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "verifiedById" TEXT,
    "verifiedAt" DATETIME,
    "verifyRemarks" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "Evidence_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "FinancingCase" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Evidence_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "StoredFile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Evidence_stampedFileId_fkey" FOREIGN KEY ("stampedFileId") REFERENCES "StoredFile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StoredFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "authTag" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StoredFile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Installment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "principal" REAL NOT NULL,
    "profit" REAL NOT NULL,
    "total" REAL NOT NULL,
    "units" REAL NOT NULL DEFAULT 0,
    "bankShare" REAL NOT NULL DEFAULT 0,
    "paidAmount" REAL NOT NULL DEFAULT 0,
    "paidAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'DUE',
    CONSTRAINT "Installment_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "FinancingCase" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "caseId" TEXT,
    "customerId" TEXT,
    "entityType" TEXT NOT NULL DEFAULT '',
    "entityId" TEXT NOT NULL DEFAULT '',
    "actorId" TEXT,
    "actorName" TEXT NOT NULL DEFAULT 'system',
    "actorRole" TEXT NOT NULL DEFAULT 'SYSTEM',
    "before" TEXT NOT NULL DEFAULT '',
    "after" TEXT NOT NULL DEFAULT '',
    "docHash" TEXT NOT NULL DEFAULT '',
    "ip" TEXT NOT NULL DEFAULT '',
    "userAgent" TEXT NOT NULL DEFAULT '',
    "lat" REAL,
    "lng" REAL,
    "accuracy" REAL,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "prevHash" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    CONSTRAINT "AuditEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "link" TEXT NOT NULL DEFAULT '',
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_code_key" ON "Tenant"("code");

-- CreateIndex
CREATE UNIQUE INDEX "OrgUnit_tenantId_code_key" ON "OrgUnit"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_username_key" ON "User"("tenantId", "username");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_tenantId_cif_key" ON "Customer"("tenantId", "cif");

-- CreateIndex
CREATE UNIQUE INDEX "FinancingCase_tenantId_ref_key" ON "FinancingCase"("tenantId", "ref");

-- CreateIndex
CREATE UNIQUE INDEX "Clearance_caseId_track_key" ON "Clearance"("caseId", "track");

-- CreateIndex
CREATE UNIQUE INDEX "Template_tenantId_code_version_key" ON "Template"("tenantId", "code", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ExecutionStep_caseId_key_key" ON "ExecutionStep"("caseId", "key");

-- CreateIndex
CREATE INDEX "AuditEvent_tenantId_caseId_idx" ON "AuditEvent"("tenantId", "caseId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditEvent_tenantId_seq_key" ON "AuditEvent"("tenantId", "seq");

-- ---------------------------------------------------------------------------
-- Tamper-evidence: the audit trail and signatures are append-only.
-- (PostgreSQL equivalent: BEFORE UPDATE OR DELETE trigger raising an
--  exception, plus REVOKE UPDATE, DELETE from the application role.)
-- ---------------------------------------------------------------------------
CREATE TRIGGER "AuditEvent_no_update" BEFORE UPDATE ON "AuditEvent"
BEGIN SELECT RAISE(ABORT, 'AuditEvent is append-only'); END;

CREATE TRIGGER "AuditEvent_no_delete" BEFORE DELETE ON "AuditEvent"
BEGIN SELECT RAISE(ABORT, 'AuditEvent is append-only'); END;

CREATE TRIGGER "Signature_no_update" BEFORE UPDATE ON "Signature"
BEGIN SELECT RAISE(ABORT, 'Signature is append-only'); END;

CREATE TRIGGER "Signature_no_delete" BEFORE DELETE ON "Signature"
BEGIN SELECT RAISE(ABORT, 'Signature is append-only'); END;

-- Executed documents are frozen: their text and hash can never change.
CREATE TRIGGER "Document_freeze_content" BEFORE UPDATE OF "content", "contentHash" ON "Document"
BEGIN SELECT RAISE(ABORT, 'Document content is immutable'); END;
