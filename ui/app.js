import { products, policyNumber } from '/catalog.js';

const $=selector=>document.querySelector(selector);
const root=$('#root'), modal=$('#modal');
const roles={
  customer:{label:'Client portal',email:'client@claimdesk.test',home:'/client',initials:'AM',icon:'person',desc:'Submit a claim and track your repair.'},
  officer:{label:'Claims operations',email:'officer@claimdesk.test',home:'/operations',initials:'NK',icon:'file',desc:'Assess incidents and coordinate repairs.'},
  support:{label:'Integration service desk',email:'support@claimdesk.test',home:'/service-desk',initials:'FR',icon:'pulse',desc:'Inspect dispatches and recover failures.'},
  admin:{label:'Administration',email:'admin@claimdesk.test',home:'/admin',initials:'MS',icon:'shield',desc:'Assign cases and review audit activity.'}
};
const navs={
  customer:[['/client','Overview','grid'],['/client/claims','My claims','file'],['/client/new','Report a claim','plus']],
  officer:[['/operations','Overview','grid'],['/operations/queue','Claims queue','file']],
  support:[['/service-desk','Overview','grid'],['/service-desk/dispatches','Dispatch log','pulse']],
  admin:[['/admin','Overview','grid'],['/admin/assignments','Assignments','person'],['/admin/audit','Audit log','file'],['/admin/reporting','Service levels','pulse']]
};
const icons={grid:'▦',file:'▤',plus:'+',person:'◎',pulse:'⌁',shield:'◇',arrow:'→',check:'✓',clock:'◷',alert:'!',upload:'↑',logout:'↗',search:'⌕'};
const ico=(name)=>`<span class="icon" aria-hidden="true">${icons[name]||'·'}</span>`;
const statuses=['New','In review','Awaiting documents','Repair referred','Decision issued','Closed'];
const productOf=claim=>products[claim?.product]||products.motor;
const categories=()=>productOf(current()).evidence;
const dateFmt=new Intl.DateTimeFormat('en-AE',{timeZone:'Asia/Dubai',day:'numeric',month:'short',year:'numeric'});
const timeFmt=new Intl.DateTimeFormat('en-AE',{timeZone:'Asia/Dubai',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const stamp=at=>dateFmt.format(new Date(at))+' · '+timeFmt.format(new Date(at));
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const tones={'In review':'blue','Awaiting documents':'amber','Repair referred':'green','Decision issued':'green',New:'cyan',Failed:'red',Delivered:'green',Urgent:'red',High:'amber',Overdue:'red','Due soon':'amber','Reviewed late':'red','On track':'cyan',Met:'green',Accepted:'green','Replacement needed':'red','Pending review':'amber'};
const badge=value=>`<span class="badge ${tones[value]||''}">${esc(value)}</span>`;
const button=(label,action,kind='secondary',icon='')=>`<button class="btn ${kind}" data-action="${action}" type="button">${icon?ico(icon):''}${label}</button>`;
const link=(label,path,kind='secondary',icon='')=>`<a class="btn ${kind}" href="${path}" data-route>${icon?ico(icon):''}${label}</a>`;
const option=(text,selected)=>`<option ${text===selected?'selected':''}>${esc(text)}</option>`;
const roleLabel=()=>roles[account.role].label;
const amount=fils=>new Intl.NumberFormat('en-AE',{style:'currency',currency:'AED'}).format(fils/100);
const current=()=>claims.find(c=>c.id===selected);
const active=()=>claims.filter(c=>c.status!=='Closed');
const failures=()=>claims.filter(c=>c.referral?.status==='Failed');
const openRoute=()=>location.pathname.replace(/\/$/,'')||'/';
let account=null,claims=[],team=[],selected='',query='',filter='All statuses',busy=false,timer,loginRole='customer',step=1,draft={},detailView='Summary',queueView='All cases',auditTerm='',productFilter='all';
const notice=(text)=>{ $('#toast').textContent=text;clearTimeout(timer);timer=setTimeout(()=>{$('#toast').textContent='';},4600); };
async function api(path,data){
  const res=await fetch('/api/'+path,data===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  let body;
  try{body=await res.json();}catch{throw Error('The service is temporarily unavailable.');}
  if(!res.ok){const error=Error(body.error||'The request could not be completed.');error.status=res.status;throw error;}
  return body;
}
const brand=()=>`<a class="brand" href="/" data-route><span class="mark" aria-hidden="true"><i></i><i></i><i></i></span><span>ClaimDesk<small>INSURANCE CLAIMS</small></span></a>`;
const disclaimer=()=>`<span class="prototype">Independent portfolio concept for ADNIC · Sample data only</span>`;
function login(){
  const items=Object.entries(roles).map(([key,r])=>`<button class="role-choice ${key===loginRole?'active':''}" data-login-role="${key}" aria-pressed="${key===loginRole}">${ico(r.icon)}<span><strong>${r.label}</strong><small>${r.desc}</small></span>${ico('arrow')}</button>`).join('');
  root.innerHTML=`<header class="public-head">${brand()}<div><span class="tag">Portfolio demo</span><a href="https://www.adnic.ae/" target="_blank" rel="noopener">ADNIC official site ↗</a></div></header>
  <main id="main" class="sign-layout"><section class="sign-intro"><div class="intro-copy"><p class="eyebrow light">INSURANCE CLAIMS PORTAL</p><h1>From first report<br>to resolution.</h1><p>Report and track personal or commercial claims, submit evidence, and follow the case through review.</p></div><ol class="intro-steps"><li><span>01</span>Report incident</li><li><span>02</span>Claim assessment</li><li><span>03</span>Resolution</li></ol></section>
  <section class="sign-panel"><p class="eyebrow">CLAIMS SERVICES</p><h2>Sign in to ClaimDesk</h2><p class="muted">Choose a sample account to explore its workspace.</p><div class="role-grid">${items}</div>
  <form id="login-form"><div class="login-fields"><label>Demo email<input name="email" type="email" required value="${roles[loginRole].email}" autocomplete="off"></label><label>Demo access code<input name="code" type="text" required value="ClaimsDemo2026!" autocomplete="off"></label></div><p class="form-error" role="alert"></p><button class="btn primary sign-submit">Sign in as ${roles[loginRole].label.toLowerCase()}${ico('arrow')}</button></form></section></main>
  <footer class="public-footer">${disclaimer()}<span>Use the provided demo credentials and fictional documents.</span></footer>`;
}
function navigate(path,replace=false){
  if(!account) path='/login';
  else if(!navs[account.role].some(([url])=>url===path)) path=roles[account.role].home;
  if(openRoute()!==path){
    history[replace?'replaceState':'pushState']({},'',path);
    query='';filter='All statuses';queueView='All cases';productFilter='all';
  }
  render();
  window.scrollTo(0,0);
}
function shell(content){
  const route=openRoute(), name=navs[account.role].find(([path])=>path===route)?.[1]||'Overview';
  return `<header class="portal-head">${brand()}<span class="head-divider"></span><strong>${roleLabel()}</strong><div class="head-end"><span class="tag"><i></i>Demo environment</span><span class="user-avatar">${roles[account.role].initials}</span><span class="user-name">${esc(account.name)}</span>${button('Sign out','logout','quiet','logout')}</div></header>
    <div class="portal-shell ${account.role==='customer'?'client-shell':''}"><aside class="sidebar"><div class="side-title">${roleLabel()}</div><nav aria-label="Portal pages">${navs[account.role].map(([path,label,icon])=>`<a href="${path}" data-route ${path===route?'aria-current="page"':''}>${ico(icon)}${label}</a>`).join('')}</nav><div class="side-foot">${button('Demo walkthrough','guide','quiet','arrow')}${disclaimer()}</div></aside>
    <main id="main" tabindex="-1" class="workspace"><div class="breadcrumb">${roleLabel()} <span>/</span> ${name}</div>${content}</main></div>`;
}
const title=(heading,desc,actions='')=>`<div class="page-title"><div><h1>${heading}</h1><p>${desc}</p></div><div class="actions">${actions}</div></div>`;
const kpi=(label,num,detail,icon)=>`<article class="kpi"><div>${ico(icon)}<span>${label}</span></div><strong>${num}</strong><small>${detail}</small></article>`;
const panel=(heading,sub,body,tail='')=>`<section class="panel"><div class="panel-head"><div><h2>${heading}</h2>${sub?'<p>'+sub+'</p>':''}</div>${tail}</div>${body}</section>`;
const empty=(message)=>`<div class="empty">${esc(message)}</div>`;
function overview(){
  const role=account.role;
  const recent=claims.slice(0,4);
  const support=role==='support',admin=role==='admin';
  const heading=support?'Integration overview':admin?'Administration overview':'Claims operations overview';
  const action=support?link('Open dispatch log','/service-desk/dispatches','primary','arrow'):admin?link('Manage assignments','/admin/assignments','primary','arrow'):link('Open claims queue','/operations/queue','primary','arrow');
  const metrics=support?kpi('Repair referrals',claims.length,'Simulated garage dispatches','pulse')+kpi('Failed referrals',failures().length,'Awaiting intervention','alert')+kpi('Delivered',claims.filter(c=>c.referral.status==='Delivered').length,'Acknowledged by the garage','check'):
    kpi('Open claims',active().length,'Cases currently in the workflow','file')+kpi('Awaiting documents',claims.filter(c=>c.status==='Awaiting documents').length,'Policyholder action required','upload')+kpi('Overdue first reviews',claims.filter(c=>c.service?.state==='Overdue').length,'Past the review target','clock')+kpi('Referral exceptions',failures().length,'Technical action required','alert');
  const secondary=support?panel('Integration endpoint','Motor repair dispatch',`<div class="summary-body"><div class="status-line"><span>Garage partner</span>${badge('Simulated')}</div><div class="status-line"><span>Latest delivery errors</span>${failures().length}</div><div class="status-line"><span>Successful referrals</span>${claims.length-failures().length}</div></div>`):admin?panel('Workspace accounts','Demo access by role',`<div class="summary-body">${team.map(a=>`<div class="status-line"><span><b>${esc(a.name)}</b><small>${esc(a.email)}</small></span>${badge(roles[a.role].label)}</div>`).join('')}</div>`):panel('Claims by stage','Live distribution',`<div class="summary-body">${statuses.map(s=>{const n=claims.filter(c=>c.status===s).length;return `<div class="bar-row"><div><span>${s}</span><b>${n}</b></div><progress value="${n}" max="${claims.length||1}" aria-label="${s}"></progress></div>`;}).join('')}</div>`);
  const next=support?failures().slice(0,3):claims.filter(c=>['Overdue','Due soon'].includes(c.service?.state)).sort((a,b)=>a.service.dueAt.localeCompare(b.service.dueAt)).slice(0,3);
  const strip=next.length?`<section class="attention-strip"><div>${ico('alert')}<strong>${support?'Dispatches needing attention':'Review deadlines needing attention'}</strong></div><div>${next.map(c=>`<button class="ref" data-select="${c.id}" data-select-path="${actionPath(role)}">${c.id} ${badge(support?'Failed':c.service.state)}</button>`).join('')}</div></section>`:'';
  return '<div class="operations-title">'+title(heading,support?'Monitor the repair partner and resolve delivery exceptions.':admin?'Manage case ownership, priority and operational oversight.':'Monitor personal and commercial claims from first notice to closure.',action)+'</div>'+`<div class="kpis">${metrics}</div>${strip}<div class="overview-grid">${panel(support?'Recent dispatches':'Recent claims',support?'Latest repair integration activity':'Recently received cases across all insurance lines',table(recent,role,actionPath(role)))}${secondary}</div>`;
}
const actionPath=role=>role==='support'?'/service-desk/dispatches':role==='admin'?'/admin/assignments':'/operations/queue';
function table(list,role,path=''){
  if(!list.length) return empty('No cases match this view.');
  const service=role==='support';
  return `<div class="table-scroll"><table><thead><tr><th scope="col">Reference</th><th scope="col">${service?'Referral':'Policyholder / insurance line'}</th><th scope="col">Status</th><th scope="col" class="optional-col">${service?'Attempts':'Owner'}</th></tr></thead><tbody>${list.map(c=>`<tr class="${selected===c.id?'selected':''}"><td><button class="ref" data-select="${c.id}" ${path?'data-select-path="'+path+'"':''} aria-label="Open ${c.id}">${c.id}</button></td><td><b>${esc(service?c.referral.reference:c.name)}</b><small>${esc(service?c.city:productOf(c).name+' · '+c.vehicle)}</small></td><td>${badge(service?c.referral.status:c.status)}${!service&&['Overdue','Due soon'].includes(c.service?.state)?'<div class="table-target">'+badge(c.service.state)+'</div>':''}</td><td class="optional-col">${service?c.referral.attempts:esc(c.owner)}</td></tr>`).join('')}</tbody></table></div><div class="table-foot">${list.length} ${list.length===1?'result':'results'}</div>`;
}
function filtered(){
  const term=query.trim().toLowerCase(), service=account.role==='support';
  return claims.filter(c=>{
    const matchesQueue=queueView==='All cases'||(queueView==='Needs attention'&&(service?c.referral.status==='Failed':['Overdue','Due soon'].includes(c.service?.state)))||(queueView==='Unassigned'&&c.owner==='Unassigned'&&c.status!=='Closed');
    return matchesQueue&&(productFilter==='all'||(c.product||'motor')===productFilter)&&(filter==='All statuses'||filter===(service?c.referral.status:c.status))&&[c.id,c.name,c.policy,c.vehicle,productOf(c).name,c.referral?.reference,c.owner].join(' ').toLowerCase().includes(term);
  });
}
function queue(){
  const role=account.role,support=role==='support',admin=role==='admin';
  const heading=support?'Dispatch log':admin?'Case assignments':'Claims queue';
  const list=filtered();
  const segments=['All cases','Needs attention',...(support?[]:['Unassigned'])].map(name=>`<button data-queue="${name}" aria-pressed="${queueView===name}">${name}</button>`).join('');
  const controls=`<div class="segmented queue-segments" aria-label="Queue views">${segments}</div><div class="filters"><label class="search-wrap">${ico('search')}<input id="search" type="search" aria-label="Search cases" placeholder="Search reference, policyholder or owner…" value="${esc(query)}"></label><select id="filter" aria-label="Filter by status">${['All statuses',...(support?['Failed','Delivered']:statuses)].map(s=>option(s,filter)).join('')}</select></div>${support?'':`<div class="filters line-filter"><label for="line-filter">Insurance line</label><select id="line-filter"><option value="all">All insurance lines</option>${productOptions(productFilter)}</select></div>`}`;
  return title(heading,support?'Inspect partner responses and safely retry failed repair referrals.':admin?'Assign ownership and set triage priority.':'Review incidents, evidence, assessments and decisions.',button('Refresh','refresh','secondary'))+`<div class="queue-grid">${panel(support?'Garage referrals':'Claims across all lines',support?'Repair integration activity':'Select a case to open its file',controls+`<div id="results">${table(list,role)}</div>`)}${claimDetail(current())}</div>`;
}
function facts(c){
  if(account.role==='support') return `<dl class="facts"><div><dt>Referral reference</dt><dd>${esc(c.referral.reference)}</dd></div><div><dt>Dispatch attempts</dt><dd>${c.referral.attempts}</dd></div><div><dt>Last dispatch</dt><dd>${stamp(c.referral.at)}</dd></div><div><dt>Repair partner</dt><dd>${esc(c.referral.garage||'Simulated garage')}</dd></div></dl>`;
  return `<dl class="facts"><div><dt>Policy number</dt><dd class="mono">${esc(c.policy)}</dd></div><div><dt>Incident date</dt><dd>${esc(c.incident)}</dd></div><div><dt>Insurance line</dt><dd>${esc(productOf(c).name)}</dd></div><div><dt>Incident type</dt><dd>${esc(c.type)}</dd></div><div><dt>Emirate</dt><dd>${esc(c.city)}</dd></div>${c.owner?`<div><dt>Case owner</dt><dd>${esc(c.owner)}</dd></div><div><dt>Priority</dt><dd>${badge(c.priority||'Standard')}</dd></div>`:''}</dl>`;
}
function activity(c){
  return `<ol class="timeline">${[...c.timeline].reverse().map(e=>`<li><strong>${esc(e.title)}</strong><p>${esc(e.detail)}</p><small>${e.actor?esc(e.actor)+' · ':''}${stamp(e.at)} GST</small></li>`).join('')}</ol>`;
}
function files(c){
  const staff=account.role==='officer'&&c.status!=='Closed';
  const documents=c.documents.map(d=>`<div class="evidence-row"><a class="document" href="/api/document?claim=${encodeURIComponent(c.id)}&amp;id=${encodeURIComponent(d.id)}" download>${ico('file')}<span><b>${esc(d.name)}</b><small>${esc(d.category||'Supporting document')} · ${Math.max(1,Math.ceil(d.bytes/1024))} KB</small></span>${ico('arrow')}</a><div class="evidence-meta">${badge(d.review||'Pending review')}${staff&&d.review!=='Superseded'?`<button class="btn quiet" type="button" data-review-document="${esc(d.id)}">Review document</button>`:''}</div>${d.reviewNote?`<p>${esc(d.reviewNote)}</p>`:''}</div>`).join('');
  const canUpload=account.role==='customer'&&c.status!=='Closed'&&c.documents.length<12&&(c.documents.filter(d=>d.review!=='Superseded').length<6||c.documents.some(d=>d.review==='Replacement needed'));
  return `<section class="detail-section first"><h3>Claim evidence <span class="muted">(${c.documents.length})</span></h3>${documents||'<p class="muted">No documents attached.</p>'}${canUpload?button('Add sample document','upload-open','secondary','upload'):''}</section>`;
}
function assessment(c){
  if((c.product||'motor')!=='motor'){
    const decision=c.decision;
    return `<section class="detail-section first"><h3>Examiner decision</h3><p class="muted">${esc(productOf(c).desk)}</p>${decision?`<div class="callout success"><b>${esc(decision.outcome)}</b><span>${esc(decision.rationale)}</span><small>${stamp(decision.at)} GST</small></div>`:'<p class="assessment-note">No decision has been recorded.</p>'}${account.role==='officer'&&c.status==='In review'?button('Record decision','decide-open','primary','check'):''}</section>`;
  }
  const a=c.assessment,customer=account.role==='customer';
  const edit=account.role==='officer'&&c.status==='In review'&&!c.referral;
  return `<section class="detail-section first"><h3>Repair assessment</h3>${a?`<dl class="facts assessment-facts"><div><dt>Repair partner</dt><dd>${esc(a.garage)}</dd></div>${customer?'':`<div><dt>Repair estimate</dt><dd>${amount(a.estimateFils)}</dd></div><div><dt>Policy excess</dt><dd>${amount(a.excessFils)}</dd></div><div><dt>Estimated insurer share</dt><dd>${amount(a.estimateFils-a.excessFils)}</dd></div>`}</dl>${customer?'':`<p class="assessment-note">${esc(a.note)}</p>`}`:'<p class="muted">No repair assessment has been recorded.</p>'}${edit?button(a?'Update assessment':'Record assessment','assess-open','primary','file'):''}</section>`;
}
function conversations(c){
  const role=account.role;
  const events=c.timeline.filter(e=>e.title==='Internal note'||e.title.startsWith('Message from'));
  const canWrite=c.status!=='Closed'&&['customer','officer'].includes(role);
  return `<section class="detail-section first"><h3>Case correspondence</h3>${events.length?activity({...c,timeline:events}):'<p class="muted">There are no case messages yet.</p>'}${canWrite?`<div class="actions message-actions">${button('Send message','message-open','primary','arrow')}${role==='officer'?button('Add internal note','note-open','secondary','file'):''}</div>`:''}</section>`;
}
function workflow(c){
  const role=account.role;
  if(role==='customer') return '';
  if(role==='admin') return c.status==='Closed'?'':`<div class="actions">${button('Change owner','assign-open','primary','person')}${button('Set priority','priority-open')}</div>`;
  if(role==='support') return `<div class="actions">${button(c.referral.status==='Failed'?'Retry dispatch':'Re-send same request','retry',c.referral.status==='Failed'?'primary':'secondary','pulse')}</div>`;
  const actions=[],motor=(c.product||'motor')==='motor';
  if(['New','Awaiting documents'].includes(c.status)) actions.push(button('Start review','review','primary','check'));
  if(['New','In review'].includes(c.status)&&!c.referral) actions.push(button('Request document','request-open','secondary','file'));
  if(motor&&c.status==='In review'&&!c.referral&&(!c.requiresAssessment||c.assessment)) actions.push(button('Refer to garage','refer','primary','arrow'));
  if(motor&&c.status==='In review'&&!c.referral&&c.requiresAssessment&&!c.assessment) actions.push(button('Record assessment','assess-open','primary','file'));
  if(!motor&&c.status==='In review') actions.push(button('Record decision','decide-open','primary','check'));
  if(['Repair referred','Decision issued'].includes(c.status)) actions.push(button('Close claim','close','primary','check'));
  return `<div class="actions">${actions.join('')}</div>`;
}
function referral(c){
  if(!c.referral) return '';
  const failed=c.referral.status==='Failed', role=account.role;
  return `<section class="detail-section"><h3>Repair dispatch</h3><div class="callout ${failed?'warning':'success'}"><b>${failed?'HTTP 504 · Gateway timeout':'Referral delivered'}</b><span>${failed?'The simulated repair partner timed out. The service desk can retry this referral.':'Confirmed under '+esc(c.referral.reference)+'.'}</span></div>${role==='support'?`<ul class="dispatch-list">${[...c.referral.logs].reverse().map(e=>`<li><b class="mono">${esc(e.outcome)}</b><span>${stamp(e.at)} GST</span></li>`).join('')}</ul>`:''}</section>`;
}
function claimProgress(c){
  const stage={New:0,'In review':1,'Awaiting documents':1,'Repair referred':2,'Decision issued':2,Closed:3}[c.status]??0;
  return `<ol class="claim-progress" aria-label="Claim stage">${['Received','Review',(c.product||'motor')==='motor'?'Repair':'Decision','Closed'].map((label,i)=>`<li class="${i<=stage?'reached':''}" ${i===stage?'aria-current="step"':''}><i aria-hidden="true">${i<stage?'✓':i+1}</i><span>${label}</span></li>`).join('')}</ol>`;
}
function claimDetail(c){
  if(!c) return panel('Case file','',empty('Select a case from the list.'));
  const support=account.role==='support',client=account.role==='customer';
  const request=c.status==='Awaiting documents'&&(c.evidenceRequest||[...c.timeline].reverse().find(e=>e.title==='Awaiting documents'));
  const views=support?['Summary','Activity']:['Summary','Evidence',(c.product||'motor')==='motor'?'Assessment':'Decision','Messages','Activity'];
  const view=views.includes(detailView)?detailView:'Summary';
  const tabs=views.map(name=>`<button data-detail="${name}" aria-pressed="${view===name}">${name}</button>`).join('');
  const summary=`${client?claimProgress(c):''}${facts(c)}${c.service?`<div class="service-target"><div>${ico('clock')}<span><b>First review target</b><small>${stamp(c.service.dueAt)} GST</small></span></div>${badge(c.service.state)}</div>`:''}${workflow(c)}${client&&c.decision?`<div class="callout success"><b>${esc(c.decision.outcome)}</b><span>${esc(c.decision.rationale)}</span></div>`:''}${client&&request?`<div class="callout warning"><b>${esc(request.category||'Document requested')}</b><span>${esc(request.note||request.detail)}</span><button type="button" class="btn quiet" data-detail="Evidence">Open evidence</button></div>`:''}${referral(c)}${support?'':`<section class="detail-section"><h3>Incident summary</h3><p>${esc(c.description)}</p></section>`}`;
  const content={Summary:()=>summary,Evidence:()=>files(c),Assessment:()=>assessment(c),Decision:()=>assessment(c),Messages:()=>conversations(c),Activity:()=>`<section class="detail-section first"><h3>${client?'Claim progress':'Activity history'}</h3>${activity(c)}</section>`};
  return `<section class="panel case-panel" id="case" tabindex="-1"><div class="case-top"><div class="case-meta"><span class="mono">${c.id}</span>${badge(support?c.referral.status:c.status)}</div><h2>${esc(support?c.referral.reference:client?c.type:c.name)}</h2><p>${esc(support?'Motor repair integration':productOf(c).desk+' · '+c.vehicle+' · '+c.city)}</p></div>
    <div class="segmented case-segments" aria-label="Case sections">${tabs}</div><div class="case-body">${content[view]()}</div></section>`;
}
function productOptions(selected){
  return ['Personal','Commercial'].map(group=>`<optgroup label="${group}">${Object.entries(products).filter(([,p])=>p.group===group).map(([key,p])=>`<option value="${key}" ${key===selected?'selected':''}>${esc(p.name)}</option>`).join('')}</optgroup>`).join('');
}
function clientHome(){
  const requested=claims.find(c=>c.status==='Awaiting documents');
  const groups=['Personal','Commercial'].map(group=>`<section class="panel product-group"><div class="panel-head"><div><h2>${group} claims</h2><p>Select an insurance line to start with its sample policy.</p></div></div><div class="product-grid">${Object.entries(products).filter(([,p])=>p.group===group).map(([key,p])=>`<button type="button" class="product-tile" data-start-product="${key}"><span><strong>${esc(p.name)}</strong><small>${esc(p.desk)}</small></span>${ico('arrow')}</button>`).join('')}</div></section>`).join('');
  return `<section class="client-hero"><div><p class="eyebrow light">POLICYHOLDER SERVICES</p><h1>Insurance claims</h1><p>Report a loss, submit evidence and follow your claim from intake to resolution.</p><div class="actions">${link('Report a claim','/client/new','primary','plus')}${link('Track my claims','/client/claims','hero-link','arrow')}</div></div></section>
  ${requested?`<div class="callout warning client-alert"><div><b>Documents requested for ${requested.id}</b><span>Open the case to see what the claims team needs.</span></div><button class="btn secondary" data-select="${requested.id}" data-select-path="/client/claims">Open claim</button></div>`:''}
  <div class="product-groups">${groups}</div>`;
}
function clientClaims(){
  return title('My claims','Review progress and upload any requested documents.',link('Report a claim','/client/new','primary','plus'))+`<div class="client-grid">${panel('Your claims','',claims.length?`<div class="claim-list">${claims.map(c=>`<button data-select="${c.id}" aria-current="${c.id===selected}"><span><b class="mono">${c.id}</b><small>${esc(productOf(c).name+' · '+c.vehicle)}</small></span>${badge(c.status)}${ico('arrow')}</button>`).join('')}</div>`:empty('You have no claims yet.'))}${claimDetail(current())}</div>`;
}
const field=(name,control)=>`<label>${name}${control}</label>`;
const input=(name,value,attrs='')=>`<input name="${name}" value="${esc(value)}" ${attrs} required>`;
const select=(name,values,selected)=>`<select name="${name}">${values.map(s=>option(s,selected)).join('')}</select>`;
const textarea=(name,value,attrs)=>`<textarea name="${name}" ${attrs}>${esc(value)}</textarea>`;
function intake(){
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dubai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const key=draft.product||'motor', product=products[key];
  const steps=['Policy & insured item','Incident details','Review & submit'];
  let body;
  if(step===1) body=`<h2>Policy & insured item</h2><div class="field-grid">${field('Insurance line',`<select id="intake-product" name="product">${productOptions(key)}</select>`)}${field('Demo policy number',input('policy',policyNumber(key),'readonly'))}</div>${field(esc(product.subjectLabel),input('vehicle',draft.vehicle||product.subject,'maxlength="70"'))}`;
  if(step===2) body=`<h2>Incident details</h2><div class="field-grid">${field('Incident date',input('incident',draft.incident||today,'type="date" max="'+today+'"'))}${field('Incident location',select('city',['Abu Dhabi','Dubai','Al Ain','Sharjah','Ajman','Other UAE','Outside UAE'],draft.city))}${field('Incident type',select('type',product.incidents,draft.type))}</div>${field('What happened?',textarea('description',draft.description,'rows="4" minlength="10" maxlength="600" required placeholder="Describe the fictional incident."'))}<div class="intake-checklist"><strong>Sample evidence to prepare</strong><ul>${product.evidence.filter(d=>d!=='Other').map(d=>`<li>${esc(d)}</li>`).join('')}</ul></div>`;
  if(step===3) body=`<h2>Review your claim</h2><dl class="facts"><div><dt>Insurance line</dt><dd>${esc(product.name)}</dd></div><div><dt>Handling team</dt><dd>${esc(product.desk)}</dd></div><div><dt>Policy</dt><dd>${esc(draft.policy)}</dd></div><div><dt>Insured item or reference</dt><dd>${esc(draft.vehicle)}</dd></div><div><dt>Incident date</dt><dd>${esc(draft.incident)}</dd></div><div><dt>Location</dt><dd>${esc(draft.city)}</dd></div><div><dt>Incident type</dt><dd>${esc(draft.type)}</dd></div></dl><p class="review-summary">${esc(draft.description)}</p><label class="checkbox"><input type="checkbox" required> I confirm this is fictional demo information.</label>`;
  return title('Report a claim','Choose an insurance line and submit a fictional incident.')+`<ol class="stepper">${steps.map((s,i)=>`<li class="${i+1<=step?'reached':''}" ${i+1===step?'aria-current="step"':''}><b>${i+1<step?'✓':i+1}</b><span>${s}</span></li>`).join('')}</ol><form id="intake" class="panel intake">${body}<p class="form-error" role="alert"></p><div class="form-actions">${step>1?button('Back','back-step'):link('Cancel','/client')}${'<button class="btn primary">'+(step===3?'Submit claim':'Continue')+ico('arrow')+'</button>'}</div></form>`;
}
function auditRows(){
  const term=auditTerm.trim().toLowerCase();
  const rows=claims.flatMap(c=>c.timeline.map(e=>({...e,id:c.id}))).filter(e=>[e.id,e.actor,e.title,e.detail].join(' ').toLowerCase().includes(term)).sort((a,b)=>b.at.localeCompare(a.at));
  if(!rows.length) return empty('No matching audit events.');
  return `<div class="table-scroll"><table><thead><tr><th>Time (GST)</th><th>Claim</th><th>Actor</th><th>Event</th></tr></thead><tbody>${rows.map(e=>`<tr><td>${stamp(e.at)}</td><td class="mono">${e.id}</td><td>${esc(e.actor)}</td><td><b>${esc(e.title)}</b> ${e.visibility==='staff'?badge('Staff only'):''}<small>${esc(e.detail)}</small></td></tr>`).join('')}</tbody></table></div><div class="table-foot">${rows.length} events</div>`;
}
function audit(){
  return title('Audit log','Search the case history by reference, actor or event.',`<a class="btn secondary" href="/api/audit.csv" download>${ico('upload')}Export CSV</a>`)+panel('Case activity','',`<div class="filters"><label class="search-wrap">${ico('search')}<input id="audit-search" type="search" aria-label="Search audit events" placeholder="Search audit events…" value="${esc(auditTerm)}"></label></div><div id="audit-results">${auditRows()}</div>`);
}
function reporting(){
  const states=['Overdue','Due soon','On track','Met','Reviewed late'];
  const cases=state=>claims.filter(c=>c.service?.state===state);
  const ordered=[...claims].filter(c=>c.service).sort((a,b)=>a.service.dueAt.localeCompare(b.service.dueAt));
  return title('Service levels','First review targets by claim priority. Times shown in Gulf Standard Time.')+`<div class="kpis">${states.map(state=>kpi(state,cases(state).length,'First review','clock')).join('')}</div>`+panel('Review performance','Urgent 4 hours · High 12 hours · Standard 24 hours',`<div class="table-scroll"><table><thead><tr><th>Claim</th><th>Priority</th><th>Review due</th><th>First reviewed</th><th>Target status</th></tr></thead><tbody>${ordered.map(c=>`<tr><td><button class="ref" data-select="${c.id}" data-select-path="/admin/assignments">${c.id}</button></td><td>${badge(c.priority||'Standard')}</td><td>${stamp(c.service.dueAt)}</td><td>${c.service.reviewedAt?stamp(c.service.reviewedAt):'Pending'}</td><td>${badge(c.service.state)}</td></tr>`).join('')}</tbody></table></div>`);
}
function render(){
  if(!account){login();return;}
  const route=openRoute();
  const screens={'/client':clientHome,'/client/claims':clientClaims,'/client/new':intake,'/operations':overview,'/operations/queue':queue,'/service-desk':overview,'/service-desk/dispatches':queue,'/admin':overview,'/admin/assignments':queue,'/admin/audit':audit,'/admin/reporting':reporting};
  root.innerHTML=shell(screens[route]());
}
function show(title,content){
  modal.innerHTML=`<div class="modal-head"><h2 id="modal-title">${title}</h2>${button('Close','dismiss','quiet')}</div><div class="modal-body">${content}</div>`;
  if(!modal.open) modal.showModal();
}
const modalForm=(id,fields,submit)=>`<form id="${id}">${fields}<p class="form-error" role="alert"></p><div class="form-actions">${button('Cancel','dismiss')}<button class="btn primary">${submit}</button></div></form>`;
async function loadClaims(){
  const body=await api('claims');
  claims=body.claims;team=body.team||[];
  if(!current()) selected=(account.role==='support'?failures()[0]:claims.find(c=>c.id==='MC-1048'))?.id||claims[0]?.id||'';
}
const messages={create:'Claim submitted.',review:'Case moved to review.',request:'Document request sent to the client portal.',refer:'Simulated timeout recorded in the service desk.',retry:'Referral confirmed under its original reference.',close:'Claim closed.',assign:'Case owner updated.',priority:'Priority updated.',upload:'Sample document uploaded.',reset:'Demo data restored.',assess:'Repair assessment saved.','document-review':'Evidence decision saved.',message:'Case message sent.',note:'Internal note added.',decide:'Examiner decision recorded.'};
async function guarded(control,work){
  if(busy) return;
  busy=true;
  if(control) control.disabled=true;
  try{await work();}catch(error){
    if(error.status===401&&account){if(modal.open) modal.close();account=null;navigate('/login',true);}
    const form=(modal.open?modal:root).querySelector('.form-error');
    if(form) form.textContent=error.message;
    else notice(error.message);
  }finally{busy=false;if(control?.isConnected) control.disabled=false;}
}
async function mutate(action,values={}){
  const result=await api('action',{id:selected,action,...values});
  claims=result.claims;selected=result.id;
  if(modal.open) modal.close();
  if(action==='create'){step=1;draft={};detailView='Summary';navigate('/client/claims');}
  else {
    if(action==='assess') detailView='Summary';
    if(action==='decide') detailView='Decision';
    if(['upload','document-review'].includes(action)) detailView='Evidence';
    if(['message','note'].includes(action)) detailView='Messages';
    render();
  }
  notice(messages[action]);
}
document.addEventListener('click',event=>{
  const route=event.target.closest('a[data-route]');
  if(route&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey){
    event.preventDefault();
    if(!busy) navigate(route.getAttribute('href'));
    return;
  }
  const target=event.target.closest('button');
  if(!target||busy) return;
  if(target.dataset.loginRole){loginRole=target.dataset.loginRole;login();$('#login-form input').focus();return;}
  if(target.dataset.startProduct){step=1;draft={product:target.dataset.startProduct};return navigate('/client/new');}
  if(target.dataset.detail){detailView=target.dataset.detail;render();Array.from(document.querySelectorAll('[data-detail]')).find(b=>b.dataset.detail===detailView)?.focus({preventScroll:true});return;}
  if(target.dataset.queue){queueView=target.dataset.queue;render();document.querySelector('[data-queue][aria-pressed="true"]')?.focus({preventScroll:true});return;}
  if(target.dataset.reviewDocument){
    const doc=current().documents.find(d=>d.id===target.dataset.reviewDocument);
    if(!doc) return;
    return show('Review evidence',modalForm('document-review',`<input type="hidden" name="documentId" value="${esc(doc.id)}"><p class="muted">${esc(doc.name)}</p>`+field('Decision',select('decision',['Accepted','Replacement needed'],doc.review))+field('Review note',textarea('note',doc.reviewNote,'rows="3" maxlength="300" placeholder="Required if a replacement is needed"')),'Save decision'));
  }
  if(target.dataset.select){
    detailView='Summary';
    selected=target.dataset.select;
    if(target.dataset.selectPath) navigate(target.dataset.selectPath);
    else render();
    $('#case')?.focus({preventScroll:true});
    if(matchMedia('(max-width: 1000px)').matches) $('#case')?.scrollIntoView({block:'start'});
    return;
  }
  const action=target.dataset.action;
  if(action==='dismiss') return modal.close();
  if(action==='logout') return guarded(target,async()=>{await api('logout',{});loginRole=account.role;account=null;claims=[];team=[];selected='';detailView='Summary';auditTerm='';step=1;draft={};navigate('/login',true);});
  if(action==='back-step'){Object.assign(draft,Object.fromEntries(new FormData($('#intake'))));step--;return render();}
  if(action==='refresh') return guarded(target,async()=>{await loadClaims();render();notice('Workspace refreshed.');});
  if(action==='guide') return show('Demo walkthrough',`<ol class="guide-list"><li>Sign in as the client and choose an insurance line and submit a fictional claim.</li><li>Sign out, then sign in to Claims operations. Review the evidence, record a motor repair assessment or a non-motor examiner decision.</li><li>Sign in to the Integration service desk. Inspect the HTTP 504, retry, then re-send to verify one referral.</li><li>Sign in to Administration to assign a case, check service levels and export the audit log.</li></ol>${account.role==='admin'?button('Reset sample data','reset-open'):''}`);
  if(action==='reset-open') return show('Restore sample data?',modalForm('reset','<p>Changes and sample uploads in this demo workspace will be removed.</p>','Restore'));
  if(action==='request-open') return show('Request a document',modalForm('request',field('Document category',select('category',categories()))+field('Instructions for the client',textarea('note','','rows="4" maxlength="300" required placeholder="Specify the document the client should attach."')),'Send request'));
  if(action==='decide-open') return show('Record examiner decision',modalForm('decide',field('Outcome',select('outcome',['Accepted for processing','Declined in demo']))+field('Decision rationale for the policyholder',textarea('rationale','','rows="4" required minlength="10" maxlength="500"')),'Record decision'));
  if(action==='assess-open'){
    const a=current().assessment;
    return show('Repair assessment',modalForm('assess',field('Repair estimate (AED)',input('estimate',a?a.estimateFils/100:'','type="number" min="0.01" max="9999999" step="0.01"'))+field('Policy excess (AED)',input('excess',a?a.excessFils/100:'500','type="number" min="0" max="9999999" step="0.01"'))+field('Repair partner',select('garage',['Capital Motor Works','Corniche Auto Repair','Al Ain Vehicle Centre'],a?.garage))+field('Assessment note',textarea('note',a?.note,'rows="3" required minlength="10" maxlength="500"')),'Save assessment'));
  }
  if(action==='message-open'||action==='note-open'){
    const note=action==='note-open';
    return show(note?'Add internal note':'Send case message',modalForm(note?'note':'message',field(note?'Staff-only note':'Message',textarea('message','','rows="4" required minlength="3" maxlength="500"')),'Save '+(note?'note':'message')));
  }
  if(action==='assign-open') return show('Change case owner',modalForm('assign',field('Queue owner',select('owner',['Nadia Khalid','Faris Rahman','Unassigned'],current().owner)),'Update owner'));
  if(action==='priority-open') return show('Set triage priority',modalForm('priority',field('Priority',select('priority',['Standard','High','Urgent'],current().priority)),'Update priority'));
  if(action==='upload-open') return show('Add a sample document',modalForm('upload',field('Document category',select('category',categories(),current().evidenceRequest?.category))+field('Sample file','<input name="file" type="file" accept="application/pdf,image/jpeg,image/png,text/plain" required>')+'<p class="muted">PDF, JPEG, PNG or text. Maximum 120 KB.</p>','Upload'));
  if(action==='close') return show('Close this claim?',modalForm('close','<p>The customer timeline will show that the case is closed.</p>','Close claim'));
  if(['review','refer','retry'].includes(action)) return guarded(target,()=>mutate(action));
});
document.addEventListener('input',event=>{
  if(event.target.id==='search'){query=event.target.value;$('#results').innerHTML=table(filtered(),account.role);}
  if(event.target.id==='audit-search'){auditTerm=event.target.value;$('#audit-results').innerHTML=auditRows();}
});
document.addEventListener('change',event=>{
  if(event.target.id==='intake-product'){
    const {incident,city}=draft;
    draft={product:event.target.value,incident,city};render();$('#intake-product')?.focus();return;
  }
  if(event.target.id==='line-filter'){productFilter=event.target.value;$('#results').innerHTML=table(filtered(),account.role);}
  if(event.target.id==='filter'){filter=event.target.value;$('#results').innerHTML=table(filtered(),account.role);}
});
document.addEventListener('submit',event=>{
  const form=event.target, id=form.id;
  if(!['login-form','intake','upload','request','assign','priority','reset','close','assess','document-review','message','note','decide'].includes(id)) return;
  event.preventDefault();
  const data=Object.fromEntries(new FormData(form));
  if(id==='intake'&&step<3){Object.assign(draft,data);step++;render();window.scrollTo(0,0);return;}
  guarded(event.submitter,async()=>{
    if(id==='login-form'){
      account=(await api('login',data)).account;
      try{await loadClaims();}catch(error){account=null;throw error;}
      navigate(account.home,true);return;
    }
    if(id==='intake'){draft.requestKey ||= crypto.randomUUID();return mutate('create',draft);}
    if(id==='upload'){
      const file=data.file;
      if(!file.size||file.size>122880) throw Error('Choose a sample file between 1 byte and 120 KB.');
      const bytes=new Uint8Array(await file.arrayBuffer());
      let binary='';for(const byte of bytes) binary+=String.fromCharCode(byte);
      return mutate('upload',{name:file.name,type:file.type||'text/plain',base64:btoa(binary),category:data.category});
    }
    return mutate(id,data);
  });
});
window.addEventListener('popstate',()=>navigate(openRoute(),true));
(async()=>{
  try{account=(await api('session')).account;if(account) await loadClaims();navigate(openRoute(),true);}
  catch(error){root.innerHTML=`<main id="main" class="loading"><h1>Workspace unavailable</h1><p>${esc(error.message)}</p><a href="/">Reload</a></main>`;}
})();
