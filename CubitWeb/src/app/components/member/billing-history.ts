export interface BillingRow {
  id: string; date: string; kind: string; description: string; amount: number;
  status: string; editable: boolean; charge?: any; payment?: any;
}
function localDay(value: string) {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
export function billingRows(billing: any, order = 'desc'): BillingRow[] {
  if (!billing) return [];
  const rows: BillingRow[] = billing.charges.map(c => ({ id:c.id,date:c.dueDate,kind:'Charge',description:c.planName,amount:c.amount,
    status:c.amount===0?'Waived':c.outstanding===0?'Paid':c.outstanding<c.amount?'Part-paid':c.dueDate<billing.asOf?'Past due':'Due',editable:true,charge:c }));
  for(const p of billing.payments || []) {
    // Superseded payments and their reversing entries belong in change history only.
    if(p.correctedBy || p.reversalOf || Number(p.amount)===0)continue;
    const date=localDay(p.transactionDate);
    rows.push({id:p.id,date,kind:Number(p.amount)<0?'Refund':'Payment',description:p.description || p.method || 'Payment',
      amount:-Number(p.amount),status:date>billing.asOf?'Future-dated':'Recorded',editable:!p.requestKey?.startsWith('paypal:'),payment:p});
  }
  return rows.sort((a,b)=>(order==='desc'?-1:1)*a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
}
