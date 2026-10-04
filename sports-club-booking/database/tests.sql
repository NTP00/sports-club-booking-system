use sports_club_booking;
go
-- Run on a development/test database. Each case rolls its data back.
-- Sequences are nontransactional: tests intentionally leave harmless ID gaps.
create or alter procedure dbo.sp_test_case @name nvarchar(200), @test_sql nvarchar(max), @expected_error int=0
as
begin
set nocount on;
set xact_abort on;
declare @stage bit=0, @before_bookings int=(select count(*) from dbo.court_bookings),
    @before_rentals int=(select count(*) from dbo.equipment_rentals), @before_payments int=(select count(*) from dbo.payments);
begin try
    begin transaction;
    exec dbo.sp_lock_integrity;
    exec sys.sp_executesql N'
declare @today date=dbo.fn_today();
insert dbo.facilities(facility_id,facility_name,facility_type,location,opening_time,closing_time) values(''TFC0000001'',N''Test facility'',N''hall'',N''test'',''06:00'',''22:00'');
insert dbo.courts(court_id,facility_id,court_name,court_type,capacity,hourly_rate) values(''TCT0000001'',''TFC0000001'',N''Test court'',N''tennis'',4,100);
insert dbo.members(member_id,first_name,last_name,phone,email,membership_type,membership_start,membership_end) values(''TMB0000001'',N''Test'',N''Member'',''0800000000'',''test-fixture@example.test'',N''test'',dateadd(day,-365,@today),dateadd(day,365,@today));
insert dbo.equipment(equipment_id,equipment_name,equipment_type,total_quantity,rental_rate) values(''TEQ0000001'',N''Test racket'',N''racket'',2,20),(''TEQ0000002'',N''Test ball'',N''ball'',2,30);
insert dbo.staff(staff_id,first_name,last_name,phone,email,position) values(''TST0000001'',N''Test'',N''Staff'',''0900000000'',''test-staff-fixture@example.test'',N''technician'');
';
    set @stage=1;
    set @test_sql=N'declare @today date=dbo.fn_today();'+@test_sql;
    exec sys.sp_executesql @test_sql;
    if @expected_error<>0 throw 51990,N'Expected rejection did not occur',1;
    if @@trancount>0 rollback transaction;
    select @name as test_case,'PASS' as result,0 as error_number;
end try
begin catch
    declare @actual int=error_number(), @message nvarchar(2048)=error_message();
    if xact_state()<>0 rollback transaction;
    if @stage=1 and @expected_error=@actual
    begin
        if (select count(*) from dbo.court_bookings)<>@before_bookings
          or (select count(*) from dbo.equipment_rentals)<>@before_rentals
          or (select count(*) from dbo.payments)<>@before_payments
            throw 51992,N'Rollback verification failed',1;
        select @name as test_case,'PASS' as result,@actual as error_number;
    end
    else
    begin
        select @name as test_case,'FAIL' as result,@actual as error_number,@message as error_message;
        throw;
    end;
end catch;
end;
go


exec dbo.sp_test_case @name=N'T01 booking succeeds', @expected_error=0, @test_sql=N'insert dbo.court_bookings(booking_id,member_id,court_id,booking_date,start_time,end_time,total_amount) values(''TBK0000001'',''TMB0000001'',''TCT0000001'',@today,''09:00'',''10:00'',100); if (select hourly_rate_snapshot from dbo.court_bookings where booking_id=''TBK0000001'')<>100 throw 51980,N''Snapshot missing'',1;';
go

exec dbo.sp_test_case @name=N'T02 adjacent slots succeed', @expected_error=0, @test_sql=N'insert dbo.court_bookings(booking_id,member_id,court_id,booking_date,start_time,end_time,total_amount) values(''TBK0000001'',''TMB0000001'',''TCT0000001'',@today,''09:00'',''10:00'',100);insert dbo.court_bookings(booking_id,member_id,court_id,booking_date,start_time,end_time,total_amount) values(''TBK0000002'',''TMB0000001'',''TCT0000001'',@today,''10:00'',''11:00'',100);';
go

exec dbo.sp_test_case @name=N'T03 overlap rejected', @expected_error=51003, @test_sql=N'insert dbo.court_bookings(booking_id,member_id,court_id,booking_date,start_time,end_time,total_amount) values(''TBK0000001'',''TMB0000001'',''TCT0000001'',@today,''09:00'',''10:00'',100);insert dbo.court_bookings(booking_id,member_id,court_id,booking_date,start_time,end_time,total_amount) values(''TBK0000002'',''TMB0000001'',''TCT0000001'',@today,''09:30'',''10:30'',100);';
go

exec dbo.sp_test_case @name=N'T04 cancelled does not block', @expected_error=0, @test_sql=N'insert dbo.court_bookings(booking_id,member_id,court_id,booking_date,start_time,end_time,total_amount) values(''TBK0000001'',''TMB0000001'',''TCT0000001'',@today,''09:00'',''10:00'',100);update dbo.court_bookings set status=''cancelled'' where booking_id=''TBK0000001'';insert dbo.court_bookings(booking_id,member_id,court_id,booking_date,start_time,end_time,total_amount) values(''TBK0000002'',''TMB0000001'',''TCT0000001'',@today,''09:00'',''10:00'',100);';
go

exec dbo.sp_test_case @name=N'T05 outside hours', @expected_error=51016, @test_sql=N'insert dbo.court_bookings(booking_id,member_id,court_id,booking_date,start_time,end_time,total_amount) values(''TBK0000001'',''TMB0000001'',''TCT0000001'',@today,''05:00'',''07:00'',100);';
go

exec dbo.sp_test_case @name=N'T06 inactive member', @expected_error=51015, @test_sql=N'update dbo.members set status=''inactive'' where member_id=''TMB0000001'';insert dbo.court_bookings(booking_id,member_id,court_id,booking_date,start_time,end_time,total_amount) values(''TBK0000001'',''TMB0000001'',''TCT0000001'',@today,''09:00'',''10:00'',100);';
go

exec dbo.sp_test_case @name=N'T07 expired membership', @expected_error=51015, @test_sql=N'update dbo.members set membership_end=dateadd(day,-1,@today) where member_id=''TMB0000001'';insert dbo.court_bookings(booking_id,member_id,court_id,booking_date,start_time,end_time,total_amount) values(''TBK0000001'',''TMB0000001'',''TCT0000001'',@today,''09:00'',''10:00'',100);';
go

exec dbo.sp_test_case @name=N'T08 maintenance court', @expected_error=51016, @test_sql=N'update dbo.courts set status=''maintenance'' where court_id=''TCT0000001'';insert dbo.court_bookings(booking_id,member_id,court_id,booking_date,start_time,end_time,total_amount) values(''TBK0000001'',''TMB0000001'',''TCT0000001'',@today,''09:00'',''10:00'',100);';
go

exec dbo.sp_test_case @name=N'T09 maintenance equipment', @expected_error=51021, @test_sql=N'update dbo.equipment set status=''maintenance'' where equipment_id=''TEQ0000001'';insert dbo.equipment_rentals(rental_id,member_id,equipment_id,rental_date,due_date,quantity,total_amount) values(''TRN0000001'',''TMB0000001'',''TEQ0000001'',@today,dateadd(day,1,@today),1,40);';
go

exec dbo.sp_test_case @name=N'T10 quantity above stock', @expected_error=51005, @test_sql=N'insert dbo.equipment_rentals(rental_id,member_id,equipment_id,rental_date,due_date,quantity,total_amount) values(''TRN0000001'',''TMB0000001'',''TEQ0000001'',@today,dateadd(day,1,@today),3,40);';
go

exec dbo.sp_test_case @name=N'T11 stock equality succeeds', @expected_error=0, @test_sql=N'insert dbo.equipment_rentals(rental_id,member_id,equipment_id,rental_date,due_date,quantity,total_amount) values(''TRN0000001'',''TMB0000001'',''TEQ0000001'',@today,dateadd(day,1,@today),1,40);insert dbo.equipment_rentals(rental_id,member_id,equipment_id,rental_date,due_date,quantity,total_amount) values(''TRN0000002'',''TMB0000001'',''TEQ0000001'',@today,dateadd(day,1,@today),1,40);';
go

exec dbo.sp_test_case @name=N'T12 combined quantity above stock', @expected_error=51005, @test_sql=N'insert dbo.equipment_rentals(rental_id,member_id,equipment_id,rental_date,due_date,quantity,total_amount) values(''TRN0000001'',''TMB0000001'',''TEQ0000001'',@today,dateadd(day,1,@today),1,40);insert dbo.equipment_rentals(rental_id,member_id,equipment_id,rental_date,due_date,quantity,total_amount) values(''TRN0000002'',''TMB0000001'',''TEQ0000001'',@today,dateadd(day,1,@today),2,40);';
go

exec dbo.sp_test_case @name=N'T13 overdue remains occupied', @expected_error=51005, @test_sql=N'insert dbo.equipment_rentals(rental_id,member_id,equipment_id,rental_date,due_date,quantity,total_amount) values(''TRN0000001'',''TMB0000001'',''TEQ0000001'',dateadd(day,-5,@today),dateadd(day,-4,@today),2,40);insert dbo.equipment_rentals(rental_id,member_id,equipment_id,rental_date,due_date,quantity,total_amount) values(''TRN0000002'',''TMB0000001'',''TEQ0000001'',@today,dateadd(day,1,@today),1,40);';
go

exec dbo.sp_test_case @name=N'T14 invalid actual return date', @expected_error=547, @test_sql=N'insert dbo.equipment_rentals(rental_id,member_id,equipment_id,rental_date,due_date,quantity,total_amount) values(''TRN0000001'',''TMB0000001'',''TEQ0000001'',@today,dateadd(day,1,@today),1,40);update dbo.equipment_rentals set status=''returned'',return_date=dateadd(day,-1,@today) where rental_id=''TRN0000001'';';
go

exec dbo.sp_test_case @name=N'T15 payment XOR', @expected_error=547, @test_sql=N'insert dbo.court_bookings(booking_id,member_id,court_id,booking_date,start_time,end_time,total_amount) values(''TBK0000001'',''TMB0000001'',''TCT0000001'',@today,''09:00'',''10:00'',100);insert dbo.equipment_rentals(rental_id,member_id,equipment_id,rental_date,due_date,quantity,total_amount) values(''TRN0000001'',''TMB0000001'',''TEQ0000001'',@today,dateadd(day,1,@today),1,40);insert dbo.payments(booking_id,rental_id,amount,payment_method) values(''TBK0000001'',''TRN0000001'',10,N''cash'');';
go

exec dbo.sp_test_case @name=N'T16 payment amount zero', @expected_error=547, @test_sql=N'insert dbo.court_bookings(booking_id,member_id,court_id,booking_date,start_time,end_time,total_amount) values(''TBK0000001'',''TMB0000001'',''TCT0000001'',@today,''09:00'',''10:00'',100);insert dbo.payments(payment_id,booking_id,amount,payment_method,status) values(''TPY0000001'',''TBK0000001'',0,N''cash'',''paid'');';
go

exec dbo.sp_test_case @name=N'T17 duplicate transaction reference', @expected_error=2601, @test_sql=N'insert dbo.court_bookings(booking_id,member_id,court_id,booking_date,start_time,end_time,total_amount) values(''TBK0000001'',''TMB0000001'',''TCT0000001'',@today,''09:00'',''10:00'',100);insert dbo.payments(booking_id,amount,payment_method,transaction_ref,status) values(''TBK0000001'',20,N''cash'',''T-DUP'',''paid''),(''TBK0000001'',20,N''cash'',''T-DUP'',''paid'');';
go

exec dbo.sp_test_case @name=N'T18 paid total too high', @expected_error=51007, @test_sql=N'insert dbo.court_bookings(booking_id,member_id,court_id,booking_date,start_time,end_time,total_amount) values(''TBK0000001'',''TMB0000001'',''TCT0000001'',@today,''09:00'',''10:00'',100);insert dbo.payments(payment_id,booking_id,amount,payment_method,status) values(''TPY0000001'',''TBK0000001'',100,N''cash'',''paid'');insert dbo.payments(payment_id,booking_id,amount,payment_method,status) values(''TPY0000002'',''TBK0000001'',1,N''cash'',''paid'');';
go

exec dbo.sp_test_case @name=N'T19 final amount below paid', @expected_error=51007, @test_sql=N'insert dbo.court_bookings(booking_id,member_id,court_id,booking_date,start_time,end_time,total_amount) values(''TBK0000001'',''TMB0000001'',''TCT0000001'',@today,''09:00'',''10:00'',100);insert dbo.payments(payment_id,booking_id,amount,payment_method,status) values(''TPY0000001'',''TBK0000001'',100,N''cash'',''paid'');update dbo.court_bookings set total_amount=99 where booking_id=''TBK0000001'';';
go

exec dbo.sp_test_case @name=N'T20 immutable booking snapshot', @expected_error=51012, @test_sql=N'insert dbo.court_bookings(booking_id,member_id,court_id,booking_date,start_time,end_time,total_amount) values(''TBK0000001'',''TMB0000001'',''TCT0000001'',@today,''09:00'',''10:00'',100);update dbo.court_bookings set hourly_rate_snapshot=999 where booking_id=''TBK0000001'';';
go

exec dbo.sp_test_case @name=N'T21 catalog changes preserve snapshots', @expected_error=0, @test_sql=N'insert dbo.court_bookings(booking_id,member_id,court_id,booking_date,start_time,end_time,total_amount) values(''TBK0000001'',''TMB0000001'',''TCT0000001'',@today,''09:00'',''10:00'',100);insert dbo.equipment_rentals(rental_id,member_id,equipment_id,rental_date,due_date,quantity,total_amount) values(''TRN0000001'',''TMB0000001'',''TEQ0000001'',@today,dateadd(day,1,@today),1,40);update dbo.courts set hourly_rate=900 where court_id=''TCT0000001''; update dbo.equipment set rental_rate=900 where equipment_id=''TEQ0000001''; if (select hourly_rate_snapshot from dbo.court_bookings where booking_id=''TBK0000001'')<>100 or (select rental_rate_snapshot from dbo.equipment_rentals where rental_id=''TRN0000001'')<>20 throw 51980,N''Price history changed'',1;';
go

exec dbo.sp_test_case @name=N'T22 stock reduction rejected', @expected_error=51005, @test_sql=N'insert dbo.equipment_rentals(rental_id,member_id,equipment_id,rental_date,due_date,quantity,total_amount) values(''TRN0000001'',''TMB0000001'',''TEQ0000001'',@today,dateadd(day,1,@today),1,40);update dbo.equipment set total_quantity=0 where equipment_id=''TEQ0000001'';';
go

exec dbo.sp_test_case @name=N'T23 FK delete preserves history', @expected_error=547, @test_sql=N'insert dbo.court_bookings(booking_id,member_id,court_id,booking_date,start_time,end_time,total_amount) values(''TBK0000001'',''TMB0000001'',''TCT0000001'',@today,''09:00'',''10:00'',100);delete dbo.members where member_id=''TMB0000001'';';
go

exec dbo.sp_test_case @name=N'T24 combined SP creates booking two rentals three payments', @expected_error=0, @test_sql=N'declare @items dbo.equipment_request; insert @items values(''TEQ0000001'',1,@today,@today,null,null),(''TEQ0000002'',1,@today,@today,null,null);exec dbo.sp_BookCourtAndEquipment @member_id=''TMB0000001'',@court_id=''TCT0000001'',@booking_date=@today,@start_time=''09:00'',@end_time=''10:00'',@equipment_items=@items;if (select count(*) from dbo.court_bookings where member_id=''TMB0000001'')<>1 or (select count(*) from dbo.equipment_rentals where member_id=''TMB0000001'')<>2 or (select count(*) from dbo.payments p left join dbo.court_bookings b on b.booking_id=p.booking_id left join dbo.equipment_rentals r on r.rental_id=p.rental_id where b.member_id=''TMB0000001'' or r.member_id=''TMB0000001'')<>3 throw 51980,N''Atomic records missing'',1;';
go

exec dbo.sp_test_case @name=N'T25 SP fails after booking insert and rolls back everything', @expected_error=51005, @test_sql=N'declare @items dbo.equipment_request; insert @items values(''TEQ0000001'',3,@today,@today,null,null);exec dbo.sp_BookCourtAndEquipment @member_id=''TMB0000001'',@court_id=''TCT0000001'',@booking_date=@today,@start_time=''09:00'',@end_time=''10:00'',@equipment_items=@items;';
go

exec dbo.sp_test_case @name=N'T26 multirow booking conflict in inserted rows', @expected_error=51003, @test_sql=N'insert dbo.court_bookings(booking_id,member_id,court_id,booking_date,start_time,end_time,total_amount) values(''TBK0000001'',''TMB0000001'',''TCT0000001'',@today,''09:00'',''10:00'',100),(''TBK0000002'',''TMB0000001'',''TCT0000001'',@today,''09:30'',''10:30'',100);';
go

exec dbo.sp_test_case @name=N'T27 multirow booking update conflict', @expected_error=51003, @test_sql=N'insert dbo.court_bookings(booking_id,member_id,court_id,booking_date,start_time,end_time,total_amount) values(''TBK0000001'',''TMB0000001'',''TCT0000001'',@today,''09:00'',''10:00'',100);insert dbo.court_bookings(booking_id,member_id,court_id,booking_date,start_time,end_time,total_amount) values(''TBK0000002'',''TMB0000001'',''TCT0000001'',@today,''10:00'',''11:00'',100);update dbo.court_bookings set start_time=''09:00'',end_time=''10:00'' where booking_id in (''TBK0000001'',''TBK0000002'');';
go

exec dbo.sp_test_case @name=N'T28 multirow rental stock check', @expected_error=51005, @test_sql=N'insert dbo.equipment_rentals(rental_id,member_id,equipment_id,rental_date,due_date,quantity,total_amount) values(''TRN0000001'',''TMB0000001'',''TEQ0000001'',@today,dateadd(day,1,@today),1,40),(''TRN0000002'',''TMB0000001'',''TEQ0000001'',@today,dateadd(day,1,@today),2,80);';
go

exec dbo.sp_test_case @name=N'T29 future opening hours protect bookings', @expected_error=51010, @test_sql=N'insert dbo.court_bookings(booking_id,member_id,court_id,booking_date,start_time,end_time,total_amount) values(''TBK0000001'',''TMB0000001'',''TCT0000001'',@today,''09:00'',''10:00'',100);update dbo.facilities set opening_time=''10:00'' where facility_id=''TFC0000001'';';
go

exec dbo.sp_test_case @name=N'T30 immutable rental snapshot', @expected_error=51018, @test_sql=N'insert dbo.equipment_rentals(rental_id,member_id,equipment_id,rental_date,due_date,quantity,total_amount) values(''TRN0000001'',''TMB0000001'',''TEQ0000001'',@today,dateadd(day,1,@today),1,40);update dbo.equipment_rentals set rental_rate_snapshot=999 where rental_id=''TRN0000001'';';
go

exec dbo.sp_test_case @name=N'T31 actual return frees later days but not same day', @expected_error=0, @test_sql=N'insert dbo.equipment_rentals(rental_id,member_id,equipment_id,rental_date,due_date,quantity,total_amount) values(''TRN0000001'',''TMB0000001'',''TEQ0000001'',@today,dateadd(day,1,@today),1,40);update dbo.equipment_rentals set status=''returned'',return_date=@today where rental_id=''TRN0000001'';insert dbo.equipment_rentals(rental_id,member_id,equipment_id,rental_date,due_date,quantity,total_amount) values(''TRN0000002'',''TMB0000001'',''TEQ0000001'',dateadd(day,1,@today),dateadd(day,2,@today),2,40);';
go

exec dbo.sp_test_case @name=N'T32 inclusive shared day cannot exceed stock', @expected_error=51005, @test_sql=N'insert dbo.equipment_rentals(rental_id,member_id,equipment_id,rental_date,due_date,quantity,total_amount) values(''TRN0000001'',''TMB0000001'',''TEQ0000001'',@today,dateadd(day,1,@today),2,40);insert dbo.equipment_rentals(rental_id,member_id,equipment_id,rental_date,due_date,quantity,total_amount) values(''TRN0000002'',''TMB0000001'',''TEQ0000001'',dateadd(day,1,@today),dateadd(day,2,@today),1,40);';
go

exec dbo.sp_test_case @name=N'T33 maintenance XOR rejected', @expected_error=547, @test_sql=N'insert dbo.maintenance(staff_id,facility_id,court_id,maintenance_date,description,cost) values(''TST0000001'',''TFC0000001'',''TCT0000001'',@today,N''test'',0);';
go

exec dbo.sp_test_case @name=N'T34 multiple NULL references permitted', @expected_error=0, @test_sql=N'insert dbo.court_bookings(booking_id,member_id,court_id,booking_date,start_time,end_time,total_amount) values(''TBK0000001'',''TMB0000001'',''TCT0000001'',@today,''09:00'',''10:00'',100);insert dbo.payments(booking_id,amount,payment_method,status) values(''TBK0000001'',20,N''cash'',''paid''),(''TBK0000001'',20,N''cash'',''paid'');';
go

exec dbo.sp_test_case @name=N'T35 blank transaction reference rejected', @expected_error=547, @test_sql=N'insert dbo.court_bookings(booking_id,member_id,court_id,booking_date,start_time,end_time,total_amount) values(''TBK0000001'',''TMB0000001'',''TCT0000001'',@today,''09:00'',''10:00'',100);insert dbo.payments(booking_id,amount,payment_method,transaction_ref) values(''TBK0000001'',20,N''cash'',''   '');';
go

exec dbo.sp_test_case @name=N'T36 rental total cannot fall below paid', @expected_error=51007, @test_sql=N'insert dbo.equipment_rentals(rental_id,member_id,equipment_id,rental_date,due_date,quantity,total_amount) values(''TRN0000001'',''TMB0000001'',''TEQ0000001'',@today,dateadd(day,1,@today),1,40);insert dbo.payments(rental_id,amount,payment_method,status) values(''TRN0000001'',40,N''cash'',''paid'');update dbo.equipment_rentals set total_amount=39 where rental_id=''TRN0000001'';';
go

exec dbo.sp_test_case @name=N'T37 disjoint overlaps use peak not sum', @expected_error=0, @test_sql=N'insert dbo.equipment_rentals(rental_id,member_id,equipment_id,rental_date,due_date,quantity,total_amount) values(''TRN0000001'',''TMB0000001'',''TEQ0000001'',@today,dateadd(day,1,@today),1,40);insert dbo.equipment_rentals(rental_id,member_id,equipment_id,rental_date,due_date,quantity,total_amount) values(''TRN0000002'',''TMB0000001'',''TEQ0000001'',dateadd(day,2,@today),dateadd(day,3,@today),1,40);insert dbo.equipment_rentals(rental_id,member_id,equipment_id,rental_date,due_date,quantity,total_amount) values(''TRN0000003'',''TMB0000001'',''TEQ0000001'',@today,dateadd(day,3,@today),1,40);';
go

exec dbo.sp_test_case @name=N'T38 membership endpoints allowed', @expected_error=0, @test_sql=N'update dbo.members set membership_start=@today,membership_end=@today where member_id=''TMB0000001'';insert dbo.court_bookings(booking_id,member_id,court_id,booking_date,start_time,end_time,total_amount) values(''TBK0000001'',''TMB0000001'',''TCT0000001'',@today,''09:00'',''10:00'',100);insert dbo.equipment_rentals(rental_id,member_id,equipment_id,rental_date,due_date,quantity,total_amount) values(''TRN0000001'',''TMB0000001'',''TEQ0000001'',@today,dateadd(day,1,@today),1,40);';
go

exec dbo.sp_test_case @name=N'T39 no hard delete transaction history', @expected_error=51025, @test_sql=N'insert dbo.court_bookings(booking_id,member_id,court_id,booking_date,start_time,end_time,total_amount) values(''TBK0000001'',''TMB0000001'',''TCT0000001'',@today,''09:00'',''10:00'',100);delete dbo.court_bookings where booking_id=''TBK0000001'';';
go

exec dbo.sp_test_case @name=N'T40 free booking produces no payment', @expected_error=0, @test_sql=N'declare @items dbo.equipment_request; exec dbo.sp_BookCourtAndEquipment @member_id=''TMB0000001'',@court_id=''TCT0000001'',@booking_date=@today,@start_time=''09:00'',@end_time=''10:00'',@equipment_items=@items,@total_amount=0;if exists(select 1 from dbo.payments where booking_id in(select booking_id from dbo.court_bookings where member_id=''TMB0000001''))throw 51980,N''Zero total generated a payment'',1;';
go

exec dbo.sp_test_case @name=N'T41 inactive facility', @expected_error=51016, @test_sql=N'update dbo.facilities set status=''inactive'' where facility_id=''TFC0000001'';insert dbo.court_bookings(booking_id,member_id,court_id,booking_date,start_time,end_time,total_amount) values(''TBK0000001'',''TMB0000001'',''TCT0000001'',@today,''09:00'',''10:00'',100);';
go

exec dbo.sp_test_case @name=N'T42 cancellation allowed on unavailable resource', @expected_error=0, @test_sql=N'insert dbo.court_bookings(booking_id,member_id,court_id,booking_date,start_time,end_time,total_amount) values(''TBK0000001'',''TMB0000001'',''TCT0000001'',@today,''09:00'',''10:00'',100);update dbo.courts set status=''maintenance'' where court_id=''TCT0000001'';update dbo.court_bookings set status=''cancelled'' where booking_id=''TBK0000001'';';
go

exec dbo.sp_test_case @name=N'T43 return allowed after equipment disabled', @expected_error=0, @test_sql=N'insert dbo.equipment_rentals(rental_id,member_id,equipment_id,rental_date,due_date,quantity,total_amount) values(''TRN0000001'',''TMB0000001'',''TEQ0000001'',@today,dateadd(day,1,@today),1,40);update dbo.equipment set status=''inactive'' where equipment_id=''TEQ0000001'';update dbo.equipment_rentals set status=''returned'',return_date=@today where rental_id=''TRN0000001'';';
go

exec dbo.sp_test_case @name=N'T44 client-supplied snapshot ignored', @expected_error=0, @test_sql=N'insert dbo.court_bookings(booking_id,member_id,court_id,booking_date,start_time,end_time,total_amount,hourly_rate_snapshot) values(''TBK0000001'',''TMB0000001'',''TCT0000001'',@today,''09:00'',''10:00'',100,999);if (select hourly_rate_snapshot from dbo.court_bookings where booking_id=''TBK0000001'')<>100 throw 51980,N''Client chose snapshot'',1;';
go

exec dbo.sp_test_case @name=N'T45 completed historical rentals do not prevent stock retirement', @expected_error=0, @test_sql=N'insert dbo.equipment_rentals(rental_id,member_id,equipment_id,rental_date,due_date,return_date,quantity,total_amount,status)values(''TRN0000001'',''TMB0000001'',''TEQ0000001'',dateadd(day,-5,@today),dateadd(day,-4,@today),dateadd(day,-4,@today),2,80,''returned'');update dbo.equipment set total_quantity=0 where equipment_id=''TEQ0000001'';';
go

exec dbo.sp_test_case @name=N'T46 current stock checks ignore released historical peaks', @expected_error=0, @test_sql=N'insert dbo.equipment_rentals(rental_id,member_id,equipment_id,rental_date,due_date,return_date,quantity,total_amount,status)values(''TRN0000009'',''TMB0000001'',''TEQ0000001'',dateadd(day,-5,@today),dateadd(day,-4,@today),dateadd(day,-4,@today),2,80,''returned'');update dbo.equipment set total_quantity=1 where equipment_id=''TEQ0000001'';insert dbo.equipment_rentals(rental_id,member_id,equipment_id,rental_date,due_date,quantity,total_amount) values(''TRN0000001'',''TMB0000001'',''TEQ0000001'',@today,dateadd(day,1,@today),1,40);';
go

drop procedure dbo.sp_test_case;
go
