'use strict';
// Read-only runtime checks. Run with the normal sports_club_app .env account.
const assert=require('node:assert/strict');
const {createApp}=require('../src/app');
const {createService}=require('../src/services/club');
const db=require('../src/config/database');
const runtimeSql=`select user_name() as database_user,
 has_perms_by_name('dbo.fn_today','OBJECT','EXECUTE') as can_execute_today,
 dbo.fn_today() as today;
 select top(1) * from dbo.fn_rental_periods();`;
async function main() {
  let server;
  try {
    const pool=await db.getPool();
    const identity=(await pool.request().query(runtimeSql)).recordsets[0][0];
    assert.equal(identity.database_user,'sports_club_app','Run db:app using the actual sports_club_app account, not the developer/DBA account.');
    assert.equal(identity.can_execute_today,1,'sports_club_app requires EXECUTE on dbo.fn_today from permissions.sql.');
    const service=createService(); // Normal application config and real DB pool.
    const rows=await service.reports();
    assert.ok(Array.isArray(rows));
    server=createApp(service).listen(0,'127.0.0.1');
    await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
    const url=`http://127.0.0.1:${server.address().port}`;
    const health=await fetch(url+'/health');assert.equal(health.status,200);
    assert.deepEqual(await health.json(),{status:'ok',database:'connected'});
    for(const route of ['/','/court_bookings/new','/reports']) {
      const response=await fetch(url+route);assert.equal(response.status,200,`${route} must render under sports_club_app`);
      await response.text();console.log(`PASS sports_club_app HTTP ${route}`);
    }
    console.log('PASS sports_club_app: fn_today EXECUTE, rental function SELECT, real reports(), /health and runtime pages');
  } finally {
    if(server)await new Promise(resolve=>server.close(resolve));
    await db.closePool();
  }
}
if(require.main===module)main().catch(error=>{console.error(error.code||error.name,error.message);process.exitCode=1;});
module.exports={runtimeSql};
