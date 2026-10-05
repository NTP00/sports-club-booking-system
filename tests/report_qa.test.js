'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {assertDevelopmentTarget}=require('./reports.integration');
const {mutationVariants,loadServiceFactory}=require('../scripts/test_report_mutations');

test('report integration refuses an unconfirmed development DB before connecting',()=>{
  for(const value of [undefined,''])assert.throws(()=>assertDevelopmentTarget('sports_club_booking',value),/DB_TEST_DATABASE/);
});
test('report integration requires configured DB to equal the explicitly confirmed test DB',()=>{
  assert.throws(()=>assertDevelopmentTarget('production_db','sports_club_test'),/DB_DATABASE/);
  assert.doesNotThrow(()=>assertDevelopmentTarget('sports_club_test','sports_club_test'));
});
const sourcePath=path.join(__dirname,'../src/services/club.js');
const source=fs.readFileSync(sourcePath,'utf8');
for(const variant of mutationVariants(source)) {
  test(`in-memory mutation stays within reports() and compiles: ${variant.name}`,()=>{
    const start=source.indexOf('async reports(');
    assert.equal(variant.source.slice(0,start),source.slice(0,start));
    assert.notEqual(variant.source,source);
    assert.equal(typeof loadServiceFactory(variant.source),'function');
    assert.equal(fs.readFileSync(sourcePath,'utf8'),source);
  });
}
