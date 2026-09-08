/* Audio-to-attribute routing, independent of the browser and renderer. */
(function(root){
'use strict';
const clamp=(v,lo=0,hi=1)=>Math.max(lo,Math.min(hi,v));
const targets={speed:'Motion speed',blobs:'Structure / spawning',peaks:'Peak sharpness',size:'Effect scale',intensity:'Peak intensity',hue:'Color shift',light:'Extra brightness'};
const sources={bass:{label:'Bass · 30–250 Hz',low:30,high:250},mid:{label:'Mids · 250–2k Hz',low:250,high:2000},high:{label:'Treble · 2k–12k Hz',low:2000,high:12000},full:{label:'Full spectrum · 30–12k Hz',low:30,high:12000},impact:{label:'Impact · bass novelty',feature:'impact'},presence:{label:'Presence · treble novelty',feature:'presence'},melody:{label:'Melody · harmonic confidence',feature:'melody'},glide:{label:'Melody glide · pitch movement',feature:'glide'},vocal:{label:'Vocal presence · harmonic mids',feature:'vocal'},beat:{label:'Beat pulse',feature:'beat'},tempo:{label:'Tempo cycle',feature:'tempo'},custom:{label:'Custom frequency range'}};
const frequency=i=>30*Math.pow(400,(i+.5)/48);
function validate(routes){
 if(!Array.isArray(routes)||routes.length>12)throw Error('Use at most 12 audio pairings.');
 return routes.map(r=>{
  if(!r||!Object.hasOwn(sources,r.source)||!Object.hasOwn(targets,r.target)||!['level','peak'].includes(r.response)||typeof r.enabled!=='boolean')throw Error('Invalid audio pairing.');
  for(const [key,lo,hi] of [['amount',0,2],['threshold',0,.95],['release',.05,2],['low',30,11999],['high',31,12000]])if(typeof r[key]!=='number'||!Number.isFinite(r[key])||r[key]<lo||r[key]>hi)throw Error('Audio pairing value out of range.');
  if(r.low>=r.high)throw Error('Frequency range must start below its end.');
  const clean=Object.fromEntries(['source','target','response','enabled','amount','threshold','release','low','high'].map(k=>[k,r[k]]));
  if(r.requiredFor!==undefined){if(!Array.isArray(r.requiredFor)||r.requiredFor.some(value=>typeof value!=='string'||!value))throw Error('Invalid required pairing.');clean.requiredFor=[...new Set(r.requiredFor)];}
  return clean;
 });
}
function create(source='bass',target='blobs'){return {source,target,response:'level',enabled:true,amount:1,threshold:.12,release:.35,low:30,high:250};}
function read(source,bands,features={},response='level'){
 if(source==='none'||!Object.hasOwn(sources,source))return 0;
 const range=sources[source];
 if(range.feature)return clamp(Number(features[range.feature])||0);
 const bins=[];for(let i=0;i<48;i++)if(frequency(i)>=range.low&&frequency(i)<range.high)bins.push(i);
 const values=(bins.length?bins:[0]).map(i=>clamp(Number(bands[i])||0));
 return response==='peak'?Math.max(...values):values.reduce((a,b)=>a+b,0)/values.length;
}
function step(routes,bands,dt,states,features={}){
 const out={speed:0,blobs:0,peaks:0,size:0,intensity:0,hue:0,light:0,meters:[]};
 routes.forEach((r,index)=>{
  const state=states[index]||(states[index]={value:0});
  if(!r.enabled){state.value=0;out.meters.push(0);return;}
  const range=r.source==='custom'?r:sources[r.source];
  let raw;
  if(range.feature){raw=clamp(Number(features[range.feature])||0);}
  else{let bins=[];for(let i=0;i<48;i++)if(frequency(i)>=range.low&&frequency(i)<range.high)bins.push(i);
   // Ranges narrower than the analysis resolution use their nearest band.
   if(!bins.length)bins=[clamp(Math.round(Math.log(Math.sqrt(range.low*range.high)/30)/Math.log(400)*48-.5),0,47)];
   const values=bins.map(i=>clamp(Number(bands[i])||0));
   raw=r.response==='peak'?Math.max(...values):values.reduce((a,b)=>a+b,0)/values.length;}
  const active=clamp((raw-r.threshold)/(1-r.threshold));
  const tau=active>state.value?.025:r.release;
  state.value+=(active-state.value)*(1-Math.exp(-Math.max(0,dt)/tau));
  const drive=state.value*r.amount;out[r.target]+=drive;out.meters.push(state.value);

 });
 out.speed=clamp(out.speed,0,3);out.peaks=clamp(out.peaks,0,2);out.size=clamp(out.size,0,2);out.intensity=clamp(out.intensity,0,2);out.hue=clamp(out.hue,0,2);out.light=clamp(out.light,0,2);

 return out;
}
// Gate on unprocessed RMS; normalize spectral shape only above that floor.
// This makes quiet passages usable without amplifying digital silence into motion.
function condition(input,rms,noiseDb=-60,gain=1.5){
 const floor=Math.pow(10,noiseDb/20);
 const audible=Number.isFinite(rms)&&rms>floor;
 const values=Array.from(input,v=>Math.max(0,Number(v)||0));
 const peak=Math.max(...values,0);
 if(!audible||peak<1e-6)return {active:false,bands:new Float32Array(48),activity:0};
 const gate=clamp((rms/floor-1)/2); // Smooth entry over about 9 dB above the floor.
 // Log compression keeps quiet musical detail visible without letting a sustained bass peak dominate every route.
 const scale=Math.log1p(10*gain);const compressed=Float32Array.from(values,v=>Math.log1p(10*gain*v/peak)/scale*gate);
 return {active:true,bands:compressed,activity:Math.max(...compressed)};
}
function advance(phase,dt,active,drive,sensitivity){return phase+(active?Math.max(0,dt)*clamp(drive,0,3)*Math.max(0,sensitivity):0);}
const api={targets,sources,frequency,validate,create,read,step,condition,advance};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SupaModulation=api;
})(globalThis);
