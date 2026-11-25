"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const {createApp}=require("../src/app");
const {createCamera,isJpeg}=require("../src/camera");
const {normalizeDice,createOllama}=require("../src/ollama");
const {changedFraction}=require("../src/vision");
const JPEG=Buffer.from([255,216,255,217]);

async function withServer(app,cb){
  const server=app.listen(0,"127.0.0.1");
  await new Promise(resolve=>server.once("listening",resolve));
  try{await cb("http://127.0.0.1:"+server.address().port);}
  finally{await new Promise(resolve=>server.close(resolve));}
}
test("valida tipo de dado, rango, confianza y cara superior",()=>{
  assert.equal(normalizeDice({dado:"d20",valor:21,confianza:"alta",cara_superior_visible:true}).valor,null);
  assert.equal(normalizeDice({dado:"d20",valor:17,confianza:"baja",cara_superior_visible:true}).valor,null);
  assert.equal(normalizeDice({dado:"d20",valor:17,confianza:"alta",cara_superior_visible:false}).valor,null);
  assert.equal(normalizeDice({dado:"d20",valor:17,confianza:"alta",cara_superior_visible:true}).valor,17);
});
test("diferencia entre fotogramas",()=>{
  assert.equal(changedFraction(Buffer.from([0,0,0]),Buffer.from([0,32,60])),2/3);
});
test("cámara acepta JPEG y rechaza HTML",async()=>{
  const capture=createCamera({url:"http://192.168.1.95/capture",fetchFn:async()=>new Response(JPEG,{headers:{"Content-Type":"image/jpeg"}})});
  assert.equal(isJpeg(await capture()),true);
  const invalid=createCamera({url:"http://192.168.1.95/capture",fetchFn:async()=>new Response("<html>no camera</html>",{headers:{"Content-Type":"text/html"}})});
  await assert.rejects(invalid(),/no JPEG/);
});
test("enlace con Ollama envía imagen en Base64 y esquema JSON",async()=>{
  const analyze=createOllama({
    url:"http://localhost:11434",model:"gemma3:4b",
    fetchFn:async(_,init)=>{
      const body=JSON.parse(init.body);
      assert.equal(body.model,"gemma3:4b");
      assert.equal(body.messages[0].images[0],JPEG.toString("base64"));
      assert.equal(body.format.type,"object");
      return Response.json({message:{content:JSON.stringify({
        dado:"d20",valor:5,cara_superior_visible:true,confianza:"alta",observacion:"Cara superior visible"
      })}});
    }
  });
  assert.equal((await analyze(JPEG)).valor,5);
});
test("API expone salud, lectura e imagen",async()=>{
  const {app}=createApp({
    capture:async()=>JPEG,
    analyze:async()=>({estado:"reconocido",dado:"d20",valor:14,confianza:"alta",observacion:"ok"})
  });
  await withServer(app,async base=>{
    assert.equal((await (await fetch(base+"/api/health")).json()).ok,true);
    const result=await (await fetch(base+"/api/read",{method:"POST"})).json();
    assert.equal(result.valor,14);
    assert.equal((await (await fetch(base+"/api/state")).json()).latest.valor,14);
    assert.match((await fetch(base+"/api/last-image")).headers.get("content-type"),/image\/jpeg/);
  });
});
test("bloquea lecturas simultáneas",async()=>{
  let finish;
  const wait=new Promise(resolve=>finish=resolve);
  const {app}=createApp({
    capture:async()=>JPEG,
    analyze:async()=>{await wait;return {valor:null};}
  });
  await withServer(app,async base=>{
    const first=fetch(base+"/api/read",{method:"POST"});
    await new Promise(resolve=>setTimeout(resolve,50));
    assert.equal((await fetch(base+"/api/read",{method:"POST"})).status,409);
    finish();
    assert.equal((await first).status,200);
  });
});
test("modo automático exige calibración",async()=>{
  const {app}=createApp({capture:async()=>JPEG,analyze:async()=>({})});
  await withServer(app,async base=>{
    assert.equal((await fetch(base+"/api/auto/start",{method:"POST"})).status,400);
  });
});

test('archivo real se decodifica, se analiza y no usa la cámara',async()=>{
  const sharp=require('sharp');
  const png=await sharp({create:{width:64,height:64,channels:3,background:'white'}}).png().toBuffer();
  let calls=0;
  const {app}=createApp({capture:async()=>{throw Error('No usar cámara');},analyze:async image=>{calls++;assert.equal((await sharp(image).metadata()).format,'jpeg');return {dado:'d20',valor:20,estado:'reconocido'};}});
  await withServer(app,async base=>{
    const send=(bytes,type='image/png')=>fetch(base+'/api/read-image',{method:'POST',headers:{'Content-Type':type},body:bytes});
    assert.equal((await send('bad')).status,422);
    assert.equal((await send('bad','text/plain')).status,415);
    assert.equal((await send(Buffer.alloc(4*1024*1024+1))).status,413);
    const result=await (await send(png)).json();assert.equal(result.valor,20);assert.equal(result.confirmed,false);assert.equal(calls,1);
    assert.equal((await fetch(base+'/api/read-image',{method:'POST',headers:{Origin:'http://evil.example','Content-Type':'image/png'},body:png})).status,403);
  });
});
test('captura bloquea una segunda operación y limpia el resultado previo',async()=>{
  let release;let block=false;const wait=new Promise(r=>release=r);
  const {app}=createApp({capture:async()=>{if(block)await wait;return JPEG;},analyze:async()=>({valor:12})});
  await withServer(app,async base=>{
    await fetch(base+'/api/read',{method:'POST'});block=true;
    const first=fetch(base+'/api/capture');await new Promise(r=>setTimeout(r,30));
    assert.equal((await fetch(base+'/api/read',{method:'POST'})).status,409);
    release();await first;
    assert.equal((await (await fetch(base+'/api/state')).json()).latest,null);
  });
});
test('rechaza inferencia remota y admite d6 dentro de rango',()=>{
  assert.throws(()=>createOllama({url:'https://example.com',model:'x'}),/local/);
  assert.equal(normalizeDice({dado:'d6',valor:6,cara_superior_visible:true,confianza:'alta'}).valor,6);
});

test('confirma una revisión, rechaza corrección obsoleta y preserva foto frente a vista en vivo',async()=>{
  const jpeg2=Buffer.from([255,216,1,255,217]);let frame=JPEG;
  const {app}=createApp({capture:async()=>frame,analyze:async()=>({dado:'d20',valor:16,estado:'reconocido'})});
  await withServer(app,async base=>{
    const result=await (await fetch(base+'/api/read',{method:'POST'})).json();
    assert.equal(result.imageData,'data:image/jpeg;base64,'+JPEG.toString('base64'));
    frame=jpeg2;
    await fetch(base+'/api/live-frame');
    assert.deepEqual(Buffer.from(await (await fetch(base+'/api/last-image')).arrayBuffer()),JPEG);
    const confirm=(body)=>fetch(base+'/api/confirm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    assert.equal((await confirm({revision:result.revision,dado:'d6',valor:16})).status,400);
    const corrected=await (await confirm({revision:result.revision,dado:'d6',valor:6})).json();
    assert.equal(corrected.valor,6);assert.equal(corrected.confirmed,true);assert.equal(corrected.original.valor,16);
    assert.equal((await confirm({revision:result.revision,dado:'d20',valor:6})).status,409);
    await fetch(base+'/api/capture');
    assert.equal((await confirm({revision:corrected.revision,dado:'d6',valor:6})).status,409);
  });
});
test('solo permite el origen FRAGUA configurado, incluso en preflight',async()=>{
  const {app}=createApp({capture:async()=>JPEG,analyze:async()=>({}),allowedOrigins:['http://localhost:5173']});
  await withServer(app,async base=>{
    const allowed=await fetch(base+'/api/read',{method:'OPTIONS',headers:{Origin:'http://localhost:5173','Access-Control-Request-Method':'POST'}});
    assert.equal(allowed.status,204);assert.equal(allowed.headers.get('access-control-allow-origin'),'http://localhost:5173');
    assert.equal((await fetch(base+'/api/read',{method:'OPTIONS',headers:{Origin:'https://evil.example'}})).status,403);
  });
});
