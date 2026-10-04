use sports_club_booking;
go
-- Q01 | multi-table JOIN >=3 | Booking detail for reception, without payment fanout.
select b.booking_id,m.first_name,m.last_name,c.court_name,f.facility_name,
       b.booking_date,b.start_time,b.end_time,b.total_amount,b.status
from dbo.court_bookings b join dbo.members m on m.member_id=b.member_id
join dbo.courts c on c.court_id=b.court_id join dbo.facilities f on f.facility_id=c.facility_id
order by b.booking_date desc,b.booking_id;

-- Q02 | multi-table JOIN >=3 | Equipment rental and payer contact.
select r.rental_id,e.equipment_name,m.email,r.quantity,r.due_date,r.return_date,
       p.payment_id,p.amount,p.status as payment_status
from dbo.equipment_rentals r join dbo.equipment e on e.equipment_id=r.equipment_id
join dbo.members m on m.member_id=r.member_id left join dbo.payments p on p.rental_id=r.rental_id;

-- Q03 | GROUP BY + HAVING | Courts with at least 10 confirmed bookings.
select c.court_id,c.court_name,count(*) as booking_count,sum(b.total_amount) as billed
from dbo.courts c join dbo.court_bookings b on b.court_id=c.court_id
where b.status='confirmed' group by c.court_id,c.court_name having count(*)>=10;

-- Q04 | GROUP BY + HAVING | Equipment types rented more than 10 pieces.
select e.equipment_type,sum(convert(bigint,r.quantity)) as quantity_rented
from dbo.equipment e join dbo.equipment_rentals r on r.equipment_id=e.equipment_id
where r.status<>'cancelled' group by e.equipment_type having sum(convert(bigint,r.quantity))>10;

-- Q05 | GROUP BY + HAVING | Staff with maintenance costs above 400.
select s.staff_id,s.first_name,count(*) as jobs,sum(m.cost) as total_cost
from dbo.staff s join dbo.maintenance m on m.staff_id=s.staff_id
where m.status<>'cancelled' group by s.staff_id,s.first_name having sum(m.cost)>400;

-- Q06 | subquery | Above-average final booking amount.
select booking_id,total_amount from dbo.court_bookings
where status='confirmed' and total_amount>(select avg(total_amount) from dbo.court_bookings where status='confirmed');

-- Q07 | correlated subquery | Members with overdue equipment not returned.
select m.member_id,m.first_name,m.email from dbo.members m
where exists(select 1 from dbo.equipment_rentals r where r.member_id=m.member_id
    and r.status='active' and r.return_date is null and r.due_date<dbo.fn_today());

-- Q08 | correlated subquery | Unpaid or partially paid confirmed bookings.
select b.booking_id,b.total_amount from dbo.court_bookings b
where b.status='confirmed' and b.total_amount>
    (select coalesce(sum(p.amount),0) from dbo.payments p where p.booking_id=b.booking_id and p.status='paid');

-- Q09 | window RANK OVER | Court ranking by confirmed booked minutes.
with usage_totals as (
    select c.court_id,c.court_name,coalesce(sum(datediff(second,b.start_time,b.end_time))/60.0,0) as booked_minutes
    from dbo.courts c left join dbo.court_bookings b on b.court_id=c.court_id and b.status='confirmed'
    group by c.court_id,c.court_name
)
select *,rank() over(order by booked_minutes desc) as usage_rank from usage_totals;

-- Q10 | window ROW_NUMBER OVER | Latest booking for each member.
with ranked as (
    select b.*,row_number() over(partition by member_id order by booking_date desc,start_time desc,booking_id desc) as rn
    from dbo.court_bookings b
)
select * from ranked where rn=1;
