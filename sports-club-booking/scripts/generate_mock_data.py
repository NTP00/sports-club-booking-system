"""Deterministic, linked fixtures. Generates executable T-SQL, no third-party libs.

Run from any directory: python scripts/generate_mock_data.py
The file uses dbo.fn_today() when executed, so it stays useful after download.
"""
from pathlib import Path
import json

ROOT=Path(__file__).resolve().parents[1]
def q(value):
    if value is None:return 'null'
    if isinstance(value,(int,float)):return str(value)
    if value.startswith('@'):return value
    return "N'"+value.replace("'","''")+"'"
def id_(prefix,n):return f'{prefix}{n:07}'
def date_(n):return f'@dateadd:{n}'
def lit(v):
    if isinstance(v,str) and v.startswith('@dateadd:'):
        return f'dateadd(day,{v.split(":")[1]},@today)'
    return q(v)

counts={}
chunks=[]
def insert(table,columns,rows):
    counts[table]=len(rows)
    for start in range(0,len(rows),200):
        batch=rows[start:start+200]
        chunks.append('insert dbo.'+table+'('+','.join(columns)+') values\n'+',\n'.join('('+','.join(lit(x) for x in row)+')' for row in batch)+';')

insert('facilities',['facility_id','facility_name','facility_type','location','opening_time','closing_time','status'],[
    [id_('FAC',i),f'ศูนย์กีฬา {i:02}', ['sports_hall','swimming_pool','outdoor'][i%3],f'อาคารกีฬาโซน {i:02}','06:00','22:00','active'] for i in range(1,21)])
insert('courts',['court_id','facility_id','court_name','court_type','capacity','hourly_rate','status'],[
    [id_('CRT',i),id_('FAC',(i-1)%20+1),f'สนาม {i:02}',['badminton','tennis','basketball','swimming_lane'][i%4],4+i%12,100+i*5,'active'] for i in range(1,41)])
insert('members',['member_id','first_name','last_name','phone','email','membership_type','membership_start','membership_end','status'],[
    [id_('MEM',i),f'สมาชิก{i:03}',f'ทดลอง{i:03}',f'08{i:08}',f'member{i:03}@example.test',['standard','student','premium'][i%3],date_(-365),date_(365),'active'] for i in range(1,601)])
insert('equipment',['equipment_id','equipment_name','equipment_type','total_quantity','rental_rate','status'],[
    [id_('EQP',i),f'{["ไม้แบด","ลูกบาส","ห่วงยาง","ไม้เทนนิส"][i%4]} รุ่น {i:02}',['racket','ball','swimming','tennis'][i%4],50+i%5,20+i,'active'] for i in range(1,41)])
insert('staff',['staff_id','first_name','last_name','phone','email','position','status'],[
    [id_('STF',i),f'เจ้าหน้าที่{i:02}',f'ทดสอบ{i:02}',f'09{i:08}',f'staff{i:02}@example.test',['technician','manager','attendant'][i%3],'active'] for i in range(1,26)])
bookings=[];cancelled=[]
for i in range(1,1201):
    day=(i-1)//40-24
    amount=80+((i-1)%40+1)*5
    bookings.append([id_('BKG',i),id_('MEM',(i-1)%580+1),id_('CRT',(i-1)%40+1),date_(day),'09:00','10:00',amount,'confirmed'])
    if i%12==0:cancelled.append(id_('BKG',i))
insert('court_bookings',['booking_id','member_id','court_id','booking_date','start_time','end_time','total_amount','status'],bookings)
# Cancellation must be performed against existing rows, preserving history.
chunks.append("update dbo.court_bookings set status='cancelled' where booking_id in ("+','.join(q(x) for x in cancelled)+');')
rentals=[]
for i in range(1,801):
    offset=(i-1)//40*3-45
    cancelled_rental=i%16==0
    returned=offset+1<0 and i%13!=0 and not cancelled_rental
    rentals.append([id_('RNT',i),id_('MEM',(i-1)%580+1),id_('EQP',(i-1)%40+1),date_(offset),date_(offset+1),date_(offset+1) if returned else None,1+i%2,(1+i%2)*(20+(i-1)%40+1)*2,'cancelled' if cancelled_rental else 'returned' if returned else 'active'])
insert('equipment_rentals',['rental_id','member_id','equipment_id','rental_date','due_date','return_date','quantity','total_amount','status'],rentals)
payments=[]
for b in bookings:
    if b[0] in cancelled:continue
    idx=int(b[0][3:])
    status='pending' if idx%9==0 else 'failed' if idx%17==0 else 'paid'
    payments.append([id_('PAY',len(payments)+1),b[0],None,b[6],f'dateadd(day,{(idx-1)//40-24},convert(datetime2(0),@today))','bank_transfer',f'MOCK-B-{idx:05}',status])
for r in rentals:
    if r[-1]=='cancelled':continue
    payments.append([id_('PAY',len(payments)+1),None,r[0],r[-2],f'dateadd(day,{(int(r[0][3:])-1)//40*3-45},convert(datetime2(0),@today))','cash',None,'paid'])
# SQL expressions here must be unquoted, unlike input text.
payment_sql=[]
for row in payments:
    cells=[lit(v) if j!=4 else v for j,v in enumerate(row)]
    payment_sql.append('('+','.join(cells)+')')
counts['payments']=len(payments)
for start in range(0,len(payment_sql),200):
    chunks.append('insert dbo.payments(payment_id,booking_id,rental_id,amount,payment_date,payment_method,transaction_ref,status) values\n'+',\n'.join(payment_sql[start:start+200])+';')
insert('maintenance',['maintenance_id','staff_id','facility_id','court_id','equipment_id','maintenance_date','description','cost','status'],[
    [id_('MNT',i),id_('STF',(i-1)%25+1),id_('FAC',(i-1)%20+1) if i%3==0 else None,id_('CRT',(i-1)%40+1) if i%3==1 else None,id_('EQP',(i-1)%40+1) if i%3==2 else None,date_(-i),f'ตรวจสอบและบำรุงรักษารอบ {i:02}',200+i*10,['scheduled','in_progress','completed','cancelled'][i%4]] for i in range(1,41)])
chunks.extend([
    "update dbo.members set status='inactive' where member_id in ('MEM0000591','MEM0000592','MEM0000593');",
    "update dbo.members set membership_end=dateadd(day,-1,@today) where member_id='MEM0000600';",
    "update dbo.staff set status='inactive' where staff_id='STF0000025';",
    "update dbo.facilities set status='maintenance' where facility_id='FAC0000020';",
    "update dbo.courts set status='inactive' where court_id='CRT0000040';",
    "update dbo.equipment set status='maintenance' where equipment_id='EQP0000040';",
    "update dbo.payments set status='cancelled' where payment_id='PAY0000001';"
])
# Reserve low IDs for the seed. Restart only within the initial all-or-nothing
# seed transaction. Never restart on a rerun or in a populated database.
catalog=json.loads((ROOT/'src/config/schema.json').read_text())
for t in catalog:chunks.append(f'alter sequence dbo.seq_{t} restart with 100000;')
output='''-- Generated by scripts/generate_mock_data.py. Seed only an empty database.
use sports_club_booking;
set nocount on;
set xact_abort on;
if exists(select 1 from dbo.members where member_id='MEM0000001' and email='member001@example.test')
begin
    print 'Seed already exists; data.sql skipped without resetting sequences.';
    return;
end;
begin try
begin transaction;
exec dbo.sp_lock_integrity;
if '''+' or '.join(f'exists(select 1 from dbo.{t})' for t in catalog)+'''
    throw 51040, N'Seed requires empty tables. Keep existing data; use a new database for fixtures.',1;
declare @today date=dbo.fn_today();
'''+ '\n\n'.join(chunks)+'''
commit transaction;
end try
begin catch
    if xact_state()<>0 rollback transaction;
    throw;
end catch;
'''
(ROOT/'database/data.sql').write_text(output,encoding='utf-8')
(ROOT/'docs/mock_data_counts.json').write_text(json.dumps(counts,indent=2)+'\n')
print(json.dumps(counts))
