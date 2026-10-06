# Sports Club & Facility Booking

ระบบบริหารจัดการสถานออกกำลังกายและสระว่ายน้ำ สำหรับ Database Systems 2026

Node.js 20+ → Express / EJS → `mssql` connection pool → SQL Server 2019/2022

**เริ่มที่นี่:** รัน `schema.sql` → `logic.sql` → `data.sql`, ตั้ง `.env`, `npm ci`, `npm start` แล้วเปิด <http://127.0.0.1:3000>

## Clone repository

```bash
git clone https://github.com/Sushinull/sports-club-booking-system.git
cd sports-club-booking-system
```

คำสั่ง npm และ path `database/`, `scripts/`, `docs/`, `src/`, `tests/` ในเอกสารนี้อ้างอิงจาก root ของ repository ซึ่งมี `package.json` อยู่ ใช้โปรเจกต์ชุดนี้สำหรับติดตั้ง รัน และพัฒนาร่วมกัน

ชุดเริ่มต้นเดิมที่ใช้ฐานข้อมูล `sports_club` และ README รุ่นเก่าถูกนำออกจาก `main` เพื่อไม่ให้สับสนกับฐานข้อมูล `sports_club_booking` ที่ใช้งานปัจจุบัน เนื้อหาเดิมยังดูและกู้คืนได้จาก [commit ก่อนนำไฟล์ซ้ำออก](https://github.com/NTP00/sports-club-booking-system/tree/258fc295c3a9483cfc3c50b95ab8951a5149c732/archive/initial-scaffold)

## 1. สิ่งที่ต้องติดตั้ง

- Microsoft SQL Server 2019 หรือ 2022 (Developer สำหรับเรียน หรือ Express): เป็น Database Engine
- SSMS 22: เป็นโปรแกรมจัดการ Engine ต้องติดตั้ง SQL Server แยกด้วย
- Node.js รุ่น 20 ขึ้นไป พร้อม npm; Python 3 เฉพาะเมื่อจะสร้างข้อมูลจำลองใหม่
- ไม่ใช้ SQLite, React หรือระบบ Login และไม่มีตารางเพิ่มนอกเหนือ 9 ตารางที่ล็อกไว้

## 2. สร้างฐานข้อมูลใน SSMS

เชื่อมต่อ instance ของ SQL Server ด้วยบัญชีที่สร้าง Database/DDL ได้ เปิด New Query และรันทั้งไฟล์ตามลำดับ:

1. `database/schema.sql`: สร้าง `sports_club_booking`, 9 ตาราง, PK/FK/AK/CHECK, indexes, sequences และ TVP types
2. `database/logic.sql`: สร้าง functions, procedures, INSTEAD OF triggers และ weekly view
3. `database/data.sql`: ใส่ข้อมูลจำลองในฐานข้อมูลที่ยังว่าง
4. `database/queries.sql`: ลองทั้ง 10 query

หากต้องการรันรวม: เปิด Query → SQLCMD Mode, เปลี่ยน `project_root` ใน `database/run_all.sql` เป็น path ของโฟลเดอร์ repository ที่มี `package.json` แล้ว execute ไฟล์นั้น `:on error exit` จะหยุดเมื่อไฟล์ใดผิดพลาด

`schema.sql` รันซ้ำโดยไม่ลบข้อมูล แต่ไม่ได้ migrate schema เก่าที่โครงสร้างต่างกัน ให้ใช้ฐานข้อมูลใหม่กับงานนี้และรัน `npm run db:verify` ตรวจ drift; `logic.sql` ใช้ CREATE OR ALTER; `data.sql` ข้ามเมื่อ seed มีแล้วและไม่ reset sequence

## 3. เปิด TCP/IP และบัญชีเชื่อมต่อ

ใน SQL Server Configuration Manager → SQL Server Network Configuration → Protocols for instance → เปิด TCP/IP, ตั้ง TCP Port 1433 (หรือ port ที่เลือก) แล้ว restart SQL Server service

ไดรเวอร์เริ่มต้นใช้ SQL Authentication: เปิด SQL Server and Windows Authentication mode แล้ว restart ถ้ายังใช้ Windows Authentication อย่างเดียว สร้าง SQL Login ของโปรเจกต์และ Database User ที่ตรงกัน อย่าใส่รหัสผ่านใน source

ตัวอย่างสำหรับ local development เปลี่ยนรหัสผ่านก่อนรัน (ไฟล์ตัวอย่างไม่มีรหัสผ่านจริง):

```sql
use master;
create login sports_club_app with password = 'replace_with_a_strong_local_password';
go
use sports_club_booking;
create user sports_club_app for login sports_club_app;
go
```

จากนั้นรัน `database/permissions.sql` ด้วยบัญชี DBA เพื่อให้ app อ่านข้อมูลและทำเฉพาะ workflow ที่จำเป็น การทดสอบ SQL ใช้บัญชีผู้พัฒนาที่มี DML/DDL permission เพราะทดสอบ direct INSERT/UPDATE/DELETE โดยตั้ง credential เฉพาะ local `.env` แล้วเปลี่ยนกลับเป็นบัญชี app หลังทดสอบ

Named instance: ใช้ `DB_SERVER=localhost` และ `DB_INSTANCE=SQLEXPRESS`, เว้น `DB_PORT` ว่าง; ต้องเปิด SQL Browser หรือเลือกกำหนด static port แล้วใช้ `DB_PORT` โดยไม่ใช้ `DB_INSTANCE`

## 4. ตั้งค่าและเปิดเว็บ

เปิด terminal ในโฟลเดอร์ที่มี `package.json`:

```powershell
Copy-Item .env.example .env
npm ci
npm start
```

macOS/Linux ใช้ `cp .env.example .env` แทน Copy-Item แก้ `.env` ให้ตรงเครื่อง โดยเฉพาะ DB_SERVER, DB_PORT, DB_USER, DB_PASSWORD

```dotenv
HOST=127.0.0.1
PORT=3000
DB_SERVER=localhost
DB_PORT=1433
DB_DATABASE=sports_club_booking
DB_USER=sports_club_app
DB_PASSWORD=replace_with_your_local_password
DB_ENCRYPT=true
DB_TRUST_CERTIFICATE=true
DB_INSTANCE=
```

เปิด <http://localhost:3000> หรือ <http://127.0.0.1:3000> และตรวจ <http://127.0.0.1:3000/health> ถ้า DB ยังไม่พร้อม health คืน 503 ส่วนเว็บแสดงข้อความไทย ไม่เปิดเผย connection string/credentials

`DB_TRUST_CERTIFICATE=true` ใช้กับ certificate ทดสอบในเครื่อง ถ้าใช้ certificate ที่เชื่อถือได้ให้ตั้ง false เว็บ bind loopback เป็นค่าเริ่มต้น ไม่มี authentication จึงออกแบบสำหรับสาธิตในเครื่องหรือเครือข่ายที่จำกัดการเข้าถึง

## 5. หน้าจอและ workflow

| หน้า | ทำอะไรได้ |
|---|---|
| Dashboard | สมาชิก active, การจองวันนี้, รายการ overdue, ยอด paid, stock ว่างวันนี้ |
| Facilities / Courts / Members / Equipment / Staff | ค้นหา, เพิ่ม, แก้, เปลี่ยนสถานะ/ปิดใช้งาน |
| Court bookings | รายการ, รายละเอียด, สร้างผ่าน SP, ยกเลิกเมื่อไม่มี paid payment |
| Equipment rentals | รายการ, รายละเอียด, รับคืนวันจริง, ยกเลิกเมื่อไม่มี paid payment; สร้างผ่าน combined booking |
| Payments | รายการ, เพิ่มการชำระบางส่วน, รายละเอียด, แก้ข้อมูล/สถานะโดยรักษาต้นทาง |
| Maintenance | เพิ่ม/แก้ record, XOR target, เปลี่ยนสถานะ |
| Reports | เลือก Monday, ดู court/equipment utilization พร้อมหมวดหมู่ |

ตัวอย่างสาธิต: เลือก member active, court active, วันที่อยู่ในอายุสมาชิก, เวลา 11:00–12:00, เพิ่ม equipment active สองประเภทอย่างละ 1 ชิ้น, กำหนดวันคืน แล้วยืนยัน ระบบสร้าง booking 1, rental 2 และ payment สูงสุด 3 รายการ หากรายการใดผิดเงื่อนไข rollback ทั้ง operation

เลือก “บันทึกว่าชำระสำเร็จแล้ว” เฉพาะเมื่อรับเงินแล้ว หากต้องการจองก่อนชำระให้เอาเครื่องหมายออก แล้วเพิ่ม Payment ภายหลัง Payment ต้นทางแต่ละรายการต้องเลือกเพียง booking หรือ rental ช่อง snapshot ไม่รับค่าจาก form

## 6. Database architecture และ business logic

9 ตารางตามไฟล์อาจารย์/EER/Normalization: facilities, courts, members, court_bookings, equipment, equipment_rentals, payments, staff, maintenance; 11 FK; members.email และ staff.email เป็น UNIQUE NOT NULL

- ทุก FK ใช้ ON DELETE NO ACTION / ON UPDATE NO ACTION ไม่ลบประวัติผ่าน UI
- IDs เป็น VARCHAR(10) ใช้ sequence ไม่ใช้ MAX(id)+1; seed ใช้รหัสต่ำกว่า 100000 แล้วเริ่ม auto IDs ที่ 100000, sequence อาจมีช่องว่างหลัง rollback ได้ตามปกติ
- Booking ใช้ช่วงเวลา `[start_time,end_time)` จองติดกันได้ แต่ทับกันไม่ได้
- Rental ใช้ inclusive days: วันคืนจริงมีผลถึงสิ้นวัน ถ้าไม่คืนและ due_date เลยแล้ว effective_end เป็น 9999-12-31 ในการตรวจ stock; ไม่มี overdue status
- Stock ใช้ **peak simultaneous quantity** ตรวจที่วันเริ่มของแต่ละช่วง ไม่รวมรายการคนละวันที่ไม่ได้เกิดพร้อมกัน และไม่ลด total_quantity เมื่อเช่า
- total_amount เป็นยอดสุดท้ายที่แก้ได้ภายใต้ยอด paid; ค่า duration×rate เป็นเพียงยอดแนะนำ
- ยกเลิก booking/rental ได้เมื่อไม่มี paid Payment เพราะ schema ไม่มี refund ledger การเปลี่ยน Payment เป็น cancelled ไม่ใช่การคืนเงินจริง
- Cancellation/return เป็นการปิดประวัติ อนุญาตแม้ทรัพยากรถูกปิดภายหลัง โดยห้ามเปลี่ยนรายละเอียดการเช่า/จองพร้อมปิดรายการ

## 7. Stored Procedure และ ACID

`dbo.sp_BookCourtAndEquipment` รับ member, court, วันเวลา, ยอด booking แบบ optional, TVP `dbo.equipment_request` หลายประเภท, วิธีชำระ, reference แต่ละ payment และ pay_now

SP เปิด transaction + `SET XACT_ABORT ON` + TRY/CATCH + COMMIT/ROLLBACK, ล็อกก่อนอ่านข้อมูล, บันทึก confirmed booking, snapshot จาก catalog, rentals และ payments สถานะ paid เฉพาะยอด > 0 คืน 3 recordsets: booking ID, rental IDs, payment IDs

“หักเงิน” หมายถึงบันทึก Payment สำเร็จ ไม่มี wallet/table เพิ่ม ไม่มีการชำระเงินจริง SP ใช้ transaction ของตัวเอง แต่เรียกภายใน transaction ได้: เมื่อ fail จะ rollback ทั้ง transaction รวมถึง ambient transaction ของ caller; เมื่อสำเร็จ caller ยังเป็นผู้ commit transaction ภายนอก

## 8. Triggers และ concurrency

`trg_CheckCourtConflict` ตรงชื่อโจทย์ ตรวจ INSERT/UPDATE แบบหลายแถว ชน existing และชนกันเอง อีก 8 triggers บนตารางที่เหลือใช้ INSTEAD OF เพื่อขอล็อก **ก่อนเขียน base table** และ enforce rules เมื่อรัน DML ใน SSMS โดยตรง

`sp_lock_integrity` ใช้ `sp_getapplock` exclusive transaction-owned key เดียวสำหรับทั้งโปรเจกต์ เป็นการเลือกความเรียบง่ายและความถูกต้องสำหรับระบบขนาดเล็ก writer ต้องรอจน transaction จบ อ่านข้อมูลยังทำได้ ไม่มีช่อง SELECT-check-INSERT ที่ไม่ล็อก Snapshot isolation ถูกปฏิเสธสำหรับ writes เพื่อไม่อ่าน transaction snapshot เก่า

ระบบอาจคืน timeout/deadlock error เมื่อมีการใช้งานพร้อมกันมาก ให้ retry **ทั้ง operation** ความล้มเหลวไม่อนุญาต double commit ดู `docs/concurrency_test.md` และ `npm run db:concurrency`

## 9. Weekly reporting view

`vw_FacilityUtilizationReport` คืน utilization **ราย resource ต่อสัปดาห์** แยก resource_type court/equipment และใช้ resource_category ระบุประเภท equipment.facility_id ใน view เป็น NULL ตาม stock กลาง ไม่สร้างความสัมพันธ์ปลอม หน้า Reports คืนทรัพยากรทุกแถวของสัปดาห์ที่เลือก ไม่มี TOP(80) หรือการตัดแถวเงียบ

หน้า Reports ใช้ SQL คำนวณสัปดาห์ที่เลือกใน `reports()` โดยตรง ส่วน view เป็น reporting object ของโจทย์ ชุด `db:reports` ตรวจ service จริงกับ numerical oracle และ cross-check view เพื่อป้องกันสูตรสองทางคลาดเคลื่อน

- court = booked_minutes / (นาทีเปิดต่อวัน × 7) × 100; เฉพาะ confirmed
- equipment = quantity-days ที่ทับช่วง Monday–Sunday / (total_quantity × 7) × 100; ยกเว้น cancelled
- stock เป็น 0 → utilization NULL ด้วย NULLIF
- Monday คำนวณอิง 1900-01-01 ไม่ขึ้นกับ DATEFIRST; spine เริ่มสัปดาห์ข้อมูลแรกถึงวันสุดท้ายของข้อมูลหรือวันนี้ (สูงสุด 20,000 สัปดาห์ ครอบคลุมช่วงวันที่ของแอป ค.ศ. 1900–2099 ทั้งหมด)

หากต้องการสรุปรวมประเภท ให้ GROUP BY week_start, resource_type, resource_category แล้วคำนวณ `100.0 * SUM(utilized_units) / NULLIF(SUM(capacity_units), 0)` โดยรวมเฉพาะหน่วยเดียวกัน ห้ามใช้ AVG(utilization_percent) หรือเฉลี่ยเปอร์เซ็นต์ราย resource โดยตรง View และ output structure ปัจจุบันยังคงเดิมจนกว่าจะมี requirement จากอาจารย์ที่ชัดเจน

View ใช้เวลาทำการและ stock **ปัจจุบัน** เป็นตัวหารย้อนหลัง เพราะ schema ไม่มี capacity history จึงเป็น utilization เทียบความจุปัจจุบัน รวม planned rental dates ในอนาคตด้วย ไม่อ้างว่าเป็น audit ประวัติความจุที่เปลี่ยนไป

## 10. Mock data และ queries

| ตาราง | Seed records |
|---|---:|
| facilities | 20 |
| courts | 40 |
| members | 600 |
| equipment | 40 |
| staff | 25 |
| court_bookings | 1200 |
| equipment_rentals | 800 |
| payments | 1850 |
| maintenance | 40 |

ข้อมูลไม่ซ้ำกัน รักษา FK และกระจายช่วงหลายสัปดาห์ วันต่าง ๆ อิงวันที่ไทยเมื่อรัน data.sql มี active/inactive/maintenance, confirmed/cancelled, returned/overdue และ paid/pending/failed/cancelled พร้อมผลจริงสำหรับทุก query

สร้างไฟล์ใหม่: `python scripts/generate_mock_data.py` จะ regenerate `database/data.sql` เท่านั้น ไม่รันหรือแก้ DB

queries.sql: Q01–Q02 JOIN ≥3 tables; Q03–Q05 GROUP BY + HAVING; Q06–Q08 subquery/correlated subquery; Q09–Q10 window functions

## 11. การทดสอบ

```bash
npm test
npm run db:verify
npm run db:test
npm run db:concurrency
```

- npm test: ตรวจ validation, HTTP/EJS pages, CSRF, SQL allowlist และ TVP/SP contract ใช้ service test doubles ไม่มีการอ้างว่าทดสอบ DB จริง
- db:verify: ตรวจ schema กับ catalog, types/nullability/PK, FK parent/target schema-table-column และ actions, unique index ordered key columns/filter, trigger name/parent/type/events, constraints, จำนวน seed, queries ทั้งสิบคืนผล และ weekly view
- db:test หรือรัน database/tests.sql ใน SSMS: 58 positive/negative cases (รวม numerical reporting, actual-return day, 81 resources และ date boundaries), fixtures ใน transaction และ rollback ทุก case รวม SP failure กลางทาง sequences มีช่องว่างได้
- db:concurrency: 2 sessions จริง ทดสอบ court และ equipment ชิ้นสุดท้าย; เก็บ fixture ประวัติไว้แล้ว cancelled/inactive ไม่มี hard delete ให้รันกับ DB สำหรับพัฒนา

### Final report integration regression (SQL Server จริง)

`npm test` มี 61 tests; 4 tests ใหม่ตรวจ development-DB guard และการสร้าง mutation เฉพาะ reports() โดยไม่เขียน source ผล numerical จริงอยู่ในคำสั่งต่อไปนี้แยกจาก Node/unit tests:

```powershell
# ใช้ .env บัญชี developer เช่น sports_club_test กับ development/test DB เท่านั้น
# DB_TEST_DATABASE ต้องตรง DB_DATABASE และชื่อ DB ที่เชื่อมต่อจริง
$env:DB_TEST_DATABASE = 'sports_club_booking'
npm run db:verify
npm run db:test
npm run db:concurrency
npm run db:reports
npm run db:reports:mutation
```

- `db:reports` เรียก application service `createService(transactionDatabase).reports(week)` ที่ไม่ได้แก้ implementation: transactionDatabase สร้าง **mssql.Request จริงใน sql.Transaction เดียวกับ fixture** เพื่อให้เห็น uncommitted fixture และ rollback ได้ ไม่มี mock numerical result
- ตรวจ 6 สัปดาห์/กรณี รวม default Monday, Monday/Sunday boundaries, court 60 นาทีและ 90 วินาที, equipment inclusive/returned/overdue/cancelled/cross-week, zero usage/stock และ 41 courts +40 equipment ทุกสัปดาห์ พร้อมเทียบ view
- ค่าตั้งต้นที่รู้ล่วงหน้า: court 60/6720 ×100 =0.89%, equipment 4/70 ×100 =5.71%; ทุกแถวตรวจ week_start, utilized_units, capacity_units, utilization_percent
- Fixture ใช้ QAF/QAM/QAC/QAE/QAB/QAR reserved IDs; ถ้าชนจะหยุด ไม่ลบ/ทับข้อมูลเดิม ทุกการรัน rollback และตรวจว่าไม่มี fixture เหลือ ไม่มี COMMIT, hard DELETE, sequence reset หรือ table เพิ่ม
- `db:reports:mutation` ต้องให้ baseline ผ่านก่อน แล้วเปลี่ยน confirmed เป็น cancelled และ inclusive +1 เป็น +0 ใน module ชั่วคราวใน memory; ต้องถูก numerical assertion ปฏิเสธทั้งสองแบบ SQL/connection/permission error ไม่นับเป็น mutation detection ตรวจ source เดิม byte-identical ก่อนจบ
- ถ้า baseline numerical assertion ไม่ผ่าน ให้หยุดและวิเคราะห์ mismatch ก่อนแก้ production logic

จากนั้นใช้ `.env` บัญชี **sports_club_app** เดิมและรัน:

```powershell
npm run db:app
```

คำสั่งนี้ read-only ตรวจ principal ต้องเป็น sports_club_app, EXECUTE dbo.fn_today ที่เพิ่มใน c4a1081, SELECT rental function, `createService().reports()` จริง และ HTTP /health, /, /court_bookings/new, /reports ใน server ชั่วคราวบน loopback ไม่ต้องหยุดเว็บ port3000 ที่เปิดอยู่ ใช้บัญชี developer/DBA แทนไม่ได้ อย่าใส่ credential ในผลทดสอบหรือ Git

อ่าน `docs/validation_results.md` สำหรับผลตรวจจริงในรอบส่งมอบนี้

## 12. เอกสารและขอบเขตที่ยังต้องส่งเอง

Data dictionary, integrity constraints, design decisions, traceability matrix BR01–BR14, concurrency instructions, index rationale และคำอธิบายสำหรับ quiz อยู่ใน docs

ชื่อ objects พิเศษสามชื่อใช้ capitalization ตามชื่อหัวข้อที่โจทย์ระบุเฉพาะ แม้ general naming rule จะกำหนด lowercase; ชื่อ tables/columns/constraints/indexes/objects อื่นใช้ lowercase snake_case ไม่มีการเพิ่ม/ลด columns หรือเปลี่ยน FD

Schema ไม่รองรับ holiday hours, opening ข้ามคืน, maintenance time scheduling, capacity history, wallet, payment gateway, refund ledger, member login, หรือการผูก rental กับ booking เมื่อ combined operation เสร็จ rental เป็นรายการของสมาชิกโดยตรง ดังนั้นยกเลิก booking ไม่ยกเลิก rental อัตโนมัติ

การค้างคืนเกินกำหนดเกิดจากเวลาเปลี่ยนแม้ไม่มี DML หากไปทับ future reservation ระบบจะแสดงการครอบครองจริงและ reject การเพิ่ม/แก้ที่ทำให้ stock ไม่เพียงพอ ผู้ดูแลต้องรับคืนหรือปรับ reservation ไม่สามารถสร้างอุปกรณ์เพิ่มขึ้นจาก schema ได้ รายงานอาจแสดง >100% เมื่อ capacity ปัจจุบันลดจากอดีตหรือมี overdue ที่ทับ future reservations

สิ่งส่งมอบนอก source-code ZIP ที่อาจารย์ยังต้องการ: เล่มรายงาน PDF, คลิป Technical Walkthrough 5–7 นาที (ทุกคนร่วมบรรยายและเปิดกล้อง), Peer Evaluation และ Individual Quiz ดูแนวทางใน docs/submission_support.md

## Troubleshooting

| อาการ | ตรวจอะไร |
|---|---|
| Login failed | SQL login/password และ mixed mode; database user mapping |
| Connection refused/timeout | Engine service, TCP/IP, port, instance; SQL Browser สำหรับ named instance |
| Certificate error | local self-signed ใช้ DB_TRUST_CERTIFICATE=true |
| Seed requires empty tables | อย่าลบข้อมูลเดิม ใช้ DB ใหม่กับ script ชุดนี้ |
| Opening/resource/member rejected | ตรวจสถานะและวันเริ่มบริการ ไม่ตรวจเฉพาะชื่อใน dropdown |
| Cancellation rejected | ยังมี Payment paid; ไม่มี refund workflow อัตโนมัติ |
| Stock rejected despite passing due_date | มี rental overdue ยังไม่บันทึกวันคืนจริง |

## Official references

- Microsoft: <https://learn.microsoft.com/en-us/sql/relational-databases/system-stored-procedures/sp-getapplock-transact-sql>
- Microsoft: <https://learn.microsoft.com/en-us/sql/t-sql/statements/create-trigger-transact-sql>
- node-mssql: <https://tediousjs.github.io/node-mssql/>
