-- Run once as DBA after creating the local sports_club_app login and user.
-- No app authentication tables are added. This is DB authorization only.
use sports_club_booking;
go
if database_principal_id(N'sports_club_app') is null
    throw 51050,N'Create the sports_club_app login and mapped database user first. See README.',1;
go
grant select on schema::dbo to sports_club_app;
grant insert, update on dbo.facilities to sports_club_app;
grant insert, update on dbo.courts to sports_club_app;
grant insert, update on dbo.members to sports_club_app;
grant insert, update on dbo.equipment to sports_club_app;
grant insert, update on dbo.staff to sports_club_app;
grant insert, update on dbo.maintenance to sports_club_app;
grant insert, update on dbo.payments to sports_club_app;
grant update on dbo.court_bookings to sports_club_app;
grant update on dbo.equipment_rentals to sports_club_app;
grant execute on dbo.sp_BookCourtAndEquipment to sports_club_app;
grant execute on dbo.sp_lock_integrity to sports_club_app;
grant execute on type::dbo.equipment_request to sports_club_app;
grant references on type::dbo.equipment_request to sports_club_app;
-- NEXT VALUE FOR requires UPDATE on the corresponding sequence.
grant update on dbo.seq_facilities to sports_club_app;
grant update on dbo.seq_courts to sports_club_app;
grant update on dbo.seq_members to sports_club_app;
grant update on dbo.seq_equipment to sports_club_app;
grant update on dbo.seq_staff to sports_club_app;
grant update on dbo.seq_maintenance to sports_club_app;
grant update on dbo.seq_payments to sports_club_app;
go
