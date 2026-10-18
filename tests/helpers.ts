import { db } from "../src/lib/db";
import { actorOf } from "../src/lib/demo/autopilot";
import { IBP_ORGS, IBP_USERS, seedCustomer, seedTenant } from "../src/lib/demo/seed";

const M = 1_000_000;
let cached: Awaited<ReturnType<typeof build>> | null = null;

async function build() {
  const code = `T${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  const t = await seedTenant(
    db,
    { code, name: "Test Islamic Bank", legalName: "Test Islamic Bank Ltd", bankType: "ISLAMIC", primaryColor: "#0b5d3b", accentColor: "#c8a24a", logoText: "TIB", tagline: "", shariahBoardRef: "SB/TEST/1" },
    IBP_ORGS,
    IBP_USERS,
  );
  const customer = await seedCustomer(db, t.tenant.id, t.userIds["rm.ali"], {
    legalName: "Test Textiles (Pvt) Ltd",
    legalForm: "PRIVATE_LIMITED",
    ntn: "1234567-8",
    sector: "Textiles & apparel",
    city: "Lahore",
    address: "1 Test Road",
    annualTurnover: 350 * M,
    establishedOn: new Date("2015-01-01"),
    kycCleared: true,
    people: [{ fullName: "Test Owner", cnic: "35202-1111111-1", role: "DIRECTOR", sharePct: 100 }],
    users: [
      { username: `${code.toLowerCase()}.ceo`, fullName: "Test Owner", role: "CUSTOMER_SIGNATORY" },
      { username: `${code.toLowerCase()}.guar`, fullName: "Test Guarantor", role: "GUARANTOR" },
      { username: `${code.toLowerCase()}.acct`, fullName: "Test Accountant", role: "CUSTOMER_USER" },
    ],
  });
  return { ...t, customer, code };
}

export async function fixture() {
  cached ??= await build();
  return cached;
}

export async function actor(username: string) {
  const f = await fixture();
  const u = await db.user.findFirstOrThrow({ where: { tenantId: f.tenant.id, OR: [{ username }, { username: `${f.code.toLowerCase()}.${username}` }] }, include: { orgUnit: true } });
  return actorOf(u);
}

export const future = (days: number) => new Date(Date.now() + days * 86400_000).toISOString().slice(0, 10);
