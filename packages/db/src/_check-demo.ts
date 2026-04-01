import postgres from "postgres";
const sql = postgres("postgres://paperclip:paperclip@127.0.0.1:54329/paperclip", { max: 1 });

const users = await sql`SELECT id, name, email FROM "user" WHERE email = 'demo@aygencyworld.com'`;
console.log("User:", JSON.stringify(users));

if (users.length > 0) {
  const memberships = await sql`SELECT company_id, principal_type, principal_id, status, membership_role FROM company_memberships WHERE principal_id = ${users[0]!.id}`;
  console.log("Memberships:", JSON.stringify(memberships));
}

const companies = await sql`SELECT id, name, issue_prefix FROM companies WHERE issue_prefix = 'DPP'`;
console.log("Company:", JSON.stringify(companies));

await sql.end();
