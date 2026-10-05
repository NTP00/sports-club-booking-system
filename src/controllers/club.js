'use strict';
const ui=require('../config/ui');
const validate=require('../middleware/validation');
const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res)).catch(next);
function controllers(service) {
  const resource=req=>{if(!Object.hasOwn(ui.schema,req.params.resource))throw Object.assign(new Error('ไม่พบหน้า'),{status:404});return req.params.resource;};
  const editable=table=>{if(!ui.masters.has(table) && table!=='payments')throw Object.assign(new Error('ใช้หน้าธุรกรรมเพื่อทำรายการนี้'),{status:400});};
  return {
    dashboard:wrap(async(req,res)=>res.render('dashboard',{title:'ภาพรวม',data:await service.dashboard()})),
    list:wrap(async(req,res)=>{
      const table=resource(req),page=validate.number(req.query.page||'1','หน้า',{integer:true,positive:true,max:100000});
      const search=validate.text(req.query.q||'','ค้นหา',80,true)||'';
      res.render('list',{title:ui.titles[table],table,meta:ui.schema[table],result:await service.list(table,{page,search})});
    }),
    form:wrap(async(req,res)=>{
      const table=resource(req);editable(table);
      const row=req.params.id?await service.get(table,validate.id(req.params.id,'รหัส')):{};
      res.render('form',{title:(req.params.id?'แก้ไข':'เพิ่ม')+ui.titles[table],table,meta:ui.schema[table],row,lookups:await service.lookups(),edit:!!req.params.id});
    }),
    save:wrap(async(req,res)=>{
      const table=resource(req);editable(table);
      const id=req.params.id?validate.id(req.params.id,'รหัส'):null;
      const values=validate.record(table,req.body,{edit:!!id});
      // Payment source stays fixed on edit even if a caller changes the form.
      if(table==='payments' && id) {
        const old=await service.get(table,id);
        if(values.booking_id!==old.booking_id || values.rental_id!==old.rental_id)validate.fail('เปลี่ยนรายการต้นทางของ Payment ไม่ได้');
      }
      const saved=await service.save(table,values,id);
      res.redirect(`/${table}/${saved}`);
    }),
    detail:wrap(async(req,res)=>{
      const table=resource(req),id=validate.id(req.params.id,'รหัส');
      const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
      res.render('detail',{title:ui.titles[table]+' '+id,table,meta:ui.schema[table],...(await service.detail(table,id)),today});
    }),
    status:wrap(async(req,res)=>{
      const table=resource(req),id=validate.id(req.params.id,'รหัส'),status=req.body.status;
      const allowed=['facilities','courts','members','equipment','staff','maintenance','court_bookings','equipment_rentals','payments'];
      if(!allowed.includes(table))validate.fail('เปลี่ยนสถานะไม่ได้');
      if(['court_bookings','equipment_rentals'].includes(table) && status!=='cancelled')validate.fail('ใช้ workflow ที่กำหนด');
      await service.get(table,id);await service.changeStatus(table,id,status);
      res.redirect(`/${table}/${id}`);
    }),
    returnRental:wrap(async(req,res)=>{
      const id=validate.id(req.params.id,'รหัสเช่า');await service.returnRental(id,validate.date(req.body.return_date,'วันคืนจริง'));res.redirect('/equipment_rentals/'+id);
    }),
    bookingForm:wrap(async(req,res)=>res.render('booking',{title:'จองสนามและเช่าอุปกรณ์',lookups:await service.lookups()})),
    book:wrap(async(req,res)=>{
      const result=await service.book(validate.booking(req.body));res.redirect('/court_bookings/'+result.recordsets[0][0].booking_id);
    }),
    reports:wrap(async(req,res)=>{
      const week=req.query.week?validate.date(req.query.week,'สัปดาห์'):null;
      if(week && week.getUTCDay()!==1)validate.fail('เลือกวันที่เริ่มสัปดาห์เป็นวันจันทร์');
      res.render('reports',{title:'รายงานการใช้งานรายสัปดาห์',rows:await service.reports(week),week:req.query.week||''});
    })
  };
}
module.exports=controllers;
