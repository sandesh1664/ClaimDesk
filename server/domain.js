import { evidenceMatches } from './policy.ts';
import { products, isProduct, policyNumber } from './catalog.ts';

const demoRows = [
  ['1048','Aisha Al Mansoori','Toyota Camry · 2023','Abu Dhabi','In review','Rear-end collision','Nadia Khalid',0],
  ['1047','Omar Hassan','Nissan Patrol · 2022','Abu Dhabi','Awaiting documents','Parking damage','Nadia Khalid',1],
  ['1046','Leena Thomas','Hyundai Tucson · 2024','Dubai','New','Windscreen damage','Unassigned',0],
  ['1045','Khalid Al Nuaimi','Ford Explorer · 2021','Al Ain','Repair referred','Side-impact collision','Faris Rahman',2],
  ['1044','Maya Fernandes','Honda Civic · 2023','Abu Dhabi','In review','Minor collision','Faris Rahman',3],
  ['1043','Yousef Ali','Kia Sportage · 2024','Sharjah','New','Parking damage','Unassigned',3],
  ['1042','Reem Al Ketbi','Mazda CX-5 · 2022','Abu Dhabi','Closed','Windscreen damage','Nadia Khalid',4],
  ['1041','Daniel Pereira','Toyota Corolla · 2020','Dubai','Repair referred','Rear-end collision','Faris Rahman',5],
];
export function seed() {
  const motorClaims=demoRows.map(([number,name,vehicle,city,status,type,owner,age])=>{
    const received=new Date(Date.now()-age*864e5-45*6e4).toISOString();
    const timeline=[{at:received,actor:'Customer portal',title:'Claim received',detail:'Motor claim intake submitted.'}];
    if(status!=='New') timeline.push({at:received,actor:owner,title:status,detail:status==='Awaiting documents'?'Police accident report requested.':'Initial review completed.'});
    return {id:'MC-'+number,product:'motor',clientOwned:number==='1048',priority:number==='1048'?'High':'Standard',name,vehicle,city,status,type,owner,received,incident:received.slice(0,10),policy:'MTR-DEMO-'+number,description:number==='1048'?'The vehicle was struck from behind while stopped at a junction in Al Danah. Rear bumper damage was reported. The vehicle remains drivable.':'The policyholder reported '+type.toLowerCase()+'. Details are recorded for claims review.',assessment:number==='1048'?{estimateFils:275000,excessFils:50000,garage:'Capital Motor Works',note:'Rear bumper repair and paint inspection.',at:received}:null,documents:number==='1048'?[{id:'demo-report',category:'Police or Saaed report',review:'Accepted',name:'Accident report · sample.txt',type:'text/plain',bytes:64,base64:btoa('Fictional training document for ClaimDesk case MC-1048.')}]:[],timeline,referral:status==='Repair referred'?{status:'Delivered',attempts:1,reference:'GR-'+number,at:received,logs:[{at:received,outcome:'201 Created'}]}:null};
  });
  const otherClaims=Object.entries(products).filter(([key])=>key!=='motor').map(([key,product],index)=>{
    const received=new Date(Date.now()-(index+1)*7200000).toISOString();
    return {id:product.prefix+'-'+(2001+index),product:key,clientOwned:true,priority:'Standard',name:'Aisha Al Mansoori',vehicle:product.subject,city:'Abu Dhabi',status:'New',type:product.incidents[0],owner:'Unassigned',received,incident:received.slice(0,10),policy:policyNumber(key),description:product.example,documents:[],timeline:[{at:received,actor:'Customer portal',title:'Claim received',detail:'Sample '+product.name.toLowerCase()+' claim submitted.'}],referral:null};
  });
  return {next:1049,claims:[...motorClaims,...otherClaims]};
}

const actor = {customer:'Aisha Al Mansoori',officer:'Nadia Khalid',support:'Faris Rahman',admin:'Mariam Saeed'};
export const actions = {customer:['create','upload','message'],officer:['review','request','refer','close','assess','document-review','message','note','decide'],support:['retry'],admin:['assign','priority']};
const transitions = {review:['New','Awaiting documents'],request:['New','In review'],refer:['In review'],close:['Repair referred','Decision issued']};
const clean = (value,max) => typeof value==='string'?value.trim().slice(0,max):'';
export class WorkflowError extends Error {
  constructor(message,status=400){super(message);this.status=status;}
}
function event(claim,role,title,detail,at,visibility='client'){
  if(claim.timeline.length>=200) throw new WorkflowError('This case has reached its activity limit.',409);
  claim.timeline.push({actor:actor[role],title,detail,at,visibility});
}
const examinerDecisions=['Accepted for processing','Declined in demo'];
const garages=['Capital Motor Works','Corniche Auto Repair','Al Ain Vehicle Centre'];
const money=value=>typeof value==='string'&&/^\d{1,7}(?:\.\d{1,2})?$/.test(value)?Math.round(Number(value)*100):NaN;
function addAssessment(claim,input,role,at){
  if(claim.status!=='In review'||claim.referral) throw new WorkflowError('An assessment can be recorded only before dispatch while the claim is in review.',409);
  const estimateFils=money(input.estimate),excessFils=money(input.excess),note=clean(input.note,500);
  if(!Number.isFinite(estimateFils)||!Number.isFinite(excessFils)||estimateFils<=0||excessFils>estimateFils||!garages.includes(input.garage)||note.length<10) throw new WorkflowError('Enter a valid estimate, excess, repair partner and assessment of at least 10 characters.');
  claim.assessment={estimateFils,excessFils,garage:input.garage,note,at};
  event(claim,role,'Assessment recorded','Repair estimate and partner saved.',at);
}
function recordDecision(claim,input,role,at){
  if((claim.product||'motor')==='motor'||claim.status!=='In review') throw new WorkflowError('An examiner decision is available for non-motor cases in review.',409);
  const rationale=clean(input.rationale,500);
  if(!examinerDecisions.includes(input.outcome)||rationale.length<10) throw new WorkflowError('Select an outcome and enter a decision rationale of at least 10 characters.');
  if(claim.documents.some(file=>file.review==='Replacement needed'||file.review==='Pending review'||!file.review)) throw new WorkflowError('Resolve outstanding evidence reviews before recording a decision.',409);
  claim.decision={outcome:input.outcome,rationale,at};
  claim.status='Decision issued';
  event(claim,role,'Decision recorded',input.outcome+' · '+rationale,at);
}
function reviewDocument(claim,input,role,at){
  const file=claim.documents.find(d=>d.id===input.documentId);
  if(!file) throw new WorkflowError('Document could not be found.',404);
  if(file.review==='Superseded') throw new WorkflowError('Review the replacement document instead.',409);
  if(!['Accepted','Replacement needed'].includes(input.decision)) throw new WorkflowError('Select a review decision.');
  const note=clean(input.note,300);
  if(input.decision==='Replacement needed'&&!note) throw new WorkflowError('Explain why a replacement is needed.');
  if(file.review===input.decision&&file.reviewNote===note) return;
  file.review=input.decision;
  file.reviewNote=note;
  event(claim,role,'Evidence '+input.decision.toLowerCase(),(file.category||file.name)+(note?' · '+note:''),at);
}
export function apply(state,role,action,input) {
  if(!Object.hasOwn(actions,role)||!actions[role].includes(action)) throw new WorkflowError('This action is unavailable in the selected workspace.',403);
  const at=new Date().toISOString();
  const localDate=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dubai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(at));
  if(action==='create'){
    const key=clean(input.requestKey,36);
    if(input.requestKey!==undefined&&!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(key)) throw new WorkflowError('Invalid claim submission reference.');
    const product=input.product??'motor';
    if(!isProduct(product)) throw new WorkflowError('Select a supported insurance line.');
    const definition=products[product];
    const name=actor.customer, policy=clean(input.policy,30).toUpperCase(), vehicle=clean(input.vehicle,70), description=clean(input.description,600), incident=clean(input.incident,10);
    const date=new Date(incident+'T00:00:00Z');
    if(!name||policy!==policyNumber(product)||!vehicle||description.length<10||!Number.isFinite(+date)||date.toISOString().slice(0,10)!==incident||incident>localDate) throw new WorkflowError('Enter the matching demo policy, insured item or reference, valid incident date and a description of at least 10 characters.');
    if(!['Abu Dhabi','Dubai','Al Ain','Sharjah','Ajman','Other UAE','Outside UAE'].includes(input.city)||!definition.incidents.includes(input.type)) throw new WorkflowError('Select a location and incident type.');
    const previous=key&&state.claims.find(c=>isClientClaim(c)&&c.requestKey===key);
    if(previous){
      const submitted={product,policy,vehicle,description,incident,city:input.city,type:input.type};
      if(Object.entries(submitted).some(([field,value])=>(field==='product'?(previous.product||'motor'):previous[field])!==value)) throw new WorkflowError('This submission reference has already been used. Open My claims to see the original case.',409);
      return previous.id;
    }
    if(state.claims.length>=50) throw new WorkflowError('The demo has reached its claim limit. Reset the demo to continue.');
    const claim={id:definition.prefix+'-'+state.next++,product,clientOwned:true,requiresAssessment:product==='motor',requestKey:key||undefined,priority:'Standard',name,policy,vehicle,description,incident,city:input.city,type:input.type,status:'New',owner:'Unassigned',received:at,documents:[],timeline:[],referral:null};
    event(claim,role,'Claim received',definition.name+' claim intake submitted.',at);
    state.claims.unshift(claim);
    return claim.id;
  }
  const claim=state.claims.find(c=>c.id===input.id);
  if(!claim) throw new WorkflowError('Claim could not be found.',404);
  if(role==='customer'&&!isClientClaim(claim)) throw new WorkflowError('Claim could not be found.',404);
  const product=claim.product||'motor';
  const definition=products[product];
  if(product!=='motor'&&['assess','refer','retry'].includes(action)) throw new WorkflowError('This action is available only for motor claims.',409);
  if(['assess','document-review','message','note','decide'].includes(action)){
    if(claim.status==='Closed') throw new WorkflowError('This claim is closed.',409);
    if(action==='assess') addAssessment(claim,input,role,at);
    else if(action==='decide') recordDecision(claim,input,role,at);
    else if(action==='document-review') reviewDocument(claim,input,role,at);
    else {
      const message=clean(input.message,500);
      if(message.length<3) throw new WorkflowError('Enter at least three characters.');
      event(claim,role,action==='note'?'Internal note':role==='customer'?'Message from policyholder':'Message from claims team',message,at,action==='note'?'staff':'client');
    }
    return claim.id;
  }
  if(action==='assign'||action==='priority'){
    if(claim.status==='Closed') throw new WorkflowError('This claim is closed.',409);
    if(action==='assign'){
      if(!['Nadia Khalid','Faris Rahman','Unassigned'].includes(input.owner)) throw new WorkflowError('Choose a queue owner.');
      claim.owner=input.owner;
      event(claim,role,'Queue assignment changed',input.owner,at);
    }else{
      if(!['Standard','High','Urgent'].includes(input.priority)) throw new WorkflowError('Choose a priority.');
      claim.priority=input.priority;
      event(claim,role,'Priority changed',input.priority,at);
    }
    return claim.id;
  }
  if(action==='upload'){
    if(claim.status==='Closed') throw new WorkflowError('Closed claims cannot accept uploads.',409);
    if(claim.documents.length>=12) throw new WorkflowError('This claim has reached its sample document history limit.');
    const {base64,type}=input;
    const name=clean(input.name,100);
    if(!name||!['application/pdf','image/jpeg','image/png','text/plain'].includes(type)||typeof base64!=='string'||!base64.length||base64.length>163840||!/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)) throw new WorkflowError('Choose a sample PDF, JPEG, PNG or text file up to 120 KB.');
    const raw=atob(base64);
    if(!evidenceMatches(type,raw)) throw new WorkflowError('The document contents do not match the selected file format.');
    const existingBytes=state.claims.flatMap(c=>c.documents).reduce((total,d)=>total+d.bytes,0);
    if(existingBytes+raw.length>750000) throw new WorkflowError('The demo session has reached its storage limit.');
    const category=clean(input.category,40);
    if(!definition.evidence.includes(category)) throw new WorkflowError('Choose a document category.');
    const replacement=claim.documents.findLast(file=>file.category===category&&file.review==='Replacement needed');
    if(claim.documents.filter(file=>file.review!=='Superseded').length>=6&&!replacement) throw new WorkflowError('Each claim accepts up to six active sample documents.');
    const id=crypto.randomUUID();
    if(replacement){replacement.review='Superseded';replacement.replacedBy=id;}
    claim.documents.push({category,id,name,type,bytes:raw.length,base64,review:'Pending review',uploadedAt:at});
    event(claim,role,'Document uploaded',category+' · '+name,at);
    return claim.id;
  }
  if(action==='refer' && claim.referral) return claim.id;
  if(action==='retry' && claim.referral?.status==='Delivered') return claim.id;
  if(action==='retry'){
    if(claim.referral?.status!=='Failed') throw new WorkflowError('This claim has no failed referral.',409);
    Object.assign(claim.referral,{status:'Delivered',attempts:claim.referral.attempts+1,at});
    claim.referral.logs.push({at,outcome:'201 Created'});
    claim.status='Repair referred';
    event(claim,role,'Repair referral recovered',claim.referral.reference+' delivered to the simulated garage.',at);
    return claim.id;
  }
  if(action==='request'&&claim.referral?.status==='Failed') throw new WorkflowError('Resolve the failed dispatch before requesting documents.',409);
  if(!transitions[action]?.includes(claim.status)) throw new WorkflowError('Refresh the case and check its current status.',409);
  if(claim.owner==='Unassigned') claim.owner=actor[role];
  if(action==='refer'){
    if(claim.requiresAssessment&&!claim.assessment) throw new WorkflowError('Record a repair assessment before dispatch.',409);
    claim.referral={status:'Failed',attempts:1,reference:'GR-'+claim.id.slice(3),garage:claim.assessment?.garage||'Capital Motor Works',at,logs:[{at,outcome:'504 Gateway Timeout'}]};
    event(claim,role,'Garage referral timed out','First dispatch returned HTTP 504. Queued for service desk review.',at);
  }else{
    const status={review:'In review',request:'Awaiting documents',close:'Closed'}[action];
    const note=clean(input.note,300);
    const category=clean(input.category,40);
    if(action==='request'&&(!note||(category&&!definition.evidence.includes(category)))) throw new WorkflowError('Select a document category and describe what the customer should provide.');
    if(action==='request') claim.evidenceRequest={category:category||'Other',note,at};
    if(action==='review'&&claim.evidenceRequest){
      const request=claim.evidenceRequest;
      const submitted=claim.documents.some(file=>(request.category==='Other'||file.category===request.category)&&file.uploadedAt>=request.at&&!['Superseded','Replacement needed'].includes(file.review));
      if(!submitted) throw new WorkflowError('The requested document has not been received. Ask the policyholder to upload it.',409);
      delete claim.evidenceRequest;
    }
    claim.status=status;
    event(claim,role,status,note||({review:'Case assigned for review.',close:'Claims officer closed the case.'}[action]),at);
  }
  return claim.id;
}

export function isClientClaim(claim){
  return claim.clientOwned===true||claim.id==='MC-1048';
}
