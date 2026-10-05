# Strict Audit fix and regression results

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
