-- SSMS: Query > SQLCMD Mode. Set project_root to your repository root (the folder containing package.json).
-- Use :r with absolute paths; schema/logic/data can also run individually.
:setvar project_root "C:\sports-club-booking-system"
:on error exit
:r "$(project_root)\database\schema.sql"
:r "$(project_root)\database\logic.sql"
:r "$(project_root)\database\data.sql"
