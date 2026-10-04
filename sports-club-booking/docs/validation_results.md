# Final validation results

ตรวจเมื่อ 2026-10-04 โดยเทียบ Assignment, EER/Relational Schema, Normalization และ prompt ที่แนบ

**สถานะ:** source-code deliverable สร้างครบ ตรวจโครงสร้าง, syntax, seed-model และ web contract ผ่านแล้ว ยังไม่ได้ execute บน SQL Server Engine จริง และยังไม่มีหลักฐาน runtime concurrency ผ่าน

## ผ่านแล้วในสภาพแวดล้อมนี้

| Check | Evidence |
|---|---|
| Schema source alignment | 9 tables, 73 columns, 9 PK, 11 FK, 2 email AK; types อ่านจากภาพ EER หน้า1; nullableเฉพาะที่ระบุ |
| SQL syntax | Microsoft.SqlServer.TransactSql.ScriptDom 161.8901.0, TSql150Parser (SQL Server2019 grammar); 6 SQL files ไม่มี parse error |
| Embedded SQL | SQL test batches46และ web SQL statements33ไม่มี parse error |
| Mock-data model | 20/40/600/1200/40/800/1850/25/40 records; PK/ref/XOR/payment ceilingและoverlap/stockตรวจในPython ผ่าน; peak stock occupancy6 ≤ stock50–54 |
| Node web/validation tests | npm test: 11/11ผ่าน; HTTP pages, malformed dates/amounts, XOR, CSRF, TVP/SP calls, SQL allowlist, 40equipment form parsing |
| Templates | EJSทุกไฟล์ compileผ่าน |
| UI in a browser | Desktop1440px/mobile390px renderผ่าน, ไม่มีpageoverflow/JSerror; เพิ่ม/ลบequipmentแล้วIDsไม่ซ้ำ; มีfontไทยที่serveจากlocal; previewใช้servicefixturesไม่ใช่DBจริง |
| Dependencies | npm installสร้างpackage-lock.jsonสำเร็จ; npm audit --omit=dev ไม่พบ known vulnerabilities ในรอบตรวจนี้ |
| SQL source protection | ทุกFK NO ACTION; snapshotcopy/immutability; statusCHECK; filteredunique reference; parameterizedqueries |

ScriptDom ตรวจ syntax แต่ไม่ได้ resolve FK/object dependencies, ตรวจ permissions หรือ execute triggers/SP ไม่แทน SQL Server runtime test และ Node tests ใช้ service doubles สำหรับหน้าเว็บ

ภาพใน docs/screenshots เป็น UI preview ที่ใช้ service fixtures สำหรับตรวจ layout/ภาษาไทย desktop/mobile ตัวเลขในภาพไม่ได้เป็นผล query ของ SQL Server ใช้ภาพจากเว็บที่เชื่อมฐานข้อมูลจริงในการส่งคลิปและรายงาน

## Checklist ที่ implement แล้ว (runtime บางข้อยังรอตรวจ)

| Requirement | Implementation | Verification status |
|---|---|---|
| 9 tables only + keys/types | schema.sql + schema.json | static/sourceผ่าน; db:verifyเตรียมไว้ |
| BR01–BR14 | CHECK/FK/triggers/SP ตาม traceability_matrix.md | mappedครบ; 46 SQL casesรอEngine |
| CHECK, FK actions, indexes | schema.sql | syntax/staticผ่าน |
| SQL Server2019/2022 compatibility | T-SQL150 grammar; ไม่มีfeatureเฉพาะ2025 | syntaxผ่าน; Engineยังไม่รัน |
| schema/data/logic/queries/run_all | database/ครบ | 6 SQL filesparseผ่าน; SQLCMDincludeตรวจpathเชิงโครงสร้าง |
| Mandatory SP + ACID | sp_BookCourtAndEquipment, TVP, TRY/CATCH, XACT_ABORT, COMMIT/ROLLBACK | code/contractผ่าน; runtime rollbackรอEngine |
| Mandatory trigger | trg_CheckCourtConflict, multirow insert/update | syntaxและcasesครบ; runtimeรอEngine |
| Mandatory weekly view | vw_FacilityUtilizationReport + resource_category | syntaxผ่าน; numerical DB resultsรอEngine |
| 10 queries 2/3/3/2 | queries.sql Q01–Q10 | syntax/categoryผ่าน; db:verifyตรวจresultไม่ว่าง |
| Mock-data counts | data.sql + generator | counts/modelผ่าน; DMLexecutionรอEngine |
| Data dictionary | data_dictionary.md | generatedจากschema metadata; ตรวจtypesกับEERภาพ |
| Web CRUD/business workflows | src/ | HTTP/validation/TVP testsผ่าน; DB-connectedend-to-endรอEngine |
| Tests | database/tests.sql, tests/, concurrency script | Node11ผ่าน; SQL46/concurrencyรอEngine |
| README | requirements→SSMS→env→npm→tests | ขั้นตอนครบ |
| No frontend-only BR | DBconstraints/triggers/SPครอบคลุมทุกBR | traceabilityผ่าน |
| Concurrency protection | same transaction-owned writer gateก่อนเขียนทั้ง9ตาราง | design/sourceผ่าน; two-session proofยังไม่รัน |
| Preserve history | FK NO ACTION, immutableIDs/snapshots, no UIharddelete | source/testsครบ |

## สิ่งที่ยังต้องยืนยันจริง

1. รัน schema→logic→data บน SQL Server2019/2022 ในเครื่องกลุ่ม
2. ใช้บัญชีผู้พัฒนารัน npm run db:verify, npm run db:test และ npm run db:concurrency แล้วเก็บผล
3. รัน permissions.sql และทดสอบเว็บด้วยบัญชี app จริง (รวม named instance/TCP/certificate configของเครื่อง)
4. เปิดเว็บกับ DBจริงเพื่อทดสอบ combined booking, payments, returns, cancel, reports

พยายามเปิดSQL Server2022ชั่วคราวแล้ว แต่ Engine ไม่สามารถ initialize ใน runtimeนี้ได้ จึงไม่มีการติ๊กว่า runtime/concurrencyผ่าน ไม่พบ known raceในstrategyที่ออกแบบ แต่ยังไม่อ้างว่าได้พิสูจน์จากการรันจริง

## ข้อจำกัดที่มีจริงตามschema/scope

- No authentication/payment gateway/wallet/refund ledger ตามprompt; bindloopbackและCSRFเป็นค่าเริ่มต้น
- Capacity/opening historyไม่ได้เก็บ จึงใช้catalogปัจจุบันเป็นdenominatorของรายงานย้อนหลัง
- Overdue เกิดจากเวลาเปลี่ยนได้แม้ไม่มีDML ต้องจัดการการคืนหรือreservationที่ทับกันโดยผู้ดูแล
- Global write serializationเหมาะงานเรียน throughputต่ำกว่าresource-specificlocking; timeout/deadlockต้องretrywholeoperation
- Combined operationไม่มีFKbooking↔rentalตามEER การยกเลิกbookingไม่ยกเลิกrentalอัตโนมัติ
- ยังต้องจัดทำเล่มรายงานPDFและคลิปของสมาชิกกลุ่มตามAssignment แยกจากsource-codeZIPนี้
