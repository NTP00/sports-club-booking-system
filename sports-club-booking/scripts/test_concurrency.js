'use strict';
// Creates a small test fixture. Run against a development DB, not production.
// Successful test records are retained and cancelled; nothing hard-deletes history.
const assert=require('node:assert/strict');
const {sql,getPool,closePool}=require('../src/config/database');
function inputs(request,f,kind) {
  const items=new sql.Table('dbo.equipment_request');
  items.columns.add('equipment_id',sql.VarChar(10),{nullable:false});
  items.columns.add('quantity',sql.Int,{nullable:false});
  items.columns.add('rental_date',sql.Date,{nullable:false});
  items.columns.add('due_date',sql.Date,{nullable:false});
  items.columns.add('total_amount',sql.Decimal(10,2),{nullable:true});
  items.columns.add('transaction_ref',sql.VarChar(100),{nullable:true});
  if(kind==='equipment')items.rows.add(f.equipment_id,1,f.day,f.day,20,null);
  request.input('member_id',sql.VarChar(10),f.member_id).input('court_id',sql.VarChar(10),f.court_id)
    .input('booking_date',sql.Date,f.day).input('start_time',sql.Time(0),new Date('2000-01-01T09:00:00Z'))
    .input('end_time',sql.Time(0),new Date('2000-01-01T10:00:00Z')).input('equipment_items',items).input('pay_now',sql.Bit,false);
  return request;
}
(async()=>{
  let pool,fixture;
  try {
    pool=await getPool();
    const setup=await pool.request().batch(`set xact_abort on; begin try begin transaction; exec dbo.sp_lock_integrity;
      declare @f varchar(10)='FAC'+right('0000000'+convert(varchar(7),next value for dbo.seq_facilities),7),
        @c varchar(10)='CRT'+right('0000000'+convert(varchar(7),next value for dbo.seq_courts),7),
        @c2 varchar(10),
        @m varchar(10)='MEM'+right('0000000'+convert(varchar(7),next value for dbo.seq_members),7),
        @e varchar(10)='EQP'+right('0000000'+convert(varchar(7),next value for dbo.seq_equipment),7),@day date=dateadd(day,7,dbo.fn_today());
      set @c2='CRT'+right('0000000'+convert(varchar(7),next value for dbo.seq_courts),7);
      insert dbo.facilities(facility_id,facility_name,facility_type,location,opening_time,closing_time)values(@f,N'Concurrency test',N'test',N'test','06:00','22:00');
      insert dbo.courts(court_id,facility_id,court_name,court_type,capacity,hourly_rate)values(@c,@f,N'Session A',N'test',2,100),(@c2,@f,N'Session B',N'test',2,100);
      insert dbo.members(member_id,first_name,last_name,phone,email,membership_type,membership_start,membership_end)values(@m,N'Concurrency',N'Test','0800000000',@m+'@concurrency.example.test',N'test',dbo.fn_today(),dateadd(day,30,@day));
      insert dbo.equipment(equipment_id,equipment_name,equipment_type,total_quantity,rental_rate)values(@e,N'Last item',N'test',1,20);
      commit;select @f as facility_id,@c as court_id,@c2 as court2_id,@m as member_id,@e as equipment_id,@day as day;
      end try begin catch if xact_state()<>0 rollback;throw;end catch;`);
    fixture=setup.recordset[0];
    for(const kind of ['court','equipment']) {
      const a=new sql.Transaction(pool);let finished=false;
      await a.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);
      try {
        await inputs(new sql.Request(a),fixture,kind).execute('dbo.sp_BookCourtAndEquipment');
        const second={...fixture,court_id:kind==='equipment'?fixture.court2_id:fixture.court_id};
        let settled=false;
        const b=inputs(pool.request(),second,kind).execute('dbo.sp_BookCourtAndEquipment')
          .then(()=>{settled=true;return {success:true};},error=>{settled=true;return {error};});
        await new Promise(resolve=>setTimeout(resolve,250));
        assert.equal(settled,false,'Session B must wait while session A holds its transaction');
        await a.commit();finished=true;
        const result=await b;
        assert.equal(result.error?.number,kind==='court'?51003:51005,`${kind}: only one operation may commit`);
        console.log(`PASS ${kind}: B waited, then rejected with ${result.error.number}; A committed`);
      } finally {if(!finished)await a.rollback().catch(()=>{});}
      // Free the fixture after each case, retaining its transaction records.
      await pool.request().input('member',sql.VarChar(10),fixture.member_id).batch(`begin transaction;exec dbo.sp_lock_integrity;
        update dbo.court_bookings set status='cancelled' where member_id=@member;
        update dbo.equipment_rentals set status='cancelled' where member_id=@member;commit;`);
    }
  } catch(error) {console.error(error.message);process.exitCode=1;}
  finally {
    if(pool&&fixture)await pool.request().input('m',sql.VarChar(10),fixture.member_id).input('f',sql.VarChar(10),fixture.facility_id).input('e',sql.VarChar(10),fixture.equipment_id)
      .batch("update dbo.members set status='inactive' where member_id=@m;update dbo.facilities set status='inactive' where facility_id=@f;update dbo.equipment set status='inactive' where equipment_id=@e;").catch(()=>{});
    await closePool();
  }
})();
