# Two-session concurrency verification

ต้องใช้ SQL Server จริง การอ่านโค้ด/ผ่าน syntax parser ยังไม่ใช่หลักฐานว่า concurrency test ผ่าน ดูผลที่ยืนยันแล้วใน validation_results.md

Final QA 2026-10-05 (Asia/Bangkok): ผู้ใช้รายงาน final `db:concurrency` บน SQL Server จริงใน local environment เป็น **PASS court และ PASS equipment** พร้อม final reports integration/mutation และ app runtime PASS ดูผลรวมใน validation_results.md สคริปต์ concurrency เดิมไม่เปลี่ยน Work ไม่ได้ execute Engine ซ้ำ; ผล local นี้เป็น user-reported execution

## ทางอัตโนมัติ

ตั้ง `.env` ให้บัญชีผู้พัฒนามี DML/sequence/EXEC permissions แล้วรัน:

```bash
npm run db:concurrency
```

Script เปิด session A ใน transaction, ทำ SP สำเร็จแต่ยังไม่ commit transaction ภายนอก, เปิด session B ทำ resource เดียวกัน, assert ว่า B ยังรอ, commit A แล้ว assert ว่า B ถูก reject ด้วย51003 (court) หรือ51005 (equipment) แต่ละ case ใช้ two simultaneous DB connections พร้อม fixture ใหม่ ไม่มีการ retry แอบทำให้ expected test ผ่าน

หลังจบเก็บประวัติไว้และ cancelled bookings/rentals, inactive member/facility/equipment; sequences ไม่ reset ให้ใช้ DB สำหรับพัฒนา

## ทาง SSMS: เตรียม fixtures หนึ่งครั้ง

เปิด Query window setup รันต่อไปนี้ (IDs สามตัวอักษร + 7หลักไม่ชน seed):

```sql
use sports_club_booking;
set xact_abort on;
begin transaction;
exec dbo.sp_lock_integrity;
if not exists(select 1 from dbo.facilities where facility_id='CFC0000001')
begin
 insert dbo.facilities(facility_id,facility_name,facility_type,location,opening_time,closing_time)
 values('CFC0000001',N'Concurrency lab',N'test',N'test','06:00','22:00');
 insert dbo.courts(court_id,facility_id,court_name,court_type,capacity,hourly_rate)
 values('CCT0000001','CFC0000001',N'Court A',N'test',2,100),
       ('CCT0000002','CFC0000001',N'Court B',N'test',2,100);
 insert dbo.members(member_id,first_name,last_name,phone,email,membership_type,membership_start,membership_end)
 values('CMB0000001',N'Concurrency',N'Test','0800000000','ssms-concurrency@example.test',N'test',
        dateadd(day,-1,dbo.fn_today()),dateadd(day,365,dbo.fn_today()));
 insert dbo.equipment(equipment_id,equipment_name,equipment_type,total_quantity,rental_rate)
 values('CEQ0000001',N'Last available item',N'test',1,20);
end;
commit;
```

### Court: window A

```sql
use sports_club_booking;
set xact_abort on;
begin transaction;
declare @items dbo.equipment_request;
declare @day date=dateadd(day,7,dbo.fn_today());
exec dbo.sp_BookCourtAndEquipment @member_id='CMB0000001',@court_id='CCT0000001',
 @booking_date=@day,@start_time='09:00',@end_time='10:00',@equipment_items=@items,@pay_now=0;
-- A สำเร็จ แต่ยังถือ lock เพราะ transaction ภายนอกยังเปิดอยู่
-- ไป execute window B แล้วกลับมา commit ใน window A ภายใน 15วินาที
```

### Court: window B (ระหว่างที่ A ยังไม่ commit)

```sql
use sports_club_booking;
declare @items dbo.equipment_request;
declare @day date=dateadd(day,7,dbo.fn_today());
exec dbo.sp_BookCourtAndEquipment @member_id='CMB0000001',@court_id='CCT0000001',
 @booking_date=@day,@start_time='09:00',@end_time='10:00',@equipment_items=@items,@pay_now=0;
```

B ต้องรอ จากนั้นรัน `commit transaction;` ใน A B ต้องถูก reject51003 และ query ต่อไปนี้ต้องคืน1:

```sql
select count(*) as confirmed_count from dbo.court_bookings
where court_id='CCT0000001' and booking_date=dateadd(day,7,dbo.fn_today()) and status='confirmed';
```

ถ้าไม่ commit ภายใน lock timeout จะได้51002 แทน concurrency evidence51003 ให้ยกเลิกรายการทดลองที่ไม่มี paid Payment แล้วลองใหม่

### Equipment: window A

ใช้วันที่ต่างจาก court test เพื่อหลีกเลี่ยง time conflict:

```sql
use sports_club_booking;
set xact_abort on;
begin transaction;
declare @day date=dateadd(day,8,dbo.fn_today());
declare @items dbo.equipment_request;
insert @items values('CEQ0000001',1,@day,@day,20,null);
exec dbo.sp_BookCourtAndEquipment @member_id='CMB0000001',@court_id='CCT0000001',
 @booking_date=@day,@start_time='09:00',@end_time='10:00',@equipment_items=@items,@pay_now=0;
-- execute window B ก่อน แล้วกลับมา commit ใน A
```

### Equipment: window B

```sql
use sports_club_booking;
declare @day date=dateadd(day,8,dbo.fn_today());
declare @items dbo.equipment_request;
insert @items values('CEQ0000001',1,@day,@day,20,null);
exec dbo.sp_BookCourtAndEquipment @member_id='CMB0000001',@court_id='CCT0000002',
 @booking_date=@day,@start_time='09:00',@end_time='10:00',@equipment_items=@items,@pay_now=0;
```

ใช้ court คนละสนาม เพื่อพิสูจน์ stock conflict โดยเฉพาะ B ต้องรอ A แล้ว reject51005 หลัง A commit ของ B ทั้ง booking/rental/payment ต้อง rollback ตรวจ:

```sql
select sum(quantity) as occupied_quantity from dbo.equipment_rentals
where equipment_id='CEQ0000001' and rental_date=dateadd(day,8,dbo.fn_today()) and status<>'cancelled';
select count(*) as rolled_back_booking_count from dbo.court_bookings
where court_id='CCT0000002' and booking_date=dateadd(day,8,dbo.fn_today());
```

ค่าคาดหวัง: occupied_quantity=1, rolled_back_booking_count=0

## เหตุผลที่ไม่ double commit

session A ได้ exclusive application lock ก่อน validation และ DML B ใช้ key เดียวกันจึงรอ พอ A commit B ค่อยอ่าน state ล่าสุดและ validate พบ conflict Trigger direct DML ก็ขอ key ก่อน base-table write จึงไม่สามารถ bypass ผ่าน SSMS insert/update หลายแถวได้

เลือก global lock เพื่อให้ multi-resource TVP/payment/catalog changes มีลำดับชัดเจน ลด throughput ของ writes ได้เมื่อ scale สูง เป็น tradeoff ที่บันทึกไว้ ไม่กล่าวอ้างไม่มี deadlock ทุกบริบท หากเกิด timeout/deadlock operation fail และ retry whole transaction
