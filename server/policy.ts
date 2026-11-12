type ServicePriority = 'Standard' | 'High' | 'Urgent';
type ServiceCase = { received: string; priority?: ServicePriority; status: string; timeline: Array<{ at: string; title: string }> };
const reviewHours: Record<ServicePriority,number> = { Standard:24, High:12, Urgent:4 };
function serviceTarget(claim: ServiceCase, now=Date.now()) {
  const received=Date.parse(claim.received);
  const hours=reviewHours[claim.priority ?? 'Standard'] ?? reviewHours.Standard;
  const due=received+hours*3600000;
  const reviewed=claim.timeline.find(event=>['In review','Awaiting documents','Assessment recorded','Decision recorded','Garage referral timed out'].includes(event.title));
  const reviewedAt=reviewed?.at ?? (['Repair referred','Decision issued','Closed'].includes(claim.status)?claim.received:null);
  const remaining=Math.ceil((due-now)/60000);
  const state=reviewedAt?(Date.parse(reviewedAt)>due?'Reviewed late':'Met'):remaining<=0?'Overdue':remaining<=120?'Due soon':'On track';
  return {dueAt:new Date(due).toISOString(),reviewedAt,state};
}
function evidenceMatches(type: string, raw: string): boolean {
  if(type==='application/pdf') return raw.startsWith('%PDF-');
  if(type==='image/png') return raw.startsWith('\x89PNG\r\n\x1a\n');
  if(type==='image/jpeg') return raw.startsWith('\xff\xd8\xff');
  if(type!=='text/plain') return false;
  try {
    const text=new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(raw,character=>character.charCodeAt(0)));
    return text.trim().length>0 && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text);
  } catch {
    return false;
  }
}
