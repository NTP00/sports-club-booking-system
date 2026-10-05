# Validation and test evidence

## Final QA / Source Freeze — 2026-10-05

Repository: `NTP00/sports-club-booking-system`, branch `main`.
Audit base และ HEAD ก่อนเริ่ม: `c4a1081e5f5c985069844ac15c46d015fbfc2515`.
QA source/test implementation: `3250e3374ae3297fdb3ffca291518780ae08942e`.

เกณฑ์: Strict Audit ล่าสุดของ HEAD นี้, FINAL QA + SOURCE FREEZE และ design freeze ของผู้ใช้ ไม่เปลี่ยน production implementation, schema, EER, normalization หรือ BR01–BR14

### Final local SQL Server results — ยืนยันโดยผู้ใช้ 2026-10-05 (Asia/Bangkok)

ผู้ใช้รายงานว่า final QA ทั้งหมดผ่านบน SQL Server จริงใน local environment รวม real-DB reports integration, mutation detection และ sports_club_app runtime ผล local ด้านล่างบันทึกจากผลที่ผู้ใช้ยืนยันในบทสนทนา ไม่ใช่การ execute SQL Server โดย Work

Work ไม่มี SQL Server endpoint/credential ที่พร้อมใช้ ผล Engine ของ Work จึงยังเป็น **NOT EXECUTED IN THIS ENVIRONMENT** ส่วนหลักฐาน runtime สำหรับการปิด QA มาจาก local execution ที่ผู้ใช้รายงานสำเร็จ

| Check | Work execution | Local execution (user-reported) | ขอบเขตหลักฐาน |
|---|---|---|---|
| npm ci | PASS | ไม่ได้ระบุ | package-lock เดิม; Work ติดตั้ง155packages; dependencies ไม่เปลี่ยน |
| npm test | **61/61 PASS** | **61/61 PASS** | 57เดิม +4 development-DB guard/in-memory mutation-construction tests |
| node --check | PASS,22JSfiles | ไม่ได้ระบุ | src/scripts/tests รวมไฟล์ใหม่; ไม่รวม node_modules |
| EJS compile | PASS,10templates | ไม่ได้ระบุ | templates ไม่เปลี่ยน |
| SQL static parse | PASS,118checks,0errors | ไม่ได้ระบุ | ScriptDom161.8901.0/TSql150Parser:6SQLfiles +58embeddedcases +1fixturebatch +53JS-generated/harness SQL statements |
| db:verify | NOT EXECUTED IN THIS ENVIRONMENT | **PASS** | ตรวจ schema catalog บน SQL Server จริง |
| db:test | NOT EXECUTED IN THIS ENVIRONMENT | **58/58 PASS** | SQL positive/negative suite |
| db:concurrency | NOT EXECUTED IN THIS ENVIRONMENT | **PASS court; PASS equipment** | two-session concurrency ทั้งสอง resource |
| db:reports | NOT EXECUTED IN THIS ENVIRONMENT | **PASS** | 6weekcases ×81resources; numerical oracle/view match; fixture rollback verified |
| db:reports:mutation | NOT EXECUTED IN THIS ENVIRONMENT | **PASS ทั้งสอง mutation** | confirmed→cancelled และ inclusive+1→+0 ถูก numerical assertion ตรวจจับ |
| db:app | NOT EXECUTED IN THIS ENVIRONMENT | **PASS** | sports_club_app principal, fn_today EXECUTE, rental function SELECT, real reports(), /health, /, /court_bookings/new, /reports |

SQL static parse ตรวจ grammar เท่านั้น ไม่ใช่ SQL Server execution, binding, permissions หรือ numerical/concurrency PASS

### QA gaps ที่ปิดด้วย source checks และ local runtime results

- RA01: เพิ่ม `tests/reports.integration.js` เรียก production `createService(transactionDatabase).reports(week)` ผ่าน mssql.Request/Transaction จริง ไม่แก้ service และไม่ใช้ mock numerical result ตรวจ6กรณีสัปดาห์กับ literal oracle และ `dbo.vw_FacilityUtilizationReport` ทั้ง81resourcesต่อกรณี
- Court:60min/6720min=0.89%,90sec=1.5min=0.02%, Sunday/Monday boundaries และ confirmed/cancelled Equipment:2ชิ้น×inclusive2days=4piece-days/70=5.71%, returned/actual-return day, overdue, cross-week, zero usage และ stock0→percentNULL ทุกแถวตรวจ week_start/utilized_units/capacity_units/utilization_percent
- Fixture เป็น transaction เดียวกับ service ใช้ reserved IDs และ explicit DB_TEST_DATABASE opt-in ถ้าชนจะหยุด ไม่ลบ/ทับข้อมูล ทุกครั้ง rollback/ตรวจ residue0 ไม่มี hard delete ประวัติหรือ sequence reset
- `scripts/test_report_mutations.js` ต้อง baseline ผ่านก่อน จากนั้นโหลด reports() ที่เปลี่ยน confirmed→cancelled และ inclusive+1→+0 ชั่วคราวใน memory ต้องเกิด **service numerical assertion** ทั้งสอง mutation SQL/permission/connection/view/cleanup error ไม่นับเป็น detection Source บน disk ไม่ถูกแก้ และตรวจ byte-identical ก่อนจบ
- `scripts/verify_app_runtime.js` read-only ตรวจ actual sports_club_app principal, EXECUTE fn_today (grant ใน c4a1081), rental function SELECT, service reports() จริง และ HTTP /health, /, /court_bookings/new, /reports
- RA02: อัปเดต inventory, concurrency context, README และ evidence นี้ แยก Work checks จากผล final local Engine ที่ผู้ใช้รายงาน ทุก required runtime check ผ่านตามผลยืนยันล่าสุด

### Final source audit

`src/` และ `database/` ทุกไฟล์ byte-identical กับ audit HEAD รวม schema.json/config/.env workflow, trigger/SP/transaction/view/SQL tests เดิม เอกสาร design/dictionary/traceability/constraints/index rationale และ package-lock ก็ไม่เปลี่ยน

- 9tablesเดิม ไม่มี table/column ใหม่ EER mapping/Normalization/BR14: **NO CHANGE**
- Stored Procedure `sp_BookCourtAndEquipment` + BEGIN/COMMIT/ROLLBACK, `trg_CheckCourtConflict`, stock protection, paid-total/payment constraints และ reporting view ยังครบ
- Complex Queries Q01–Q10 ยังครบ10; mock data ยัง4615rows:facilities20,courts40,members600,bookings1200,equipment40,rentals800,payments1850,staff25,maintenance40
- แก้เฉพาะ test/verification, package commands และเอกสารหลักฐาน ไม่มี production logic/UI changes ไม่มี .env/credential/node_modules/generated logs/test residue หรือ applied mutation ใน source ที่เตรียม commit

### Commands สำหรับทำซ้ำ final regression บนเครื่อง local

ตั้ง `.env` เดิมเป็นบัญชี developer/test กับ development DB ที่ตรงกับ DB_TEST_DATABASE แล้วรันใน repository root (PowerShell):

```powershell
git pull --ff-only origin main
npm ci
npm test
$env:DB_TEST_DATABASE = 'sports_club_booking'
npm run db:verify
npm run db:test
npm run db:concurrency
npm run db:reports
npm run db:reports:mutation
```

จากนั้นใช้ `.env` บัญชี sports_club_app เดิม แล้วรัน `npm run db:app` ไม่เพิ่มสิทธิ์ให้ผ่าน test และไม่ใส่ credential ใน Git/log evidence เก็บ commit SHA และผลจริง ถ้า baseline numerical mismatch ให้หยุด วิเคราะห์ก่อนเปลี่ยน production logic

**Final verdict: READY FOR SOURCE FREEZE** ตาม source/static checks ของ Work และ final real-SQL-Server QA ที่ผู้ใช้ยืนยันครบแล้ว ไม่มี confirmed issue คงค้างจาก Strict Audit ล่าสุด ผู้ใช้ยืนยันว่าไม่มี schema/EER/normalization/business-rule changes การอัปเดตผลนี้แก้เฉพาะเอกสาร ไม่เปลี่ยน production source หรือ tests

## Historical Strict Audit fix evidence (42f3009)

ข้อความด้านล่างเป็นบันทึก FIX + REGRESSION รอบก่อน ณ commit `42f3009c1dbd7a955756c959de8634d905ea1848` ใช้เป็นประวัติเท่านั้น จำนวน57testsและสถานะ Engine ด้านล่างไม่ใช่สถานะล่าสุดของผู้ใช้หรือ Final QA รอบนี้

ตรวจวันที่ 2026-10-05 (Asia/Bangkok) ตาม Strict Audit และคำสั่ง FIX + REGRESSION

Audit base: `258fc295c3a9483cfc3c50b95ab8951a5149c732`

เริ่มแก้บน main ล่าสุด: `224e843095224c12f2a870d26602ecce901cb656` ซึ่งต่างจาก audit base เฉพาะการนำ scaffold เก่าออกและปรับเอกสาร งานรอบนี้รักษาการจัดโครงสร้างนั้นไว้

**ผล:** แก้ source F01/F02/F03/F04/F05 และเพิ่ม Q01/Q02 verification/regression แล้ว Node และ static checks ผ่าน ส่วน SQL Server runtime, DB tests และ concurrency เป็น **NOT EXECUTED** ไม่มี Engine/credential ที่พร้อมใช้ในสภาพแวดล้อมนี้ จึงยังไม่รับรองความพร้อมส่งทั้งระบบ

## ผลแต่ละ issue

| Issue | Files changed | Exact fix | Regression / result |
|---|---|---|---|
| F01 | src/services/club.js; tests/strict_audit.test.js; database/tests.sql | เอา TOP(80) ออกจาก reports() คืนทุก resource ของ week ที่เลือก; ไม่เปลี่ยนสูตรหรือ output columns | Node service+HTTP fixture 41 courts + 40 equipment ได้ครบ 81 ผ่าน; SQL T58 เตรียมไว้/parse ผ่าน แต่ยังไม่ execute |
| F02 | src/app.js; tests/strict_audit.test.js | กำหนด UI res.locals รวม path/titles ก่อน URL-encoded body parser เพื่อให้ early-error template render ได้ | oversized 70 KB และ 501 parameters คืน 413/HTML error page; ไม่มี stack/EJS location/credential fixture ผ่านใน development mode |
| F03 | src/middleware/validation.js; tests/strict_audit.test.js | validator VARCHAR ร่วมกัน: trim, optional NULL, printable ASCII และ max length; reference ทั้งสาม workflow ใช้ VARCHAR(100) ตามเดิม | ASCII/100 chars/blank/null/missing และ Thai/accent/emoji/control/101 chars/nonstring ให้ผลตรงกันทั้งสาม workflow ผ่าน |
| Q01 | scripts/verify_database.js; tests/database_verification.test.js | ตรวจเต็ม FK mapping/actions/trust; ordered unique index key columns/uniqueness/filter; trigger name/parent/SQL_TRIGGER/INSTEAD OF/INSERT UPDATE DELETE; mandatory object types | 26 catalog-fixture tests ผ่าน รวม negative mutations ที่คงจำนวน FK เดิม; query parse ผ่าน; actual db:verify ยังไม่ execute |
| Q02 | database/tests.sql; scripts/run_sql_tests.js; docs/test_case_inventory.md | เพิ่ม independent numerical SQL oracles T47–T56 และตรวจ SQL suite ครบ 58 case names ไม่ซ้ำ | SQL parse ผ่าน; expected court 60/6720 ×100, equipment 4/70 ×100; numerical runtime ยังไม่ execute |
| F04 | src/controllers/club.js; src/services/club.js; src/middleware/validation.js; tests/strict_audit.test.js | Object.hasOwn ใน resource allowlists ป้องกัน inherited properties | /constructor, /toString, /__proto__ รวม /new และ detail คืน 404; service ปฏิเสธก่อนเข้าฐานข้อมูล ผ่าน |
| F05 | database/logic.sql; database/tests.sql; tests/strict_audit.test.js | เพิ่มเลขหลักสัปดาห์ 0/1 ทำให้ spine รองรับ 20,000 สัปดาห์ ครอบคลุม input 1900–2099; ไม่เพิ่ม calendar table | Node validator boundary ผ่าน; SQL T57 ตรวจ earliest 1900-01-01 และ week ของ 2099-12-31 parse ผ่าน/ยังไม่ execute |

Q01/Q02 เป็นการเพิ่มตัวตรวจและ tests ไม่ได้แก้ schema เพื่อให้ผ่าน ไม่มีการเพิ่ม table หรือเปลี่ยน EER/Normalization/BR01–BR14

## Checks ที่ execute จริง

| Check | Result | หลักฐาน/ข้อจำกัด |
|---|---|---|
| npm ci | PASS | ติดตั้งจาก package-lock.json 155 packages; lockfile ไม่เปลี่ยน |
| npm test | 57/57 PASS | รวม 11 tests เดิม + 20 strict-audit regressions + 26 metadata-verifier tests; DB/service/catalog fixtures ไม่แทน Engine |
| node --check | PASS, 18 JS files | ตรวจทุก JS ของโปรเจกต์ ไม่นับ node_modules |
| EJS compile | PASS, 10 templates | F02 ตรวจ render ผ่าน HTTP เพิ่มด้วย |
| SQL static parse | PASS, 0 errors | Microsoft ScriptDom 161.8901.0, TSql150Parser: 6 SQL files + 58 embedded test cases + fixture batch + 47 SQL statements ที่ JS สร้างจริง รวม 112 parse checks |
| Old-code regression control | คาดหมาย FAIL, 10/20 failed | นำ strict-audit regression เดียวกันไปทดสอบ code ณ audit base; จับ F01/F02/F03/F04 เดิมได้ 10 cases หลังแก้ทั้ง 20 cases ผ่าน |
| SQL Engine execution | NOT EXECUTED | ไม่พบ Engine/endpoint/credential ที่พร้อมใช้ |
| db:verify | NOT EXECUTED | catalog fixtures พิสูจน์ตรรกะ assertion; ยังไม่พิสูจน์การ query metadata จริงหรือสิทธิ์บัญชี |
| DB tests | NOT EXECUTED — 58 cases prepared | SQL syntax ผ่าน ไม่ใช่ 58/58 runtime PASS |
| Concurrency | NOT EXECUTED | รักษาสคริปต์ two-session เดิม ยังไม่มี Engine evidence |

ScriptDom ตรวจ grammar แต่ไม่ resolve dependencies, catalog metadata, permissions, transaction effects หรือ concurrency

## Numerical oracle inventory

| Case | Expected result |
|---|---|
| T47 Court 60 นาที, เปิด 16 ชั่วโมง/วัน | utilized=60, capacity=6720, percent=0.89 เมื่อ cast DECIMAL(10,2) |
| T48 Stock=10, quantity=2, planned inclusive 2 วัน | utilized=4, capacity=70, percent=5.71 |
| T49 Zero usage | court/equipment utilized=0, percent=0 |
| T50 Cancelled court/rental | utilized=0 |
| T51 Returned ก่อน due_date | ใช้ actual return; 2 ชิ้น ×2 วัน=4 piece-days |
| T52 Overdue ผ่านสัปดาห์ถัดมา | 2 ชิ้น ×7 วัน=14 piece-days; percent=20.00 |
| T53 Cross-week Saturday–Tuesday | 4 piece-days ในแต่ละสัปดาห์, percent=5.71 |
| T54 Zero stock | capacity=0, utilized=0, percent=NULL โดยไม่ divide-by-zero |
| T55 Actual return day inclusive | 2 ชิ้น Monday–Tuesday=4 piece-days; stock=2 capacity=14, percent=28.57 |
| T56 Same-day reuse เมื่อคืนเต็ม stock | reject SQL error 51005; วันถัดไปใช้ได้ตาม T31 เดิม |
| T57 Date boundary | มี reporting rows ของ 1900-01-01 และสัปดาห์สุดท้ายของ 2099 |
| T58 All resources | view คืน 41 courts +40 equipment ครบ 81 resources ใน fixture |

วันใน cases ผูกกับ dbo.fn_today() และ Monday ป้องกัน test กลายเป็น overdue โดยไม่ตั้งใจ; planned case ใช้สัปดาห์หน้า และ actual-return cases ใช้ช่วงอดีตที่แน่นอน Facility opening=closing ไม่ใช่ zero-capacity case ที่ valid เพราะ CHECK บังคับ opening<closing; zero-capacity oracle จึงใช้ equipment stock=0 ที่ schema อนุญาต

## Reporting interpretation

View ปัจจุบันคืน **ราย resource ต่อสัปดาห์** และ resource_category ระบุประเภท output structure และสูตรยังเดิม หากต้องรวมประเภท ให้ group by week_start, resource_type, resource_category แล้วคำนวณ:

`100.0 * SUM(utilized_units) / NULLIF(SUM(capacity_units), 0)`

ห้ามเฉลี่ย utilization_percent ราย resource โดยตรง และห้ามรวม court minutes กับ equipment piece-days เป็นตัวหารเดียวกัน ยังไม่เปลี่ยน output จนกว่าจะได้ requirement จากผู้สอนที่ชัดเจน ใช้เวลาเปิด/stock ปัจจุบันเป็น denominator ตามข้อจำกัด schema เดิม

## ปิด runtime evidence เมื่อ Engine พร้อม

1. รัน database/logic.sql ที่ปรับแล้วบน DB ทดสอบที่ใช้ schema เดิม; สำหรับเครื่องใหม่ รัน schema → logic → data ตาม README
2. ตั้ง local .env ด้วยบัญชี developer สำหรับ tests; รัน npm run db:verify, npm run db:test, npm run db:concurrency แล้วเก็บผลจริง
3. ใช้บัญชี app ตาม permissions.sql ทดสอบเว็บเชื่อม DB จริง รวม reports, combined booking, payment, return/cancel
4. ภาพใน docs/screenshots ยังเป็น UI/service-fixture preview จากรอบเดิม ต้องถ่ายใหม่จาก DB จริงสำหรับเล่มรายงานและคลิป

ยังไม่ประกาศ PROJECT READY FOR SUBMISSION และไม่เปลี่ยน tentative issue เรื่อง driver precedingErrors ที่ Audit ยังไม่ได้ยืนยัน

## ขอบเขตที่คงเดิม

schema.sql, schema.json, data.sql, queries.sql, permissions.sql และ concurrency/business-integrity trigger/SP implementations ไม่เปลี่ยน เปลี่ยน logic.sql เฉพาะตัวสร้างสัปดาห์ของ view ไม่มี table/column/constraint/BR ใหม่
