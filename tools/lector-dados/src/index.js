"use strict";
// Carga las direcciones y los tiempos definidos en .env.
require("dotenv").config();
const {createCamera}=require("./camera");
const {createOllama}=require("./ollama");
const {createApp}=require("./app");
// Usa el valor configurado o el valor por defecto si no es válido.
function numeric(name,fallback){
  const value=Number(process.env[name]);
  return Number.isFinite(value)&&value>0?value:fallback;
}
const host=process.env.HOST||"127.0.0.1";
const port=numeric("PORT",3000);
const model=process.env.OLLAMA_MODEL||"gemma3:4b";
// Prepara la conexión con la cámara para pedir una foto.
const capture=createCamera({
  url:process.env.CAMERA_URL||"http://192.168.1.95/capture",
  timeoutMs:numeric("CAMERA_TIMEOUT_MS",10000)
});
// Prepara la consulta al modelo que corre en esta PC.
const analyze=createOllama({
  url:process.env.OLLAMA_URL||"http://127.0.0.1:11434",
  model,timeoutMs:numeric("OLLAMA_TIMEOUT_MS",120000)
});
// Une cámara, modelo y detector en la API local.
const {app}=createApp({
  capture,analyze,model,
  allowedOrigins:(process.env.FRAGUA_ORIGINS||"http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173").split(",").map(s=>s.trim()).filter(Boolean),
  autoConfig:{
    intervalMs:numeric("AUTO_INTERVAL_MS",350),
    stableMs:numeric("AUTO_STABLE_MS",1000),
    occupancyThreshold:numeric("AUTO_OCCUPANCY_THRESHOLD",0.018),
    emptyThreshold:numeric("AUTO_EMPTY_THRESHOLD",0.008),
    motionThreshold:numeric("AUTO_MOTION_THRESHOLD",0.015)
  }
});
// Deja disponible la web y sus rutas en el puerto configurado.
app.listen(port,host,()=>{
  console.log("Lector de dados: http://"+host+":"+port);
  console.log("Modelo Ollama: "+model);
});

