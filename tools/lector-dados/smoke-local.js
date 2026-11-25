"use strict";
const sharp=require('sharp');
const fs=require('node:fs');
async function main(){
  // Synthetic empty scene: tests real transport/inference, NOT physical dice accuracy.
  const image=await sharp({create:{width:320,height:240,channels:3,background:'#888888'}}).jpeg().toBuffer();
  const started=Date.now();
  const r=await fetch('http://127.0.0.1:3000/api/read-image',{method:'POST',headers:{'Content-Type':'image/jpeg'},body:image,signal:AbortSignal.timeout(200000)});
  const data=await r.json();
  const report={test:'synthetic_empty_image_real_ollama',date:new Date().toISOString(),http:r.status,elapsed_ms:Date.now()-started,result:data};
  fs.writeFileSync('smoke-result.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
  if(!r.ok||data.valor!==null)process.exitCode=1;
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
