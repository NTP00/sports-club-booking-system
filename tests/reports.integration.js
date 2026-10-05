'use strict';
// Opt-in real SQL Server test. No committed fixture rows or mocked query results.
const assert=require('node:assert/strict');
const db=require('../src/config/database');
const {createService}=require('../src/services/club');

const courtIds=Array.from({length:41},(_,i)=>'QAC'+String(i+1).padStart(7,'0'));
const equipmentIds=Array.from({length:40},(_,i)=>'QAE'+String(i+1).padStart(7,'0'));
const fixtureIds=new Set([...courtIds,...equipmentIds]);
const fixtureCountSql=`select
  (select count(*) from dbo.facilities where facility_id like 'QAF%')+
  (select count(*) from dbo.members where member_id like 'QAM%')+
  (select count(*) from dbo.courts where court_id like 'QAC%')+
  (select count(*) from dbo.equipment where equipment_id like 'QAE%')+
  (select count(*) from dbo.court_bookings where booking_id like 'QAB%')+
  (select count(*) from dbo.equipment_rentals where rental_id like 'QAR%') as fixture_count;`;

const fixtureSql=`set xact_abort on;
exec dbo.sp_lock_integrity;
if exists(select 1 from dbo.facilities where facility_id like 'QAF%')
 or exists(select 1 from dbo.members where member_id like 'QAM%')
 or exists(select 1 from dbo.courts where court_id like 'QAC%')
 or exists(select 1 from dbo.equipment where equipment_id like 'QAE%')
 or exists(select 1 from dbo.court_bookings where booking_id like 'QAB%')
 or exists(select 1 from dbo.equipment_rentals where rental_id like 'QAR%')
 throw 51970,N'Report QA reserved IDs already exist; do not delete or overwrite them.',1;
declare @today date=dbo.fn_today();
declare @current_week date=dateadd(day,-((datediff(day,convert(date,'19000101'),@today)%7+7)%7),@today);
declare @past date=dateadd(day,-14,@current_week),@future date=dateadd(day,14,@current_week);
insert dbo.facilities(facility_id,facility_name,facility_type,location,opening_time,closing_time)
 values('QAF0000001',N'Report QA',N'test',N'test','06:00','22:00');
insert dbo.members(member_id,first_name,last_name,phone,email,membership_type,membership_start,membership_end)
 values('QAM0000001',N'Report',N'QA','0800000000','report-qa-fixture@example.test',N'test',dateadd(day,-7,@past),dateadd(day,21,@future));
insert dbo.courts(court_id,facility_id,court_name,court_type,capacity,hourly_rate)
 values ${courtIds.map(id=>`('${id}','QAF0000001',N'Report QA court',N'test',4,100)`).join(',')};
insert dbo.equipment(equipment_id,equipment_name,equipment_type,total_quantity,rental_rate)
 values ${equipmentIds.map((id,i)=>`('${id}',N'Report QA equipment',N'test',${i===5?0:10},20)`).join(',')};
insert dbo.court_bookings(booking_id,member_id,court_id,booking_date,start_time,end_time,total_amount) values
 ('QAB0000001','QAM0000001','QAC0000001',@past,'09:00','10:00',100),
 ('QAB0000002','QAM0000001','QAC0000001',dateadd(day,-1,@past),'09:00','10:00',100),
 ('QAB0000003','QAM0000001','QAC0000002',dateadd(day,6,@past),'21:00','22:00',100),
 ('QAB0000004','QAM0000001','QAC0000002',dateadd(day,7,@past),'06:00','07:00',100),
 ('QAB0000005','QAM0000001','QAC0000003',@past,'09:00:00','09:01:30',10),
 ('QAB0000006','QAM0000001','QAC0000004',@past,'09:00','10:00',100),
 ('QAB0000007','QAM0000001','QAC0000005',@future,'09:00','10:00',100);
update dbo.court_bookings set status='cancelled' where booking_id='QAB0000006';
insert dbo.equipment_rentals(rental_id,member_id,equipment_id,rental_date,due_date,return_date,quantity,total_amount,status) values
 ('QAR0000001','QAM0000001','QAE0000001',@future,dateadd(day,1,@future),null,2,80,'active'),
 ('QAR0000002','QAM0000001','QAE0000002',dateadd(day,-1,@past),dateadd(day,3,@past),dateadd(day,1,@past),2,80,'returned'),
 ('QAR0000003','QAM0000001','QAE0000003',dateadd(day,-7,@past),dateadd(day,-6,@past),null,2,80,'active'),
 ('QAR0000004','QAM0000001','QAE0000004',@past,dateadd(day,1,@past),null,4,80,'cancelled'),
 ('QAR0000005','QAM0000001','QAE0000005',@past,dateadd(day,4,@past),dateadd(day,1,@past),2,80,'returned'),
 ('QAR0000006','QAM0000001','QAE0000008',dateadd(day,5,@future),dateadd(day,8,@future),null,2,80,'active'),
 ('QAR0000007','QAM0000001','QAE0000009',dateadd(day,6,@past),dateadd(day,6,@past),dateadd(day,6,@past),2,40,'returned');
select @today as today,@current_week as current_week,@past as past_week,@future as future_week;`;

const viewSql=`select * from dbo.vw_FacilityUtilizationReport
 where week_start=@week and ((resource_type='court' and resource_id like 'QAC%')
 or (resource_type='equipment' and resource_id like 'QAE%'))
 order by resource_type,resource_id;`;

function assertDevelopmentTarget(configuredDatabase,confirmedTestDatabase) {
  assert.ok(confirmedTestDatabase,'Set DB_TEST_DATABASE to the exact development/test database name before running report fixtures.');
  assert.equal(configuredDatabase,confirmedTestDatabase,'DB_DATABASE must match the explicitly confirmed DB_TEST_DATABASE.');
}
function plusDays(date,days) {const d=new Date(date);d.setUTCDate(d.getUTCDate()+days);return d;}
function iso(date) {assert.ok(date instanceof Date && !Number.isNaN(date.getTime()));return date.toISOString().slice(0,10);}
function normalizedRows(rows) {
  return rows.filter(r=>fixtureIds.has(r.resource_id)).map(r=>({
    week_start:iso(r.week_start),resource_type:r.resource_type,resource_id:r.resource_id,
    utilized_units:r.utilized_units,capacity_units:r.capacity_units,utilization_percent:r.utilization_percent
  })).sort((a,b)=>a.resource_type.localeCompare(b.resource_type)||a.resource_id.localeCompare(b.resource_id));
}
function expectedRows(week,courts={},equipment={}) {
  // Values below are independent, precomputed oracles, not SQL/formula reuse.
  return [
    ...courtIds.map((resource_id,i)=>({week_start:iso(week),resource_type:'court',resource_id,
      utilized_units:courts[i+1]?.[0]??0,capacity_units:6720,utilization_percent:courts[i+1]?.[1]??0})),
    ...equipmentIds.map((resource_id,i)=>({week_start:iso(week),resource_type:'equipment',resource_id,
      utilized_units:equipment[i+1]?.[0]??0,capacity_units:i===5?0:70,
      utilization_percent:i===5?null:equipment[i+1]?.[1]??0}))
  ];
}
function numericalAssertion(actual,expected,label,failure='report numerical oracle') {
  try {assert.deepEqual(actual,expected,label);}
  catch(error) {error.qaFailure=failure;throw error;}
}
async function runReportRegression(pool,{serviceFactory=createService,log=console.log}={}) {
  const confirmed=process.env.DB_TEST_DATABASE;
  assertDevelopmentTarget(db.config().database,confirmed);
  const identity=(await pool.request().query("select db_name() as database_name,convert(varchar(128),serverproperty('ProductVersion')) as engine_version;")).recordset[0];
  assert.equal(identity.database_name,confirmed,'Connected database must match DB_TEST_DATABASE.');
  log(`SQL Server ${identity.engine_version}; development DB ${identity.database_name}`);
  const transaction=new db.sql.Transaction(pool);
  let began=false,rolledBack=false,fixtureCreated=false;
  transaction.on('rollback',()=>{rolledBack=true;});
  try {
    await transaction.begin(db.sql.ISOLATION_LEVEL.READ_COMMITTED);began=true;
    // Genuine mssql Requests share the same SQL Server transaction/connection.
    // The application service implementation runs unchanged; no DB result double.
    const transactionDatabase={async getPool(){return {request(){return new db.sql.Request(transaction);}};}};
    const service=serviceFactory(transactionDatabase);
    const dates=(await new db.sql.Request(transaction).query(fixtureSql)).recordset[0];fixtureCreated=true;
    const cases=[
      {name:'preceding Sunday belongs to preceding week',week:plusDays(dates.past_week,-7),courts:{1:[60,0.89]},equipment:{2:[2,2.86],3:[14,20]}},
      {name:'court durations, Sunday boundary, returned/cancelled/overdue, zero capacity',week:dates.past_week,
        courts:{1:[60,0.89],2:[60,0.89],3:[1.5,0.02]},equipment:{2:[4,5.71],3:[14,20],5:[4,5.71],9:[2,2.86]}},
      {name:'following Monday belongs to next week',week:plusDays(dates.past_week,7),courts:{2:[60,0.89]},equipment:{3:[14,20]}},
      {name:'planned inclusive two days and Saturday-Sunday cross-week rental',week:dates.future_week,
        courts:{5:[60,0.89]},equipment:{1:[4,5.71],3:[14,20],8:[4,5.71]}},
      {name:'cross-week rental ends inclusively on Tuesday',week:plusDays(dates.future_week,7),equipment:{3:[14,20],8:[4,5.71]}},
      {name:'default current Monday, zero usage and continuing overdue',week:dates.current_week,defaultWeek:true,equipment:{3:[14,20]}}
    ];
    for(const c of cases) {
      assert.equal(c.week.getUTCDay(),1,'Oracle week must start on Monday.');
      const expected=expectedRows(c.week,c.courts,c.equipment);
      const actual=normalizedRows(await service.reports(c.defaultWeek?null:c.week));
      numericalAssertion(actual,expected,`${c.name}: reports() numerical output including all 81 resources`);
      const view=normalizedRows((await new db.sql.Request(transaction).input('week',db.sql.Date,c.week).query(viewSql)).recordset);
      numericalAssertion(view,expected,`${c.name}: reporting view numerical output`,'report view numerical oracle');
      assert.deepEqual(actual,view,`${c.name}: service/view equivalence`);
      log(`PASS reports: ${c.name} — 41 courts + 40 equipment; oracle and view match`);
    }
    const endToday=(await new db.sql.Request(transaction).query('select dbo.fn_today() as today;')).recordset[0].today;
    assert.equal(iso(endToday),iso(dates.today),'Business day changed during test; rerun for a stable clock.');
    return {weekCases:cases.length,resourcesPerWeek:81};
  } finally {
    if(began&&!rolledBack)await transaction.rollback();
    if(fixtureCreated) {
      const residue=(await pool.request().query(fixtureCountSql)).recordset[0].fixture_count;
      assert.equal(residue,0,'Report QA fixture rollback must leave no rows behind.');
      log('PASS reports: fixture rollback verified; no committed test rows');
    }
  }
}
async function main() {
  assertDevelopmentTarget(db.config().database,process.env.DB_TEST_DATABASE);
  try {
    const result=await runReportRegression(await db.getPool());
    console.log(`PASS real-DB reports integration: ${result.weekCases} week cases, ${result.resourcesPerWeek} resources each`);
  } finally {await db.closePool();}
}
if(require.main===module)main().catch(error=>{console.error(error.code||error.name,error.message);process.exitCode=1;});
module.exports={runReportRegression,assertDevelopmentTarget,fixtureSql,fixtureCountSql,viewSql};
