'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const v=require('../src/middleware/validation');
const base={member_id:'MEM0000001',court_id:'CRT0000001',booking_date:'2026-10-05',start_time:'09:00',end_time:'10:00',payment_method:'cash',pay_now:'1'};
test('real dates only, leap years supported',()=>{
  assert.equal(v.date('2024-02-29','date').toISOString().slice(0,10),'2024-02-29');
  for(const value of ['2026-02-29','2026-04-31','0000-01-01','2026-13-01'])assert.throws(()=>v.date(value,'date'));
});
test('money rejects NaN, scientific notation and hidden precision',()=>{
  assert.equal(v.number('0.01','amount',{positive:true}),0.01);
  for(const value of ['NaN','Infinity','1e5','1.001','-1','999999999'])assert.throws(()=>v.number(value,'money'));
  assert.throws(()=>v.number('0','amount',{positive:true}));
});
test('ID rejects SQL injection payloads',()=>{
  assert.equal(v.id('CRT0000001','id'),'CRT0000001');
  assert.throws(()=>v.id("';drop table courts;--",'id'));
});
test('booking validates interval and multi-equipment request',()=>{
  const b=v.booking({...base,items:[{equipment_id:'EQP0000001',quantity:'2',rental_date:'2026-10-05',due_date:'2026-10-06'}]});
  assert.equal(b.items.length,1);assert.equal(b.items[0].quantity,2);assert.equal(b.total_amount,null);assert.equal(b.pay_now,true);
  assert.throws(()=>v.booking({...base,end_time:'08:30'}));
  assert.throws(()=>v.booking({...base,items:[{equipment_id:'EQP0000001',quantity:'0',due_date:'2026-10-05'}]}));
});
test('duplicate equipment is rejected before TVP creation',()=>{
  const i={equipment_id:'EQP0000001',quantity:'1',due_date:'2026-10-05'};
  assert.throws(()=>v.booking({...base,items:[i,i]}),/ประเภทเดียวกัน/);
});
test('payment and maintenance XOR are checked on backend',()=>{
  const p={booking_id:'BKG0000001',rental_id:'RNT0000001',amount:'1',payment_date:'2026-10-05T09:00',payment_method:'cash',status:'paid'};
  assert.throws(()=>v.record('payments',p),/อย่างเดียว/);
  const m={staff_id:'STF0000001',facility_id:'FAC0000001',court_id:'CRT0000001',equipment_id:'',maintenance_date:'2026-10-05',description:'test',cost:'0',status:'scheduled'};
  assert.throws(()=>v.record('maintenance',m),/อย่างเดียว/);
});
test('status allowlist rejects unrecognized values',()=>{
  assert.throws(()=>v.record('facilities',{facility_name:'test',facility_type:'test',location:'test',opening_time:'06:00',closing_time:'22:00',status:'hacked'}));
});
