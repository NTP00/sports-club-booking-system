# Integrity constraints

## ประเภทของการบังคับ

| Layer | บทบาท |
|---|---|
| PK | รหัสหนึ่งรายการไม่ซ้ำและไม่ NULL |
| AK | members.email, staff.email UNIQUE NOT NULL |
| FK | 11 ความสัมพันธ์ ตาม EER; ON DELETE/UPDATE NO ACTION |
| CHECK | จำนวน/ราคา/ยอด, ช่วงวันเวลา, status allowlist, payment/maintenance XOR, rental status ↔ actual return consistency |
| Filtered unique index | transaction_ref ไม่ NULL ไม่ซ้ำ; NULL หลายแถวได้; ไม่ใช่ candidate key |
| INSTEAD OF trigger | ล็อกก่อนเขียน, copy snapshots, ป้องกันแก้ snapshots, overlap, stock/paid ceiling, eligibility, opening changes |
| SP | combined operation, multi-equipment TVP, ACID, return IDs |
| Backend | parse types, length/date/status/XOR, parameterized query, reject ID changes |
| Frontend | required/min/max, รองรับหลาย equipment, price suggestion; ไม่ใช่ final protection |

ทุก table มี NOT NULL ตาม EER ยกเว้น return_date, payment source/ref และ maintenance target ที่ระบุ nullable ไม่มีการเติม FD ใหม่จากสูตรราคา

## CHECK inventory

ดู schema.sql และ data_dictionary.md สำหรับ expression จริง รวม: membership_end>=membership_start; opening_time<closing_time; start_time<end_time; due_date>=rental_date; return_date>=rental_date เมื่อมีค่า; capacity>0; total_quantity>=0; quantity>0; rates/snapshots/totals/cost>=0; payments.amount>0; paid payment มี payment_date NOT NULL

Payment XOR = ผลรวมตัวบ่งชี้ FK non-NULL เท่ากับ 1; Maintenance XOR = ผลรวม 3 FK non-NULL เท่ากับ 1 `transaction_ref` ถ้ามีต้องไม่เป็น space-only ใช้ trimmed LEN และ filtered unique index

Rental returned ต้องมี return_date; active/cancelled ไม่มี return_date เพื่อไม่ให้ cancelled หรือ active แอบเปลี่ยนความหมายวันคืน ป้องกัน reopening และแก้ actual return ที่บันทึกแล้ว

## Defensive triggers

| Trigger | ตาราง | ตรวจหลัก |
|---|---|---|
| trg_CheckCourtConflict | court_bookings | membership/resource/hours, historical immutability, multirow overlap, paid floor, cancellation |
| trg_equipment_rentals_integrity | equipment_rentals | eligibility, historical immutability, status/return, stock peak, paid floor |
| trg_equipment_integrity | equipment | stock floor หลังเปลี่ยนจำนวน |
| trg_payments_integrity | payments | source immutable, ห้ามจ่าย cancelled, paid ceiling |
| trg_facilities_integrity | facilities | future bookings ต้องยังอยู่ใน opening hours |
| trg_courts_integrity | courts | court ที่มีประวัติย้าย facility ไม่ได้ |
| trg_members_integrity | members | write gate + immutable PK; CHECK/AK/FK |
| trg_staff_integrity | staff | write gate + immutable PK; CHECK/AK/FK |
| trg_maintenance_integrity | maintenance | write gate + immutable PK; CHECK/FK/XOR; ห้าม hard delete record |

Triggers ใช้ inserted/deleted แบบ set-based ไม่ใช้ cursor สมมติแถวเดียว ไม่ disable triggers หรือ constraints เพื่อ seed/test ไม่มี trusting client snapshot ตอน INSERT copy catalog rate ตอน UPDATE ตรวจค่ากับ deleted ห้ามเปลี่ยน

Transaction/history tables ปฏิเสธ hard delete ทุกแถว catalog tables จะ delete ได้เฉพาะเมื่อไม่มี FK อ้างอิง แต่ UI ใช้ status แทน IDs immutable แม้ไม่มี FK อ้างอยู่

การลด stock ตรวจเฉพาะปริมาณที่ยังผูกพันวันนี้และอนาคต ไม่ใช้ peak ในอดีตที่คืนแล้วมาขวางการปลดอุปกรณ์ออกจาก stock (T45/T46) การ INSERT หรือขยาย rental ตรวจตั้งแต่วันเริ่มของช่วงที่แก้ การปิด return/cancel ตรวจวันนี้และอนาคต เพราะเป็นการปล่อย occupancy รายงานอดีตอาจมีเปอร์เซ็นต์เกิน100เมื่อ denominator stock ปัจจุบันลดลง

## Lock invariant

ทุก base-table write ผ่าน INSTEAD OF trigger ขอ exclusive key เดียวกันและถือไว้จน transaction จบ SP ขอ key ก่อนตรวจหรือเขียน จึงไม่มีสอง writer ตรวจ state เก่าแล้ว commit ช่วงเวลาหรือจำนวนชนกัน ใช้ default READ COMMITTED; write ภายใน SNAPSHOT transaction ถูกปฏิเสธ

CHECK/UNIQUE/FK เกิดบน statement ที่ trigger เขียนลง base table; หากตรวจหลังเขียนแล้ว THROW จะ rollback statement/transaction ตาม XACT_ABORT ไม่มีค่าผิด committed

Deadlock ยังเป็นไปได้กับการใช้ transaction อื่นที่อ่าน/ล็อก rows คนละลำดับ จัดการโดย SQL Server เลือก victim และผู้ใช้ retry ทั้ง transaction ไม่มีการรับประกันว่า concurrency จะสำเร็จทั้งหมด; รับประกันเชิงออกแบบว่ารายการที่ผิด invariant จะ commit ไม่ได้ หลักฐาน runtime ต้องดู validation_results.md

## การเปลี่ยนแปลง catalog

Member/resource status ที่เปลี่ยนภายหลังไม่ยกเลิก transaction เก่าทันที แต่การสร้าง/แก้ transaction active จะตรวจสถานะใหม่ ส่วน cancellation/return อนุญาตให้ปิดประวัติได้โดยไม่เปลี่ยนรายละเอียดพร้อมกัน ไม่ปรับ snapshot ตาม catalog price และไม่ปรับ total_amount ย้อนหลังโดยอัตโนมัติ

Maintenance เป็น record เท่านั้น ต้องเปลี่ยน resource.status เองเมื่อทรัพยากรหยุดให้บริการ ไม่สร้าง implicit booking exclusion จาก maintenance_date ซึ่งไม่มีเวลาสิ้นสุด
