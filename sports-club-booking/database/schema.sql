-- SQL Server 2019/2022. Non-destructive rerun: existing schema is verified separately.
use master;
go
if db_id(N'sports_club_booking') is null
    exec(N'create database sports_club_booking');
go
use sports_club_booking;
go
set ansi_nulls on;
set quoted_identifier on;
go

if object_id(N'dbo.seq_facilities',N'SO') is null
    exec(N'create sequence dbo.seq_facilities as bigint start with 1 increment by 1 minvalue 1 maxvalue 9999999 no cycle cache 50');
go

if object_id(N'dbo.facilities',N'U') is null
begin
create table dbo.facilities(
    facility_id varchar(10) not null constraint df_facilities_facility_id default ('FAC' + right('0000000' + convert(varchar(7), next value for dbo.seq_facilities), 7)),
    facility_name nvarchar(100) not null,
    facility_type nvarchar(50) not null,
    location nvarchar(150) not null,
    opening_time time(0) not null,
    closing_time time(0) not null,
    status nvarchar(20) not null constraint df_facilities_status default ('active'),
    constraint pk_facilities primary key (facility_id),
    constraint ck_facilities_01 check (opening_time < closing_time),
    constraint ck_facilities_status check (status in ('active', 'inactive', 'maintenance'))
);
end;
go

if object_id(N'dbo.seq_courts',N'SO') is null
    exec(N'create sequence dbo.seq_courts as bigint start with 1 increment by 1 minvalue 1 maxvalue 9999999 no cycle cache 50');
go

if object_id(N'dbo.courts',N'U') is null
begin
create table dbo.courts(
    court_id varchar(10) not null constraint df_courts_court_id default ('CRT' + right('0000000' + convert(varchar(7), next value for dbo.seq_courts), 7)),
    facility_id varchar(10) not null,
    court_name nvarchar(100) not null,
    court_type nvarchar(50) not null,
    capacity int not null,
    hourly_rate decimal(10,2) not null,
    status nvarchar(20) not null constraint df_courts_status default ('active'),
    constraint pk_courts primary key (court_id),
    constraint fk_courts_facility_id foreign key (facility_id) references dbo.facilities(facility_id) on delete no action on update no action,
    constraint ck_courts_01 check (capacity > 0),
    constraint ck_courts_02 check (hourly_rate >= 0),
    constraint ck_courts_status check (status in ('active', 'inactive', 'maintenance'))
);
end;
go

if object_id(N'dbo.seq_members',N'SO') is null
    exec(N'create sequence dbo.seq_members as bigint start with 1 increment by 1 minvalue 1 maxvalue 9999999 no cycle cache 50');
go

if object_id(N'dbo.members',N'U') is null
begin
create table dbo.members(
    member_id varchar(10) not null constraint df_members_member_id default ('MEM' + right('0000000' + convert(varchar(7), next value for dbo.seq_members), 7)),
    first_name nvarchar(50) not null,
    last_name nvarchar(50) not null,
    phone varchar(20) not null,
    email varchar(255) not null,
    membership_type nvarchar(50) not null,
    membership_start date not null,
    membership_end date not null,
    status nvarchar(20) not null constraint df_members_status default ('active'),
    constraint pk_members primary key (member_id),
    constraint ak_members_email unique (email),
    constraint ck_members_01 check (membership_end >= membership_start),
    constraint ck_members_status check (status in ('active', 'inactive'))
);
end;
go

if object_id(N'dbo.seq_court_bookings',N'SO') is null
    exec(N'create sequence dbo.seq_court_bookings as bigint start with 1 increment by 1 minvalue 1 maxvalue 9999999 no cycle cache 50');
go

if object_id(N'dbo.court_bookings',N'U') is null
begin
create table dbo.court_bookings(
    booking_id varchar(10) not null constraint df_court_bookings_booking_id default ('BKG' + right('0000000' + convert(varchar(7), next value for dbo.seq_court_bookings), 7)),
    member_id varchar(10) not null,
    court_id varchar(10) not null,
    booking_date date not null,
    start_time time(0) not null,
    end_time time(0) not null,
    total_amount decimal(10,2) not null,
    hourly_rate_snapshot decimal(10,2) not null constraint df_court_bookings_hourly_rate_snapshot default (0),
    status nvarchar(20) not null constraint df_court_bookings_status default ('confirmed'),
    created_at datetime2(0) not null constraint df_court_bookings_created_at default (sysdatetime()),
    constraint pk_court_bookings primary key (booking_id),
    constraint fk_court_bookings_member_id foreign key (member_id) references dbo.members(member_id) on delete no action on update no action,
    constraint fk_court_bookings_court_id foreign key (court_id) references dbo.courts(court_id) on delete no action on update no action,
    constraint ck_court_bookings_01 check (start_time < end_time),
    constraint ck_court_bookings_02 check (hourly_rate_snapshot >= 0),
    constraint ck_court_bookings_03 check (total_amount >= 0),
    constraint ck_court_bookings_status check (status in ('confirmed', 'cancelled'))
);
end;
go

if object_id(N'dbo.seq_equipment',N'SO') is null
    exec(N'create sequence dbo.seq_equipment as bigint start with 1 increment by 1 minvalue 1 maxvalue 9999999 no cycle cache 50');
go

if object_id(N'dbo.equipment',N'U') is null
begin
create table dbo.equipment(
    equipment_id varchar(10) not null constraint df_equipment_equipment_id default ('EQP' + right('0000000' + convert(varchar(7), next value for dbo.seq_equipment), 7)),
    equipment_name nvarchar(100) not null,
    equipment_type nvarchar(50) not null,
    total_quantity int not null,
    rental_rate decimal(10,2) not null,
    status nvarchar(20) not null constraint df_equipment_status default ('active'),
    constraint pk_equipment primary key (equipment_id),
    constraint ck_equipment_01 check (total_quantity >= 0),
    constraint ck_equipment_02 check (rental_rate >= 0),
    constraint ck_equipment_status check (status in ('active', 'inactive', 'maintenance'))
);
end;
go

if object_id(N'dbo.seq_equipment_rentals',N'SO') is null
    exec(N'create sequence dbo.seq_equipment_rentals as bigint start with 1 increment by 1 minvalue 1 maxvalue 9999999 no cycle cache 50');
go

if object_id(N'dbo.equipment_rentals',N'U') is null
begin
create table dbo.equipment_rentals(
    rental_id varchar(10) not null constraint df_equipment_rentals_rental_id default ('RNT' + right('0000000' + convert(varchar(7), next value for dbo.seq_equipment_rentals), 7)),
    member_id varchar(10) not null,
    equipment_id varchar(10) not null,
    rental_date date not null,
    due_date date not null,
    return_date date null,
    quantity int not null,
    rental_rate_snapshot decimal(10,2) not null constraint df_equipment_rentals_rental_rate_snapshot default (0),
    total_amount decimal(10,2) not null,
    status nvarchar(20) not null constraint df_equipment_rentals_status default ('active'),
    constraint pk_equipment_rentals primary key (rental_id),
    constraint fk_equipment_rentals_member_id foreign key (member_id) references dbo.members(member_id) on delete no action on update no action,
    constraint fk_equipment_rentals_equipment_id foreign key (equipment_id) references dbo.equipment(equipment_id) on delete no action on update no action,
    constraint ck_equipment_rentals_01 check (due_date >= rental_date),
    constraint ck_equipment_rentals_02 check (return_date is null or return_date >= rental_date),
    constraint ck_equipment_rentals_03 check (quantity > 0),
    constraint ck_equipment_rentals_04 check (rental_rate_snapshot >= 0),
    constraint ck_equipment_rentals_05 check (total_amount >= 0),
    constraint ck_equipment_rentals_06 check ((status = 'returned' and return_date is not null) or (status in ('active','cancelled') and return_date is null)),
    constraint ck_equipment_rentals_status check (status in ('active', 'returned', 'cancelled'))
);
end;
go

if object_id(N'dbo.seq_payments',N'SO') is null
    exec(N'create sequence dbo.seq_payments as bigint start with 1 increment by 1 minvalue 1 maxvalue 9999999 no cycle cache 50');
go

if object_id(N'dbo.payments',N'U') is null
begin
create table dbo.payments(
    payment_id varchar(10) not null constraint df_payments_payment_id default ('PAY' + right('0000000' + convert(varchar(7), next value for dbo.seq_payments), 7)),
    rental_id varchar(10) null,
    booking_id varchar(10) null,
    amount decimal(10,2) not null,
    payment_date datetime2(0) not null constraint df_payments_payment_date default (sysdatetime()),
    payment_method nvarchar(30) not null,
    transaction_ref varchar(100) null,
    status nvarchar(20) not null constraint df_payments_status default ('pending'),
    constraint pk_payments primary key (payment_id),
    constraint fk_payments_booking_id foreign key (booking_id) references dbo.court_bookings(booking_id) on delete no action on update no action,
    constraint fk_payments_rental_id foreign key (rental_id) references dbo.equipment_rentals(rental_id) on delete no action on update no action,
    constraint ck_payments_01 check (amount > 0),
    constraint ck_payments_02 check ((case when booking_id is null then 0 else 1 end + case when rental_id is null then 0 else 1 end) = 1),
    constraint ck_payments_03 check (transaction_ref is null or len(ltrim(rtrim(transaction_ref))) > 0),
    constraint ck_payments_status check (status in ('pending', 'paid', 'failed', 'cancelled'))
);
end;
go

if object_id(N'dbo.seq_staff',N'SO') is null
    exec(N'create sequence dbo.seq_staff as bigint start with 1 increment by 1 minvalue 1 maxvalue 9999999 no cycle cache 50');
go

if object_id(N'dbo.staff',N'U') is null
begin
create table dbo.staff(
    staff_id varchar(10) not null constraint df_staff_staff_id default ('STF' + right('0000000' + convert(varchar(7), next value for dbo.seq_staff), 7)),
    first_name nvarchar(50) not null,
    last_name nvarchar(50) not null,
    phone varchar(20) not null,
    email varchar(255) not null,
    position nvarchar(50) not null,
    status nvarchar(20) not null constraint df_staff_status default ('active'),
    constraint pk_staff primary key (staff_id),
    constraint ak_staff_email unique (email),
    constraint ck_staff_status check (status in ('active', 'inactive'))
);
end;
go

if object_id(N'dbo.seq_maintenance',N'SO') is null
    exec(N'create sequence dbo.seq_maintenance as bigint start with 1 increment by 1 minvalue 1 maxvalue 9999999 no cycle cache 50');
go

if object_id(N'dbo.maintenance',N'U') is null
begin
create table dbo.maintenance(
    maintenance_id varchar(10) not null constraint df_maintenance_maintenance_id default ('MNT' + right('0000000' + convert(varchar(7), next value for dbo.seq_maintenance), 7)),
    staff_id varchar(10) not null,
    facility_id varchar(10) null,
    court_id varchar(10) null,
    equipment_id varchar(10) null,
    maintenance_date date not null,
    description nvarchar(500) not null,
    cost decimal(10,2) not null,
    status nvarchar(20) not null constraint df_maintenance_status default ('scheduled'),
    constraint pk_maintenance primary key (maintenance_id),
    constraint fk_maintenance_staff_id foreign key (staff_id) references dbo.staff(staff_id) on delete no action on update no action,
    constraint fk_maintenance_facility_id foreign key (facility_id) references dbo.facilities(facility_id) on delete no action on update no action,
    constraint fk_maintenance_court_id foreign key (court_id) references dbo.courts(court_id) on delete no action on update no action,
    constraint fk_maintenance_equipment_id foreign key (equipment_id) references dbo.equipment(equipment_id) on delete no action on update no action,
    constraint ck_maintenance_01 check (cost >= 0),
    constraint ck_maintenance_02 check ((case when facility_id is null then 0 else 1 end + case when court_id is null then 0 else 1 end + case when equipment_id is null then 0 else 1 end) = 1),
    constraint ck_maintenance_status check (status in ('scheduled', 'in_progress', 'completed', 'cancelled'))
);
end;
go

if not exists(select 1 from sys.indexes where object_id=object_id(N'dbo.courts') and name=N'ix_courts_facility')
    create index ix_courts_facility on dbo.courts(facility_id);
go

if not exists(select 1 from sys.indexes where object_id=object_id(N'dbo.court_bookings') and name=N'ix_bookings_conflict')
    create index ix_bookings_conflict on dbo.court_bookings(court_id, booking_date, status, start_time, end_time) include (member_id, total_amount);
go

if not exists(select 1 from sys.indexes where object_id=object_id(N'dbo.court_bookings') and name=N'ix_bookings_member')
    create index ix_bookings_member on dbo.court_bookings(member_id) include (booking_date, status);
go

if not exists(select 1 from sys.indexes where object_id=object_id(N'dbo.equipment_rentals') and name=N'ix_rentals_stock')
    create index ix_rentals_stock on dbo.equipment_rentals(equipment_id, status, rental_date, due_date, return_date) include (quantity);
go

if not exists(select 1 from sys.indexes where object_id=object_id(N'dbo.equipment_rentals') and name=N'ix_rentals_member')
    create index ix_rentals_member on dbo.equipment_rentals(member_id);
go

if not exists(select 1 from sys.indexes where object_id=object_id(N'dbo.payments') and name=N'ix_payments_booking')
    create index ix_payments_booking on dbo.payments(booking_id, status) include (amount);
go

if not exists(select 1 from sys.indexes where object_id=object_id(N'dbo.payments') and name=N'ix_payments_rental')
    create index ix_payments_rental on dbo.payments(rental_id, status) include (amount);
go

if not exists(select 1 from sys.indexes where object_id=object_id(N'dbo.payments') and name=N'ux_payments_ref')
    create unique index ux_payments_ref on dbo.payments(transaction_ref) where transaction_ref is not null;
go

if not exists(select 1 from sys.indexes where object_id=object_id(N'dbo.maintenance') and name=N'ix_maintenance_staff')
    create index ix_maintenance_staff on dbo.maintenance(staff_id, maintenance_date);
go

if not exists(select 1 from sys.indexes where object_id=object_id(N'dbo.maintenance') and name=N'ix_maintenance_facility')
    create index ix_maintenance_facility on dbo.maintenance(facility_id, maintenance_date);
go

if not exists(select 1 from sys.indexes where object_id=object_id(N'dbo.maintenance') and name=N'ix_maintenance_court')
    create index ix_maintenance_court on dbo.maintenance(court_id, maintenance_date);
go

if not exists(select 1 from sys.indexes where object_id=object_id(N'dbo.maintenance') and name=N'ix_maintenance_equipment')
    create index ix_maintenance_equipment on dbo.maintenance(equipment_id, maintenance_date);
go

if type_id(N'dbo.resource_ids') is null
    exec(N'create type dbo.resource_ids as table(resource_id varchar(10) not null primary key)');
go

if type_id(N'dbo.equipment_request') is null
    exec(N'create type dbo.equipment_request as table(equipment_id varchar(10) not null primary key, quantity int not null, rental_date date not null, due_date date not null, total_amount decimal(10,2) null, transaction_ref varchar(100) null)');
go
