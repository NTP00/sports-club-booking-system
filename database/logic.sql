use sports_club_booking;
go
set ansi_nulls on;
set quoted_identifier on;
go
create or alter function dbo.fn_today()
returns date
as
begin
    return convert(date, sysdatetimeoffset() at time zone 'SE Asia Standard Time');
end;
go
-- Small academic system: serialize all writes before touching base tables.
-- Triggers also use this gate, so direct SSMS DML cannot bypass the lock.
create or alter procedure dbo.sp_lock_integrity
as
begin
    set nocount on;
    if @@trancount = 0 throw 51000, N'Integrity lock requires a transaction.', 1;
    if exists(select 1 from sys.dm_exec_sessions where session_id=@@spid and transaction_isolation_level=5)
        throw 51001, N'SNAPSHOT isolation is not supported for writes. Use READ COMMITTED.', 1;
    declare @lock_result int;
    exec @lock_result=sys.sp_getapplock @Resource=N'sports_club_integrity',
        @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=15000;
    if @lock_result < 0 throw 51002, N'Concurrent operation is busy. Retry the complete transaction.', 1;
end;
go
create or alter function dbo.fn_rental_periods()
returns table
as return (
    select rental_id, equipment_id, rental_date, quantity,
        case when return_date is not null then return_date
             when due_date < dbo.fn_today() then convert(date,'99991231')
             else due_date end as effective_end
    from dbo.equipment_rentals where status <> 'cancelled'
);
go
create or alter procedure dbo.sp_check_stock @equipment_ids dbo.resource_ids readonly, @from_date date=null
as
begin
    set nocount on;
    -- Occupancy can increase only at a rental start. Check all such points,
    -- rather than incorrectly summing disjoint rentals that overlap a long one.
    if exists (
        select 1 from dbo.fn_rental_periods() p
        join @equipment_ids ids on ids.resource_id=p.equipment_id
        join dbo.equipment e on e.equipment_id=p.equipment_id
        cross apply (select case when @from_date is not null and p.rental_date<@from_date then @from_date else p.rental_date end as point_date) point
        cross apply (
            select sum(convert(bigint,r.quantity)) as committed_quantity
            from dbo.fn_rental_periods() r
            where r.equipment_id=p.equipment_id
              and r.rental_date <= point.point_date and r.effective_end >= point.point_date
        ) q
        where p.effective_end>=point.point_date and q.committed_quantity > e.total_quantity
    ) throw 51005, N'Equipment stock is insufficient for the requested inclusive date period.', 1;
end;
go
create or alter procedure dbo.sp_check_paid_totals
as
begin
    set nocount on;
    if exists(select 1 from dbo.court_bookings b
        cross apply(select sum(p.amount) as paid from dbo.payments p where p.booking_id=b.booking_id and p.status='paid') s
        where s.paid > b.total_amount)
       or exists(select 1 from dbo.equipment_rentals r
        cross apply(select sum(p.amount) as paid from dbo.payments p where p.rental_id=r.rental_id and p.status='paid') s
        where s.paid > r.total_amount)
        throw 51007, N'Paid total exceeds final transaction amount.', 1;
end;
go

create or alter trigger dbo.trg_facilities_integrity on dbo.facilities
instead of insert, update, delete
as
begin
    set nocount on;
    if not exists(select 1 from inserted) and not exists(select 1 from deleted) return;
    exec dbo.sp_lock_integrity;
    if exists(select 1 from deleted) and not exists(select 1 from inserted)
    begin
        delete base from dbo.facilities base join deleted d on d.facility_id=base.facility_id;
        return;
    end;
    if exists(select 1 from deleted) and update(facility_id)
        throw 51026, N'Primary IDs are immutable.', 1;
    if exists(select 1 from inserted i join deleted d on i.facility_id=d.facility_id
        join dbo.courts c on c.facility_id=i.facility_id
        join dbo.court_bookings b on b.court_id=c.court_id
        where b.status='confirmed' and b.booking_date >= dbo.fn_today()
        and (i.opening_time<>d.opening_time or i.closing_time<>d.closing_time)
        and (b.start_time<i.opening_time or b.end_time>i.closing_time))
        throw 51010, N'Opening hours would invalidate an existing future booking.', 1;
    if exists(select 1 from deleted)
    begin
        update base set facility_name=i.facility_name,
            facility_type=i.facility_type,
            location=i.location,
            opening_time=i.opening_time,
            closing_time=i.closing_time,
            status=i.status
        from dbo.facilities base join inserted i on i.facility_id=base.facility_id;
    end
    else
    begin
        insert dbo.facilities(facility_id, facility_name, facility_type, location, opening_time, closing_time, status)
        select i.facility_id, i.facility_name, i.facility_type, i.location, i.opening_time, i.closing_time, i.status from inserted i;
    end;
    
end;
go

create or alter trigger dbo.trg_courts_integrity on dbo.courts
instead of insert, update, delete
as
begin
    set nocount on;
    if not exists(select 1 from inserted) and not exists(select 1 from deleted) return;
    exec dbo.sp_lock_integrity;
    if exists(select 1 from deleted) and not exists(select 1 from inserted)
    begin
        delete base from dbo.courts base join deleted d on d.court_id=base.court_id;
        return;
    end;
    if exists(select 1 from deleted) and update(court_id)
        throw 51026, N'Primary IDs are immutable.', 1;
    if exists(select 1 from inserted i join deleted d on i.court_id=d.court_id
        where i.facility_id<>d.facility_id and exists(select 1 from dbo.court_bookings b where b.court_id=i.court_id))
        throw 51011, N'A court with booking history cannot move to another facility.', 1;
    if exists(select 1 from deleted)
    begin
        update base set facility_id=i.facility_id,
            court_name=i.court_name,
            court_type=i.court_type,
            capacity=i.capacity,
            hourly_rate=i.hourly_rate,
            status=i.status
        from dbo.courts base join inserted i on i.court_id=base.court_id;
    end
    else
    begin
        insert dbo.courts(court_id, facility_id, court_name, court_type, capacity, hourly_rate, status)
        select i.court_id, i.facility_id, i.court_name, i.court_type, i.capacity, i.hourly_rate, i.status from inserted i;
    end;
    
end;
go

create or alter trigger dbo.trg_members_integrity on dbo.members
instead of insert, update, delete
as
begin
    set nocount on;
    if not exists(select 1 from inserted) and not exists(select 1 from deleted) return;
    exec dbo.sp_lock_integrity;
    if exists(select 1 from deleted) and not exists(select 1 from inserted)
    begin
        delete base from dbo.members base join deleted d on d.member_id=base.member_id;
        return;
    end;
    if exists(select 1 from deleted) and update(member_id)
        throw 51026, N'Primary IDs are immutable.', 1;
    
    if exists(select 1 from deleted)
    begin
        update base set first_name=i.first_name,
            last_name=i.last_name,
            phone=i.phone,
            email=i.email,
            membership_type=i.membership_type,
            membership_start=i.membership_start,
            membership_end=i.membership_end,
            status=i.status
        from dbo.members base join inserted i on i.member_id=base.member_id;
    end
    else
    begin
        insert dbo.members(member_id, first_name, last_name, phone, email, membership_type, membership_start, membership_end, status)
        select i.member_id, i.first_name, i.last_name, i.phone, i.email, i.membership_type, i.membership_start, i.membership_end, i.status from inserted i;
    end;
    
end;
go

create or alter trigger dbo.trg_CheckCourtConflict on dbo.court_bookings
instead of insert, update, delete
as
begin
    set nocount on;
    if not exists(select 1 from inserted) and not exists(select 1 from deleted) return;
    exec dbo.sp_lock_integrity;
    if exists(select 1 from deleted) and not exists(select 1 from inserted)
    begin
        throw 51025, N'Transaction/history rows cannot be hard deleted. Change status.', 1;
    end;
    if exists(select 1 from deleted) and update(booking_id)
        throw 51026, N'Primary IDs are immutable.', 1;
    if exists(select 1 from inserted i join deleted d on i.booking_id=d.booking_id
        where i.hourly_rate_snapshot<>d.hourly_rate_snapshot or i.created_at<>d.created_at
           or i.court_id<>d.court_id or i.member_id<>d.member_id)
        throw 51012, N'Booking identity, creation timestamp and historical snapshot are immutable.', 1;
    if exists(select 1 from inserted i join deleted d on i.booking_id=d.booking_id
        where d.status='cancelled' and i.status<>'cancelled')
        throw 51013, N'A cancelled booking cannot be reopened. Create a new booking.', 1;
    if exists(select 1 from inserted i left join deleted d on i.booking_id=d.booking_id
        where i.status='cancelled' and (d.booking_id is null or i.booking_date<>d.booking_date
            or i.start_time<>d.start_time or i.end_time<>d.end_time or i.total_amount<>d.total_amount))
        throw 51014, N'Cancellation changes only the status of an existing booking.', 1;
    if exists(select 1 from inserted i join dbo.members m on m.member_id=i.member_id
        where i.status='confirmed' and (m.status<>'active' or i.booking_date<m.membership_start or i.booking_date>m.membership_end))
        throw 51015, N'Member is inactive or the booking date is outside membership.', 1;
    if exists(select 1 from inserted i join dbo.courts c on c.court_id=i.court_id
        join dbo.facilities f on f.facility_id=c.facility_id where i.status='confirmed'
        and (c.status<>'active' or f.status<>'active' or i.start_time<f.opening_time or i.end_time>f.closing_time))
        throw 51016, N'Court/facility is unavailable or booking is outside opening hours.', 1;
    if exists(select 1 from inserted i join dbo.payments p on p.booking_id=i.booking_id
        where i.status='cancelled' and p.status='paid')
        throw 51017, N'Paid bookings need payment cancellation before booking cancellation.', 1;
    if exists(select 1 from deleted)
    begin
        update base set member_id=i.member_id,
            court_id=i.court_id,
            booking_date=i.booking_date,
            start_time=i.start_time,
            end_time=i.end_time,
            total_amount=i.total_amount,
            hourly_rate_snapshot=i.hourly_rate_snapshot,
            status=i.status,
            created_at=i.created_at
        from dbo.court_bookings base join inserted i on i.booking_id=base.booking_id;
    end
    else
    begin
        insert dbo.court_bookings(booking_id, member_id, court_id, booking_date, start_time, end_time, total_amount, hourly_rate_snapshot, status, created_at)
        select i.booking_id, i.member_id, i.court_id, i.booking_date, i.start_time, i.end_time, i.total_amount, (select hourly_rate from dbo.courts where court_id=i.court_id), i.status, i.created_at from inserted i;
    end;
    if exists(select 1 from dbo.court_bookings a
        join dbo.court_bookings b on a.court_id=b.court_id and a.booking_date=b.booking_date
            and a.booking_id < b.booking_id and a.start_time < b.end_time and a.end_time > b.start_time
        where a.status='confirmed' and b.status='confirmed'
            and (exists(select 1 from inserted i where i.booking_id=a.booking_id)
                or exists(select 1 from inserted i where i.booking_id=b.booking_id)))
        throw 51003, N'Court booking overlaps another confirmed booking.', 1;
    exec dbo.sp_check_paid_totals;
end;
go

create or alter trigger dbo.trg_equipment_integrity on dbo.equipment
instead of insert, update, delete
as
begin
    set nocount on;
    if not exists(select 1 from inserted) and not exists(select 1 from deleted) return;
    exec dbo.sp_lock_integrity;
    if exists(select 1 from deleted) and not exists(select 1 from inserted)
    begin
        delete base from dbo.equipment base join deleted d on d.equipment_id=base.equipment_id;
        return;
    end;
    if exists(select 1 from deleted) and update(equipment_id)
        throw 51026, N'Primary IDs are immutable.', 1;
    
    if exists(select 1 from deleted)
    begin
        update base set equipment_name=i.equipment_name,
            equipment_type=i.equipment_type,
            total_quantity=i.total_quantity,
            rental_rate=i.rental_rate,
            status=i.status
        from dbo.equipment base join inserted i on i.equipment_id=base.equipment_id;
    end
    else
    begin
        insert dbo.equipment(equipment_id, equipment_name, equipment_type, total_quantity, rental_rate, status)
        select i.equipment_id, i.equipment_name, i.equipment_type, i.total_quantity, i.rental_rate, i.status from inserted i;
    end;
    declare @ids dbo.resource_ids;
    insert @ids select equipment_id from inserted;
    declare @from_date date=dbo.fn_today();
    exec dbo.sp_check_stock @ids, @from_date;
end;
go

create or alter trigger dbo.trg_equipment_rentals_integrity on dbo.equipment_rentals
instead of insert, update, delete
as
begin
    set nocount on;
    if not exists(select 1 from inserted) and not exists(select 1 from deleted) return;
    exec dbo.sp_lock_integrity;
    if exists(select 1 from deleted) and not exists(select 1 from inserted)
    begin
        throw 51025, N'Transaction/history rows cannot be hard deleted. Change status.', 1;
    end;
    if exists(select 1 from deleted) and update(rental_id)
        throw 51026, N'Primary IDs are immutable.', 1;
    if exists(select 1 from inserted i join deleted d on i.rental_id=d.rental_id
        where i.rental_rate_snapshot<>d.rental_rate_snapshot or i.equipment_id<>d.equipment_id or i.member_id<>d.member_id)
        throw 51018, N'Rental identity and historical snapshot are immutable.', 1;
    if exists(select 1 from inserted i join deleted d on i.rental_id=d.rental_id
        where d.status in ('returned','cancelled') and i.status<>d.status)
        throw 51019, N'Closed rentals cannot be reopened.', 1;
    if exists(select 1 from inserted i left join deleted d on i.rental_id=d.rental_id
        where i.status in ('returned','cancelled') and d.rental_id is not null
          and (i.rental_date<>d.rental_date or i.due_date<>d.due_date or i.quantity<>d.quantity
              or (d.return_date is not null and (i.return_date is null or i.return_date<>d.return_date))))
        throw 51020, N'Return/cancel must preserve rental dates, quantity and any recorded actual return.', 1;
    if exists(select 1 from inserted i left join deleted d on i.rental_id=d.rental_id
        join dbo.members m on m.member_id=i.member_id join dbo.equipment e on e.equipment_id=i.equipment_id
        where (d.rental_id is null or i.status='active') and
          (m.status<>'active' or i.rental_date<m.membership_start or i.rental_date>m.membership_end or e.status<>'active'))
        throw 51021, N'Member/membership or equipment does not allow this rental.', 1;
    if exists(select 1 from inserted i join dbo.payments p on p.rental_id=i.rental_id
        where i.status='cancelled' and p.status='paid')
        throw 51022, N'Paid rentals need payment cancellation before rental cancellation.', 1;
    if exists(select 1 from deleted)
    begin
        update base set member_id=i.member_id,
            equipment_id=i.equipment_id,
            rental_date=i.rental_date,
            due_date=i.due_date,
            return_date=i.return_date,
            quantity=i.quantity,
            rental_rate_snapshot=i.rental_rate_snapshot,
            total_amount=i.total_amount,
            status=i.status
        from dbo.equipment_rentals base join inserted i on i.rental_id=base.rental_id;
    end
    else
    begin
        insert dbo.equipment_rentals(rental_id, member_id, equipment_id, rental_date, due_date, return_date, quantity, rental_rate_snapshot, total_amount, status)
        select i.rental_id, i.member_id, i.equipment_id, i.rental_date, i.due_date, i.return_date, i.quantity, (select rental_rate from dbo.equipment where equipment_id=i.equipment_id), i.total_amount, i.status from inserted i;
    end;
    declare @ids dbo.resource_ids;
    insert @ids select equipment_id from inserted union select equipment_id from deleted;
    declare @from_date date=dbo.fn_today();
    -- Inserts/widening edits must validate their historical/requested periods.
    -- Pure return/cancel only releases occupancy, so validate current/future.
    if not exists(select 1 from deleted)
       or exists(select 1 from inserted i join deleted d on i.rental_id=d.rental_id
           where i.status='active' and (i.quantity>d.quantity or i.rental_date<d.rental_date or i.due_date>d.due_date))
        select @from_date=min(rental_date) from inserted;
    exec dbo.sp_check_stock @ids, @from_date;
    exec dbo.sp_check_paid_totals;
end;
go

create or alter trigger dbo.trg_payments_integrity on dbo.payments
instead of insert, update, delete
as
begin
    set nocount on;
    if not exists(select 1 from inserted) and not exists(select 1 from deleted) return;
    exec dbo.sp_lock_integrity;
    if exists(select 1 from deleted) and not exists(select 1 from inserted)
    begin
        throw 51025, N'Transaction/history rows cannot be hard deleted. Change status.', 1;
    end;
    if exists(select 1 from deleted) and update(payment_id)
        throw 51026, N'Primary IDs are immutable.', 1;
    if exists(select 1 from inserted i join deleted d on i.payment_id=d.payment_id
        where isnull(i.booking_id,'')<>isnull(d.booking_id,'') or isnull(i.rental_id,'')<>isnull(d.rental_id,''))
        throw 51023, N'Payment source is immutable.', 1;
    if exists(select 1 from inserted i left join dbo.court_bookings b on b.booking_id=i.booking_id
        left join dbo.equipment_rentals r on r.rental_id=i.rental_id
        where i.status='paid' and (b.status='cancelled' or r.status='cancelled'))
        throw 51024, N'Cannot pay a cancelled transaction.', 1;
    if exists(select 1 from deleted)
    begin
        update base set rental_id=i.rental_id,
            booking_id=i.booking_id,
            amount=i.amount,
            payment_date=i.payment_date,
            payment_method=i.payment_method,
            transaction_ref=i.transaction_ref,
            status=i.status
        from dbo.payments base join inserted i on i.payment_id=base.payment_id;
    end
    else
    begin
        insert dbo.payments(payment_id, rental_id, booking_id, amount, payment_date, payment_method, transaction_ref, status)
        select i.payment_id, i.rental_id, i.booking_id, i.amount, i.payment_date, i.payment_method, i.transaction_ref, i.status from inserted i;
    end;
    exec dbo.sp_check_paid_totals;
end;
go

create or alter trigger dbo.trg_staff_integrity on dbo.staff
instead of insert, update, delete
as
begin
    set nocount on;
    if not exists(select 1 from inserted) and not exists(select 1 from deleted) return;
    exec dbo.sp_lock_integrity;
    if exists(select 1 from deleted) and not exists(select 1 from inserted)
    begin
        delete base from dbo.staff base join deleted d on d.staff_id=base.staff_id;
        return;
    end;
    if exists(select 1 from deleted) and update(staff_id)
        throw 51026, N'Primary IDs are immutable.', 1;
    
    if exists(select 1 from deleted)
    begin
        update base set first_name=i.first_name,
            last_name=i.last_name,
            phone=i.phone,
            email=i.email,
            position=i.position,
            status=i.status
        from dbo.staff base join inserted i on i.staff_id=base.staff_id;
    end
    else
    begin
        insert dbo.staff(staff_id, first_name, last_name, phone, email, position, status)
        select i.staff_id, i.first_name, i.last_name, i.phone, i.email, i.position, i.status from inserted i;
    end;
    
end;
go

create or alter trigger dbo.trg_maintenance_integrity on dbo.maintenance
instead of insert, update, delete
as
begin
    set nocount on;
    if not exists(select 1 from inserted) and not exists(select 1 from deleted) return;
    exec dbo.sp_lock_integrity;
    if exists(select 1 from deleted) and not exists(select 1 from inserted)
    begin
        throw 51025, N'Transaction/history rows cannot be hard deleted. Change status.', 1;
    end;
    if exists(select 1 from deleted) and update(maintenance_id)
        throw 51026, N'Primary IDs are immutable.', 1;
    
    if exists(select 1 from deleted)
    begin
        update base set staff_id=i.staff_id,
            facility_id=i.facility_id,
            court_id=i.court_id,
            equipment_id=i.equipment_id,
            maintenance_date=i.maintenance_date,
            description=i.description,
            cost=i.cost,
            status=i.status
        from dbo.maintenance base join inserted i on i.maintenance_id=base.maintenance_id;
    end
    else
    begin
        insert dbo.maintenance(maintenance_id, staff_id, facility_id, court_id, equipment_id, maintenance_date, description, cost, status)
        select i.maintenance_id, i.staff_id, i.facility_id, i.court_id, i.equipment_id, i.maintenance_date, i.description, i.cost, i.status from inserted i;
    end;
    
end;
go

create or alter procedure dbo.sp_BookCourtAndEquipment
    @member_id varchar(10), @court_id varchar(10), @booking_date date,
    @start_time time(0), @end_time time(0),
    @equipment_items dbo.equipment_request readonly,
    @total_amount decimal(10,2)=null,
    @payment_method nvarchar(30)=N'cash', @booking_transaction_ref varchar(100)=null,
    @pay_now bit=1
as
begin
    set nocount on;
    set xact_abort on;
    -- A failure rolls back the whole transaction, including a caller's ambient
    -- transaction. This makes atomic failure explicit and supports SQL tests.
    declare @booking_id varchar(10), @rate decimal(10,2), @rental_count int;
    declare @rentals table(rental_id varchar(10) not null, equipment_id varchar(10) not null,
        quantity int not null, rental_date date not null, due_date date not null,
        total_amount decimal(10,2) null, transaction_ref varchar(100) null);
    declare @payment_ids table(payment_id varchar(10) not null, booking_id varchar(10) null, rental_id varchar(10) null);
    begin try
        begin transaction;
        exec dbo.sp_lock_integrity;
        if not exists(select 1 from dbo.members where member_id=@member_id)
            throw 51028, N'Member not found.', 1;
        select @rate=hourly_rate from dbo.courts where court_id=@court_id;
        if @rate is null throw 51029, N'Court not found.', 1;
        if @booking_date is null or @start_time is null or @end_time is null or @start_time>=@end_time
            throw 51030, N'Invalid booking date/time interval.', 1;
        if @pay_now is null or @payment_method is null or len(ltrim(rtrim(@payment_method)))=0
            throw 51031, N'Payment method and pay_now are required.', 1;
        if exists(select 1 from @equipment_items x left join dbo.equipment e on e.equipment_id=x.equipment_id
            where e.equipment_id is null or e.status<>'active' or x.quantity<=0 or x.due_date<x.rental_date)
            throw 51032, N'Invalid equipment request.', 1;
        set @total_amount=coalesce(@total_amount,round(datediff(second,@start_time,@end_time)/3600.0*@rate,2));
        set @booking_id='BKG'+right('0000000'+convert(varchar(7),next value for dbo.seq_court_bookings),7);
        insert dbo.court_bookings(booking_id,member_id,court_id,booking_date,start_time,end_time,total_amount)
        values(@booking_id,@member_id,@court_id,@booking_date,@start_time,@end_time,@total_amount);
        insert @rentals(rental_id,equipment_id,quantity,rental_date,due_date,total_amount,transaction_ref)
        select 'RNT'+right('0000000'+convert(varchar(7),next value for dbo.seq_equipment_rentals),7),
            x.equipment_id,x.quantity,x.rental_date,x.due_date,
            coalesce(x.total_amount,convert(decimal(10,2),convert(bigint,x.quantity)*(datediff(day,x.rental_date,x.due_date)+1)*e.rental_rate)),x.transaction_ref
        from @equipment_items x join dbo.equipment e on e.equipment_id=x.equipment_id;
        insert dbo.equipment_rentals(rental_id,member_id,equipment_id,rental_date,due_date,quantity,total_amount)
        select rental_id,@member_id,equipment_id,rental_date,due_date,quantity,total_amount from @rentals;
        if @pay_now=1
        begin
            if @total_amount>0
            begin
                insert @payment_ids values('PAY'+right('0000000'+convert(varchar(7),next value for dbo.seq_payments),7),@booking_id,null);
                insert dbo.payments(payment_id,booking_id,amount,payment_method,transaction_ref,status)
                select payment_id,@booking_id,@total_amount,@payment_method,@booking_transaction_ref,'paid' from @payment_ids;
            end;
            declare @rental_payment_ids table(payment_id varchar(10),rental_id varchar(10));
            insert @rental_payment_ids
            select 'PAY'+right('0000000'+convert(varchar(7),next value for dbo.seq_payments),7),rental_id from @rentals where total_amount>0;
            insert dbo.payments(payment_id,rental_id,amount,payment_method,transaction_ref,status)
            select p.payment_id,r.rental_id,r.total_amount,@payment_method,r.transaction_ref,'paid'
            from @rental_payment_ids p join @rentals r on r.rental_id=p.rental_id;
            insert @payment_ids select payment_id,null,rental_id from @rental_payment_ids;
        end;
        commit transaction;
        select @booking_id as booking_id;
        select rental_id,equipment_id from @rentals order by rental_id;
        select payment_id,booking_id,rental_id from @payment_ids order by payment_id;
    end try
    begin catch
        if xact_state()<>0 rollback transaction;
        throw;
    end catch;
end;
go
-- Monday-based week spine, independent of SET DATEFIRST; 20,000 weeks from
-- earliest stored transaction cover the application's full 1900-2099 window.
create or alter view dbo.vw_FacilityUtilizationReport
as
with digits as (select n from (values(0),(1),(2),(3),(4),(5),(6),(7),(8),(9))v(n)),
numbers as (select a.n+10*b.n+100*c.n+1000*d.n+10000*e.n as n from digits a cross join digits b cross join digits c cross join digits d cross join (values(0),(1)) e(n)),
dates as (select booking_date as d from dbo.court_bookings union all select rental_date from dbo.equipment_rentals
    union all select due_date from dbo.equipment_rentals union all select return_date from dbo.equipment_rentals where return_date is not null
    union all select dbo.fn_today()),
bounds as (select min(d) as lo,max(d) as hi from dates),
monday as (select dateadd(day,-((datediff(day,convert(date,'19000101'),lo)%7+7)%7),lo) as first_monday,hi from bounds),
weeks as (select dateadd(day,7*n,first_monday) as week_start from monday cross join numbers where dateadd(day,7*n,first_monday)<=hi),
court_report as (
    select w.week_start,convert(varchar(10),'court') as resource_type,c.court_id as resource_id,c.court_name as resource_name,
        c.court_type as resource_category,c.facility_id,
        convert(decimal(19,4),coalesce(b.used,0)) as utilized_units,
        convert(decimal(19,4),datediff(second,f.opening_time,f.closing_time)/60.0*7) as capacity_units
    from weeks w cross join dbo.courts c join dbo.facilities f on f.facility_id=c.facility_id
    outer apply(select sum(convert(bigint,datediff(second,b.start_time,b.end_time)))/60.0 as used from dbo.court_bookings b
        where b.court_id=c.court_id and b.status='confirmed' and b.booking_date>=w.week_start and b.booking_date<dateadd(day,7,w.week_start)) b
),
equipment_report as (
    select
        w.week_start,
        convert(varchar(10),'equipment') as resource_type,
        e.equipment_id as resource_id,
        e.equipment_name as resource_name,
        e.equipment_type as resource_category,
        convert(varchar(10), null) as facility_id,
        convert(decimal(19,4), coalesce(u.used,0)) as utilized_units,
        convert(
            decimal(19,4),
            convert(bigint, e.total_quantity) * 7
        ) as capacity_units
    from weeks w
    cross join dbo.equipment e
    left join equipment_usage u
      on u.week_start = w.week_start
     and u.equipment_id = e.equipment_id
),
combined as (
    select * from court_report
    union all
    select * from equipment_report
)
select
    week_start,
    resource_type,
    resource_id,
    resource_name,
    resource_category,
    facility_id,
    utilized_units,
    capacity_units,
    convert(
        decimal(10,2),
        100.0 * utilized_units / nullif(capacity_units,0)
    ) as utilization_percent
from combined;
go