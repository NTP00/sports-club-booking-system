-- =============================================
-- Sports Club & Facility Booking System
-- Database Schema (SQL Server / T-SQL)
-- =============================================

IF DB_ID('sports_club') IS NULL
BEGIN
    CREATE DATABASE sports_club;
END;
GO

USE sports_club;
GO

-- =============================================
-- 1. FACILITIES
-- =============================================
CREATE TABLE FACILITIES (
    facility_id INT IDENTITY(1,1) PRIMARY KEY,
    facility_name NVARCHAR(100) NOT NULL,
    facility_type NVARCHAR(50) NOT NULL,
    location NVARCHAR(255) NOT NULL,
    opening_time TIME NOT NULL,
    closing_time TIME NOT NULL,
    status NVARCHAR(20) NOT NULL
);
GO

-- =============================================
-- 2. COURTS
-- =============================================
CREATE TABLE COURTS (
    court_id INT IDENTITY(1,1) PRIMARY KEY,
    facility_id INT NOT NULL,
    court_name NVARCHAR(100) NOT NULL,
    court_type NVARCHAR(50) NOT NULL,
    capacity INT NOT NULL,
    hourly_rate DECIMAL(10,2) NOT NULL,
    status NVARCHAR(20) NOT NULL,

    CONSTRAINT FK_COURTS_FACILITIES
        FOREIGN KEY (facility_id)
        REFERENCES FACILITIES(facility_id)
);
GO

-- =============================================
-- 3. MEMBERS
-- =============================================
CREATE TABLE MEMBERS (
    member_id INT IDENTITY(1,1) PRIMARY KEY,
    first_name NVARCHAR(100) NOT NULL,
    last_name NVARCHAR(100) NOT NULL,
    phone NVARCHAR(20) NOT NULL,
    email NVARCHAR(255) NOT NULL,
    membership_type NVARCHAR(50) NOT NULL,
    membership_start DATE NOT NULL,
    membership_end DATE NOT NULL,
    status NVARCHAR(20) NOT NULL
);
GO

-- =============================================
-- 4. COURT_BOOKINGS
-- =============================================
CREATE TABLE COURT_BOOKINGS (
    booking_id INT IDENTITY(1,1) PRIMARY KEY,
    member_id INT NOT NULL,
    court_id INT NOT NULL,
    booking_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    status NVARCHAR(20) NOT NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    CONSTRAINT FK_COURT_BOOKINGS_MEMBERS
        FOREIGN KEY (member_id)
        REFERENCES MEMBERS(member_id),

    CONSTRAINT FK_COURT_BOOKINGS_COURTS
        FOREIGN KEY (court_id)
        REFERENCES COURTS(court_id)
);
GO

-- =============================================
-- 5. EQUIPMENT
-- =============================================
CREATE TABLE EQUIPMENT (
    equipment_id INT IDENTITY(1,1) PRIMARY KEY,
    equipment_name NVARCHAR(100) NOT NULL,
    equipment_type NVARCHAR(50) NOT NULL,
    total_quantity INT NOT NULL,
    rental_rate DECIMAL(10,2) NOT NULL,
    status NVARCHAR(20) NOT NULL
);
GO

-- =============================================
-- 6. EQUIPMENT_RENTALS
-- =============================================
CREATE TABLE EQUIPMENT_RENTALS (
    rental_id INT IDENTITY(1,1) PRIMARY KEY,
    member_id INT NOT NULL,
    equipment_id INT NOT NULL,
    rental_date DATE NOT NULL,
    due_date DATE NOT NULL,
    return_date DATE NULL,
    quantity INT NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    status NVARCHAR(20) NOT NULL,

    CONSTRAINT FK_EQUIPMENT_RENTALS_MEMBERS
        FOREIGN KEY (member_id)
        REFERENCES MEMBERS(member_id),

    CONSTRAINT FK_EQUIPMENT_RENTALS_EQUIPMENT
        FOREIGN KEY (equipment_id)
        REFERENCES EQUIPMENT(equipment_id)
);
GO

-- =============================================
-- 7. STAFF
-- =============================================
CREATE TABLE STAFF (
    staff_id INT IDENTITY(1,1) PRIMARY KEY,
    first_name NVARCHAR(100) NOT NULL,
    last_name NVARCHAR(100) NOT NULL,
    phone NVARCHAR(20) NOT NULL,
    email NVARCHAR(255) NOT NULL,
    position NVARCHAR(100) NOT NULL,
    status NVARCHAR(20) NOT NULL
);
GO

-- =============================================
-- 8. MAINTENANCE
-- =============================================
CREATE TABLE MAINTENANCE (
    maintenance_id INT IDENTITY(1,1) PRIMARY KEY,
    staff_id INT NOT NULL,
    facility_id INT NULL,
    court_id INT NULL,
    equipment_id INT NULL,
    maintenance_date DATE NOT NULL,
    description NVARCHAR(500) NOT NULL,
    cost DECIMAL(10,2) NOT NULL,
    status NVARCHAR(20) NOT NULL,

    CONSTRAINT FK_MAINTENANCE_STAFF
        FOREIGN KEY (staff_id)
        REFERENCES STAFF(staff_id),

    CONSTRAINT FK_MAINTENANCE_FACILITIES
        FOREIGN KEY (facility_id)
        REFERENCES FACILITIES(facility_id),

    CONSTRAINT FK_MAINTENANCE_COURTS
        FOREIGN KEY (court_id)
        REFERENCES COURTS(court_id),

    CONSTRAINT FK_MAINTENANCE_EQUIPMENT
        FOREIGN KEY (equipment_id)
        REFERENCES EQUIPMENT(equipment_id),

    CONSTRAINT CHK_MAINTENANCE_TARGET
        CHECK (
            (CASE WHEN facility_id IS NOT NULL THEN 1 ELSE 0 END) +
            (CASE WHEN court_id IS NOT NULL THEN 1 ELSE 0 END) +
            (CASE WHEN equipment_id IS NOT NULL THEN 1 ELSE 0 END)
            = 1
        )
);
GO

-- =============================================
-- 9. PAYMENTS
-- =============================================
CREATE TABLE PAYMENTS (
    payment_id INT IDENTITY(1,1) PRIMARY KEY,
    booking_id INT NULL,
    rental_id INT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_date DATETIME2 NOT NULL,
    payment_method NVARCHAR(50) NOT NULL,
    transaction_ref NVARCHAR(100) NULL,
    status NVARCHAR(20) NOT NULL,

    CONSTRAINT FK_PAYMENTS_BOOKINGS
        FOREIGN KEY (booking_id)
        REFERENCES COURT_BOOKINGS(booking_id),

    CONSTRAINT FK_PAYMENTS_RENTALS
        FOREIGN KEY (rental_id)
        REFERENCES EQUIPMENT_RENTALS(rental_id),

    CONSTRAINT CHK_PAYMENT_SOURCE
        CHECK (
            (CASE WHEN booking_id IS NOT NULL THEN 1 ELSE 0 END) +
            (CASE WHEN rental_id IS NOT NULL THEN 1 ELSE 0 END)
            = 1
        )
);
GO
