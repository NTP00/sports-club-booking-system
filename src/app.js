'use strict';
require('dotenv').config();
const path=require('node:path');
const express=require('express');
const helmet=require('helmet');
const ui=require('./config/ui');
const csrf=require('./middleware/csrf');
const {errorHandler}=require('./middleware/error');
const {createService}=require('./services/club');
const routes=require('./routes');
const database=require('./config/database');
function createApp(service=createService()) {
  const app=express();
  app.disable('x-powered-by');
  app.set('view engine','ejs');app.set('views',path.join(__dirname,'views'));
  app.use(helmet({contentSecurityPolicy:{directives:{upgradeInsecureRequests:null}},hsts:false}));
  app.use(express.urlencoded({extended:true,limit:'64kb',parameterLimit:500}));
  app.use(express.static(path.join(__dirname,'public')));
  app.use((req,res,next)=>{Object.assign(res.locals,ui,{path:req.path});next();});
  app.get('/health',async(req,res)=>{
    try {await service.run('select 1 as ok');res.json({status:'ok',database:'connected'});}
    catch {res.status(503).json({status:'unavailable',database:'disconnected'});}
  });
  app.use(csrf);app.use(routes(service));
  app.use((req,res)=>res.status(404).render('error',{title:'ไม่พบหน้า',message:'ตรวจ URL แล้วลองอีกครั้ง'}));
  app.use(errorHandler);
  return app;
}
if(require.main===module) {
  const app=createApp(),port=Number(process.env.PORT||3000),host=process.env.HOST||'127.0.0.1';
  const server=app.listen(port,host,()=>console.log(`Sports Club: http://${host}:${port}`));
  const stop=()=>server.close(async()=>{try{await database.closePool();}finally{process.exit(0);}});
  process.once('SIGINT',stop);process.once('SIGTERM',stop);
}
module.exports={createApp};
