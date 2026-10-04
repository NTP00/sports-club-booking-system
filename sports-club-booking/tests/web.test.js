'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createApp}=require('../src/app');
const {createService}=require('../src/services/club');
const v=require('../src/middleware/validation');
const fake={
  async run(){return {};},
  async dashboard(){return [[{active_members:600,bookings_today:40,overdue_rentals:10,paid_revenue:1000}],[],[]];},
  async lookups(){return {members:[],courts:[],equipment:[],facilities:[],staff:[]};},
  async list(table,p){return {...p,size:25,total:0,rows:[]};},
  async reports(){return [];}
};
test('HTTP pages render, CSRF blocks writes, no credentials exposed',async()=>{
  const server=createApp(fake).listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const url=`http://127.0.0.1:${server.address().port}`;
  try {
    for(const path of ['/','/facilities','/courts','/members','/equipment','/court_bookings','/equipment_rentals','/payments','/staff','/maintenance','/reports','/court_bookings/new','/facilities/new','/payments/new']) {
      const response=await fetch(url+path);assert.equal(response.status,200,path);
      assert.ok((await response.text()).includes('Sports Club'));
    }
    assert.equal((await fetch(url+'/payments/new',{method:'POST',body:'amount=1',headers:{'content-type':'application/x-www-form-urlencoded'}})).status,403);
    assert.equal((await fetch(url+'/not_a_table')).status,404);
    assert.equal((await fetch(url+'/.env')).status,404);
    const r=await fetch(url+'/facilities/new'),html=await r.text(),token=html.match(/name="_csrf" value="([a-f0-9]+)"/)[1],cookie=r.headers.get('set-cookie').split(';')[0];
    const invalid=await fetch(url+'/facilities/new',{method:'POST',headers:{cookie,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({_csrf:token,status:'invalid'})});
    assert.equal(invalid.status,400);
  } finally {await new Promise(resolve=>server.close(resolve));}
});
test('booking service sends typed TVP and calls mandatory SP',async()=>{
  const calls={};
  const request={input(name,type,value){calls[name]=arguments.length===2?type:value;return this;},async execute(name){calls.procedure=name;return {recordsets:[[{booking_id:'BKG0000001'}],[],[]]};}};
  const service=createService({async getPool(){return {request(){return request;}};}});
  await service.book(v.booking({member_id:'MEM0000001',court_id:'CRT0000001',booking_date:'2026-10-05',start_time:'09:00',end_time:'10:00',payment_method:'cash',items:[{equipment_id:'EQP0000001',quantity:'2',due_date:'2026-10-06'}]}));
  assert.equal(calls.procedure,'dbo.sp_BookCourtAndEquipment');
  assert.equal(calls.equipment_items.name,'equipment_request');
  assert.equal(calls.equipment_items.rows.length,1);
  assert.equal(calls.equipment_items.rows[0][1],2);
  assert.ok(!('hourly_rate_snapshot' in calls));
});
test('list search is parameterized and identifiers use allowlist',async()=>{
  let captured;
  const request={input(){return this;},async query(statement){captured=statement;return {recordsets:[[{total:0}],[]]};}};
  const service=createService({async getPool(){return {request(){return request;}};}});
  await service.list('members',{page:1,search:"';drop table members;--"});
  assert.ok(captured.includes('@search'));assert.ok(!captured.includes('drop table'));
  await assert.rejects(service.list('members;drop table members;--'));
});
test('HTTP extended form parser accepts 40 equipment types',async()=>{
  let parsed;
  const server=createApp({...fake,async book(values){parsed=values;return {recordsets:[[{booking_id:'BKG0000001'}],[],[]]};}}).listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));const url=`http://127.0.0.1:${server.address().port}`;
  try {
    const get=await fetch(url+'/court_bookings/new'),html=await get.text(),token=html.match(/name="_csrf" value="([a-f0-9]+)"/)[1],cookie=get.headers.get('set-cookie').split(';')[0];
    const body=new URLSearchParams({_csrf:token,member_id:'MEM0000001',court_id:'CRT0000001',booking_date:'2026-10-05',start_time:'09:00',end_time:'10:00',payment_method:'cash'});
    for(let i=0;i<40;i++)for(const [k,value] of Object.entries({equipment_id:'EQP'+String(i+1).padStart(7,'0'),quantity:'1',due_date:'2026-10-05'}))body.set(`items[${i}][${k}]`,value);
    const response=await fetch(url+'/court_bookings/new',{method:'POST',redirect:'manual',headers:{cookie,'content-type':'application/x-www-form-urlencoded'},body});
    assert.equal(response.status,302);assert.equal(parsed.items.length,40);
  } finally {await new Promise(resolve=>server.close(resolve));}
});
