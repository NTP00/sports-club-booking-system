# Design decisions and quiz notes

## Source precedence

อ่าน Assignment 2026 ทั้ง 13 หน้า, EER/Relational Schema 2 หน้า, Normalization 10 หน้า และ prompt txt ก่อนเขียน Schema ไม่พบความขัดแย้งเชิงโครงสร้าง 9 ตาราง ใช้รูป Relational Schema หน้า 1 เป็นหลักในการอ่านชนิดข้อมูล เพราะ PDF text extraction ของ facilities สลับ NVARCHAR(100/50/150)

ข้อกำหนดทั่วไปให้ naming lowercase แต่หัวข้อ 21 ให้ชื่อ objects 3 ตัวเฉพาะแบบ Pascal/camel case พร้อม prompt บังคับ EXACT NAME จึงรักษาชื่อ sp_BookCourtAndEquipment, trg_CheckCourtConflict, vw_FacilityUtilizationReport เป็นข้อยกเว้น ชื่ออื่น lowercase snake_case ไม่มีการออกแบบ schema ใหม่เงียบ ๆ

## Decisions

| เรื่อง | การเลือกและเหตุผล |
|---|---|
| Stock กลาง | equipment ไม่มี facility_id ตาม EER ใช้ได้ทั้ง club ไม่สร้าง FK ปลอม |
| total_quantity | stock รวม ไม่ decrement ตอนเช่า ใช้ rental periods คำนวณว่าง |
| Price snapshots | rates ณ INSERT จาก catalog ฝั่ง DB immutable ป้องกัน catalog price เปลี่ยนประวัติ |
| Final amounts | total_amount เป็นยอดธุรกรรมสุดท้าย optional override ใน SP ได้ ไม่บังคับ FD duration×rate |
| Membership | วันที่เริ่ม booking/rental อยู่ระหว่าง start/end inclusive ไม่บังคับ due_date อยู่ใน membership เพราะ BR ไม่ได้ระบุ |
| Opening | ชุดเวลาเดียวทุกวันและไม่ข้ามวัน; future confirmed bookings ถูกป้องกันเมื่อเปลี่ยน opening |
| Rental days | inclusive; คืนจริงในวันหนึ่งยังใช้วันนั้น; ไม่คืน overdue ถือใช้ต่อไป |
| Availability | ตรวจ peak quantity ที่ rental starts, ไม่ sum รายการ disjoint ทั้งหมด |
| ID | sequence + prefix + 7 digits VARCHAR(10), no cycle; มี gaps ได้ ไม่ใช้ MAX+1 |
| Transactions | global writer lock เป็น tradeoff สำหรับงานเรียน: เข้าใจง่ายและคุมทุก resource/price/payment path |
| Cancellation | เฉพาะไม่มี paid payment; closed entries เปิดใหม่ไม่ได้; สร้างรายการใหม่แทน |
| FK actions | NO ACTION รักษาประวัติ, catalog UI ใช้ inactive/maintenance |
| Actual return | ต้องมี return_date เมื่อ returned, วันที่ไม่ก่อน rental_date; UI ไม่รับ actual return ในอนาคต |
| Historical identity | booking/rental member/resource และ snapshot immutable; court มีประวัติย้าย facility ไม่ได้ |
| Maintenance | history/record ไม่ใช่ time scheduling ไม่เปลี่ยนสถานะ resource โดยอัตโนมัติ |
| Datetimes | schema DATETIME2(0) เป็นเวลาของ SQL Server ไม่มี timezone ใน column; วันที่ธุรกิจ/current-day ใช้เวลาไทยจาก fn_today |
| Reporting | view คืนราย resource/สัปดาห์ พร้อม resource_category; denominator ใช้ catalog ปัจจุบัน มี zero-usage rows; stock กลาง facility NULL; รวมประเภทด้วย SUM(utilized_units)/SUM(capacity_units) × 100 แยก resource_type ไม่เฉลี่ยเปอร์เซ็นต์ |
| Web scope | no Login ตาม prompt; loopback default, CSRF, parameterized query, escaped EJS, allowlist identifiers |

## อธิบาย BCNF อย่างไร

ภายใต้ FD ที่เอกสาร Normalization ระบุ ทั้ง 9 relations อยู่ใน BCNF ทุก non-trivial determinant เป็น PK หรือ email AK ของ members/staff; ทุก attribute atomic (1NF), single-attribute candidate keys ไม่มี partial dependency (2NF), ไม่มี transitive dependency ที่ละเมิด 3NF และ determinant เป็น superkey (BCNF)

การมี FK ไม่ได้ทำให้ relation ผิด BCNF: court_id→facility_id แต่ facility_id ไม่ได้กำหนด court_name/capacity ของทุก court ใน relation เดียวกัน 1 facility มีหลาย courts และรายละเอียด facility อยู่แยกตารางแล้ว

total_amount ไม่ได้ถูกกำหนดโดย quantity/rate/duration ตาม FD ที่ล็อก เพราะราคา final มี adjustment ได้ Snapshot เป็นค่าธุรกรรมตาม ID ไม่ใช่ FD equipment_id→snapshot สำหรับธุรกรรมทุกเวลา

## คำถาม Individual Quiz

1. **PK กับ FK ต่างกันอย่างไร?** PK ระบุรายการหนึ่งเดียว FK อ้าง PK ของอีกตารางเพื่อรักษาความสัมพันธ์ เช่น booking.court_id
2. **Payment XOR ทำไม?** payment มีต้นทางเดียว จะจ่าย booking และ rental พร้อมกันต้องสร้างสอง payment ป้องกันตีความ amount ว่าจ่ายอะไร
3. **Maintenance XOR ทำไม?** งานหนึ่ง record อ้าง target หนึ่งประเภท ไม่กำกวมว่า cost และ description เป็นของ resource ไหน
4. **AK email ทำไม NOT NULL?** เป็น candidate key ต้องระบุแถวได้ทุกแถว unique อย่างเดียวบน nullable column ไม่ทำหน้าที่ key เต็มรูปแบบ
5. **transaction_ref ทำไมไม่ AK?** บาง payment ไม่มี reference ใช้ NULL ได้ แต่ filtered unique index ป้องกันค่าที่มีซ้ำกัน
6. **Snapshot ทำไมอยู่ใน transaction?** เช่น court.rate จาก100เป็น200 การจองเดิม snapshot100 ต้องคงเดิม ไม่ดึง current rate มาเขียนทับ
7. **Overlap ตรวจอย่างไร?** existing.start<new.end AND existing.end>new.start สำหรับ court/day เดียวกันและ confirmed; equality endpoints ไม่ overlap
8. **ACID ของ combined SP?** A: fail จุดใด rollbackทั้งหมด; C: constraints/triggersคุม BR; I: transaction lock กัน competing writes; D: COMMIT ลง SQL Server log
9. **ทำไม lock ก่อนเขียน?** กันทั้งสอง session ตรวจว่างจาก state เดียวกันแล้วจอง resource เดียวกัน SP และ defensive triggers ใช้ gate เดียว
10. **ลด total_quantity เมื่อเช่าผิดอย่างไร?** จะสูญเสียความหมายจำนวนทั้งหมดและคำนวณ availability ของวันอนาคตผิด ต้องใช้ occupied periods
11. **Overdue คือ status ไหม?** derive active/unreturned with due_date<today ไม่เก็บ enum overdue ที่หมดความจริงตามเวลา
12. **View เป็น historical truth ไหม?** numerator จาก transaction records แต่ denominator ใช้ opening/stock ปัจจุบัน ไม่มี capacity-history table
13. **ทำไมไม่มี superclass persons?** schema ที่ล็อกมี members/staff แยกตามบทบาท เหมือนบาง attributes ไม่จำเป็นต้องเพิ่ม table และไม่เปลี่ยน design freeze
14. **Refund ทำได้ไหม?** มีเพียงสถานะ payment ไม่มี refund transaction/ledger ต้องจัดการเงินจริงภายนอกก่อนปรับสถานะบันทึก ไม่อ้างว่าระบบคืนเงินเอง
