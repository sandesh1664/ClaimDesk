import { apply, seed, WorkflowError, isClientClaim } from './domain.js';
import { accounts, demoAccount, readCookie, authCookie, sessionFor, startSession, endSession, randomToken } from './auth.ts';
import { serviceTarget } from './policy.ts';
import { assets } from './assets.js';

const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','X-Frame-Options':'DENY'};
const json=(body,status=200,extra={})=>Response.json(body,{status,headers:{...headers,...extra}});
const schema=row=>JSON.parse(row.payload);
const canRead=(role,c)=>role==='customer'?isClientClaim(c):role==='support'?Boolean(c.referral):true;
const project=(state,role)=>state.claims.filter(c=>canRead(role,c)).map(c=>{
  if(role==='support') return {id:c.id,product:c.product||'motor',status:c.status,city:c.city,referral:c.referral,timeline:c.timeline.filter(e=>e.title.startsWith('Garage referral')||e.title==='Repair referral recovered')};
  const {clientOwned,requestKey,...claim}=c;
  claim.product=c.product||'motor';
  if(role!=='customer') claim.service=serviceTarget(c);
  claim.documents=c.documents.map(({base64,...meta})=>meta);
  if(role==='customer'){
    delete claim.referral;
    delete claim.requiresAssessment;
    if(c.assessment) claim.assessment={garage:c.assessment.garage};
    delete claim.priority;
    delete claim.owner;
    claim.timeline=c.timeline.filter(e=>e.visibility!=='staff'&&!['Garage referral timed out','Queue assignment changed','Priority changed'].includes(e.title))
      .map(({actor,visibility,...e})=>({...e,detail:e.title==='Repair referral recovered'?'Your claim has been referred for repair.':e.detail}));
  }
  return claim;
});
const routes=/^\/(?:login|client(?:\/(?:claims|new))?|operations(?:\/queue)?|service-desk(?:\/dispatches)?|admin(?:\/(?:audit|assignments|reporting))?)?\/?$/;
function csvCell(value){
  const text=String(value??'');
  const safe=/^[\s\u0000-\u001f]*[=+@-]|^[\t\r\n]/.test(text)?"'"+text:text;
  return '"'+safe.replace(/"/g,'""')+'"';
}
async function readRequestBody(request,max){
  const reader=request.body?.getReader();
  if(!reader) return '';
  const decoder=new TextDecoder('utf-8',{fatal:true});
  let total=0,body='';
  try{
    for(;;){
      const {value,done}=await reader.read();
      if(done) return body+decoder.decode();
      total+=value.byteLength;
      if(total>max){
        await reader.cancel();
        throw new WorkflowError('Request is too large.',413);
      }
      body+=decoder.decode(value,{stream:true});
    }
  }catch(error){
    if(error instanceof WorkflowError) throw error;
    throw new WorkflowError('Invalid request body.');
  }finally{reader.releaseLock();}
}
function cookieHeaders(values){
  const out=new Headers(headers);
  for(const value of values) out.append('Set-Cookie',value);
  return out;
}

export default {async fetch(request,env){
  const url=new URL(request.url);
  const asset=Object.hasOwn(assets,url.pathname)?assets[url.pathname]:routes.test(url.pathname)?assets['/']:null;
  if(asset&&request.method==='GET'){
    const body=asset.base64?Uint8Array.from(atob(asset.body),c=>c.charCodeAt(0)):asset.body;
    return new Response(body,{headers:{...headers,'Content-Type':asset.type,'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"}});
  }
  if(!url.pathname.startsWith('/api/')) return new Response('Not found',{status:404});
  if(!env.DB) return json({error:'Demo storage is unavailable.'},503);
  if(request.method==='GET'&&url.pathname==='/api/health'){
    try{
      await env.DB.prepare('SELECT 1 AS ready FROM portal_sessions LIMIT 1').bind().first();
      return json({status:'ready'});
    }catch{
      return json({status:'unavailable'},503);
    }
  }
  try{
    let sandbox=readCookie(request,'claimdesk');
    const read=id=>env.DB.prepare('SELECT revision,payload FROM demo_sessions WHERE id=?').bind(id).first();
    let row=sandbox?await read(sandbox):null;
    const account=row?await sessionFor(env.DB,request,sandbox):undefined;
    let data;
    if(request.method==='POST'){
      if(request.headers.get('Origin')!==url.origin || !request.headers.get('Content-Type')?.startsWith('application/json')) return json({error:'Invalid request origin or format.'},403);
      if(Number(request.headers.get('Content-Length'))>180000) return json({error:'Request is too large.'},413);
      const raw=await readRequestBody(request,180000);
      if(raw.length>180000) return json({error:'Request is too large.'},413);
      try{data=JSON.parse(raw);}catch{return json({error:'Invalid JSON.'},400);}
      if(!data||typeof data!=='object'||Array.isArray(data)) return json({error:'Invalid request.'},400);
    }
    if(request.method==='GET'&&url.pathname==='/api/session') return json({account:account??null});
    if(request.method==='POST'&&url.pathname==='/api/login'){
      const next=demoAccount(data.email,data.code);
      if(!next) return json({error:'Use one of the sample accounts and its demo access code.'},401);
      const cookies=[];
      if(!row){
        sandbox=randomToken();
        const state=seed();
        await env.DB.prepare('INSERT INTO demo_sessions(id,payload) VALUES (?,?)').bind(sandbox,JSON.stringify(state)).run();
        cookies.push(authCookie(request,'claimdesk',sandbox,604800));
      }
      cookies.push(await startSession(env.DB,request,sandbox,next.role));
      const responseHeaders=cookieHeaders(cookies);
      return Response.json({account:next},{headers:responseHeaders});
    }
    if(request.method==='POST'&&url.pathname==='/api/logout'){
      return Response.json({account:null},{headers:cookieHeaders([await endSession(env.DB,request,sandbox)])});
    }
    if(!account) return json({error:'Sign in to open this workspace.'},401);
    const role=account.role;
    if(request.method==='GET'&&url.pathname==='/api/claims'){
      return json({claims:project(schema(row),role),team:role==='admin'?Object.values(accounts):undefined});
    }
    if(request.method==='GET'&&url.pathname==='/api/audit.csv'){
      if(role!=='admin') return json({error:'This export is available to administrators only.'},403);
      const rows=schema(row).claims.flatMap(c=>c.timeline.map(e=>[e.at,c.id,e.actor,e.title,e.detail,e.visibility||'client']));
      rows.sort((a,b)=>b[0].localeCompare(a[0]));
      const csv=[['Time UTC','Claim','Actor','Event','Detail','Visibility'],...rows].map(record=>record.map(csvCell).join(',')).join('\r\n')+'\r\n';
      return new Response(csv,{headers:{...headers,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="claimdesk-audit.csv"'}});
    }
    if(request.method==='GET'&&url.pathname==='/api/document'){
      if(role==='support') return json({error:'Document not found.'},404);
      const claim=schema(row).claims.find(c=>c.id===url.searchParams.get('claim')&&canRead(role,c));
      const file=claim?.documents.find(d=>d.id===url.searchParams.get('id'));
      if(!file) return json({error:'Document not found.'},404);
      return new Response(Uint8Array.from(atob(file.base64),c=>c.charCodeAt(0)),{headers:{...headers,'Content-Type':'application/octet-stream','Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(file.name)}});
    }
    if(request.method!=='POST'||url.pathname!=='/api/action') return json({error:'Endpoint not found.'},404);
    if(data.action==='reset'&&role!=='admin') return json({error:'Only administrators can reset this demo.'},403);
    for(let attempt=0;attempt<5;attempt++){
      const state=data.action==='reset'?seed():schema(row);
      const id=data.action==='reset'?state.claims[0].id:apply(state,role,data.action,data);
      const payload=JSON.stringify(state);
      if(new TextEncoder().encode(payload).byteLength>1600000) throw new WorkflowError('This demo workspace has reached its storage limit.',409);
      const result=await env.DB.prepare('UPDATE demo_sessions SET payload=?,revision=revision+1 WHERE id=? AND revision=?').bind(payload,sandbox,row.revision).run();
      if(result.meta.changes===1) return json({id,claims:project(state,role)});
      row=await read(sandbox);
    }
    return json({error:'Another change is in progress. Try again.'},409);
  }catch(error){
    if(error instanceof WorkflowError) return json({error:error.message},error.status);
    console.error(error.message);
    return json({error:'The workspace could not complete your request.'},500);
  }
}};
