'use strict';
const db=require('../config/database');
const {schema,masters}=require('../config/ui');
function sqlType(type) {
  if(type==='int') return db.sql.Int;
  if(type==='date') return db.sql.Date;
  if(type.startsWith('time(')) return db.sql.Time(0);
  if(type.startsWith('datetime2')) return db.sql.DateTime2(0);
  const args=type.match(/\(([^)]+)\)/)[1].split(',').map(Number);
  if(type.startsWith('nvarchar')) return db.sql.NVarChar(args[0]);
  if(type.startsWith('varchar')) return db.sql.VarChar(args[0]);
  return db.sql.Decimal(...args);
}
function createService(database=db) {
  const run=async (statement,params=[])=>{
    const request=(await database.getPool()).request();
    for(const [name,type,value] of params) request.input(name,type,value);
    return request.query(statement);
  };
  const tableMeta=table=>{ if(!Object.hasOwn(schema,table)) throw Object.assign(new Error('ไม่พบหน้า'),{status:404});return schema[table]; };
  const get=async(table,id)=>{
    const m=tableMeta(table);
    const result=await run(`select * from dbo.${table} where ${m.pk}=@id`,[['id',db.sql.VarChar(10),id]]);
    if(!result.recordset.length)throw Object.assign(new Error('ไม่พบรายการ'),{status:404});
    return result.recordset[0];
  };
  return {
    run,get,
    async list(table,{page=1,search=''}={}) {
      const m=tableMeta(table),size=25;
      const columns=m.columns.filter(c=>/varchar/.test(c.type)).map(c=>`convert(nvarchar(500),${c.name}) like @search escape '~'`).join(' or ');
      const escaped=search.replace(/[~%_\[]/g,c=>'~'+c);
      const result=await run(`select count(*) as total from dbo.${table} where (@search=N'%%' or ${columns});
        select * from dbo.${table} where (@search=N'%%' or ${columns}) order by ${m.pk} desc offset @offset rows fetch next @size rows only;`,
        [['search',db.sql.NVarChar(200),'%'+escaped+'%'],['offset',db.sql.Int,(page-1)*size],['size',db.sql.Int,size]]);
      return {rows:result.recordsets[1],total:result.recordsets[0][0].total,page,size,search};
    },
    async save(table,values,id=null) {
      const m=tableMeta(table);
      if(!masters.has(table) && table!=='payments')throw Object.assign(new Error('ใช้ workflow ธุรกรรม'),{status:400});
      const columns=Object.keys(values).filter(c=>m.columns.some(col=>col.name===c) && c!==m.pk);
      const params=columns.map(c=>[c,sqlType(m.columns.find(col=>col.name===c).type),values[c]]);
      if(id) {
        params.push(['id',db.sql.VarChar(10),id]);
        await run(`set xact_abort on; begin try begin transaction; exec dbo.sp_lock_integrity;
          if not exists(select 1 from dbo.${table} where ${m.pk}=@id) throw 51041,N'Record not found.',1;
          update dbo.${table} set ${columns.map(c=>`${c}=@${c}`).join(',')} where ${m.pk}=@id;
          commit; end try begin catch if xact_state()<>0 rollback; throw; end catch;`,params);
        return id;
      }
      // INSTEAD OF triggers make OUTPUT an unreliable source of final values.
      // Allocate the ID explicitly using the sequence, then return that ID.
      const result=await run(`set xact_abort on; begin try begin transaction; exec dbo.sp_lock_integrity;
        declare @new_id varchar(10)='${m.prefix}'+right('0000000'+convert(varchar(7),next value for dbo.seq_${table}),7);
        insert dbo.${table}(${m.pk},${columns.join(',')}) values(@new_id,${columns.map(c=>'@'+c).join(',')});
        commit; select @new_id as id; end try begin catch if xact_state()<>0 rollback; throw; end catch;`,params);
      return result.recordset[0].id;
    },
    async changeStatus(table,id,status) {
      const m=tableMeta(table);
      if(!m.statuses.includes(status)) throw Object.assign(new Error('สถานะไม่ถูกต้อง'),{status:400});
      await run(`update dbo.${table} set status=@status where ${m.pk}=@id`,[['id',db.sql.VarChar(10),id],['status',db.sql.NVarChar(20),status]]);
    },
    async returnRental(id,return_date) {
      await run(`set xact_abort on; begin try begin transaction; exec dbo.sp_lock_integrity;
        if not exists(select 1 from dbo.equipment_rentals where rental_id=@id and status='active') throw 51042,N'Rental is not active.',1;
        if @return_date>dbo.fn_today() throw 51043,N'Actual return cannot be in the future.',1;
        update dbo.equipment_rentals set return_date=@return_date,status='returned' where rental_id=@id;
        commit; end try begin catch if xact_state()<>0 rollback; throw; end catch;`,[['id',db.sql.VarChar(10),id],['return_date',db.sql.Date,return_date]]);
    },
    async lookups() {
      const result=await run(`select member_id as id,member_id+N' • '+first_name+N' '+last_name as label,status from dbo.members order by member_id;
        select c.court_id as id,c.court_id+N' • '+c.court_name+N' / '+f.facility_name as label,c.status,c.hourly_rate,f.opening_time,f.closing_time from dbo.courts c join dbo.facilities f on f.facility_id=c.facility_id order by c.court_id;
        select equipment_id as id,equipment_id+N' • '+equipment_name as label,status,rental_rate,total_quantity from dbo.equipment order by equipment_id;
        select facility_id as id,facility_id+N' • '+facility_name as label,status from dbo.facilities order by facility_id;
        select staff_id as id,staff_id+N' • '+first_name+N' '+last_name as label,status from dbo.staff order by staff_id;`);
      const [members,courts,equipment,facilities,staff]=result.recordsets;
      return {members,courts,equipment,facilities,staff};
    },
    async book(values) {
      const tvp=new db.sql.Table('dbo.equipment_request');
      tvp.columns.add('equipment_id',db.sql.VarChar(10),{nullable:false});
      tvp.columns.add('quantity',db.sql.Int,{nullable:false});
      tvp.columns.add('rental_date',db.sql.Date,{nullable:false});
      tvp.columns.add('due_date',db.sql.Date,{nullable:false});
      tvp.columns.add('total_amount',db.sql.Decimal(10,2),{nullable:true});
      tvp.columns.add('transaction_ref',db.sql.VarChar(100),{nullable:true});
      for(const i of values.items)tvp.rows.add(i.equipment_id,i.quantity,i.rental_date,i.due_date,i.total_amount,i.transaction_ref);
      const r=(await database.getPool()).request();
      for(const [name,type] of [['member_id',db.sql.VarChar(10)],['court_id',db.sql.VarChar(10)],['booking_date',db.sql.Date],['start_time',db.sql.Time(0)],['end_time',db.sql.Time(0)],['total_amount',db.sql.Decimal(10,2)],['payment_method',db.sql.NVarChar(30)],['booking_transaction_ref',db.sql.VarChar(100)],['pay_now',db.sql.Bit]])r.input(name,type,values[name]);
      r.input('equipment_items',tvp);
      return r.execute('dbo.sp_BookCourtAndEquipment');
    },
    async detail(table,id) {
      const row=await get(table,id);
      let payments=[];
      if(['court_bookings','equipment_rentals'].includes(table)) {
        const fk=schema[table].pk;
        payments=(await run(`select * from dbo.payments where ${fk}=@id order by payment_date`,[['id',db.sql.VarChar(10),id]])).recordset;
      }
      return {row,payments};
    },
    async dashboard() {
      return (await run(`select
        (select count(*) from dbo.members where status='active') as active_members,
        (select count(*) from dbo.court_bookings where status='confirmed' and booking_date=dbo.fn_today()) as bookings_today,
        (select count(*) from dbo.equipment_rentals where status='active' and due_date<dbo.fn_today()) as overdue_rentals,
        (select coalesce(sum(amount),0) from dbo.payments where status='paid') as paid_revenue;
        select top(8) b.booking_id,b.booking_date,b.start_time,c.court_name,m.first_name,b.status from dbo.court_bookings b join dbo.courts c on c.court_id=b.court_id join dbo.members m on m.member_id=b.member_id order by b.created_at desc,b.booking_id desc;
        select e.equipment_id,e.equipment_name,e.total_quantity-coalesce(q.used,0) as available_today
        from dbo.equipment e outer apply(select sum(p.quantity) as used from dbo.fn_rental_periods() p where p.equipment_id=e.equipment_id and dbo.fn_today() between p.rental_date and p.effective_end) q order by e.equipment_id;`)).recordsets;
    },
    async reports(week=null) {
      const params=week?[['week',db.sql.Date,week]]:[];
      return (await run(`select * from dbo.vw_FacilityUtilizationReport where week_start=${week?'@week':"dateadd(day,-((datediff(day,convert(date,'19000101'),dbo.fn_today())%7+7)%7),dbo.fn_today())"} order by resource_type,resource_id`,params)).recordset;
    }
  };
}
module.exports={createService,sqlType};
