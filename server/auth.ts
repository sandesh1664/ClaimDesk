type Role = 'customer' | 'officer' | 'support' | 'admin';
type Account = { role: Role; email: string; name: string; home: string };
type Statement = { bind(...values: unknown[]): Statement; first<T>(): Promise<T|null>; run(): Promise<unknown> };
type Database = { prepare(query: string): Statement; batch(statements: Statement[]): Promise<unknown> };
const accounts: Record<Role,Account> = {
  customer: {role:'customer',email:'client@claimdesk.test',name:'Aisha Al Mansoori',home:'/client'},
  officer: {role:'officer',email:'officer@claimdesk.test',name:'Nadia Khalid',home:'/operations'},
  support: {role:'support',email:'support@claimdesk.test',name:'Faris Rahman',home:'/service-desk'},
  admin: {role:'admin',email:'admin@claimdesk.test',name:'Mariam Saeed',home:'/admin'}
};
const DEMO_CODE = 'ClaimsDemo2026!';
const SESSION_SECONDS = 28800;
function randomToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(24)),b=>b.toString(16).padStart(2,'0')).join('');
}
async function tokenHash(value: string): Promise<string> {
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}
function readCookie(request: Request, name: string): string|undefined {
  return request.headers.get('Cookie')?.match(new RegExp('(?:^|;\\s*)'+name+'=([a-f0-9]{48})(?:;|$)'))?.[1];
}
function authCookie(request: Request, name: string, token: string, age: number): string {
  return name+'='+token+'; Path=/; HttpOnly; SameSite=Strict; Max-Age='+age+(new URL(request.url).protocol==='https:'?'; Secure':'');
}
function demoAccount(email: unknown, code: unknown): Account|undefined {
  if(typeof email!=='string'||code!==DEMO_CODE) return undefined;
  return Object.values(accounts).find(a=>a.email===email.trim().toLowerCase());
}
async function sessionFor(db: Database, request: Request, sandbox: string|undefined): Promise<Account|undefined> {
  const token=readCookie(request,'claimdesk_auth');
  if(!token||!sandbox) return undefined;
  const row=await db.prepare('SELECT role FROM portal_sessions WHERE token_hash=? AND sandbox_id=? AND expires_at>?').bind(await tokenHash(token),sandbox,Date.now()).first<{role:Role}>();
  return row&&Object.hasOwn(accounts,row.role)?accounts[row.role]:undefined;
}
async function startSession(db: Database, request: Request, sandbox: string, role: Role): Promise<string> {
  const token=randomToken(), previous=readCookie(request,'claimdesk_auth');
  const statements=[
    db.prepare('DELETE FROM portal_sessions WHERE expires_at<=?').bind(Date.now()),
    db.prepare('INSERT INTO portal_sessions(token_hash,sandbox_id,role,expires_at) VALUES(?,?,?,?)').bind(await tokenHash(token),sandbox,role,Date.now()+SESSION_SECONDS*1000)
  ];
  if(previous) statements.unshift(db.prepare('DELETE FROM portal_sessions WHERE token_hash=? AND sandbox_id=?').bind(await tokenHash(previous),sandbox));
  await db.batch(statements);
  return authCookie(request,'claimdesk_auth',token,SESSION_SECONDS);
}
async function endSession(db: Database, request: Request, sandbox: string|undefined): Promise<string> {
  const token=readCookie(request,'claimdesk_auth');
  if(token&&sandbox) await db.prepare('DELETE FROM portal_sessions WHERE token_hash=? AND sandbox_id=?').bind(await tokenHash(token),sandbox).run();
  return authCookie(request,'claimdesk_auth','',0);
}
