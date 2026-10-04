'use strict';
const path=require('node:path');
const {getPool,closePool}=require('../src/config/database');
const {runFile}=require('./sql_runner');
(async()=>{
  try {
    const results=await runFile(await getPool(),path.join(__dirname,'../database/tests.sql'));
    const cases=results.flat().filter(row=>row.test_case);
    console.table(cases);
    if(cases.length!==46 || cases.some(c=>c.result!=='PASS'))throw new Error('SQL test suite is incomplete or failed');
    console.log(`${cases.length} SQL tests passed`);
  } catch(error) {console.error(error.message);process.exitCode=1;}
  finally {await closePool();}
})();
