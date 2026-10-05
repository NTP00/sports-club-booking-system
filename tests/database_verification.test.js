'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const schema=require('../src/config/schema.json');
const {verifyMetadata}=require('../scripts/verify_database');
function catalog() {
  const columns=[],fks=[],unique=[],triggers=[];
  for(const [table,m] of Object.entries(schema)) {
    for(const c of m.columns) {
      const [type,params]=c.type.split('('),sizes=params?params.replace(')','').split(',').map(Number):[];
      columns.push({table_name:table,column_name:c.name,type_name:type,max_length:sizes[0]*(type==='nvarchar'?2:1),precision:sizes[0],scale:type==='decimal'?sizes[1]:sizes[0],is_nullable:c.nullable,is_pk:c.name===m.pk,is_fk:!!c.fk});
      if(c.fk)fks.push({name:`fk_${table}_${c.name}`,parent_schema:'dbo',parent_table:table,parent_column:c.name,referenced_schema:'dbo',referenced_table:c.fk,referenced_column:schema[c.fk].pk,key_ordinal:1,delete_referential_action:0,update_referential_action:0,is_disabled:false,is_not_trusted:false});
      if(c.name===m.pk || c.ak)unique.push({schema_name:'dbo',table_name:table,index_name:c.ak?`ak_${table}_${c.name}`:`pk_${table}`,column_name:c.name,key_ordinal:1,is_unique:true,is_disabled:false,is_primary_key:c.name===m.pk,has_filter:false,filter_definition:null});
    }
    for(const event of ['INSERT','UPDATE','DELETE'])triggers.push({name:table==='court_bookings'?'trg_CheckCourtConflict':`trg_${table}_integrity`,trigger_schema:'dbo',parent_schema:'dbo',parent_table:table,type_desc:'SQL_TRIGGER',is_instead_of_trigger:true,is_disabled:false,event_type:event});
  }
  unique.push({schema_name:'dbo',table_name:'payments',index_name:'ux_payments_ref',column_name:'transaction_ref',key_ordinal:1,is_unique:true,is_disabled:false,is_primary_key:false,has_filter:true,filter_definition:'([transaction_ref] IS NOT NULL)'});
  return {columns,fks,unique,triggers,checks:Array.from({length:29},(_,i)=>({name:'check_'+i,is_disabled:false,is_not_trusted:false})),objects:[{schema_name:'dbo',name:'sp_BookCourtAndEquipment',type:'P '},{schema_name:'dbo',name:'trg_CheckCourtConflict',type:'TR'},{schema_name:'dbo',name:'vw_FacilityUtilizationReport',type:'V '}]};
}
test('Q01 correct catalog passes full metadata verification without SQL Engine',()=>{
  assert.doesNotThrow(()=>verifyMetadata(catalog()));
});
for(const [field,value] of [['parent_schema','other'],['parent_table','members'],['parent_column','member_id'],['referenced_schema','other'],['referenced_table','members'],['referenced_column','member_id'],['delete_referential_action',1],['update_referential_action',1],['is_disabled',true],['is_not_trusted',true]]) {
  test(`Q01 rejects FK drift in ${field} with the same FK count`,()=>{
    const c=catalog();c.fks[0][field]=value;assert.throws(()=>verifyMetadata(c),/Foreign key contract/);
  });
}
const reference=c=>c.unique.find(i=>i.index_name==='ux_payments_ref');
for(const [label,mutate] of [
  ['email key on wrong column',c=>{c.unique.find(i=>i.index_name==='ak_members_email').column_name='phone';}],
  ['reference key on wrong column',c=>{reference(c).column_name='payment_id';}],
  ['nonunique reference',c=>{reference(c).is_unique=false;}],
  ['disabled reference index',c=>{reference(c).is_disabled=true;}],
  ['wrong reference filter',c=>{reference(c).filter_definition='([transaction_ref] IS NULL)';}],
  ['missing reference filter',c=>{reference(c).filter_definition=null;reference(c).has_filter=false;}],
  ['key ordinal drift',c=>{reference(c).key_ordinal=2;}],
  ['extra ordered key column',c=>{c.unique.push({...reference(c),column_name:'amount',key_ordinal:2});}]
]) {
  test(`Q01 rejects unique index drift: ${label}`,()=>{
    const c=catalog();mutate(c);assert.throws(()=>verifyMetadata(c));
  });
}
for(const [label,mutate] of [
  ['wrong trigger name',c=>{for(const r of c.triggers.filter(t=>t.parent_table==='court_bookings'))r.name='wrong_name';}],
  ['wrong parent table',c=>{for(const r of c.triggers.filter(t=>t.parent_table==='court_bookings'))r.parent_table='payments';}],
  ['AFTER instead of INSTEAD OF',c=>{for(const r of c.triggers.filter(t=>t.parent_table==='court_bookings'))r.is_instead_of_trigger=false;}],
  ['CLR instead of SQL trigger',c=>{for(const r of c.triggers.filter(t=>t.parent_table==='court_bookings'))r.type_desc='CLR_TRIGGER';}],
  ['disabled trigger',c=>{for(const r of c.triggers.filter(t=>t.parent_table==='court_bookings'))r.is_disabled=true;}],
  ['missing DELETE event',c=>{c.triggers=c.triggers.filter(t=>!(t.parent_table==='court_bookings'&&t.event_type==='DELETE'));}],
  ['wrong mandatory object type',c=>{c.objects.find(o=>o.name==='vw_FacilityUtilizationReport').type='U';}]
]) {
  test(`Q01 rejects trigger/object drift: ${label}`,()=>{
    const c=catalog();mutate(c);assert.throws(()=>verifyMetadata(c));
  });
}
