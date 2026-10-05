'use strict';
// Test-only, in-memory mutations. Never writes src/services/club.js or any SQL file.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {createRequire}=require('node:module');
const db=require('../src/config/database');
const {runReportRegression,assertDevelopmentTarget}=require('../tests/reports.integration');
const sourcePath=path.join(__dirname,'../src/services/club.js');
function mutationVariants(source) {
  const start=source.indexOf('async reports(');
  assert.ok(start>=0,'reports() mutation boundary missing');
  const before=source.slice(0,start),reports=source.slice(start);
  return [
    {name:'confirmed filter changed to cancelled',target:"where b.status = 'confirmed'",replacement:"where b.status = 'cancelled'"},
    {name:'inclusive rental day removed',target:') + 1',replacement:') + 0'}
  ].map(m=>{
    assert.equal(reports.split(m.target).length-1,1,`${m.name}: mutation target must be unique within reports()`);
    return {name:m.name,source:before+reports.replace(m.target,m.replacement)};
  });
}
function loadServiceFactory(source) {
  const runtimeModule={exports:{}};
  const execute=vm.compileFunction(source,['require','module','exports','__filename','__dirname'],{filename:sourcePath});
  execute(createRequire(sourcePath),runtimeModule,runtimeModule.exports,sourcePath,path.dirname(sourcePath));
  assert.equal(typeof runtimeModule.exports.createService,'function');
  return runtimeModule.exports.createService;
}
async function main() {
  assertDevelopmentTarget(db.config().database,process.env.DB_TEST_DATABASE);
  const original=fs.readFileSync(sourcePath,'utf8');
  try {
    const pool=await db.getPool();
    // A failing baseline is a real regression: stop, do not count it as detection.
    await runReportRegression(pool);
    for(const mutation of mutationVariants(original)) {
      let detected=false;
      try {await runReportRegression(pool,{serviceFactory:loadServiceFactory(mutation.source),log:()=>{}});}
      catch(error) {
        if(error.code!=='ERR_ASSERTION'||error.qaFailure!=='report numerical oracle')throw error;
        detected=true;
      }
      assert.ok(detected,`Mutation escaped the real numerical oracle: ${mutation.name}`);
      console.log(`PASS mutation detected by real DB numerical assertion: ${mutation.name}`);
    }
  } finally {
    try {assert.equal(fs.readFileSync(sourcePath,'utf8'),original,'Production source must remain byte-identical.');}
    finally {await db.closePool();}
  }
}
if(require.main===module)main().catch(error=>{console.error(error.code||error.name,error.message);process.exitCode=1;});
module.exports={mutationVariants,loadServiceFactory};
