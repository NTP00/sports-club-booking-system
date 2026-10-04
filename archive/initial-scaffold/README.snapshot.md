# Sports Club & Facility Booking System

## โปรเจกต์ล่าสุด

Source code ฉบับสมบูรณ์อยู่ใน [`sports-club-booking/`](sports-club-booking/) ใช้ Node.js 20+, Express/EJS และ Microsoft SQL Server 2019/2022 อ่านวิธีติดตั้งและข้อกำหนดทั้งหมดใน [README ของโปรเจกต์](sports-club-booking/README.md)

```bash
git clone https://github.com/NTP00/sports-club-booking-system.git
cd sports-club-booking-system/sports-club-booking
```

1. ใน SSMS รัน `sports-club-booking/database/schema.sql` → `logic.sql` → `data.sql` ตามลำดับ และอ่านขั้นตอน SQL Login/TCP/IP/permissions ใน README ของโปรเจกต์
2. ในโฟลเดอร์ที่มี `package.json` สร้างไฟล์ local `.env` ด้วย `cp .env.example .env` (PowerShell: `Copy-Item .env.example .env`) แล้วตั้งค่า SQL Server ของเครื่องตนเอง
3. รัน `npm ci` แล้ว `npm start`
4. เปิด <http://localhost:3000> หรือ <http://127.0.0.1:3000>

ไฟล์หลัก: `README.md`, `package.json`, `package-lock.json`, `.env.example`, `.gitignore`, `database/`, `scripts/`, `docs/`, `src/`, `tests/` ภายใน `sports-club-booking/`

เก็บรหัสผ่านจริงใน `.env` ของแต่ละเครื่องเท่านั้น `.env`, `node_modules/` และ `*.log` ถูก ignore การทดสอบ Node.js ผ่านแล้ว ส่วน SQL tests และ concurrency บน SQL Server Engine จริงยังต้องรันตาม [ผลตรวจสอบ](sports-club-booking/docs/validation_results.md)

## บันทึกโครงสร้างเริ่มต้น (เก็บไว้เป็นประวัติ)

ไฟล์เดิมใน `backend/`, `frontend/`, `database/` และ `docs/` คงอยู่ทั้งหมด SQL รุ่นเดิมใช้ฐานข้อมูล `sports_club` ส่วนโปรเจกต์ล่าสุดใช้ `sports_club_booking` ข้อความด้านล่างเป็นบันทึกเดิม รวมถึงคำแนะนำ MySQL ที่ไม่ใช้กับโปรเจกต์ SQL Server ล่าสุด ให้ใช้ขั้นตอนด้านบนสำหรับเวอร์ชันปัจจุบัน

University database project for managing sports facilities, court bookings, members, equipment rentals, trainers, training sessions, and payments.

## Project structure

- `frontend/` — user interface
- `backend/` — API and application logic
- `database/` — SQL schema, sample data, and queries
- `docs/` — EER diagram, report materials, screenshots, and documentation

## Database files

- `database/schema.sql` — creates the database structure
- `database/seed.sql` — inserts sample data
- `database/queries.sql` — stores project queries and test queries

## Development workflow

1. Clone the repository.
2. Run `database/schema.sql` in MySQL.
3. Run `database/seed.sql` to add sample data.
4. Develop frontend/backend on separate branches.
5. Open a pull request before merging into `main`.
