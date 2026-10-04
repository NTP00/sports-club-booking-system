'use strict';
const crypto=require('node:crypto');
function csrf(req,res,next) {
  const cookies=Object.fromEntries((req.headers.cookie||'').split(';').map(s=>s.trim().split('=')).filter(p=>p.length===2));
  let token=cookies.club_csrf;
  if(!token || !/^[a-f0-9]{64}$/.test(token)) {
    token=crypto.randomBytes(32).toString('hex');
    res.cookie('club_csrf',token,{httpOnly:true,sameSite:'strict',secure:req.secure,path:'/'});
  }
  res.locals.csrf=token;
  if(['POST','PUT','PATCH','DELETE'].includes(req.method)) {
    const given=req.body?._csrf;
    if(typeof given!=='string' || !/^[a-f0-9]{64}$/.test(given) || !crypto.timingSafeEqual(Buffer.from(given),Buffer.from(token))) {
      return res.status(403).render('error',{title:'แบบฟอร์มหมดอายุ',message:'กรุณาเปิดแบบฟอร์มใหม่แล้วลองอีกครั้ง'});
    }
  }
  next();
}
module.exports=csrf;
