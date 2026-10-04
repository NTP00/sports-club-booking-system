# Index rationale

| Index | ทำไมใช้ |
|---|---|
| pk_* (9 ตาราง) | uniqueness และ lookup/join ด้วย ID |
| ak_members_email / ak_staff_email | บังคับ email candidate key และค้นอีเมล |
| ix_courts_facility | join รายการ court ของสถานที่และตรวจ future hours |
| ix_bookings_conflict | seek court/day/status แล้วเปรียบเทียบ time overlap; INCLUDE member/total ลด lookup ในรายงาน |
| ix_bookings_member | ดูประวัติของสมาชิกและกรองวัน/status |
| ix_rentals_stock | กรอง equipment/status/date range; quantity เป็น INCLUDE สำหรับ sum occupancy |
| ix_rentals_member | ดูรายการเช่า/overdue ของสมาชิก |
| ix_payments_booking | sum paid โดย booking และ payment list |
| ix_payments_rental | sum paid โดย rental และ payment list |
| ux_payments_ref | UNIQUE WHERE transaction_ref IS NOT NULL; ไม่บังคับ NULL ให้มีได้แถวเดียว |
| ix_maintenance_staff | งานของเจ้าหน้าที่และวันที่ |
| ix_maintenance_facility | ประวัติซ่อมสถานที่ตาม FK/date |
| ix_maintenance_court | ประวัติซ่อม court ตาม FK/date |
| ix_maintenance_equipment | ประวัติซ่อม equipment ตาม FK/date |

ไม่มี index ทุก attribute โดยไม่จำเป็น เพราะเพิ่ม storage และต้นทุน DML ทุก index มี workload ที่ใช้จริง Stock effective_end เป็น derived expression จึงไม่สร้าง filtered index ใช้วันที่ปัจจุบันที่เปลี่ยนเอง

ข้อจำกัด: LIKE '%คำค้น%' ของหน้าค้นหาทั่วไปเป็น scan, global writer gate และ stock self-join เป็นแนวทางสำหรับ dataset งานเรียน ต้อง benchmark/review plans ก่อนขยายเป็นระบบ production ไม่อ้างว่ามี throughput สูงโดยไม่วัด
