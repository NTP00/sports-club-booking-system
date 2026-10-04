# Data dictionary

ถอดชนิดข้อมูลจาก Relational Schema หน้า 1 โดยตรวจจากภาพ (text extraction วางชนิดข้อมูล facilities สลับลำดับ)

ทุก PK ใช้ VARCHAR(10), sequence 1–9999999; ID เปลี่ยนไม่ได้ ทุก FK: ON DELETE NO ACTION / ON UPDATE NO ACTION. ช่วงอายุสมาชิกและช่วงวันเช่า inclusive; เวลาจอง [start_time,end_time). วันปัจจุบันใช้เวลาไทยผ่าน dbo.fn_today().

## facilities
| Table | Column | Type | Key | Nullable | Default | Allowed values / description and rules |
|---|---|---|---|---|---|---|
| facilities | facility_id | VARCHAR(10) | PK | No | 'FAC' + right('0000000' + convert(varchar(7), next value for dbo.seq_facilities), 7) | facility id |
| facilities | facility_name | NVARCHAR(100) | — | No | — | facility name |
| facilities | facility_type | NVARCHAR(50) | — | No | — | facility type |
| facilities | location | NVARCHAR(150) | — | No | — | location |
| facilities | opening_time | TIME(0) | — | No | — | opening time; BR10 no overnight |
| facilities | closing_time | TIME(0) | — | No | — | closing time; BR10 no overnight |
| facilities | status | NVARCHAR(20) | — | No | 'active' | active / inactive / maintenance |

CHECKs: opening_time < closing_time

## courts
| Table | Column | Type | Key | Nullable | Default | Allowed values / description and rules |
|---|---|---|---|---|---|---|
| courts | court_id | VARCHAR(10) | PK | No | 'CRT' + right('0000000' + convert(varchar(7), next value for dbo.seq_courts), 7) | court id |
| courts | facility_id | VARCHAR(10) | FK → facilities | No | — | facility id; referential integrity |
| courts | court_name | NVARCHAR(100) | — | No | — | court name |
| courts | court_type | NVARCHAR(50) | — | No | — | court type |
| courts | capacity | INT | — | No | — | capacity |
| courts | hourly_rate | DECIMAL(10,2) | — | No | — | hourly rate |
| courts | status | NVARCHAR(20) | — | No | 'active' | active / inactive / maintenance |

CHECKs: capacity > 0; hourly_rate >= 0

## members
| Table | Column | Type | Key | Nullable | Default | Allowed values / description and rules |
|---|---|---|---|---|---|---|
| members | member_id | VARCHAR(10) | PK | No | 'MEM' + right('0000000' + convert(varchar(7), next value for dbo.seq_members), 7) | member id |
| members | first_name | NVARCHAR(50) | — | No | — | first name |
| members | last_name | NVARCHAR(50) | — | No | — | last name |
| members | phone | VARCHAR(20) | — | No | — | phone |
| members | email | VARCHAR(255) | AK | No | — | email |
| members | membership_type | NVARCHAR(50) | — | No | — | membership type |
| members | membership_start | DATE | — | No | — | membership start; BR13 inclusive |
| members | membership_end | DATE | — | No | — | membership end; BR13 inclusive |
| members | status | NVARCHAR(20) | — | No | 'active' | active / inactive |

CHECKs: membership_end >= membership_start

## court_bookings
| Table | Column | Type | Key | Nullable | Default | Allowed values / description and rules |
|---|---|---|---|---|---|---|
| court_bookings | booking_id | VARCHAR(10) | PK | No | 'BKG' + right('0000000' + convert(varchar(7), next value for dbo.seq_court_bookings), 7) | booking id |
| court_bookings | member_id | VARCHAR(10) | FK → members | No | — | member id; referential integrity |
| court_bookings | court_id | VARCHAR(10) | FK → courts | No | — | court id; referential integrity |
| court_bookings | booking_date | DATE | — | No | — | booking date |
| court_bookings | start_time | TIME(0) | — | No | — | start time |
| court_bookings | end_time | TIME(0) | — | No | — | end time |
| court_bookings | total_amount | DECIMAL(10,2) | — | No | — | total amount; ยอดสุดท้าย ไม่บังคับสูตร; >= paid sum (BR07) |
| court_bookings | hourly_rate_snapshot | DECIMAL(10,2) | — | No | 0 | hourly rate snapshot; ราคาหนึ่งหน่วย ณ การสร้าง; DB copy; immutable (BR11/12) |
| court_bookings | status | NVARCHAR(20) | — | No | 'confirmed' | confirmed / cancelled |
| court_bookings | created_at | DATETIME2(0) | — | No | sysdatetime() | created at |

CHECKs: start_time < end_time; hourly_rate_snapshot >= 0; total_amount >= 0

## equipment
| Table | Column | Type | Key | Nullable | Default | Allowed values / description and rules |
|---|---|---|---|---|---|---|
| equipment | equipment_id | VARCHAR(10) | PK | No | 'EQP' + right('0000000' + convert(varchar(7), next value for dbo.seq_equipment), 7) | equipment id |
| equipment | equipment_name | NVARCHAR(100) | — | No | — | equipment name |
| equipment | equipment_type | NVARCHAR(50) | — | No | — | equipment type |
| equipment | total_quantity | INT | — | No | — | total quantity; stock รวม ไม่ลดเมื่อเช่า; >= peak occupancy (BR05) |
| equipment | rental_rate | DECIMAL(10,2) | — | No | — | rental rate; ต่อชิ้นต่อวัน |
| equipment | status | NVARCHAR(20) | — | No | 'active' | active / inactive / maintenance |

CHECKs: total_quantity >= 0; rental_rate >= 0

## equipment_rentals
| Table | Column | Type | Key | Nullable | Default | Allowed values / description and rules |
|---|---|---|---|---|---|---|
| equipment_rentals | rental_id | VARCHAR(10) | PK | No | 'RNT' + right('0000000' + convert(varchar(7), next value for dbo.seq_equipment_rentals), 7) | rental id |
| equipment_rentals | member_id | VARCHAR(10) | FK → members | No | — | member id; referential integrity |
| equipment_rentals | equipment_id | VARCHAR(10) | FK → equipment | No | — | equipment id; referential integrity |
| equipment_rentals | rental_date | DATE | — | No | — | rental date |
| equipment_rentals | due_date | DATE | — | No | — | due date |
| equipment_rentals | return_date | DATE | — | Yes | — | return date |
| equipment_rentals | quantity | INT | — | No | — | quantity |
| equipment_rentals | rental_rate_snapshot | DECIMAL(10,2) | — | No | 0 | rental rate snapshot; ราคาหนึ่งหน่วย ณ การสร้าง; DB copy; immutable (BR11/12); ต่อชิ้นต่อวัน |
| equipment_rentals | total_amount | DECIMAL(10,2) | — | No | — | total amount; ยอดสุดท้าย ไม่บังคับสูตร; >= paid sum (BR07) |
| equipment_rentals | status | NVARCHAR(20) | — | No | 'active' | active / returned / cancelled |

CHECKs: due_date >= rental_date; return_date is null or return_date >= rental_date; quantity > 0; rental_rate_snapshot >= 0; total_amount >= 0; (status = 'returned' and return_date is not null) or (status in ('active','cancelled') and return_date is null)

## payments
| Table | Column | Type | Key | Nullable | Default | Allowed values / description and rules |
|---|---|---|---|---|---|---|
| payments | payment_id | VARCHAR(10) | PK | No | 'PAY' + right('0000000' + convert(varchar(7), next value for dbo.seq_payments), 7) | payment id |
| payments | rental_id | VARCHAR(10) | FK → equipment_rentals | Yes | — | rental id; BR06 XOR source |
| payments | booking_id | VARCHAR(10) | FK → court_bookings | Yes | — | booking id; BR06 XOR source |
| payments | amount | DECIMAL(10,2) | — | No | — | amount |
| payments | payment_date | DATETIME2(0) | — | No | sysdatetime() | payment date |
| payments | payment_method | NVARCHAR(30) | — | No | — | payment method |
| payments | transaction_ref | VARCHAR(100) | — | Yes | — | transaction ref; optional; unique filtered; ไม่ใช่ AK; ห้าม blank |
| payments | status | NVARCHAR(20) | — | No | 'pending' | pending / paid / failed / cancelled |

CHECKs: amount > 0; (case when booking_id is null then 0 else 1 end + case when rental_id is null then 0 else 1 end) = 1; transaction_ref is null or len(ltrim(rtrim(transaction_ref))) > 0

## staff
| Table | Column | Type | Key | Nullable | Default | Allowed values / description and rules |
|---|---|---|---|---|---|---|
| staff | staff_id | VARCHAR(10) | PK | No | 'STF' + right('0000000' + convert(varchar(7), next value for dbo.seq_staff), 7) | staff id |
| staff | first_name | NVARCHAR(50) | — | No | — | first name |
| staff | last_name | NVARCHAR(50) | — | No | — | last name |
| staff | phone | VARCHAR(20) | — | No | — | phone |
| staff | email | VARCHAR(255) | AK | No | — | email |
| staff | position | NVARCHAR(50) | — | No | — | position |
| staff | status | NVARCHAR(20) | — | No | 'active' | active / inactive |

CHECKs: 

## maintenance
| Table | Column | Type | Key | Nullable | Default | Allowed values / description and rules |
|---|---|---|---|---|---|---|
| maintenance | maintenance_id | VARCHAR(10) | PK | No | 'MNT' + right('0000000' + convert(varchar(7), next value for dbo.seq_maintenance), 7) | maintenance id |
| maintenance | staff_id | VARCHAR(10) | FK → staff | No | — | staff id; referential integrity |
| maintenance | facility_id | VARCHAR(10) | FK → facilities | Yes | — | facility id; BR09 XOR target |
| maintenance | court_id | VARCHAR(10) | FK → courts | Yes | — | court id; BR09 XOR target |
| maintenance | equipment_id | VARCHAR(10) | FK → equipment | Yes | — | equipment id; BR09 XOR target |
| maintenance | maintenance_date | DATE | — | No | — | maintenance date |
| maintenance | description | NVARCHAR(500) | — | No | — | description |
| maintenance | cost | DECIMAL(10,2) | — | No | — | cost |
| maintenance | status | NVARCHAR(20) | — | No | 'scheduled' | scheduled / in_progress / completed / cancelled |

CHECKs: cost >= 0; (case when facility_id is null then 0 else 1 end + case when court_id is null then 0 else 1 end + case when equipment_id is null then 0 else 1 end) = 1
