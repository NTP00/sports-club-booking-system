'use strict';
const path=require('node:path');
const assert=require('node:assert/strict');
const {getPool,closePool}=require('../src/config/database');
const {runFile}=require('./sql_runner');
const expected=require('../src/config/schema.json');

const metadataSql=`select t.name as table_name,c.name as column_name,
  ty.name as type_name,c.max_length,c.precision,c.scale,c.is_nullable,
  case when pk.column_id is null then 0 else 1 end as is_pk,
  case when fk.parent_column_id is null then 0 else 1 end as is_fk
  from sys.tables t join sys.schemas s on s.schema_id=t.schema_id
  join sys.columns c on c.object_id=t.object_id join sys.types ty on ty.user_type_id=c.user_type_id
  left join(select ic.object_id,ic.column_id from sys.indexes i join sys.index_columns ic on ic.object_id=i.object_id and ic.index_id=i.index_id where i.is_primary_key=1) pk on pk.object_id=t.object_id and pk.column_id=c.column_id
  left join sys.foreign_key_columns fk on fk.parent_object_id=t.object_id and fk.parent_column_id=c.column_id
  where s.name='dbo' order by t.name,c.column_id;
  select fk.name,ps.name as parent_schema,pt.name as parent_table,pc.name as parent_column,
    rs.name as referenced_schema,rt.name as referenced_table,rc.name as referenced_column,
    fkc.constraint_column_id as key_ordinal,fk.delete_referential_action,fk.update_referential_action,
    fk.is_disabled,fk.is_not_trusted
  from sys.foreign_keys fk join sys.foreign_key_columns fkc on fkc.constraint_object_id=fk.object_id
  join sys.tables pt on pt.object_id=fkc.parent_object_id join sys.schemas ps on ps.schema_id=pt.schema_id
  join sys.columns pc on pc.object_id=pt.object_id and pc.column_id=fkc.parent_column_id
  join sys.tables rt on rt.object_id=fkc.referenced_object_id join sys.schemas rs on rs.schema_id=rt.schema_id
  join sys.columns rc on rc.object_id=rt.object_id and rc.column_id=fkc.referenced_column_id
  where ps.name='dbo' order by pt.name,fk.name,fkc.constraint_column_id;
  select name,is_disabled,is_not_trusted from sys.check_constraints where schema_id=schema_id('dbo');
  select tr.name,ts.name as trigger_schema,ps.name as parent_schema,pt.name as parent_table,
    tr.type_desc,tr.is_instead_of_trigger,tr.is_disabled,ev.type_desc as event_type
  from sys.triggers tr join sys.objects o on o.object_id=tr.object_id
  join sys.schemas ts on ts.schema_id=o.schema_id
  join sys.tables pt on pt.object_id=tr.parent_id join sys.schemas ps on ps.schema_id=pt.schema_id
  left join sys.trigger_events ev on ev.object_id=tr.object_id
  where tr.parent_class=1 and ts.name='dbo' order by tr.name,ev.type_desc;
  select s.name as schema_name,o.name,o.type from sys.objects o join sys.schemas s on s.schema_id=o.schema_id
  where s.name='dbo' and o.name in ('sp_BookCourtAndEquipment','trg_CheckCourtConflict','vw_FacilityUtilizationReport');
  select s.name as schema_name,t.name as table_name,i.name as index_name,i.is_unique,i.is_disabled,
    i.is_primary_key,i.has_filter,i.filter_definition,c.name as column_name,ic.key_ordinal
  from sys.tables t join sys.schemas s on s.schema_id=t.schema_id
  join sys.indexes i on i.object_id=t.object_id
  join sys.index_columns ic on ic.object_id=i.object_id and ic.index_id=i.index_id
  join sys.columns c on c.object_id=ic.object_id and c.column_id=ic.column_id
  where s.name='dbo' and i.is_unique=1 and ic.key_ordinal>0
  order by t.name,i.name,ic.key_ordinal;`;

const sortRows=rows=>rows.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
const foreignKeyContract=Object.entries(expected).flatMap(([table,meta])=>meta.columns.filter(c=>c.fk).map(c=>({
  name:`fk_${table}_${c.name}`,parent_schema:'dbo',parent_table:table,parent_column:c.name,
  referenced_schema:'dbo',referenced_table:c.fk,referenced_column:expected[c.fk].pk,
  key_ordinal:1,delete_referential_action:0,update_referential_action:0,is_disabled:false,is_not_trusted:false
})));
const uniqueIndexContract=Object.entries(expected).flatMap(([table,meta])=>[
  {table_name:table,index_name:`pk_${table}`,columns:[meta.pk],is_primary_key:true,filter:null},
  ...meta.columns.filter(c=>c.ak).map(c=>({table_name:table,index_name:`ak_${table}_${c.name}`,columns:[c.name],is_primary_key:false,filter:null}))
]).concat({table_name:'payments',index_name:'ux_payments_ref',columns:['transaction_ref'],is_primary_key:false,filter:'transaction_refisnotnull'});
const triggerContract=Object.keys(expected).map(table=>({
  name:table==='court_bookings'?'trg_CheckCourtConflict':`trg_${table}_integrity`,
  trigger_schema:'dbo',parent_schema:'dbo',parent_table:table,type_desc:'SQL_TRIGGER',
  is_instead_of_trigger:true,is_disabled:false,events:['DELETE','INSERT','UPDATE']
}));
function normalizedFilter(value) {
  // SQL Server adds brackets/parentheses to this simple IS NOT NULL predicate.
  return value==null?null:value.replace(/[\s\[\]()]/g,'').toLowerCase();
}
function verifyMetadata({columns,fks,checks,triggers,objects,unique}) {
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
      assert.equal(Boolean(a.is_pk),column.name===meta.pk,`${table}.${column.name} PK`);
      assert.equal(Boolean(a.is_fk),Boolean(column.fk),`${table}.${column.name} FK`);
    }
  }
  const actualFks=fks.map(f=>({
    name:f.name,parent_schema:f.parent_schema,parent_table:f.parent_table,parent_column:f.parent_column,
    referenced_schema:f.referenced_schema,referenced_table:f.referenced_table,referenced_column:f.referenced_column,
    key_ordinal:Number(f.key_ordinal),delete_referential_action:Number(f.delete_referential_action),
    update_referential_action:Number(f.update_referential_action),is_disabled:Boolean(f.is_disabled),is_not_trusted:Boolean(f.is_not_trusted)
  }));
  assert.deepEqual(sortRows(actualFks),sortRows([...foreignKeyContract]),'Foreign key contract');
  assert.ok(checks.length>=29 && checks.every(c=>!c.is_disabled&&!c.is_not_trusted),'Enabled trusted CHECK constraints');

  const groups=new Map();
  for(const row of unique) {
    const key=JSON.stringify([row.schema_name,row.table_name,row.index_name]);
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(row);
  }
  const actualUnique=[...groups.values()].map(rows=>{
    rows.sort((a,b)=>a.key_ordinal-b.key_ordinal);
    const first=rows[0];
    assert.ok(rows.every(r=>r.is_unique&&!r.is_disabled),'Enabled unique index');
    assert.deepEqual(rows.map(r=>Number(r.key_ordinal)),rows.map((_,i)=>i+1),'Ordered index key ordinals');
    assert.ok(rows.every(r=>r.has_filter===first.has_filter && r.filter_definition===first.filter_definition && r.is_primary_key===first.is_primary_key),'Consistent index metadata');
    assert.equal(Boolean(first.has_filter),first.filter_definition!=null,'Index filter flag');
    return {schema_name:first.schema_name,table_name:first.table_name,index_name:first.index_name,
      columns:rows.map(r=>r.column_name),is_primary_key:Boolean(first.is_primary_key),filter:normalizedFilter(first.filter_definition)};
  });
  assert.deepEqual(sortRows(actualUnique),sortRows(uniqueIndexContract.map(i=>({schema_name:'dbo',...i}))),'Unique index contract');

  const triggerGroups=new Map();
  for(const row of triggers) {
    const key=JSON.stringify([row.trigger_schema,row.name]);
    if(!triggerGroups.has(key))triggerGroups.set(key,[]);
    triggerGroups.get(key).push(row);
  }
  const actualTriggers=[...triggerGroups.values()].map(rows=>{
    const first=rows[0];
    assert.ok(rows.every(r=>r.parent_schema===first.parent_schema && r.parent_table===first.parent_table
      && r.type_desc===first.type_desc && r.is_instead_of_trigger===first.is_instead_of_trigger && r.is_disabled===first.is_disabled),'Consistent trigger metadata');
    return {name:first.name,trigger_schema:first.trigger_schema,parent_schema:first.parent_schema,parent_table:first.parent_table,
      type_desc:first.type_desc,is_instead_of_trigger:Boolean(first.is_instead_of_trigger),is_disabled:Boolean(first.is_disabled),events:rows.map(r=>r.event_type).sort()};
  });
  assert.deepEqual(sortRows(actualTriggers),sortRows([...triggerContract]),'Trigger contract');
  assert.deepEqual(sortRows(objects.map(o=>({schema_name:o.schema_name,name:o.name,type:o.type.trim()}))),sortRows([
    {schema_name:'dbo',name:'sp_BookCourtAndEquipment',type:'P'},
    {schema_name:'dbo',name:'trg_CheckCourtConflict',type:'TR'},
    {schema_name:'dbo',name:'vw_FacilityUtilizationReport',type:'V'}
  ]),'Mandatory database object types');
}
async function verifyDatabase() {
  const pool=await getPool();
  const [columns,fks,checks,triggers,objects,unique]=(await pool.request().query(metadataSql)).recordsets;
  verifyMetadata({columns,fks,checks,triggers,objects,unique});
  const counts=(await pool.request().query(Object.keys(expected).map(t=>`select '${t}' as table_name,count(*) as count from dbo.${t}`).join(' union all '))).recordset;
  const minima={facilities:20,courts:20,members:500,equipment:20,staff:20,court_bookings:1000,equipment_rentals:700,payments:1000,maintenance:20};
  for(const row of counts)assert.ok(row.count>=minima[row.table_name],row.table_name+' mock data count');
  const queries=await runFile(pool,path.join(__dirname,'../database/queries.sql'));
  assert.equal(queries.length,10);assert.ok(queries.every(rows=>rows.length>0),'Every query should return mock-data results');
  const view=(await pool.request().query('select top(10) * from dbo.vw_FacilityUtilizationReport')).recordset;
  assert.ok(view.length);assert.ok(view.every(v=>v.week_start.getUTCDay()===1));
  console.table(counts);console.log('Schema, full FK/index/trigger contracts, 10 queries and weekly view verified; run db:test for numerical reporting oracles');
}
if(require.main===module) {
  verifyDatabase().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(closePool);
}
module.exports={verifyMetadata,metadataSql};
