'use strict';
const { schema } = require('../config/ui');
class ValidationError extends Error { constructor(message) { super(message); this.status=400; } }
function fail(message) { throw new ValidationError(message); }
function text(value, name, max, optional=false) {
  if (typeof value !== 'string') { if (optional && value==null) return null; fail(`${name}: ต้องเป็นข้อความ`); }
  const v=value.trim();
  if (!v) { if(optional) return null; fail(`${name}: กรุณากรอกข้อมูล`); }
  if(v.length>max) fail(`${name}: ยาวได้ไม่เกิน ${max} ตัวอักษร`);
  return v;
}
function varchar(value,name,max,optional=false) {
  const v=text(value,name,max,optional);
  if(v && /[^\x20-\x7E]/.test(v)) fail(`${name}: ใช้อักษร ASCII ตามชนิด VARCHAR`);
  return v;
}
function number(value,name,{integer=false,positive=false,max=99999999.99,optional=false}={}) {
  if(optional && (value==null || value==='')) return null;
  if(typeof value!=='string' && typeof value!=='number') fail(`${name}: ต้องเป็นตัวเลข`);
  const raw=String(value);
  if(!/^\d+(?:\.\d{1,2})?$/.test(raw)) fail(`${name}: ใช้เลขไม่ติดลบ ทศนิยมไม่เกิน 2 ตำแหน่ง`);
  const n=Number(raw);
  if(!Number.isFinite(n) || n>max || (positive && n<=0) || (integer && !Number.isInteger(n))) fail(`${name}: ค่าตัวเลขไม่ถูกต้อง`);
  return n;
}
function date(value,name,optional=false) {
  if(optional && (value==null || value==='')) return null;
  if(typeof value!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value<'1900-01-01' || value>'2099-12-31') fail(`${name}: ใช้วันที่ ค.ศ. 1900–2099`);
  const d=new Date(value+'T00:00:00.000Z');
  if(Number.isNaN(d.getTime()) || d.toISOString().slice(0,10)!==value) fail(`${name}: วันที่ไม่มีอยู่จริง`);
  return d;
}
function time(value,name) {
  if(typeof value!=='string' || !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value)) fail(`${name}: เวลาไม่ถูกต้อง`);
  return new Date('2000-01-01T'+value+(value.length===5?':00':'')+'Z');
}
function id(value,name) {
  const v=text(value,name,10);
  if(!/^[A-Z]{3}\d{7}$/.test(v)) fail(`${name}: รูปแบบรหัสไม่ถูกต้อง`);
  return v;
}
function record(table, body, { edit=false }={}) {
  if(!Object.hasOwn(schema,table)) fail('ไม่พบตาราง');
  const meta=schema[table];
  const values={};
  for(const col of meta.columns) {
    if(col.name===meta.pk || col.name==='created_at' || col.name.includes('snapshot')) continue;
    const c=col.name, v=body[c];
    if(col.fk) values[c]=col.nullable && !v ? null : id(v,c);
    else if(c==='status') {
      if(!meta.statuses.includes(v)) fail('สถานะไม่ถูกต้อง'); values[c]=v;
    } else if(col.type==='date') values[c]=date(v,c,col.nullable);
    else if(col.type.startsWith('time(')) values[c]=time(v,c);
    else if(col.type.startsWith('datetime')) {
      const raw=text(v,c,19); const dpart=raw.slice(0,10),tpart=raw.slice(11);
      date(dpart,c);time(tpart,c);values[c]=new Date(`${dpart}T${tpart}${tpart.length===5?':00':''}Z`);
    } else if(col.type==='int') values[c]=number(v,c,{integer:true,max:2147483647,positive:c==='capacity'||c==='quantity'});
    else if(col.type.startsWith('decimal')) values[c]=number(v,c,{positive:c==='amount'});
    else {
      const parse=col.type.startsWith('varchar')?varchar:text;
      values[c]=parse(v,c,Number(col.type.match(/\((\d+)\)/)[1]),col.nullable);
      if(c==='email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values[c])) fail('อีเมลไม่ถูกต้อง');
    }
  }
  if(table==='members' && values.membership_end<values.membership_start) fail('วันสิ้นสุดสมาชิกต้องไม่ก่อนวันเริ่ม');
  if(table==='facilities' && values.opening_time>=values.closing_time) fail('เวลาเปิดต้องก่อนเวลาปิด');
  if(table==='payments' && Number(Boolean(values.booking_id))+Number(Boolean(values.rental_id))!==1) fail('Payment ต้องเลือกการจองหรือการเช่าอย่างเดียว');
  if(table==='maintenance' && ['facility_id','court_id','equipment_id'].filter(c=>values[c]).length!==1) fail('Maintenance ต้องเลือกทรัพยากรอย่างเดียว');
  return values;
}
function booking(body) {
  const v={ member_id:id(body.member_id,'สมาชิก'),court_id:id(body.court_id,'สนาม'),booking_date:date(body.booking_date,'วันที่จอง'),
    start_time:time(body.start_time,'เวลาเริ่ม'),end_time:time(body.end_time,'เวลาสิ้นสุด'),
    total_amount:number(body.total_amount,'ยอดจอง',{optional:true}),
    payment_method:text(body.payment_method,'วิธีชำระ',30),booking_transaction_ref:varchar(body.booking_transaction_ref,'เลขอ้างอิง',100,true),
    pay_now:body.pay_now==='1', items:[] };
  if(v.start_time>=v.end_time) fail('เวลาเริ่มต้องก่อนเวลาสิ้นสุด');
  const items=body.items || [];
  if(!Array.isArray(items) || items.length>40) fail('รายการอุปกรณ์ไม่ถูกต้อง (สูงสุด 40 ประเภท)');
  const seen=new Set();
  for(const item of items) {
    if(!item || typeof item!=='object') fail('รายการอุปกรณ์ไม่ถูกต้อง');
    if(!item.equipment_id) continue;
    const equipment_id=id(item.equipment_id,'อุปกรณ์');
    if(seen.has(equipment_id)) fail('อุปกรณ์ประเภทเดียวกันให้รวมจำนวนในหนึ่งรายการ');seen.add(equipment_id);
    const rental_date=date(item.rental_date||body.booking_date,'วันเช่า'),due_date=date(item.due_date,'กำหนดคืน');
    if(due_date<rental_date) fail('กำหนดคืนต้องไม่ก่อนวันเช่า');
    v.items.push({equipment_id,quantity:number(item.quantity,'จำนวน',{integer:true,positive:true,max:2147483647}),rental_date,due_date,
      total_amount:number(item.total_amount,'ยอดเช่า',{optional:true}),transaction_ref:varchar(item.transaction_ref,'เลขอ้างอิงค่าเช่า',100,true)});
  }
  return v;
}
module.exports={ ValidationError,record,booking,id,date,time,text,number,fail };
