# BR01–BR14 traceability matrix

Database เป็น source of truth; frontend/backend ไม่สามารถทำให้ DB ยอมรับค่าที่ผิด rule ได้ แต่ผล execution ต้องยืนยันด้วยชุดทดสอบบน SQL Server ดู validation_results.md

| BR | Table / column | Constraint | Index | Trigger | Procedure | Backend validation / workflow | Test cases |
|---|---|---|---|---|---|---|---|
| BR01 facility 1:N court | courts.facility_id | FK + NOT NULL → facilities; NO ACTION | ix_courts_facility | trg_courts_integrity (write gate) | sp_lock_integrity | record(): FK ID/type; catalog save | T01, db:verify FK mapping |
| BR02 member 1:N booking | court_bookings.member_id | FK NOT NULL → members | ix_bookings_member | trg_CheckCourtConflict | sp_BookCourtAndEquipment | booking(): member ID | T01,T23,T24 |
| BR03 no court overlap | court_id,date,start_time,end_time,status | start<end, status CHECK | ix_bookings_conflict | trg_CheckCourtConflict; full set join includes inserted pairs | sp_BookCourtAndEquipment + lock | booking(): interval; DB error mapping | T02,T03,T04,T26,T27; court concurrency |
| BR04 member/equipment 1:N rentals | member_id,equipment_id | 2 NOT NULL FK; one equipment/row | ix_rentals_member,ix_rentals_stock | trg_equipment_rentals_integrity | SP + TVP equipment_request PK equipment_id | booking(): items array, duplicate ID rejection | T24,T28; db:verify |
| BR05 quantity/availability | quantity,total_quantity,rental_date,due_date,return_date,status | quantity>0, stock>=0, date CHECK, status/return consistency | ix_rentals_stock | trg_equipment_integrity; trg_equipment_rentals_integrity | sp_check_stock; fn_rental_periods; writer gate | number(): integer positive; return workflow | T10–T14,T22,T28,T31,T32,T37; stock concurrency |
| BR06 payment XOR | booking_id,rental_id | ck_payments_02 + 2 nullable FK | ix_payments_booking,ix_payments_rental | trg_payments_integrity | SP creates separate Payment per source | record('payments'): XOR | T15,T24,T34 |
| BR07 paid ceiling/final amount floor | payments.amount,status; transaction.total_amount | amount>0, total>=0 | ix_payments_booking,ix_payments_rental | booking/rental/payments triggers | sp_check_paid_totals | number(): monetary range; DB errors | T18,T19,T36; serialized writer gate |
| BR08 staff 1:N maintenance | maintenance.staff_id | NOT NULL FK→staff | ix_maintenance_staff | trg_maintenance_integrity | sp_lock_integrity | record(): staff FK ID | T33; db:verify |
| BR09 maintenance XOR | facility_id,court_id,equipment_id | ck_maintenance_02 + nullable FK | ix_maintenance_facility/court/equipment | trg_maintenance_integrity | sp_lock_integrity | record('maintenance'): exactly one target | T33 |
| BR10 opening hours | facility.opening/closing; booking.start/end,date | opening<closing; start<end | ix_courts_facility,ix_bookings_conflict | trg_facilities_integrity; trg_CheckCourtConflict | SP writer lock | record facilities interval; booking times | T05,T29 |
| BR11 booking snapshot | hourly_rate_snapshot,courts.hourly_rate | snapshot/rate>=0 | court PK lookup | trg_CheckCourtConflict copies INSERT and rejects UPDATE changes | SP no client snapshot input | booking form/service excludes snapshot | T20,T21,T44 |
| BR12 rental snapshot | rental_rate_snapshot,equipment.rental_rate | snapshot/rate>=0 | equipment PK lookup | trg_equipment_rentals_integrity copies INSERT and rejects changes | SP computes suggestion, trigger sets snapshot | booking item excludes snapshot | T21,T30 |
| BR13 membership eligibility | members.status,start/end; booking/rental start date | membership_end>=start; FK NOT NULL | members PK, ix_bookings_member,ix_rentals_member | booking/rental triggers validate date and active | SP + gate | ID/date parse; DB membership errors | T06,T07,T38 |
| BR14 resource eligibility | facilities/courts/equipment.status | status CHECK dictionaries | resource PK, ix_courts_facility | booking/rental triggers; closure preserves transaction details | SP + gate | UI shows status, server maps validation errors | T08,T09,T41,T42,T43 |

หลักฐานเพิ่มเติม: schema_catalog.json ที่ใช้ตรวจคือ src/config/schema.json; scripts/verify_database.js เทียบ types/nullability/keys กับ SQL metadata; docs/test_case_inventory.md มี positive/negative ทุก case

## Lifecycle clarifications

- snapshot และ member/resource IDs ของ transaction เปลี่ยนไม่ได้ เพราะเป็นประวัติทางธุรกิจ
- BR14 การสร้าง/แก้รายการที่ยัง active ตรวจ status; การปิด cancellation/return ไม่ควรถูก resource ที่หยุดใช้บริการภายหลังขวาง จึงอนุญาตการปิดโดยรักษารายละเอียดเดิม (T42/T43)
- สมาชิกหยุดใช้งานหลังสร้างรายการไม่ลบประวัติเก่า; การแก้รายการ active ต้องผ่าน eligibility อีกครั้ง
- paid transaction ยกเลิกได้เมื่อ paid records ถูกจัดการภายนอกและเปลี่ยนสถานะแล้ว ไม่สร้าง refund table
