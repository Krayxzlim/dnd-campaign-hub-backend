"use strict";
const express=require("express");
const path=require("node:path");
const {AutoReader}=require("./auto");
const sharp=require("sharp");
const {DICE_MAX}=require("./ollama");
function createApp({capture,analyze,model="gemma3:4b",autoConfig={},allowedOrigins=[],log=console}){
  const app=express();
  let latestImage=null,latestReading=null,revision=0,reading=false;
  let liveImage=null;
  // Una foto nueva deja sin efecto el resultado anterior.
  function saveImage(image){latestImage=image;latestReading=null;revision++;}
  // Guarda la foto y su candidato juntos, todavía sin confirmar.
  function saveReading(image,result){
    saveImage(image);
    latestReading={...result,confirmed:false,timestamp:new Date().toISOString(),revision};
  }
  const auto=new AutoReader({capture,analyze,onReading:saveReading,onFrame:image=>{liveImage=image;},config:autoConfig,log});
  app.disable("x-powered-by");
  // Acepta acceso local y los orígenes de FRAGUA configurados.
  app.use((req,res,next)=>{
    const host=(req.headers.host||'').split(':')[0];
    if(!['127.0.0.1','localhost'].includes(host))return res.status(403).json({error:'Solo acceso local'});
    const origin=req.headers.origin;
    if(origin && origin!=="http://"+req.headers.host && !allowedOrigins.includes(origin))return res.status(403).json({error:'Origen no permitido'});
    if(origin){res.set('Access-Control-Allow-Origin',origin);res.vary('Origin');res.set('Access-Control-Allow-Methods','GET,POST,OPTIONS');res.set('Access-Control-Allow-Headers','Content-Type');}
    if(req.method==='OPTIONS')return res.sendStatus(204);
    next();
  });
  app.use((req,res,next)=>{res.set("Cache-Control","no-store");next();});
  app.use(express.static(path.join(__dirname,"..","public"),{index:"index.html"}));
  app.use(express.json({limit:"20kb"}));
  // Permite probar con un archivo sin necesitar la cámara conectada.
  app.post('/api/read-image',express.raw({type:['image/jpeg','image/png'],limit:'4mb'}),async(req,res)=>{
    if(reading||auto.running||auto.tickInProgress)return res.status(409).json({error:'Hay otra operación en curso'});
    if(!Buffer.isBuffer(req.body)||!req.body.length)return res.status(415).json({error:'Enviar JPEG o PNG'});
    reading=true;latestReading=null;
    try{
      let image;
      try{
        const decoder=sharp(req.body,{limitInputPixels:16000000,failOn:'error'});
        const meta=await decoder.metadata();if(!['jpeg','png'].includes(meta.format))throw Error('Formato inválido');
        image=await decoder.rotate().resize({width:1024,height:1024,fit:'inside',withoutEnlargement:true}).jpeg({quality:90}).toBuffer();
      }catch{return res.status(422).json({error:'Imagen inválida o demasiado grande'});}
      saveImage(image);
      const result=await analyze(image);saveReading(image,result);
      res.json({...latestReading,imageData:"data:image/jpeg;base64,"+image.toString("base64"),imageUrl:'/api/last-image?v='+revision});
    }catch(e){res.status(502).json({error:e.message});}finally{reading=false;}
  });
  // La vista en vivo comparte la captura: nunca modifica la fotografía que se revisa.
  app.get('/api/live-frame',async(_req,res)=>{
    if(reading||auto.running||auto.tickInProgress){
      if(liveImage)return res.type('jpg').send(liveImage);
      return res.status(409).json({error:'Esperando un fotograma libre'});
    }
    reading=true;
    try{liveImage=await capture();res.type('jpg').send(liveImage);}
    catch(e){res.status(502).json({error:e.message});}finally{reading=false;}
  });
  // Confirmación vinculada a una revisión; una foto nueva invalida la anterior.
  app.post('/api/confirm',(req,res)=>{
    if(reading||auto.running||auto.tickInProgress)return res.status(409).json({error:'Detené el automático antes de confirmar'});
    const {revision:expected,dado,valor}=req.body||{};
    if(!latestReading||expected!==latestReading.revision)return res.status(409).json({error:'La lectura cambió; revisá la foto actual'});
    if(!Object.hasOwn(DICE_MAX,dado)||!Number.isInteger(valor)||valor<1||valor>DICE_MAX[dado])return res.status(400).json({error:'Tipo o valor inválido'});
    if(!latestReading.original)latestReading.original={dado:latestReading.dado,valor:latestReading.valor};
    latestReading={...latestReading,dado,valor,estado:'confirmado',confirmed:true,revision:++revision};
    res.json(latestReading);
  });
  function state(){return {model,reading,imageRevision:revision,latest:latestReading,auto:auto.status()};}
  app.get("/api/health",(_req,res)=>res.json({ok:true,model}));
  app.get("/api/state",(_req,res)=>res.json(state()));
  app.get("/api/last-image",(_req,res)=>{
    if(!latestImage)return res.status(404).json({error:"Todavía no hay fotografías"});
    res.type("jpg").send(latestImage);
  });
  // Obtiene una foto manual y la deja disponible para revisar.
  app.get("/api/capture",async(_req,res)=>{
    if(auto.running||reading||auto.tickInProgress)return res.status(409).json({error:"Cámara ocupada"});
    reading=true;
    try {
      const image=await capture();saveImage(image);res.type("jpg").send(image);
    } catch(error){res.status(502).json({error:error.message});} finally {reading=false;}
  });
  // Captura, consulta Ollama y devuelve el resultado con la misma foto.
  app.post("/api/read",async(_req,res)=>{
    if(reading||auto.running||auto.tickInProgress)return res.status(409).json({error:"Hay otra lectura o modo automático activo"});
    reading=true;
    latestReading=null;
    try {
      const image=await capture();
      saveImage(image);
      const result=await analyze(image);
      saveReading(image,result);
      res.json({...latestReading,imageData:"data:image/jpeg;base64,"+image.toString("base64"),imageUrl:"/api/last-image?v="+revision});
    } catch(error){
      log.error("Lectura manual:",error.message);
      res.status(502).json({error:error.message});
    } finally {reading=false;}
  });
  // Calibra solo cuando no hay otra operación usando la cámara.
  app.post("/api/auto/calibrate",async(_req,res)=>{
    if(reading||auto.running||auto.tickInProgress)return res.status(409).json({error:"Detené las lecturas para calibrar"});
    reading=true;
    try {
      const image=await auto.calibrate();saveImage(image);
      res.json({ok:true,auto:auto.status()});
    } catch(error){res.status(502).json({error:error.message});} finally {reading=false;}
  });
  app.post("/api/auto/start",(_req,res)=>{
    if(reading||auto.tickInProgress)return res.status(409).json({error:"Hay otra lectura en curso"});
    try{auto.start();res.json({ok:true,auto:auto.status()});}
    catch(error){res.status(400).json({error:error.message});}
  });
  app.post("/api/auto/stop",(_req,res)=>{
    auto.stop();res.json({ok:true,auto:auto.status()});
  });
  // Devuelve errores de solicitud en el mismo formato JSON.
  app.use((error,req,res,next)=>res.status(error.status||500).json({error:error.status===413?'Imagen supera 4 MiB':'Solicitud inválida'}));
  return {app,auto,state};
}
module.exports={createApp};

