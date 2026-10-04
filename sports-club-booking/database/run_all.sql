-- SSMS: Query > SQLCMD Mode. Set project_root to your extracted project path.
-- Use :r with absolute paths; schema/logic/data can also run individually.
:setvar project_root "C:\sports-club-booking"
:on error exit
:r "$(project_root)\database\schema.sql"
:r "$(project_root)\database\logic.sql"
:r "$(project_root)\database\data.sql"
