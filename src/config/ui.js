'use strict';
const schema = require('./schema.json');
const titles = {
  facilities:'สถานที่', courts:'สนาม', members:'สมาชิก', equipment:'อุปกรณ์',
  court_bookings:'การจองสนาม', equipment_rentals:'การเช่าอุปกรณ์',
  payments:'การชำระเงิน', staff:'เจ้าหน้าที่', maintenance:'การบำรุงรักษา'
};
const labels = {
  facility_id:'รหัสสถานที่', facility_name:'ชื่อสถานที่', facility_type:'ประเภทสถานที่',
  location:'ที่ตั้ง', opening_time:'เวลาเปิด', closing_time:'เวลาปิด', status:'สถานะ',
  court_id:'รหัสสนาม', court_name:'ชื่อสนาม', court_type:'ประเภทสนาม', capacity:'ความจุ', hourly_rate:'ราคาต่อชั่วโมง',
  member_id:'รหัสสมาชิก', first_name:'ชื่อ', last_name:'นามสกุล', phone:'โทรศัพท์', email:'อีเมล',
  membership_type:'ประเภทสมาชิก', membership_start:'เริ่มสมาชิก', membership_end:'สิ้นสุดสมาชิก',
  booking_id:'รหัสการจอง', booking_date:'วันที่จอง', start_time:'เวลาเริ่ม', end_time:'เวลาสิ้นสุด',
  total_amount:'ยอดสุดท้าย (บาท)', hourly_rate_snapshot:'ราคาต่อชั่วโมง ณ การจอง', created_at:'เวลาสร้าง',
  equipment_id:'รหัสอุปกรณ์', equipment_name:'ชื่ออุปกรณ์', equipment_type:'ประเภทอุปกรณ์',
  total_quantity:'จำนวนทั้งหมด', rental_rate:'ราคาต่อชิ้นต่อวัน', rental_id:'รหัสการเช่า', rental_date:'วันเริ่มเช่า',
  due_date:'กำหนดคืน', return_date:'วันคืนจริง', quantity:'จำนวน', rental_rate_snapshot:'ราคาต่อชิ้นต่อวัน ณ การเช่า',
  payment_id:'รหัสการชำระ', amount:'ยอดชำระ (บาท)', payment_date:'วันที่ชำระ', payment_method:'วิธีชำระ', transaction_ref:'เลขอ้างอิง',
  staff_id:'รหัสเจ้าหน้าที่', position:'ตำแหน่ง', maintenance_id:'รหัสบำรุงรักษา', maintenance_date:'วันที่บำรุงรักษา',
  description:'รายละเอียด', cost:'ค่าใช้จ่าย (บาท)', week_start:'สัปดาห์เริ่มวันจันทร์', resource_type:'ประเภททรัพยากร',
  resource_id:'รหัสทรัพยากร', resource_name:'ชื่อทรัพยากร', resource_category:'หมวดหมู่', utilized_units:'ปริมาณใช้งาน',
  capacity_units:'ปริมาณรองรับ', utilization_percent:'อัตราใช้งาน (%)', paid_amount:'ชำระสำเร็จ', overdue:'เกินกำหนด', available_today:'ว่างวันนี้'
};
const masters = new Set(['facilities','courts','members','equipment','staff','maintenance']);
function format(value, type='') {
  if (value == null) return '—';
  if (value instanceof Date) {
    const iso=value.toISOString();
    return type.startsWith('time(') ? iso.slice(11,19) : type.startsWith('datetime') ? iso.slice(0,19).replace('T',' ') : iso.slice(0,10);
  }
  return String(value);
}
module.exports = { schema,titles,labels,masters,format };
