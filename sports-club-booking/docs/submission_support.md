# Submission and walkthrough support

## ผูก source เข้ากับรายงาน

| บท/หัวข้อ | ใช้อะไรประกอบ |
|---|---|
| 1 Scope + BR14 | prompt และ docs/design_decisions.md, traceability_matrix.md |
| 2 Conceptual/Logical | EER/Relational Schema และ Normalization ที่ผู้ใช้แนบ, docs/data_dictionary.md |
| 3 Advanced DB | database/logic.sql, docs/integrity_constraints.md, index_rationale.md, concurrency_test.md |
| SQL implementation | schema.sql, data.sql, queries.sql, tests.sql และผลตรวจจริง |
| Web | README, src/, screenshots ถ่ายจากเครื่องผู้ใช้หลังเชื่อม DB |

ZIP นี้เป็น source-code deliverable พร้อมเอกสารช่วยรายงาน ไม่ใช่เล่มรายงาน PDF/คลิปที่มีสมาชิกกลุ่มครบ

## คลิป 5–7 นาที

| เวลาโดยประมาณ | คน/บทบาท | เนื้อหา |
|---|---|---|
| 0:00–1:45 | Data Architect & DBA | อธิบาย9ตาราง, 1:N, PK/FK/AK, XOR, BCNF, dictionary, NO ACTION |
| 1:45–3:45 | Backend & DB Logic | อธิบาย combined SP/TVP, snapshots, ACID, overlap trigger, stock/overdue, paid ceiling, view |
| 3:45–6:15 | Full-stack Developer | เปิดเว็บ จองพร้อมสอง equipment, แสดงแยก payments, conflict fail ไม่มี partial records, return, reports |
| 6:15–6:45 | ทุกคน | ผล tests/concurrency และขอบเขตระบบ |

ทุกคนเปิดกล้องและบรรยายส่วนของตัวเอง ฝึกอธิบายจากโค้ดจริง โดยเฉพาะ normalization และ FK mapping ตามนโยบายอาจารย์

## ก่อนส่ง

- รัน scripts บน SQL Server ของกลุ่มและเก็บผล tests ทุกข้อ
- ส่งเล่มรายงาน PDF, SQL ทั้งหมด, Web App Code/URL และ README
- ส่งคลิป5–7นาที, ทำ Peer Evaluation และ Individual Quiz
- แบ่งงานและตรวจคำอธิบายร่วมกัน ไม่ใช้เพียงจำนวนไฟล์เป็นหลักฐานว่าเข้าใจงาน
