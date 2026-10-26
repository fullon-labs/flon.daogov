export async function readTablePages(request, params){
  const rows=[];
  const seen=new Set();
  let lower_bound;
  for(;;){
    const page=await request('/v1/chain/get_table_rows',{...params,...(lower_bound===undefined?{}:{lower_bound})});
    rows.push(...(page.rows||[]));
    if(!page.more||page.more==='false')return {rows};
    const next=page.next_key;
    if(next===undefined||next===null||next===''||seen.has(String(next)))throw new Error('Invalid table pagination cursor');
    seen.add(String(next));lower_bound=next;
  }
}
