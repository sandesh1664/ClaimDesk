type Product = {
  name: string;
  group: 'Personal' | 'Commercial';
  prefix: string;
  desk: string;
  subjectLabel: string;
  subject: string;
  incidents: readonly string[];
  evidence: readonly string[];
  example: string;
};

export const products = {
  motor: {name:'Motor',group:'Personal',prefix:'MC',desk:'Motor claims',subjectLabel:'Vehicle make, model and year',subject:'Toyota Camry · 2023',incidents:['Minor collision','Rear-end collision','Side-impact collision','Parking damage','Windscreen damage','Other damage'],evidence:['Police or Saaed report','Vehicle registration','Driving licence','Incident photos','Other'],example:'The rear bumper was damaged while the vehicle was parked.'},
  health: {name:'Health',group:'Personal',prefix:'HC',desk:'Medical reimbursement',subjectLabel:'Sample clinic or provider',subject:'Demo Wellness Clinic',incidents:['Outpatient reimbursement','Diagnostic tests','Emergency treatment'],evidence:['Itemised medical invoice','Payment receipt','Medical report','Prescription','Other'],example:'A fictional clinic visit generated an itemised invoice and payment receipt.'},
  home: {name:'Home',group:'Personal',prefix:'HM',desk:'Personal property claims',subjectLabel:'Sample property or contents',subject:'Demo apartment · Abu Dhabi',incidents:['Water damage','Fire or smoke damage','Theft','Accidental damage'],evidence:['Damage photographs','Repair quotation','Proof of ownership','Incident report','Other'],example:'A leak damaged the flooring in the fictional insured apartment.'},
  travel: {name:'Travel',group:'Personal',prefix:'TR',desk:'Travel claims',subjectLabel:'Sample trip or flight reference',subject:'Demo flight · DXB to MCT',incidents:['Trip cancellation','Travel delay','Delayed baggage','Lost baggage','Emergency assistance'],evidence:['Travel itinerary','Carrier confirmation','Baggage irregularity report','Expense receipts','Other'],example:'The carrier reported a delay on a fictional itinerary.'},
  accident: {name:'Personal accident',group:'Personal',prefix:'PA',desk:'Personal accident claims',subjectLabel:'Sample activity or incident context',subject:'Demo recreational activity',incidents:['Accidental injury','Accidental disability'],evidence:['Accident report','Medical assessment','Supporting receipts','Other'],example:'A fictional recreational incident was reported for examiner review.'},
  property: {name:'Commercial property',group:'Commercial',prefix:'CP',desk:'Commercial property claims',subjectLabel:'Sample premises or asset',subject:'Demo warehouse · Mussafah',incidents:['Fire or smoke damage','Flood or water damage','Theft','Business interruption'],evidence:['Loss photographs','Asset schedule','Incident report','Repair estimate','Business interruption records','Other'],example:'Water entered a fictional warehouse and damaged stored equipment.'},
  marine: {name:'Marine',group:'Commercial',prefix:'MR',desk:'Marine claims',subjectLabel:'Sample shipment or vessel reference',subject:'Demo cargo · BL-7204',incidents:['Cargo damage','Cargo shortage','Hull damage'],evidence:['Bill of lading','Survey report','Commercial invoice','Carrier notice','Other'],example:'Damage was noted on arrival for a fictional cargo shipment.'},
  aviation: {name:'Aviation',group:'Commercial',prefix:'AV',desk:'Aviation claims',subjectLabel:'Sample aircraft or flight reference',subject:'Demo aircraft · Fleet 07',incidents:['Aircraft ground damage','Aircraft hull damage','Aviation liability notification'],evidence:['Occurrence report','Aircraft maintenance record','Damage survey','Supporting correspondence','Other'],example:'A fictional aircraft incurred damage during a ground handling operation.'},
  energy: {name:'Energy',group:'Commercial',prefix:'EN',desk:'Energy claims',subjectLabel:'Sample facility or equipment',subject:'Demo facility · Pump train 02',incidents:['Equipment breakdown','Facility damage','Production interruption'],evidence:['Equipment report','Incident investigation','Repair estimate','Interruption records','Other'],example:'A fictional facility reported a mechanical failure and a temporary interruption.'},
  engineering: {name:'Engineering & construction',group:'Commercial',prefix:'EC',desk:'Engineering claims',subjectLabel:'Sample project or equipment',subject:'Demo project · Site 12',incidents:['Contract works damage','Plant breakdown','Installation damage'],evidence:['Site incident report','Contract works schedule','Engineer assessment','Repair quotation','Other'],example:'A fictional site reported damage to installed works during construction.'},
  liability: {name:'Liability',group:'Commercial',prefix:'LI',desk:'Liability claims',subjectLabel:'Sample business or event reference',subject:'Demo business · Incident 42',incidents:['Third-party property damage','Public liability notification','Products liability notification'],evidence:['Third-party notice','Incident report','Witness statement','Supporting correspondence','Other'],example:'A fictional business reported a third-party property damage allegation.'}
} as const satisfies Record<string,Product>;

export type ProductKey = keyof typeof products;
export function isProduct(value: unknown): value is ProductKey {
  return typeof value==='string' && Object.hasOwn(products,value);
}
export function policyNumber(key: ProductKey): string {
  return key==='motor'?'MTR-DEMO-1048':products[key].prefix+'-DEMO-1001';
}
