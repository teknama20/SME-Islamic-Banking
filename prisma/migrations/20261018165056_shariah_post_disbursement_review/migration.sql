-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FinancingCase" (
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
    "shariahReviewStatus" TEXT NOT NULL DEFAULT 'NOT_DUE',
    "shariahReviewedById" TEXT,
    "shariahReviewedAt" DATETIME,
    "shariahReviewComments" TEXT NOT NULL DEFAULT '',
    "shariahReviewChecklist" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FinancingCase_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FinancingCase_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FinancingCase_rmId_fkey" FOREIGN KEY ("rmId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_FinancingCase" ("acceptedAt", "activatedAt", "amount", "benchmark", "classification", "closedAt", "collateral", "cptmNo", "createdAt", "customerId", "daysPastDue", "ecibJustification", "id", "liquidLien", "offeredAt", "orgPath", "orgUnitId", "productCode", "profitRate", "purpose", "ref", "repayment", "rmId", "sanctionedAt", "securityType", "stage", "structure", "submittedAt", "tatDueAt", "tenantId", "tenorMonths", "updatedAt") SELECT "acceptedAt", "activatedAt", "amount", "benchmark", "classification", "closedAt", "collateral", "cptmNo", "createdAt", "customerId", "daysPastDue", "ecibJustification", "id", "liquidLien", "offeredAt", "orgPath", "orgUnitId", "productCode", "profitRate", "purpose", "ref", "repayment", "rmId", "sanctionedAt", "securityType", "stage", "structure", "submittedAt", "tatDueAt", "tenantId", "tenorMonths", "updatedAt" FROM "FinancingCase";
DROP TABLE "FinancingCase";
ALTER TABLE "new_FinancingCase" RENAME TO "FinancingCase";
CREATE UNIQUE INDEX "FinancingCase_tenantId_ref_key" ON "FinancingCase"("tenantId", "ref");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
