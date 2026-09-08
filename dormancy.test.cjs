const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const context2d=new Proxy({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)})},{get:(t,k)=>k in t?t[k]:(()=>{})});
const defaults={gain:'1.5',smooth:'.7',speed:'1',brightness:'.8',noise:'-60',effect:'generative',palette:'neon'};
const elements=new Map();
function element(id=''){
 return {value:defaults[id]||'',checked:false,textContent:'',options:[],hidden:false,classList:{add(){},toggle(){}},getContext:()=>context2d,replaceChildren(...v){this.options=v;},pause(){},removeAttribute(){},cloneNode(){return element(id)},replaceWith(){},addEventListener(){},querySelector:()=>element(),querySelectorAll:()=>[],insertAdjacentHTML(){}};
}
const sandbox={console,Uint8Array,Uint8ClampedArray,Float32Array,Option:function(text,value){return {text,value};},document:{getElementById:id=>{if(!elements.has(id))elements.set(id,element(id));return elements.get(id);},createElement:()=>element(),querySelectorAll:()=>[],addEventListener(){}},window:{addEventListener(){}},localStorage:{getItem:()=>null},requestAnimationFrame(){},setInterval(){},setTimeout(){},SupaModulation:require('../dist/modulation.js')};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync('dist/app.js','utf8'),sandbox);
const run=code=>vm.runInContext(code,sandbox);
assert.equal(run('mode'),'idle');run('frame(1000)');const blank=run('pixels.data.slice()');
run('frame(5000)');assert.deepEqual(run('pixels.data'),blank);assert.equal(run('clock'),0);
run("routes=[SupaModulation.create('bass','blobs'),SupaModulation.create('high','peaks'),SupaModulation.create('mid','speed')];mode='demo';frame(5100);frame(5200)");
assert(run('pixels.data.some((v,i)=>i%4!==3&&v>0)'));assert(run('clock>0'));
run('stop()');const frozen=run('pixels.data.slice()'),phase=run('clock');
for(let t=5300;t<9000;t+=100)run(`frame(${t})`);
assert.deepEqual(run('pixels.data'),frozen);assert.equal(run('clock'),phase);
// Rendering identical audio at different wall-clock times must give identical pixels.
run('bass=.3;mid=.4;high=.1;mean=.2');
for(const effect of ['generative','aurora','radial','spectrum','tunnel','plasma','orbit','rain','wave']){
 run(`$('effect').value='${effect}';render(1)`);const expected=run('pixels.data.slice()');run('render(999)');assert.deepEqual(run('pixels.data'),expected,effect+' depends on wall clock');
}
console.log('PASS: idle startup, silent pixel equality, audible output, stop freezes pixels and phase, all nine effects independent of wall-clock time.');

// A pairing must change the selected field, and cannot paint an independent overlay.
run('bands.fill(.4);for(let i=0;i<wave.length;i++)wave[i]=128+Math.sin(i*.04)*70;');
for(const effect of ['generative','aurora','radial','spectrum','tunnel','plasma','orbit','rain','wave']){
 run(`$('effect').value='${effect}';bass=.3;mid=.4;high=.1;modulation={speed:0,blobs:0,peaks:0,size:0,hue:0,light:0};render(1)`);
 const baseline=run('pixels.data.slice()');
 for(const target of ['blobs','peaks','size']){
  run(`modulation.blobs=modulation.peaks=modulation.size=0;modulation.${target}=.8;render(1)`);
  assert.notDeepEqual(run('pixels.data'),baseline,effect+' ignores '+target);
 }
 run('bass=mid=high=0;modulation.blobs=modulation.peaks=modulation.size=1;render(1)');
 assert(!run('pixels.data.some((v,i)=>i%4!==3&&v>0)'),effect+' adds independent geometry');
}
console.log('PASS: structure, sharpness and scale modify every selected effect; no attribute paints independent geometry.');

// Stateful engines only evolve from their declared audio drivers.
for(const [effect,state,label] of [['currents','flowMemory','current trails'],['bloom','reactionB','mycelium bloom'],['pulse','waveCurrent','tidal pulses']]){
 run(`resetEngines();$('effect').value='${effect}';audioActive=true;audioLoudness=.8;bass=.7;mid=.35;high=.2;mean=.15;beat.pulse=.9;modulation={speed:0,blobs:1,peaks:0,size:0,intensity:1,hue:0,light:0,meters:[]};clock=1;advanceEngines(.05);render(1)`);
 assert(run(`${state}.some(v=>Math.abs(v)>0)`),label+' should receive its audio driver');
 assert(run('pixels.data.some((v,i)=>i%4!==3&&v>0)'),label+' should render its evolving state');
}
console.log('PASS: current trails, mycelium bloom, and tidal pulses evolve from audio drivers.');

run("resetEngines();$('effect').value='organic';audioActive=true;audioLoudness=.8;bass=.72;mid=.3;high=.46;mean=.15;beat.pulse=.9;modulation={speed:0,blobs:1,peaks:0,size:0,intensity:1,hue:0,light:1,meters:[]};clock=1;advanceEngines(.05);render(1)");
assert(run('organicLow.some(v=>v>0)'),'bass should seed organic blobs');
assert(run('organicHigh.some(v=>v>0)'),'treble should seed bright organic blobs');
assert(run('pixels.data.some((v,i)=>i%4!==3&&v>0)'),'organic field should render only seeded energy');
console.log('PASS: organic field seeds distinct bass and treble energy bodies.');

run("resetEngines();$('effect').value='embers';audioActive=true;audioLoudness=.8;bass=.08;mid=.2;high=.72;mean=.05;beat.pulse=.9;modulation={speed:0,blobs:1,peaks:0,size:0,intensity:1,hue:0,light:1,meters:[]};clock=1;advanceEngines(.05);render(1)");
assert(run('organicHigh.some(v=>v>0)'),'treble should seed ember energy');
assert(run('pixels.data.some((v,i)=>i%4!==3&&v>0)'),'treble embers should render their energy');
console.log('PASS: treble embers are seeded by high-frequency energy.');

run("resetBeat();mode='demo';last=0;");
for(let time=100;time<5000;time+=50)run(`frame(${time})`);
const detected=run('({bpm:beat.bpm,confidence:beat.confidence,pulses:beat.bpms.length})');
assert(detected.bpm>105&&detected.bpm<135,'tracker should lock to the synthetic 120 BPM input');
assert(detected.confidence>.35,'tracker should gain confidence from repeated input');
console.log('PASS: synthetic 120 BPM input produces a stable tempo estimate.');
