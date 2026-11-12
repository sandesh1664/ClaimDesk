import assert from 'node:assert/strict';
import test from 'node:test';
import {localDatabase} from './sqlite.mjs';
import './build.mjs';
const {default: worker}=await import('../dist/server/index.js');
const DB=await localDatabase();
const origin='https://claimdesk.test';
function request(path,cookie,body,siteOrigin=origin){
  return worker.fetch(new Request(origin+path,{method:body?'POST':'GET',headers:{...(cookie?{Cookie:cookie}:{}),...(body?{Origin:siteOrigin,'Content-Type':'application/json'}:{})},body:body&&JSON.stringify(body)}),{DB});
}
async function login(role,cookie=''){
  const result=await request('/api/login',cookie,{email:role+'@claimdesk.test',code:'ClaimsDemo2026!'});
  assert.equal(result.status,200);
  const map=new Map(cookie.split('; ').filter(Boolean).map(c=>c.split('=')));
  for(const entry of result.headers.getSetCookie()) map.set(...entry.split(';')[0].split('='));
  return [...map].map(([name,value])=>name+'='+value).join('; ');
}
async function claims(cookie){return (await (await request('/api/claims',cookie)).json()).claims;}
const act=(cookie,action,id,fields={})=>request('/api/action',cookie,{action,id,...fields});

test('role is derived from the session and direct document access follows ownership',async()=>{
  assert.equal((await request('/api/claims')).status,401);
  assert.equal((await request('/api/login','',{email:'admin@claimdesk.test',code:'wrong'})).status,401);
  assert.equal((await request('/api/login','',{email:'admin@claimdesk.test',code:'ClaimsDemo2026!'},'https://example.test')).status,403);
  const customer=await login('client');
  assert.deepEqual((await claims(customer)).filter(c=>c.product==='motor').map(c=>c.id),['MC-1048']);
  assert.equal(new Set((await claims(customer)).map(c=>c.product)).size,11);
  assert.equal((await act(customer,'assign','MC-1048',{role:'admin',owner:'Faris Rahman'})).status,403);
  assert.equal((await act(customer,'upload','MC-1047',{})).status,404);
  assert.equal((await request('/api/document?claim=MC-1047&id=demo-report',customer)).status,404);
  const staff=await login('officer',customer);
  assert.equal((await request('/api/claims',customer)).status,401);
  assert.equal((await claims(staff)).length,18);
  await request('/api/logout',staff,{});
  assert.equal((await request('/api/claims',staff)).status,401);
});
test('cross-portal handoff, admin assignment, uploads and independent sandboxes',async()=>{
  let cookie=await login('client');
  const created=await act(cookie,'create',null,{policy:'MTR-DEMO-1048',vehicle:'Honda Civic',city:'Ajman',type:'Parking damage',incident:'2025-01-01',description:'Vehicle damaged while parked.'});
  assert.equal(created.status,200);
  const {id}=await created.json();
  cookie=await login('officer',cookie);
  assert.equal((await act(cookie,'request',id,{note:'Attach a sample police report.'})).status,200);
  cookie=await login('client',cookie);
  assert.equal((await claims(cookie)).find(c=>c.id===id).status,'Awaiting documents');
  const uploaded=await act(cookie,'upload',id,{category:'Police or Saaed report',name:'sample.txt',type:'text/plain',base64:btoa('Fictional report')});
  const doc=(await uploaded.json()).claims.find(c=>c.id===id).documents[0];
  assert.equal(doc.base64,undefined);
  assert.equal(await (await request('/api/document?claim='+id+'&id='+doc.id,cookie)).text(),'Fictional report');
  assert.equal((await request('/api/document?claim='+id+'&id='+doc.id,await login('client'))).status,404);
  cookie=await login('admin',cookie);
  assert.equal((await act(cookie,'assign',id,{owner:'Faris Rahman'})).status,200);
  assert.equal((await act(cookie,'priority',id,{priority:'Urgent'})).status,200);
  const claim=(await claims(cookie)).find(c=>c.id===id);
  assert.equal(claim.owner,'Faris Rahman');
  assert.equal(claim.priority,'Urgent');
  assert.ok(claim.timeline.some(e=>e.actor==='Mariam Saeed'&&e.title==='Queue assignment changed'));
  assert.equal((await (await act(cookie,'reset')).json()).claims.length,18);
});
test('dispatch retry is safe under concurrent submissions and preserves the audit trail',async()=>{
  let cookie=await login('officer');
  const id='MC-1048';
  const failed=(await (await act(cookie,'refer',id)).json()).claims.find(c=>c.id===id);
  assert.equal(failed.referral.status,'Failed');
  assert.equal((await act(cookie,'retry',id)).status,403);
  assert.equal((await act(cookie,'request',id,{note:'A second document.'})).status,409);
  cookie=await login('support',cookie);
  assert.equal((await claims(cookie)).find(c=>c.id===id).name,undefined);
  assert.equal((await request('/api/document?claim=MC-1048&id=demo-report',cookie)).status,404);
  const results=await Promise.all([act(cookie,'retry',id),act(cookie,'retry',id)]);
  assert.deepEqual(results.map(r=>r.status),[200,200]);
  const recovered=(await claims(cookie)).find(c=>c.id===id);
  assert.equal(recovered.referral.reference,'GR-1048');
  assert.equal(recovered.referral.attempts,2);
  assert.equal(recovered.timeline.filter(e=>e.title==='Repair referral recovered').length,1);
  cookie=await login('client',cookie);
  const visible=(await claims(cookie)).find(c=>c.id===id);
  assert.equal(visible.status,'Repair referred');
  assert.equal(visible.referral,undefined);
  assert.ok(!visible.timeline.some(e=>e.title==='Garage referral timed out'));
});

test('assessment gate, evidence review, protected correspondence and safe audit export',async()=>{
  assert.equal((await request('/api/health')).status,200);
  let cookie=await login('client');
  const form={policy:'MTR-DEMO-1048',vehicle:'Toyota Camry',city:'Abu Dhabi',type:'Parking damage',incident:'2025-01-01',description:'Vehicle damage was observed while parked.',requestKey:crypto.randomUUID()};
  const submissions=await Promise.all([act(cookie,'create',null,form),act(cookie,'create',null,form)]);
  const created=await Promise.all(submissions.map(r=>r.json()));
  const {id}=created[0];
  assert.equal(created[1].id,id);
  assert.equal((await claims(cookie)).filter(c=>c.product==='motor').length,2);
  assert.equal((await act(cookie,'create',null,{...form,vehicle:'Different car'})).status,409);
  const evidence={category:'Police or Saaed report',name:'report.txt',base64:btoa('Sample evidence.')};
  assert.equal((await act(cookie,'upload',id,{...evidence,type:'application/pdf'})).status,400);
  const doc=(await (await act(cookie,'upload',id,{...evidence,type:'text/plain'})).json()).claims.find(c=>c.id===id).documents[0];
  cookie=await login('officer',cookie);
  assert.equal((await act(cookie,'review',id)).status,200);
  assert.equal((await act(cookie,'refer',id)).status,409);
  assert.equal((await act(cookie,'document-review',id,{documentId:doc.id,decision:'Replacement needed',note:''})).status,400);
  assert.equal((await act(cookie,'document-review',id,{documentId:doc.id,decision:'Accepted',note:'Reviewed.'})).status,200);
  assert.equal((await act(cookie,'assess',id,{estimate:'2750.50',excess:'500.25',garage:'Capital Motor Works',note:'Internal repair estimate.'})).status,200);
  assert.equal((await act(cookie,'note',id,{message:'Internal exception handling.'})).status,200);
  assert.equal((await act(cookie,'message',id,{message:'=Sample public update'})).status,200);
  assert.equal((await act(cookie,'refer',id)).status,200);
  assert.equal((await request('/api/audit.csv',cookie)).status,403);
  cookie=await login('client',cookie);
  const clientClaim=(await claims(cookie)).find(c=>c.id===id);
  assert.equal(clientClaim.documents[0].review,'Accepted');
  assert.equal(clientClaim.assessment.estimateFils,undefined);
  assert.equal(clientClaim.service,undefined);
  assert.ok(!clientClaim.timeline.some(e=>e.title==='Internal note'));
  assert.ok(clientClaim.timeline.some(e=>e.title==='Message from claims team'));
  cookie=await login('admin',cookie);
  const staffClaim=(await claims(cookie)).find(c=>c.id===id);
  assert.equal(staffClaim.assessment.estimateFils,275050);
  assert.equal(staffClaim.service.state,'Met');
  const exportResponse=await request('/api/audit.csv',cookie);
  assert.equal(exportResponse.status,200);
  const csv=await exportResponse.text();
  assert.ok(csv.includes('"Internal note"'));
  assert.ok(csv.includes('"\'=Sample public update"'));
});

test('travel intake and evidence use the correct line and end with an examiner decision',async()=>{
  let cookie=await login('client');
  const payload={product:'travel',policy:'TR-DEMO-1001',vehicle:'Sample flight',city:'Outside UAE',type:'Lost baggage',incident:'2025-01-01',description:'Fictional baggage did not arrive at the destination.',requestKey:crypto.randomUUID()};
  assert.equal((await act(cookie,'create',null,{...payload,policy:'MTR-DEMO-1048'})).status,400);
  assert.equal((await act(cookie,'create',null,{...payload,type:'Rear-end collision'})).status,400);
  const created=await act(cookie,'create',null,payload);
  assert.equal(created.status,200);
  const {id}=await created.json();
  assert.match(id,/^TR-/);
  cookie=await login('officer',cookie);
  assert.equal((await act(cookie,'request',id,{category:'Vehicle registration',note:'Wrong insurance line.'})).status,400);
  assert.equal((await act(cookie,'request',id,{category:'Baggage irregularity report',note:'Attach a sample carrier report.'})).status,200);
  assert.equal((await act(cookie,'review',id)).status,409);
  cookie=await login('client',cookie);
  const evidence={name:'report.txt',type:'text/plain',base64:btoa('Fictional baggage report')};
  assert.equal((await act(cookie,'upload',id,{...evidence,category:'Police or Saaed report'})).status,400);
  const upload=async()=> (await (await act(cookie,'upload',id,{...evidence,category:'Baggage irregularity report'})).json()).claims.find(c=>c.id===id).documents.at(-1);
  const first=await upload();
  cookie=await login('officer',cookie);
  assert.equal((await act(cookie,'review',id)).status,200);
  assert.equal((await act(cookie,'refer',id)).status,409);
  assert.equal((await act(cookie,'document-review',id,{documentId:first.id,decision:'Replacement needed',note:'Attach a complete sample report.'})).status,200);
  const decision={outcome:'Accepted for processing',rationale:'The fictional carrier report supports further processing.'};
  assert.equal((await act(cookie,'decide',id,decision)).status,409);
  cookie=await login('client',cookie);
  const replacement=await upload();
  cookie=await login('officer',cookie);
  assert.equal((await act(cookie,'document-review',id,{documentId:replacement.id,decision:'Accepted'})).status,200);
  assert.equal((await act(cookie,'decide',id,decision)).status,200);
  cookie=await login('client',cookie);
  const claim=(await claims(cookie)).find(c=>c.id===id);
  assert.equal(claim.status,'Decision issued');
  assert.equal(claim.decision.outcome,'Accepted for processing');
  assert.equal(claim.documents[0].review,'Superseded');
  cookie=await login('support',cookie);
  assert.ok(!(await claims(cookie)).some(c=>c.id===id));
});

test('every catalog line accepts its own sample policy and case details',async()=>{
  const {products,policyNumber}=await import('../server/catalog.ts');
  const cookie=await login('client');
  for(const [key,product] of Object.entries(products)){
    const response=await act(cookie,'create',null,{
      product:key,policy:policyNumber(key),vehicle:product.subject,
      type:product.incidents[0],city:'Abu Dhabi',incident:'2025-01-01',description:product.example
    });
    assert.equal(response.status,200,key);
    const {id,claims:list}=await response.json();
    assert.ok(id.startsWith(product.prefix+'-'),key);
    assert.equal(list.find(claim=>claim.id===id).product,key);
  }
});
