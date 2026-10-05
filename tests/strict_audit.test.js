'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createApp}=require('../src/app');
const {createService}=require('../src/services/club');
const v=require('../src/middleware/validation');

async function withServer(service,check) {
  const app=createApp(service);app.set('env','development');
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  try {await check(`http://127.0.0.1:${server.address().port}`);}
  finally {await new Promise(resolve=>server.close(resolve));}
}
function reportFixtureService() {
  const week=new Date('2026-10-05T00:00:00Z');
  const rows=[...Array.from({length:41},(_,i)=>({week_start:week,resource_type:'court',resource_id:`CRT${String(i+1).padStart(7,'0')}`,resource_name:`Oracle Court ${i+1}`,resource_category:'tennis',facility_id:'FAC0000001',utilized_units:0,capacity_units:6720,utilization_percent:0})),
    ...Array.from({length:40},(_,i)=>({week_start:week,resource_type:'equipment',resource_id:`EQP${String(i+1).padStart(7,'0')}`,resource_name:`Oracle Equipment ${i+1}`,resource_category:'racket',facility_id:null,utilized_units:0,capacity_units:70,utilization_percent:0}))];
  const calls=[];
  const service=createService({async getPool(){return {request(){
    const params={};return {input(name,type,value){params[name]=value;return this;},async query(sql){
      calls.push({sql,params});
      // Model the SQL row cap in this DB double so restoring TOP(80) fails.
      const top=sql.match(/\btop\s*\(?\s*(\d+)/i);
      return {recordset:top?rows.slice(0,Number(top[1])):rows};
    }};
  }};}});
  return {service,calls,rows,week};
}
test('F01 reports return 41 courts + 40 equipment, including the final resource',async()=>{
  const {service,calls,rows,week}=reportFixtureService();
  assert.deepEqual(await service.reports(week),rows);
  assert.equal(rows.length,81);assert.equal(calls[0].params.week,week);
  assert.match(calls[0].sql,/where week_start=@week/i);
  assert.doesNotMatch(calls[0].sql,/\btop\b/i);
  assert.equal((await service.reports()).length,81);
  await withServer(service,async url=>{
    const r=await fetch(url+'/reports?week=2026-10-05');assert.equal(r.status,200);
    const html=await r.text();
    assert.equal((html.match(/Oracle Court \d+/g)||[]).length,41);
    assert.equal((html.match(/Oracle Equipment \d+/g)||[]).length,40);
    assert.ok(html.includes('Oracle Equipment 40'));
  });
});
for(const kind of ['oversized body','parameter overflow']) {
  test(`F02 ${kind} renders a safe error page and preserves HTTP 413`,async()=>{
    const credential='FIXTURE-CREDENTIAL-DO-NOT-ECHO';
    const body=kind==='oversized body'?`password=${credential}&content=${'x'.repeat(70000)}`:
      new URLSearchParams([['password',credential],...Array.from({length:500},(_,i)=>['field'+i,'x'])]).toString();
    await withServer({},async url=>{
      const r=await fetch(url+'/members/new',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body});
      const html=await r.text();assert.equal(r.status,413);
      assert.match(r.headers.get('content-type'),/text\/html/);
      assert.ok(html.includes('ดำเนินการไม่สำเร็จ'));assert.ok(html.includes('SPORTS CLUB &amp; FACILITY BOOKING')||html.includes('SPORTS CLUB & FACILITY BOOKING'));
      assert.doesNotMatch(html,/ReferenceError|PayloadTooLargeError|\.ejs:\d|\/src\/views\/|<pre>|\bat \w+ \(/);
      assert.ok(!html.includes(credential));assert.doesNotMatch(html,/DB_PASSWORD|process\.env/);
    });
  });
}
const bookingBase={member_id:'MEM0000001',court_id:'CRT0000001',booking_date:'2026-10-05',start_time:'09:00',end_time:'10:00',payment_method:'cash'};
const rentalBase={equipment_id:'EQP0000001',quantity:'1',due_date:'2026-10-06'};
const paymentBase={booking_id:'BKG0000001',rental_id:'',amount:'1',payment_date:'2026-10-05T09:00',payment_method:'cash',status:'paid'};
const workflows=[
  value=>v.booking({...bookingBase,booking_transaction_ref:value}).booking_transaction_ref,
  value=>v.booking({...bookingBase,items:[{...rentalBase,transaction_ref:value}]}).items[0].transaction_ref,
  value=>v.record('payments',{...paymentBase,transaction_ref:value}).transaction_ref
];
for(const [label,input,expected] of [['ASCII','  REF-123 / A_B  ','REF-123 / A_B'],['100 chars','A'.repeat(100),'A'.repeat(100)],['empty','',null],['whitespace','   ',null],['null',null,null],['missing',undefined,null]]) {
  test(`F03 references accept and normalize ${label} identically in all three workflows`,()=>{
    for(const workflow of workflows)assert.equal(workflow(input),expected);
  });
}
for(const [label,input] of [['Thai','เลขไทย'],['accent','réf'],['emoji','ref😀'],['control','ref\t123'],['101 chars','A'.repeat(101)],['number',123],['array',[]]]) {
  test(`F03 references reject ${label} consistently in all three workflows`,()=>{
    for(const workflow of workflows)assert.throws(()=>workflow(input),err=>err instanceof v.ValidationError && err.status===400);
  });
}
for(const resource of ['constructor','toString','__proto__']) {
  test(`F04 inherited property ${resource} is rejected before accessing the DB`,async()=>{
    const service=createService({async getPool(){assert.fail('Unknown resource must not reach the DB');}});
    for(const operation of [()=>service.list(resource),()=>service.get(resource,'MEM0000001'),()=>service.save(resource,{}),()=>service.changeStatus(resource,'MEM0000001','active')]) {
      await assert.rejects(operation(),{status:404});
    }
    assert.throws(()=>v.record(resource,{}),v.ValidationError);
    await withServer(service,async url=>{
      for(const path of [`/${resource}`,`/${resource}/new`,`/${resource}/MEM0000001`])assert.equal((await fetch(url+path)).status,404);
    });
  });
}
test('F05 application date boundaries remain 1900-01-01 through 2099-12-31',()=>{
  for(const input of ['1900-01-01','2099-12-31'])assert.equal(v.date(input,'date').toISOString().slice(0,10),input);
  for(const input of ['1899-12-31','2100-01-01'])assert.throws(()=>v.date(input,'date'),v.ValidationError);
});
