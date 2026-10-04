'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {getPool,closePool}=require('../src/config/database');
const {runFile}=require('./sql_runner');
const expected=require('../src/config/schema.json');
(async()=>{
  try {
    const pool=await getPool();
    const result=await pool.request().query(`select t.name as table_name,c.name as column_name,
      ty.name as type_name,c.max_length,c.precision,c.scale,c.is_nullable,
      case when pk.column_id is null then 0 else 1 end as is_pk,
      case when fk.parent_column_id is null then 0 else 1 end as is_fk
      from sys.tables t join sys.schemas s on s.schema_id=t.schema_id
      join sys.columns c on c.object_id=t.object_id join sys.types ty on ty.user_type_id=c.user_type_id
      left join(select ic.object_id,ic.column_id from sys.indexes i join sys.index_columns ic on ic.object_id=i.object_id and ic.index_id=i.index_id where i.is_primary_key=1) pk on pk.object_id=t.object_id and pk.column_id=c.column_id
      left join sys.foreign_key_columns fk on fk.parent_object_id=t.object_id and fk.parent_column_id=c.column_id
      where s.name='dbo' order by t.name,c.column_id;
      select name,delete_referential_action,update_referential_action,is_disabled,is_not_trusted from sys.foreign_keys;
      select name,is_disabled,is_not_trusted from sys.check_constraints;
      select name,is_disabled from sys.triggers where parent_class=1;
      select name from sys.objects where name in ('sp_BookCourtAndEquipment','trg_CheckCourtConflict','vw_FacilityUtilizationReport');
      select t.name as table_name,i.name as index_name,i.is_unique,i.has_filter,i.filter_definition
      from sys.tables t join sys.indexes i on i.object_id=t.object_id where i.is_unique=1;`);
    const [columns,fks,checks,triggers,objects,unique]=result.recordsets;
    assert.deepEqual([...new Set(columns.map(c=>c.table_name))].sort(),Object.keys(expected).sort());
    for(const [table,meta] of Object.entries(expected)) {
      const actual=columns.filter(c=>c.table_name===table);
      assert.equal(actual.length,meta.columns.length,table);
      for(const column of meta.columns) {
        const a=actual.find(c=>c.column_name===column.name);assert.ok(a,`${table}.${column.name}`);
        let type=a.type_name;
        if(/varchar/.test(type))type+=`(${a.max_length/(type==='nvarchar'?2:1)})`;
        if(type==='decimal')type+=`(${a.precision},${a.scale})`;
        if(['time','datetime2'].includes(type))type+=`(${a.scale})`;
        assert.equal(type,column.type,`${table}.${column.name} type`);
        assert.equal(Boolean(a.is_nullable),column.nullable,`${table}.${column.name} nullable`);
        assert.equal(Boolean(a.is_pk),column.name===meta.pk);
        assert.equal(Boolean(a.is_fk),Boolean(column.fk));
      }
    }
    assert.equal(fks.length,11);assert.ok(fks.every(f=>!f.delete_referential_action&&!f.update_referential_action&&!f.is_disabled&&!f.is_not_trusted));
    assert.equal(triggers.length,9);assert.ok(triggers.every(t=>!t.is_disabled));assert.equal(objects.length,3);
    assert.ok(checks.length>=29 && checks.every(c=>!c.is_disabled&&!c.is_not_trusted));
    for(const table of ['members','staff'])assert.ok(unique.some(i=>i.table_name===table && i.index_name===`ak_${table}_email` && i.is_unique));
    assert.ok(unique.some(i=>i.index_name==='ux_payments_ref'&&i.is_unique&&i.has_filter));
    const counts=(await pool.request().query(Object.keys(expected).map(t=>`select '${t}' as table_name,count(*) as count from dbo.${t}`).join(' union all '))).recordset;
    const minima={facilities:20,courts:20,members:500,equipment:20,staff:20,court_bookings:1000,equipment_rentals:700,payments:1000,maintenance:20};
    for(const row of counts)assert.ok(row.count>=minima[row.table_name],row.table_name+' mock data count');
    const queries=await runFile(pool,path.join(__dirname,'../database/queries.sql'));
    assert.equal(queries.length,10);assert.ok(queries.every(rows=>rows.length>0),'Every query should return mock-data results');
    const view=(await pool.request().query('select top(10) * from dbo.vw_FacilityUtilizationReport')).recordset;
    assert.ok(view.length);assert.ok(view.every(v=>v.week_start.getUTCDay()===1));
    console.table(counts);console.log('Schema, keys, FK actions, constraints, triggers, 10 queries and weekly view verified');
  } catch(error) {console.error(error.message);process.exitCode=1;}
  finally {await closePool();}
})();
