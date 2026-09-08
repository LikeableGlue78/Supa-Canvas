'use strict';
const $=id=>document.getElementById(id), canvas=$('canvas'),ctx=canvas.getContext('2d'), sc=$('spectrum').getContext('2d'), waveCtx=$('waveform').getContext('2d'), spectrogram=$('spectrogram'),spectrogramCtx=spectrogram.getContext('2d'), traceCtx=$('signalTrace').getContext('2d'), stripOutput=$('stripOutput'),stripCtx=stripOutput.getContext('2d');
const field=document.createElement('canvas');field.width=240;field.height=135;const fc=field.getContext('2d'),pixels=fc.createImageData(240,135);
const simW=80,simH=45,simSize=simW*simH;
let flowMemory=new Float32Array(simSize),flowNext=new Float32Array(simSize),reactionA=new Float32Array(simSize),reactionB=new Float32Array(simSize),reactionNextA=new Float32Array(simSize),reactionNextB=new Float32Array(simSize),wavePrevious=new Float32Array(simSize),waveCurrent=new Float32Array(simSize),waveNext=new Float32Array(simSize),organicLow=new Float32Array(simSize),organicHigh=new Float32Array(simSize),organicLowNext=new Float32Array(simSize),organicHighNext=new Float32Array(simSize),melodyField=new Float32Array(simSize),melodyNext=new Float32Array(simSize),vocalField=new Float32Array(simSize),vocalNext=new Float32Array(simSize),spectrumField=new Float32Array(simSize),spectrumNext=new Float32Array(simSize),spectrumHeight=new Float32Array(48);
const visualPixels=new Uint8ClampedArray(240*135*4);let renderDt=.016;
let organicParticles=[],organicBassCarry=0,organicHighCarry=0,organicLastBeat=-Infinity,organicSeed=0,currentCarry=0,bloomCarry=0,pulseCarry=0,engineLastBeat=-Infinity,engineSeed=0;
let routes=[],routeStates=[],modulation={speed:0,blobs:0,peaks:0,size:0,intensity:0,hue:0,light:0,meters:[]};
let masterBindings={smooth:'none',speed:'none'},masterValues={smooth:0,speed:0};
let fixtures=[{name:'Desk perimeter',count:120,points:[[.16,.77],[.16,.25],[.84,.25],[.84,.77]]},{name:'Accent strip',count:60,points:[[.29,.66],[.5,.43],[.71,.66]]}],selected=0,selectedNode=0,drag=null;
let audio=null,analyser=null,stream=null,source=null,zero=null,mode='idle',audioEpoch=0,pending=false,freq=new Uint8Array(1024),pitchSpectrum=new Float32Array(1024),wave=new Uint8Array(2048),rawBands=new Float32Array(48),bandEnvelope=new Float32Array(48),bands=new Float32Array(48),rms=0,bass=0,mid=0,high=0,rawBass=0,rawMid=0,rawHigh=0,bassBed=0,highBed=0,bassFlux=0,highFlux=0,impact=0,analysisLast=0,mean=0,lastBeat=-10,clock=0,last=0,uiTime=0,traceTime=0;
let traceHistory=[],capturedTrace=[],captureActive=false;
let beat={energy:0,mean:0,deviation:0,last:-Infinity,sampledAt:-Infinity,bpms:[],bpm:0,confidence:0,pulse:0,tempo:0};
let melody={pitch:.5,raw:.5,strength:0,glide:0,vocal:0,confidence:0,history:[]},bassPosition=.5,vocalPosition=.5;
let audioActive=false,audioActivity=0,audioLoudness=0;const floatWave=new Float32Array(2048);
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));const message=t=>$('message').textContent=t;
function refresh(){const select=$('fixture');select.replaceChildren(...fixtures.map((f,i)=>new Option(f.name,String(i))));select.value=String(selected);const f=fixtures[selected];$('name').value=f.name;$('count').value=f.count;selectedNode=0;drawStripOutput();}
refresh();$('fixture').onchange=()=>{selected=+$('fixture').value;refresh()};$('name').oninput=()=>{fixtures[selected].name=$('name').value||'Untitled path';$('fixture').options[selected].text=fixtures[selected].name};$('count').onchange=()=>{fixtures[selected].count=Math.round(clamp(+$('count').value||2,2,1000));$('count').value=fixtures[selected].count};$('add').onclick=()=>{if(fixtures.length>=16)return message('Maximum 16 preview paths.');fixtures.push({name:`Strip ${fixtures.length+1}`,count:60,points:[[.2,.5],[.8,.5]]});selected=fixtures.length-1;refresh()};$('remove').onclick=()=>{if(fixtures.length===1)return message('Keep at least one path.');fixtures.splice(selected,1);selected=Math.max(0,selected-1);refresh()};$('reverse').onclick=()=>{fixtures[selected].points.reverse();message('LED order reversed. The first node is LED 0.');};$('node').onclick=()=>{const p=fixtures[selected].points;if(p.length>=32)return message('Maximum 32 points per path.');const a=p[p.length-2],b=p[p.length-1];p.splice(p.length-1,0,[(a[0]+b[0])/2,(a[1]+b[1])/2]);selectedNode=p.length-2;};
function pos(e){const r=canvas.getBoundingClientRect();return[(e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height]}
canvas.onpointerdown=e=>{if(!$('overlay').checked)return;const p=pos(e),r=canvas.getBoundingClientRect();let best=22,hit=null;fixtures.forEach((f,fi)=>f.points.forEach((n,ni)=>{const d=Math.hypot((p[0]-n[0])*r.width,(p[1]-n[1])*r.height);if(d<best){best=d;hit=[fi,ni]}}));if(hit){selected=hit[0];refresh();selectedNode=hit[1];drag=hit;canvas.setPointerCapture(e.pointerId);canvas.focus();}};
canvas.onpointermove=e=>{if(!drag)return;fixtures[drag[0]].points[drag[1]]=pos(e).map(v=>clamp(v));};canvas.onpointerup=canvas.onpointercancel=()=>drag=null;
canvas.onkeydown=e=>{const keys={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(keys[e.key]){e.preventDefault();const p=fixtures[selected].points[selectedNode],d=keys[e.key],step=e.shiftKey?.01:.002;p[0]=clamp(p[0]+d[0]*step);p[1]=clamp(p[1]+d[1]*step)}};
for(const id of ['gain','smooth','speed','brightness','noise'])$(id).oninput=()=>{$(id+'Value').value=id==='noise'?$(id).value+' dBFS':id==='brightness'?Math.round(+$(id).value*100)+'%':id==='smooth'?(+$(id).value).toFixed(2)+' s':(+$(id).value).toFixed(2)+'×';};
function renderMasterBindings(){
 for(const key of ['smooth','speed']){const select=$(key+'Bind'),source=masterBindings[key]||'none';select.value=source;const bound=source!=='none',label=bound?SupaModulation.sources[source].label:'Manual baseline';$(key+'Master').classList.toggle('master-control--bound',bound);$(key+'BindState').textContent=bound?`AUDIO BOUND · ${label}`:'MANUAL';}
}
function setupMasterBindings(){
 const options=[new Option('Manual baseline (no audio binding)','none'),...Object.entries(SupaModulation.sources).filter(([key])=>key!=='custom').map(([key,value])=>new Option(value.label,key))];
 for(const key of ['smooth','speed']){$(key+'Bind').replaceChildren(...options.map(option=>new Option(option.text,option.value)));$(key+'Bind').onchange=()=>{masterBindings[key]=$(key+'Bind').value;renderMasterBindings();persist();};}
 renderMasterBindings();
}
function applyMasterBindings(features){
 for(const key of ['smooth','speed']){const base=+$(key).value,source=masterBindings[key];const drive=source&&source!=='none'?SupaModulation.read(source,bands,features):0;masterValues[key]=key==='smooth'?clamp(base+drive*(2-base),0,2):clamp(base+drive,0,1);}
}
setupMasterBindings();
function busy(v){pending=v;for(const id of ['connect','share','devices','openAudio'])$(id).disabled=v;}
let mediaURL=null;
function resetBeat(){beat={energy:0,mean:0,deviation:0,last:-Infinity,sampledAt:-Infinity,bpms:[],bpm:0,confidence:0,pulse:0,tempo:0};lastBeat=-10;}
function cleanup(){audioEpoch++;$('player').pause();$('player').removeAttribute('src');$('player').classList.add('hidden');const oldPlayer=$('player');oldPlayer.replaceWith(oldPlayer.cloneNode(false));if(mediaURL){URL.revokeObjectURL(mediaURL);mediaURL=null;}resetBeat();resetEngines();melody={pitch:.5,raw:.5,strength:0,glide:0,vocal:0,confidence:0,history:[]};audioActive=false;audioActivity=0;audioLoudness=0;routeStates=[];if(stream){for(const t of stream.getTracks()){t.onended=null;t.stop()}}stream=null;if(source)source.disconnect();if(zero)zero.disconnect();if(audio)audio.close().catch(()=>{});audio=null;analyser=null;source=null;zero=null;freq.fill(0);pitchSpectrum.fill(0);wave.fill(128);rawBands.fill(0);bandEnvelope.fill(0);bands.fill(0);analysisLast=0;impact=bassBed=highBed=bassFlux=highFlux=0;mean=0;rms=bass=mid=high=rawBass=rawMid=rawHigh=0;}
function stop(){cleanup();mode='idle';$('status').textContent='STOPPED · NO LIVE AUDIO';$('audioMessage').textContent='Audio stopped. Choose a source to resume.';}
$('stop').onclick=stop;$('demo').onclick=()=>{cleanup();mode='demo';$('status').textContent='DEMO SIGNAL · NO LIVE AUDIO';audioMessage('Synthetic test signal, with a silent pause every 8 seconds. Connect an input for real audio.');};
async function enumerate(){const devices=await navigator.mediaDevices.enumerateDevices();const previous=$('input').value;$('input').replaceChildren(new Option('Default microphone / input',''),...devices.filter(d=>d.kind==='audioinput').map((d,i)=>new Option(d.label||`Audio input ${i+1}`,d.deviceId)));if([...$('input').options].some(o=>o.value===previous))$('input').value=previous;}
$('devices').onclick=async()=>{busy(true);let permission;try{permission=await navigator.mediaDevices.getUserMedia({audio:true});await enumerate();audioMessage('Choose BlackHole for Mac playback, or another input.');}catch(e){audioMessage(`Cannot list inputs: ${e.message}. Check browser and macOS audio permissions.`)}finally{permission?.getTracks().forEach(t=>t.stop());busy(false)}};
async function connect(shared){if(pending)return;stop();const token=audioEpoch;busy(true);let incoming;try{if(!navigator.mediaDevices)throw Error('Audio capture needs Chrome on localhost or a secure page.');incoming=shared?await navigator.mediaDevices.getDisplayMedia({video:true,audio:true,systemAudio:'include'}):await navigator.mediaDevices.getUserMedia({audio:{deviceId:$('input').value?{exact:$('input').value}:undefined,echoCancellation:false,noiseSuppression:false,autoGainControl:false}});if(token!==audioEpoch){incoming.getTracks().forEach(t=>t.stop());return}if(!incoming.getAudioTracks().length)throw Error('No audio track was shared. Try BlackHole or share a tab with audio enabled.');stream=incoming;audio=new AudioContext();await audio.resume();if(token!==audioEpoch)return;analyser=audio.createAnalyser();analyser.fftSize=2048;analyser.minDecibels=-100;analyser.maxDecibels=-10;analyser.smoothingTimeConstant=.05;source=audio.createMediaStreamSource(stream);zero=audio.createGain();zero.gain.value=0;source.connect(analyser);analyser.connect(zero);zero.connect(audio.destination);mode='live';for(const t of stream.getTracks())t.onended=()=>{stop();audioMessage('Capture ended. Connect an input to resume.');};$('status').textContent='LIVE · '+stream.getAudioTracks()[0].label;audioMessage('Connected. Play music; the meters should move. If silent, check audio routing.');await enumerate();}catch(e){incoming?.getTracks().forEach(t=>t.stop());if(token===audioEpoch){stop();audioMessage(e.message);}}finally{busy(false)}}
$('connect').onclick=()=>connect(false);$('share').onclick=()=>connect(true);
function band(lo,hi){const bin=audio.sampleRate/2048;let sum=0,n=0;for(let i=Math.max(1,Math.floor(lo/bin));i<Math.min(freq.length,Math.ceil(hi/bin));i++){sum+=freq[i]/255;n++;}return n?sum/n:0;}
function median(values){const sorted=[...values].sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;}
function trackBeat(t,bassInput=bass,midInput=mid){
 if(!audioActive){resetBeat();return;}
 const updatePulse=()=>{beat.pulse=Number.isFinite(beat.last)?Math.exp(-Math.max(0,t-beat.last)*9):0;if(beat.bpm>0&&Number.isFinite(beat.last)){const phase=((t-beat.last)/(60/beat.bpm)%1+1)%1;beat.tempo=Math.pow(1-phase,2)*beat.confidence;}else beat.tempo=0;};
 if(t-beat.sampledAt<.045){updatePulse();return;}beat.sampledAt=t;
 const energy=clamp(bassInput*.72+midInput*.28),rise=energy-beat.energy;
 beat.mean+=(energy-beat.mean)*.018;beat.deviation+=(Math.abs(energy-beat.mean)-beat.deviation)*.035;
 const threshold=Math.max(.14,beat.mean+beat.deviation*.6),candidate=energy>threshold&&rise>.004&&t-beat.last>.33;
 if(candidate){
  if(Number.isFinite(beat.last)){
   let bpm=60/(t-beat.last);while(bpm<70)bpm*=2;while(bpm>180)bpm/=2;
   beat.bpms.push(bpm);if(beat.bpms.length>8)beat.bpms.shift();
   const center=median(beat.bpms),spread=median(beat.bpms.map(value=>Math.abs(value-center)));
   beat.bpm=beat.bpm?beat.bpm*.7+center*.3:center;beat.confidence=clamp((beat.bpms.length-1)/4)*clamp(1-spread/Math.max(center*.12,1));
  }
  beat.last=t;lastBeat=t;
 }
 beat.energy=energy;updatePulse();
}
function trackMelody(dt){
 if(!audioActive){melody.strength=melody.glide=melody.vocal=melody.confidence=0;melody.history=[];return;}
 const rate=audio?.sampleRate||44100,binHz=rate/2048,pitchNorm=hz=>clamp(Math.log2(hz/130)/Math.log2(1400/130)),amplitude=hz=>{const index=clamp(Math.round(hz/binHz),4,pitchSpectrum.length-5),value=pitchSpectrum[index];let local=0;for(let i=index-3;i<=index+3;i++)if(i!==index)local+=pitchSpectrum[i];local/=6;return clamp(value*.24+Math.max(0,value-local*.72)*1.35);};let best=0,total=0,bestHz=0;
 for(let note=48;note<=88;note+=.25){const hz=440*Math.pow(2,(note-69)/12),continuity=Math.exp(-Math.pow((pitchNorm(hz)-melody.pitch)*9,2)/10),score=(amplitude(hz)*.12+amplitude(hz*2)*.4+amplitude(hz*3)*.3+amplitude(hz*4)*.18)*(1+continuity*.22);total+=score;if(score>best){best=score;bestHz=hz;}}
 let confidence=clamp((best/(total/161+1e-4)-1)/2.4)*clamp(best/.08),raw=pitchNorm(bestHz);const semitones=Math.abs(raw-melody.pitch)*12;
 if(semitones>5&&confidence<.44){raw=melody.pitch;confidence*=.45;}if(confidence>.12){melody.history.push(raw);if(melody.history.length>9)melody.history.shift();raw=median(melody.history);}const previous=melody.pitch;melody.raw=raw;melody.confidence+=(confidence-melody.confidence)*(1-Math.exp(-dt/.26));const target=melody.confidence>.12?raw:melody.pitch;melody.pitch+=(target-melody.pitch)*(1-Math.exp(-dt/(target>melody.pitch?.16:.32)));melody.glide+= (clamp(Math.abs(melody.pitch-previous)/Math.max(dt,.016)*.18)-melody.glide)*(1-Math.exp(-dt/.16));melody.strength=clamp(melody.confidence*(.35+mid*.65));melody.vocal=clamp(melody.strength*(.4+mid*.75-high*.15));
}
function analyze(t){
 const gain=+$('gain').value;
 if((mode==='live'||mode==='file')&&analyser&&!(mode==='file'&&$('player').paused)){
  analyser.getByteFrequencyData(freq);analyser.getFloatTimeDomainData(floatWave);
  // Remove DC before measuring the noise gate; byte waveforms lose quiet audio.
  let dc=0;for(const v of floatWave)dc+=v;dc/=floatWave.length;
  let sum=0;for(let i=0;i<floatWave.length;i++){const v=floatWave[i]-dc;sum+=v*v;wave[i]=Math.round(clamp(128+v*128,0,255));}rms=Math.sqrt(sum/floatWave.length);
  for(let i=0;i<floatWave.length;i++)wave[i]=Math.round(clamp(128+(floatWave[i]-dc)/Math.max(.002,rms*3)*100,0,255));
  const raw=Array.from({length:48},(_,i)=>band(30*Math.pow(400,i/48),30*Math.pow(400,(i+1)/48)));
  const result=SupaModulation.condition(raw,rms,+$('noise').value,gain);audioActive=result.active;audioActivity=result.activity;audioLoudness=audioActive?clamp((20*Math.log10(rms)-+$('noise').value)/36):0;rawBands.set(result.bands);
 }else if(mode==='demo'){
  // Explicit test signal includes silence so audio-only behavior is easy to inspect.
 const quiet=t%8>6;const kick=.08+.6*Math.exp(-((t*2)%1)*9);
 const raw=Array.from({length:48},(_,i)=>(.15+.13*Math.sin(i*.45+t*2))*Math.exp(-i/70)+kick*.4*Math.exp(-i/9));
 rms=quiet?0:.03+kick*.1;const result=SupaModulation.condition(raw,rms,+$('noise').value,gain);audioActive=result.active;audioActivity=result.activity;audioLoudness=audioActive?clamp((20*Math.log10(rms)-+$('noise').value)/36):0;rawBands.set(result.bands);
 const leadHz=220*Math.pow(2,.32*Math.sin(t*.55)+.12*Math.sin(t*1.7));for(let i=0;i<freq.length;i++){const hz=i*44100/2048,low=kick*Math.exp(-hz/260),body=(.16+.09*Math.sin(t*2+hz*.003))*Math.exp(-hz/4200),air=.08*Math.max(0,Math.sin(t*5+hz*.009))*Math.exp(-hz/12000),lead=.34*Math.exp(-Math.pow(Math.log(Math.max(1,hz)/leadHz),2)*110)+.22*Math.exp(-Math.pow(Math.log(Math.max(1,hz)/(leadHz*2)),2)*150)+.12*Math.exp(-Math.pow(Math.log(Math.max(1,hz)/(leadHz*3)),2)*170);freq[i]=quiet?0:Math.round(clamp(low+body+air+lead)*255);}
 for(let i=0;i<wave.length;i++)wave[i]=quiet?128:128+Math.sin(i*.045+t*4)*rms*100;
 }else{rms=0;rawBands.fill(0);bandEnvelope.fill(0);bands.fill(0);wave.fill(128);audioActive=false;audioActivity=0;audioLoudness=0;}
 const starting=!analysisLast,dt=analysisLast?Math.min(.1,Math.max(.001,t-analysisLast)):.016;analysisLast=t;
 if(audioActive){for(let i=0;i<48;i++){const target=rawBands[i],tau=target>bandEnvelope[i]?.025:.18;bandEnvelope[i]+=(target-bandEnvelope[i])*(1-Math.exp(-dt/tau));bands[i]=bandEnvelope[i];}for(let i=0;i<pitchSpectrum.length;i++){const raw=freq[i]/255,target=Math.log1p(raw*24)/Math.log(25),tau=target>pitchSpectrum[i]?.045:.2;pitchSpectrum[i]+=(target-pitchSpectrum[i])*(1-Math.exp(-dt/tau));}}else{bands.fill(0);pitchSpectrum.fill(0);}
 const avg=(values,lo,hi)=>{let total=0,n=0;for(let i=0;i<48;i++)if(SupaModulation.frequency(i)>=lo&&SupaModulation.frequency(i)<hi){total+=values[i];n++;}return n?total/n:0;};
 rawBass=avg(rawBands,30,250);rawMid=avg(rawBands,250,2000);rawHigh=avg(rawBands,2000,12001);bass=avg(bands,30,250);mid=avg(bands,250,2000);high=avg(bands,2000,12001);
 const centroid=(low,high,fallback)=>{let weighted=0,total=0;for(let i=0;i<48;i++){const hz=SupaModulation.frequency(i);if(hz>=low&&hz<high){const weight=bands[i]*bands[i];weighted+=weight*Math.log(hz/low)/Math.log(high/low);total+=weight;}}return total>.001?weighted/total:fallback;};const bassTarget=centroid(30,250,bassPosition),vocalTarget=centroid(300,1100,vocalPosition);bassPosition+=(bassTarget-bassPosition)*(1-Math.exp(-dt/.22));vocalPosition+=(vocalTarget-vocalPosition)*(1-Math.exp(-dt/.28));
 if(starting){bassBed=rawBass;highBed=rawHigh;}const bedMix=1-Math.exp(-dt/.7);bassBed+=(rawBass-bassBed)*bedMix;highBed+=(rawHigh-highBed)*bedMix;bassFlux=clamp((rawBass-bassBed)/.16);highFlux=clamp((rawHigh-highBed)/.12);
 mean=mean*.97+bass*.03;trackBeat(t,rawBass,rawMid);trackMelody(dt);const impactTarget=audioActive?clamp(bassFlux*.72+highFlux*.28+beat.pulse*.72):0,impactTau=impactTarget>impact?.012:.12;impact+=(impactTarget-impact)*(1-Math.exp(-dt/impactTau));
}

function rgb(h,s,v){h=((h%360)+360)%360/60;const c=v*s,x=c*(1-Math.abs(h%2-1)),m=v-c;const a=h<1?[c,x,0]:h<2?[x,c,0]:h<3?[0,c,x]:h<4?[0,x,c]:h<5?[x,0,c]:[c,0,x];return a.map(q=>Math.round((q+m)*255));}
const fade=x=>x*x*(3-2*x),hash=(x,y,z)=>{const n=Math.sin(x*127.1+y*311.7+z*74.7)*43758.5453123;return n-Math.floor(n);};
function noise(x,y,z){const ix=Math.floor(x),iy=Math.floor(y),fx=fade(x-ix),fy=fade(y-iy),a=hash(ix,iy,z),b=hash(ix+1,iy,z),c=hash(ix,iy+1,z),d=hash(ix+1,iy+1,z);return (a+(b-a)*fx)*(1-fy)+(c+(d-c)*fx)*fy;}
function flow(x,y,z){let value=0,weight=.55;for(let octave=0;octave<3;octave++){value+=noise(x,y,z+octave*17)*weight;x=x*2.03+7.1;y=y*2.03-3.7;weight*=.5;}return value/.9625;}
function resetEngines(){flowMemory.fill(0);flowNext.fill(0);reactionA.fill(1);reactionB.fill(0);reactionNextA.fill(1);reactionNextB.fill(0);wavePrevious.fill(0);waveCurrent.fill(0);waveNext.fill(0);organicLow.fill(0);organicHigh.fill(0);organicLowNext.fill(0);organicHighNext.fill(0);melodyField.fill(0);melodyNext.fill(0);vocalField.fill(0);vocalNext.fill(0);spectrumField.fill(0);spectrumNext.fill(0);spectrumHeight.fill(0);visualPixels.fill(0);organicParticles=[];organicBassCarry=organicHighCarry=currentCarry=bloomCarry=pulseCarry=0;organicLastBeat=engineLastBeat=-Infinity;organicSeed=engineSeed=0;}
function stateAt(buffer,u,v){const x=Math.round(clamp(u)*(simW-1)),y=Math.round(clamp(v)*(simH-1));return buffer[y*simW+x];}
function stateCell(buffer,x,y){return buffer[clamp(y,0,simH-1)*simW+clamp(x,0,simW-1)];}
function spawnOrganic(kind,strength){
 const seed=organicSeed++,large=kind==='bass',x=.12+hash(seed,17,3)*.76,y=.14+hash(seed,29,7)*.72;
 organicParticles.push({kind,x,y,vx:(hash(seed,43,11)-.5)*.12,vy:(hash(seed,59,13)-.5)*.1,radius:(large?.07:.035)+(large?.12:.06)*strength,life:large?2.8:1.45,energy:.38+strength*.62});
 if(organicParticles.length>36)organicParticles.shift();
}
function advanceOrganicField(dt,step,drive,transient,mode='organic'){
 const tempoRate=tempoMotion()+modulation.speed,embers=mode==='embers';
 if(!embers)organicBassCarry+=dt*Math.pow(bass,1.25)*(.55+tempoRate*.25)*modulation.blobs;organicHighCarry+=dt*Math.pow(high,1.18)*(.38+tempoRate*.2)*(.2+modulation.blobs*.8);
 if(lastBeat>organicLastBeat){organicLastBeat=lastBeat;if(!embers&&bass>.08&&modulation.blobs>.03)spawnOrganic('bass',clamp(bass+transient*.45));if(high>.09&&modulation.blobs>.03)spawnOrganic('high',clamp(high+transient*.3));}
 while(!embers&&organicBassCarry>=1){spawnOrganic('bass',bass);organicBassCarry-=1;}
 while(organicHighCarry>=1){spawnOrganic('high',high);organicHighCarry-=1;}
 for(let y=0;y<simH;y++)for(let x=0;x<simW;x++){
  const i=y*simW+x,u=x/(simW-1),v=y/(simH-1),vx=noise(u*2.1+clock*.06,v*2.1,71)-.5,vy=noise(u*2.1,v*2.1-clock*.055,79)-.5;
  const fromX=clamp(Math.round(x-vx*step*simW*.42*tempoRate),0,simW-1),fromY=clamp(Math.round(y-vy*step*simH*.42*tempoRate),0,simH-1),from=fromY*simW+fromX;
  organicLowNext[i]=organicLow[from]*(.965-step*.02);organicHighNext[i]=organicHigh[from]*(.93-step*.04);
 }
 organicParticles=organicParticles.filter(p=>{
  if(embers&&p.kind==='bass')return false;p.life-=dt;p.vx+=(noise(p.x*4+clock*.07,p.y*4,91)-.5)*dt*.05*tempoRate;p.vy+=(noise(p.x*4,p.y*4-clock*.06,97)-.5)*dt*.05*tempoRate;p.vx*=.992;p.vy*=.992;p.x=(p.x+p.vx*tempoRate*dt+1)%1;p.y=(p.y+p.vy*tempoRate*dt+1)%1;
  const radius=p.radius*(1+modulation.size*.25+modulation.blobs*.08),minX=Math.max(0,Math.floor((p.x-radius)*(simW-1))),maxX=Math.min(simW-1,Math.ceil((p.x+radius)*(simW-1))),minY=Math.max(0,Math.floor((p.y-radius)*(simH-1))),maxY=Math.min(simH-1,Math.ceil((p.y+radius)*(simH-1))),level=p.energy*clamp(p.life/(p.kind==='bass'?2.8:1.45));
  for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){const d2=((x/(simW-1)-p.x)/radius)**2+((y/(simH-1)-p.y)/radius)**2,amount=Math.exp(-d2*2.3)*level*step;if(p.kind==='bass')organicLowNext[y*simW+x]=clamp(organicLowNext[y*simW+x]+amount*.72);else organicHighNext[y*simW+x]=clamp(organicHighNext[y*simW+x]+amount);}
  return p.life>0;
 });
 [organicLow,organicLowNext]=[organicLowNext,organicLow];[organicHigh,organicHighNext]=[organicHighNext,organicHigh];
}
function tempoMotion(){return beat.confidence>.18?clamp(beat.bpm/120,.55,1.7):0;}
function injectState(buffer,x,y,radius,amount){
 const minX=Math.max(0,Math.floor((x-radius)*(simW-1))),maxX=Math.min(simW-1,Math.ceil((x+radius)*(simW-1))),minY=Math.max(0,Math.floor((y-radius)*(simH-1))),maxY=Math.min(simH-1,Math.ceil((y+radius)*(simH-1)));
 for(let iy=minY;iy<=maxY;iy++)for(let ix=minX;ix<=maxX;ix++){const dx=(ix/(simW-1)-x)/radius,dy=(iy/(simH-1)-y)/radius;buffer[iy*simW+ix]=clamp(buffer[iy*simW+ix]+Math.exp(-(dx*dx+dy*dy)*2.4)*amount);}
}
function nextEnginePoint(){const seed=engineSeed++;return [.1+hash(seed,113,5)*.8,.12+hash(seed,127,9)*.76];}
function advanceCurrents(dt,motion,drive,transient){
 const step=clamp(dt*20,.15,1);
 for(let y=0;y<simH;y++)for(let x=0;x<simW;x++){const i=y*simW+x,u=x/(simW-1),v=y/(simH-1),vx=noise(u*2.1+clock*.06,v*2.1,31)-.5,vy=noise(u*2.1,v*2.1-clock*.05,37)-.5,fromX=clamp(Math.round(x-vx*step*simW*.55*motion),0,simW-1),fromY=clamp(Math.round(y-vy*step*simH*.55*motion),0,simH-1);flowNext[i]=flowMemory[fromY*simW+fromX]*(.962-step*.02);}
 currentCarry+=dt*(bass*.7+mid*.45+high*.25)*modulation.blobs;if(lastBeat>engineLastBeat){engineLastBeat=lastBeat;currentCarry+=(.35+transient)*modulation.blobs;}
 while(currentCarry>=1){const [x,y]=nextEnginePoint();injectState(flowNext,x,y,.045+(.09+bass*.08)*(1+modulation.size*.18),.5+drive*.6);currentCarry-=1;}
 [flowMemory,flowNext]=[flowNext,flowMemory];
}
function advanceBloom(dt,motion,drive,transient){
 const step=clamp(dt*18*motion,0,1);
 for(let y=0;y<simH;y++)for(let x=0;x<simW;x++){const i=y*simW+x,a=reactionA[i],b=reactionB[i],lapA=stateCell(reactionA,x-1,y)*.2+stateCell(reactionA,x+1,y)*.2+stateCell(reactionA,x,y-1)*.2+stateCell(reactionA,x,y+1)*.2+stateCell(reactionA,x-1,y-1)*.05+stateCell(reactionA,x+1,y-1)*.05+stateCell(reactionA,x-1,y+1)*.05+stateCell(reactionA,x+1,y+1)*.05-a,lapB=stateCell(reactionB,x-1,y)*.2+stateCell(reactionB,x+1,y)*.2+stateCell(reactionB,x,y-1)*.2+stateCell(reactionB,x,y+1)*.2+stateCell(reactionB,x-1,y-1)*.05+stateCell(reactionB,x+1,y-1)*.05+stateCell(reactionB,x-1,y+1)*.05+stateCell(reactionB,x+1,y+1)*.05-b;reactionNextA[i]=clamp(a+(.9*lapA-a*b*b+.036*(1-a))*step);reactionNextB[i]=clamp(b+(.42*lapB+a*b*b-.097*b)*step);}
 bloomCarry+=dt*(bass*.8+mid*.25)*modulation.blobs;if(lastBeat>engineLastBeat){engineLastBeat=lastBeat;bloomCarry+=(.3+transient*.8)*modulation.blobs;}
 while(bloomCarry>=1){const [x,y]=nextEnginePoint();injectState(reactionNextB,x,y,.035+modulation.size*.025,.32+drive*.45);bloomCarry-=1;}
 [reactionA,reactionNextA]=[reactionNextA,reactionA];[reactionB,reactionNextB]=[reactionNextB,reactionB];
}
function advancePulse(dt,motion,drive,transient){
 const step=clamp(dt*22*motion,0,1);
 for(let y=0;y<simH;y++)for(let x=0;x<simW;x++){const i=y*simW+x,lap=stateCell(waveCurrent,x-1,y)+stateCell(waveCurrent,x+1,y)+stateCell(waveCurrent,x,y-1)+stateCell(waveCurrent,x,y+1)-4*waveCurrent[i];waveNext[i]=step?clamp((2*waveCurrent[i]-wavePrevious[i])*.987+lap*.19*step,-1,1):waveCurrent[i]*.985;}
 pulseCarry+=dt*Math.pow(bass,.9)*modulation.blobs;if(lastBeat>engineLastBeat){engineLastBeat=lastBeat;pulseCarry+=(.25+transient)*modulation.blobs;}
 while(pulseCarry>=1){const [x,y]=nextEnginePoint();injectState(waveNext,x,y,.025+modulation.size*.02,.6+drive*.45);pulseCarry-=1;}
 [wavePrevious,waveCurrent,waveNext]=[waveCurrent,waveNext,wavePrevious];
}
function advanceMelody(dt,vocals=false){
 const field=vocals?vocalField:melodyField,next=vocals?vocalNext:melodyNext,drive=vocals?melody.vocal:melody.strength;
 for(let i=0;i<simSize;i++)next[i]=field[i]*Math.exp(-dt/(vocals?1.15:.72));
 if(drive>.025){const y=clamp(1-melody.pitch,.08,.92),x=.5+.32*Math.sin(clock*.9+melody.pitch*7),radius=(vocals?.075:.045)+modulation.size*.025;injectState(next,x,y,radius,drive*(.55+modulation.blobs*.55));if(vocals)injectState(next,1-x,clamp(y+.08*Math.sin(clock+melody.pitch*9),.08,.92),radius*.8,drive*.6);}
 if(vocals)[vocalField,vocalNext]=[vocalNext,vocalField];else [melodyField,melodyNext]=[melodyNext,melodyField];
}
function advanceSpectrum(dt){
 for(let i=0;i<48;i++){const target=Math.pow(bands[i],1.45)*(.2+modulation.blobs*.8),tau=target>spectrumHeight[i]?.045:.34;spectrumHeight[i]+=(target-spectrumHeight[i])*(1-Math.exp(-dt/tau));}
}
function advanceEngines(dt){
 if(!audioActive||dt<=0)return;
 const effect=$('effect').value,motion=tempoMotion()+modulation.speed,drive=clamp(audioLoudness*.55+(bass+mid+high)*.16),transient=clamp(beat.pulse*.9+Math.max(0,bass-mean)*.65),step=clamp(dt*22,.18,1);
 if(effect==='organic'||effect==='embers')advanceOrganicField(dt,step,drive,transient,effect);
 if(effect==='currents')advanceCurrents(dt,motion,drive,transient);
 if(effect==='bloom')advanceBloom(dt,motion,drive,transient);
 if(effect==='pulse')advancePulse(dt,motion,drive,transient);
 if(effect==='melody')advanceMelody(dt);
 if(effect==='vocal')advanceMelody(dt,true);
 if(effect==='spectrum')advanceSpectrum(dt);
}
function render(t){
 const effect=$('effect').value,palette=$('palette').value;
 const bright=clamp(+$('brightness').value*(1+modulation.light));
 const peakIntensity=clamp(audioLoudness*(.18+(modulation.intensity||0)*.82)+impact*.24);
 const energy=clamp(bass*.5+mid*.35+high*.15);
 const phase=clock;
 // Pairings and beat tracking shape the selected field itself; they never add an overlay.
 const detail=1+clamp(modulation.blobs,0,2)*.8;
 const sharp=1+clamp(modulation.peaks,0,2)*2;
 const size=1+clamp(modulation.size,0,2)*.8;
 const beatPush=clamp(beat.pulse*(.25+energy*.75)),tempoPush=clamp(beat.tempo);
 const beatSize=1-beatPush*.16,beatSharp=sharp*(1+beatPush*.42);
 const organic=effect==='organic'||effect==='embers';
 for(let y=0;y<135;y++)for(let x=0;x<240;x++){
  const u=x/239,v=y/134,dx=(u-.5)*1.777,dy=v-.5,r=Math.hypot(dx,dy),angle=Math.atan2(dy,dx),grain=organic?0:flow(u*detail*2.6+phase*.09,v*detail*2.6+phase*.053,.7)-.5;
  const warpX=organic?0:noise(dx*detail*2.1+phase*.075,dy*detail*2.1-phase*.04,6.1)-.5,warpY=organic?0:noise(dx*detail*2.1-phase*.052,dy*detail*2.1+phase*.068,9.4)-.5;
  const warpedR=(r+grain*.16*size+beatPush*.026)*beatSize;
  let profile=0,hue=0,emission=1;
  if(effect==='generative'){
   const a=flow((dx+warpX*.24)*detail*2.5/(size*beatSize)+phase*.08,(dy+warpY*.24)*detail*2.5/(size*beatSize)+phase*.045,.2),b=flow((dx-warpY*.15)*detail*5.1/size-phase*.035,(dy+warpX*.15)*detail*5.1/size+phase*.07,1.3);
   const contour=.76-Math.abs(a-.5)*.85+(b-.5)*.42+grain*.26;
   profile=Math.pow(clamp(contour),beatSharp*1.25);hue=a-b*.7+grain*.7+tempoPush*.12;
  }
  if(effect==='aurora'){
   const ridge=.5+.14*Math.sin(u*6*detail+phase*.43+warpY*2)+.08*Math.sin(u*15*detail-phase*.24)+grain*.16+beatPush*(.035+Math.sin(u*9)*.018);
   const folds=.7+.3*flow(u*detail*4+phase*.05,v*detail*2,3.2);
   profile=Math.exp(-Math.abs(v-ridge)*(15-8*mid)*beatSharp/size)*folds;hue=u*.7+v*.3+phase*.04+grain*.18;
  }
  if(effect==='radial'){
   const spokes=.42+.58*(.5+.5*Math.cos(angle*(4+detail*3)+warpX*5+phase*.22));
   profile=Math.pow(clamp(.5+.5*Math.cos(warpedR*30*detail/size-phase*2.2))*spokes,2.4*beatSharp);hue=warpedR+angle*.08+phase*.04;
  }
  if(effect==='spectrum'){const band=clamp(u*47+(Math.sin(clock*.45+u*13)*.55+(u<.24?bassPosition-.5:u>.24&&u<.62?vocalPosition-.5:0))*1.2,0,47),left=Math.floor(band),right=Math.min(47,left+1),mix=band-left,height=(spectrumHeight[left]*(1-mix)+spectrumHeight[right]*mix)*(.16+peakIntensity*.84)*size,top=1-clamp(height,0,.92),column=Math.pow(Math.sin(Math.PI*(band%1)),.28),water=1+.045*Math.sin(v*22+clock*.7+band*.9)+.024*(noise(u*8, v*8+clock*.08,211)-.5);profile=v>=top?Math.pow(clamp((v-top)/Math.max(height,.001)),.32*beatSharp)*column*water:0;hue=.58+u*.38+Math.sin(band*.4)*.05;emission=1+height*.9;}
  if(effect==='tunnel'){
   const winding=angle*(4.2+detail*1.6)+Math.sin(angle*3+phase*.14)*(detail-1)*1.6+warpX*2;
   const tunnel=Math.sin(warpedR*35/size+winding-phase*1.8);
   profile=Math.pow(.5+.5*tunnel,2.8*beatSharp)*(.55+.45*(1-clamp(r/.9)));hue=angle/6.28+warpedR*.2+phase*.04;
  }
  if(effect==='plasma'){
   const a=flow((u+warpX*.18)*detail*4/(size*beatSize)+phase*.09,(v+warpY*.18)*detail*4/(size*beatSize)+phase*.04,.4),b=flow((u-warpY*.15)*detail*7/size-phase*.05,(v+warpX*.15)*detail*7/size+phase*.07,2),c=flow(warpedR*detail*9/size+phase*.06,angle*.7+warpY,3.6);
   hue=a-b+c+phase*.025;profile=Math.pow(clamp((a*.44+b*.34+c*.22)+grain*.16),beatSharp*.92);
  }
  if(effect==='orbit'){
   const petals=.5+.5*Math.sin(angle*(3+Math.round(detail*2))+phase*.22+warpX*2);
   const lobe=flow(angle*detail*.95+phase*.04,r*5+phase*.07,5)*2-1;
   const edge=(.18+.105*petals+Math.sign(lobe)*Math.pow(Math.abs(lobe),beatSharp)*.045*detail+bass*.07+beatPush*.035)*size;
   profile=Math.exp(-Math.abs(r-edge)*48*beatSharp/size)*(.55+.45*petals);hue=angle/6.28+phase*.05+r+petals*.1;
  }
  if(effect==='rain'){
   const col=Math.floor(u*48),offset=(Math.sin(col*127.1)*43758.5453)%1;
   const dropSpeed=.1+bands[col]*.42+energy*.12,head=((phase*dropSpeed+offset)%1+1)%1,tail=((head-v)%1+1)%1;
   const width=clamp(.45*detail,.1,.95);
   profile=Math.exp(-tail*18*beatSharp/size)*bands[col]*(u*48%1<width?1:.04);hue=col/48+v*.2+grain*.08;
  }
  if(effect==='wave'){
   const idx=Math.floor(u*(wave.length-1));
   const amplitude=(wave[idx]-128)/128;
   const shaped=Math.tanh(amplitude*detail)/Math.tanh(detail);
   const wy=.5+shaped*gainValue()*size*beatSize+grain*.035;
   profile=Math.exp(-Math.abs(v-wy)*52*beatSharp/size)*(.72+.28*flow(u*detail*6+phase*.08,v*3,8.2));hue=u*.7+phase*.04+grain*.12;
  }
  if(effect==='organic'){
   const low=stateAt(organicLow,u,v),highEnergy=stateAt(organicHigh,u,v);
   profile=Math.pow(clamp(low*.88+highEnergy*1.3),beatSharp*.72);hue=.04+low*.22+highEnergy*.62;emission=1+highEnergy*1.35;
  }
  if(effect==='embers'){
   const highEnergy=stateAt(organicHigh,u,v);
   profile=Math.pow(clamp(highEnergy*1.45),beatSharp*.78);hue=.45+highEnergy*.48;emission=1+highEnergy*1.8;
  }
  if(effect==='currents'){
   const memory=stateAt(flowMemory,u,v);
   profile=Math.pow(clamp(memory*1.55),beatSharp*.82);hue=.3+memory*.45+tempoPush*.12;emission=1+memory*.65;
  }
  if(effect==='bloom'){
   const chemical=stateAt(reactionB,u,v);
   profile=Math.pow(clamp(chemical*1.7),beatSharp*.7);hue=.12+chemical*.65+tempoPush*.1;emission=1+chemical*.55;
  }
  if(effect==='pulse'){
   const ripple=stateAt(waveCurrent,u,v),crest=Math.pow(clamp(Math.abs(ripple)*2.4),beatSharp*.7);
   profile=crest;hue=.55+ripple*.35+phase*.025;emission=1+crest*.65;
  }
  if(effect==='melody'){const line=stateAt(melodyField,u,v);profile=Math.pow(clamp(line*1.5),beatSharp*.7);hue=.48+melody.pitch*.38+u*.12;emission=1+line*(.8+melody.glide);}
  if(effect==='vocal'){const halo=stateAt(vocalField,u,v);profile=Math.pow(clamp(halo*1.45),beatSharp*.75);hue=.72+melody.pitch*.22+v*.12;emission=1+halo*1.1;}
  const value=clamp(profile)*Math.sqrt(energy)*(.08+peakIntensity*.92)*emission;
  const h=palette==='fire'?5+clamp(hue)*48:palette==='ice'?180+Math.sin(hue*4)*35:palette==='candy'?280+Math.sin(hue*5)*55:155+((hue%1+1)%1)*150;
  const color=rgb(h+modulation.hue*150,.76,value*bright),o=(y*240+x)*4,decay=masterValues.smooth>0?Math.exp(-renderDt/masterValues.smooth):0;
  visualPixels[o]=Math.max(color[0],visualPixels[o]*decay);visualPixels[o+1]=Math.max(color[1],visualPixels[o+1]*decay);visualPixels[o+2]=Math.max(color[2],visualPixels[o+2]*decay);visualPixels[o+3]=255;
  pixels.data[o]=visualPixels[o];pixels.data[o+1]=visualPixels[o+1];pixels.data[o+2]=visualPixels[o+2];pixels.data[o+3]=255;
 }
 fc.putImageData(pixels,0,0);present();
}
function present(){ctx.fillStyle='#030407';ctx.fillRect(0,0,960,540);if(!$('ledOnly').checked){ctx.imageSmoothingEnabled=true;ctx.drawImage(field,0,0,960,540)}if($('overlay').checked||$('ledOnly').checked)drawPaths();drawStripOutput();}
function gainValue(){return +$('gain').value*.6;}
function samplePath(points,n){const lengths=[];let total=0;for(let i=1;i<points.length;i++){total+=Math.hypot((points[i][0]-points[i-1][0])*960,(points[i][1]-points[i-1][1])*540);lengths.push(total)}const samples=[];for(let k=0;k<n;k++){const d=total*k/(n-1);let seg=lengths.findIndex(v=>v>=d);if(seg<0)seg=lengths.length-1;const prev=seg?lengths[seg-1]:0,f=(d-prev)/(lengths[seg]-prev||1);samples.push([points[seg][0]+(points[seg+1][0]-points[seg][0])*f,points[seg][1]+(points[seg+1][1]-points[seg][1])*f])}return samples;}
function drawStripOutput(){
 const width=stripOutput.width,height=stripOutput.height,visible=fixtures.slice(0,4),rows=Math.max(1,visible.length),rowHeight=height/rows,labelWidth=150;
 stripCtx.fillStyle='#05080d';stripCtx.fillRect(0,0,width,height);stripCtx.font='12px system-ui';stripCtx.textBaseline='middle';
 visible.forEach((fixture,index)=>{
  const top=index*rowHeight,center=top+rowHeight/2,selectedRow=index===selected;
  stripCtx.fillStyle=selectedRow?'#b5fa77':'#8b9aaa';stripCtx.fillText(fixture.name.toUpperCase(),14,center-8);
  stripCtx.fillStyle='#6e7e90';stripCtx.fillText(fixture.count+' LEDS',14,center+11);
  const left=labelWidth,right=width-14,barWidth=right-left,segments=Math.max(1,Math.min(fixture.count,180)),samples=samplePath(fixture.points,fixture.count);
  stripCtx.fillStyle=selectedRow?'#b5fa7720':'#ffffff10';stripCtx.fillRect(left,top+8,barWidth,rowHeight-16);
  stripCtx.save();stripCtx.beginPath();stripCtx.rect(left,top+8,barWidth,rowHeight-16);stripCtx.clip();stripCtx.globalCompositeOperation='lighter';
  for(let segment=0;segment<segments;segment++){
   const start=Math.floor(segment*samples.length/segments),end=Math.max(start+1,Math.floor((segment+1)*samples.length/segments));let red=0,green=0,blue=0;
   for(let i=start;i<end;i++){const point=samples[i],x=Math.round(clamp(point[0])*239),y=Math.round(clamp(point[1])*134),offset=(y*240+x)*4;red+=pixels.data[offset];green+=pixels.data[offset+1];blue+=pixels.data[offset+2];}
   const count=end-start,color=`rgb(${Math.round(red/count)},${Math.round(green/count)},${Math.round(blue/count)})`,x=left+segment*barWidth/segments,w=Math.ceil(barWidth/segments)+.5;
   stripCtx.fillStyle=color;stripCtx.shadowColor=color;stripCtx.shadowBlur=12;stripCtx.fillRect(x,top+14,w,rowHeight-28);
  }
  stripCtx.restore();stripCtx.shadowBlur=0;stripCtx.strokeStyle=selectedRow?'#b5fa7770':'#ffffff18';stripCtx.strokeRect(left+.5,top+8,barWidth-1,rowHeight-16);
 });
 $('stripOutputMeta').textContent=fixtures.length+' STRIP'+(fixtures.length===1?'':'S')+(fixtures.length>4?' · SHOWING 4':'')+' · '+fixtures.reduce((total,f)=>total+f.count,0)+' LEDS';
}
function drawPaths(){fixtures.forEach((f,fi)=>{const points=samplePath(f.points,f.count);if($('overlay').checked){ctx.beginPath();f.points.forEach((p,i)=>i?ctx.lineTo(p[0]*960,p[1]*540):ctx.moveTo(p[0]*960,p[1]*540));ctx.strokeStyle=fi===selected?'#ffffff55':'#ffffff22';ctx.lineWidth=1;ctx.stroke()}points.forEach(p=>{const x=Math.round(clamp(p[0])*239),y=Math.round(clamp(p[1])*134),o=(y*240+x)*4;ctx.fillStyle=`rgb(${pixels.data[o]},${pixels.data[o+1]},${pixels.data[o+2]})`;ctx.beginPath();ctx.arc(p[0]*960,p[1]*540,3.4,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#ffffff33';ctx.stroke()});if($('overlay').checked){f.points.forEach((p,ni)=>{ctx.fillStyle=fi===selected&&ni===selectedNode?'#b5fa77':'#fff';ctx.fillRect(p[0]*960-4,p[1]*540-4,8,8)});ctx.font='14px system-ui';ctx.fillStyle='#fff';ctx.fillText(f.name+' · 0',f.points[0][0]*960+10,f.points[0][1]*540-10)}});}
function drawRawSpectrum(){
 const width=960,height=112,minHz=30,maxHz=12000,sampleRate=audio?.sampleRate||44100,barCount=120;
 sc.fillStyle='#05080d';sc.fillRect(0,0,width,height);
 const regions=[[30,250,'#a5f46518'],[250,2000,'#7bc6ff16'],[2000,12000,'#f778ba16']];
 for(const [low,high,color] of regions){const start=Math.log(low/minHz)/Math.log(maxHz/minHz)*width,end=Math.log(high/minHz)/Math.log(maxHz/minHz)*width;sc.fillStyle=color;sc.fillRect(start,0,end-start,height);}
 let peak=0;
 for(let column=0;column<barCount;column++){
  const low=minHz*Math.pow(maxHz/minHz,column/barCount),high=minHz*Math.pow(maxHz/minHz,(column+1)/barCount),start=Math.max(1,Math.floor(low/(sampleRate/2048))),end=Math.min(freq.length-1,Math.ceil(high/(sampleRate/2048)));let value=0;
  for(let bin=start;bin<=end;bin++)value=Math.max(value,freq[bin]/255);peak=Math.max(peak,value);const level=Math.pow(value,.7),x=column*width/barCount,w=Math.ceil(width/barCount)-1,barHeight=level*(height-18);
  sc.fillStyle=low<250?'#a5f465':low<2000?'#7bc6ff':'#f778ba';sc.fillRect(x,height-4-barHeight,w,barHeight);
 }
 sc.fillStyle='#7d8d9e';sc.font='10px system-ui';sc.fillText('30 Hz',8,14);sc.fillText('250 Hz',width*.24,14);sc.fillText('2 kHz',width*.57,14);sc.fillText('12 kHz',width-42,14);
 $('spectrumState').textContent=peak>.02?(audioActive?'RAW FFT · ACTIVE':'RAW FFT · BELOW GATE'):'WAITING FOR INPUT';
}
function drawWaveform(){
 const width=480,height=116;waveCtx.fillStyle='#05080d';waveCtx.fillRect(0,0,width,height);waveCtx.strokeStyle='#53e3f5';waveCtx.lineWidth=1.5;waveCtx.beginPath();for(let x=0;x<width;x++){const index=Math.floor(x/(width-1)*(wave.length-1)),y=height*.5-(wave[index]-128)/128*height*.38;if(x)waveCtx.lineTo(x,y);else waveCtx.moveTo(x,y);}waveCtx.stroke();waveCtx.strokeStyle='#ffffff1c';waveCtx.beginPath();waveCtx.moveTo(0,height*.5);waveCtx.lineTo(width,height*.5);waveCtx.stroke();
}
function drawSpectrogram(){
 const width=spectrogram.width,height=spectrogram.height,sampleRate=audio?.sampleRate||44100; spectrogramCtx.drawImage(spectrogram,1,0,width-1,height,0,0,width-1,height);for(let y=0;y<height;y++){const normalized=1-y/(height-1),hz=30*Math.pow(400,normalized),bin=Math.max(1,Math.min(freq.length-1,Math.round(hz/(sampleRate/2048)))),value=Math.pow(clamp((pitchSpectrum[bin]-.07)/.62),.8),red=Math.round(clamp(value*1.7)*255),green=Math.round(clamp(value*value*2.2)*210),blue=Math.round(clamp(value*.95)*160);spectrogramCtx.fillStyle=`rgb(${red},${green},${blue})`;spectrogramCtx.fillRect(width-1,y,1,1);}spectrogramCtx.fillStyle='#cbd4df';spectrogramCtx.font='9px system-ui';spectrogramCtx.fillText('12 kHz',4,10);spectrogramCtx.fillText('2 kHz',4,height*.32);spectrogramCtx.fillText('250 Hz',4,height*.72);spectrogramCtx.fillText('30 Hz',4,height-5);
}
function recordTrace(t){
 const peak=audioActive?clamp(audioLoudness*(.18+(modulation.intensity||0)*.82)+impact*.24):0;
 const point={t,rawBass,bass,rawMid,mid,rawHigh,high,bassFlux,highFlux,impact,beat:beat.pulse,peak,bpm:beat.bpm,confidence:beat.confidence,melodyPitch:melody.pitch,melodyConfidence:melody.confidence,melodyGlide:melody.glide,vocal:melody.vocal};
 traceHistory.push(point);if(traceHistory.length>360)traceHistory.shift();
 if(captureActive){capturedTrace.push({...point,bands:Array.from(bands),rawBands:Array.from(rawBands),modulation:{...modulation,meters:undefined}});if(capturedTrace.length>=1800){captureActive=false;$('captureTrace').textContent='Capture data';$('traceStatus').textContent='CAPTURE FULL · 60 S';}$('exportTrace').disabled=!capturedTrace.length;}
}
function drawSignalTrace(){
 const width=960,height=108;traceCtx.fillStyle='#05080d';traceCtx.fillRect(0,0,width,height);traceCtx.strokeStyle='#ffffff14';traceCtx.beginPath();traceCtx.moveTo(0,height*.25);traceCtx.lineTo(width,height*.25);traceCtx.moveTo(0,height*.5);traceCtx.lineTo(width,height*.5);traceCtx.moveTo(0,height*.75);traceCtx.lineTo(width,height*.75);traceCtx.stroke();
 const draw=(key,color)=>{if(traceHistory.length<2)return;traceCtx.beginPath();traceHistory.forEach((point,index)=>{const x=index*width/(traceHistory.length-1),y=height-7-clamp(point[key])* (height-14);if(index)traceCtx.lineTo(x,y);else traceCtx.moveTo(x,y);});traceCtx.strokeStyle=color;traceCtx.lineWidth=2;traceCtx.stroke();};
 draw('rawBass','#a5f465');draw('bass','#7bc6ff');draw('peak','#f778ba');draw('impact','#53e3f5');
 traceCtx.lineWidth=1;traceCtx.fillStyle='#708397';traceCtx.font='10px system-ui';traceCtx.fillText('RAW → SMOOTH → LIGHT → IMPACT',8,14);
}
$('captureTrace').onclick=()=>{captureActive=!captureActive;if(captureActive){capturedTrace=[];$('captureTrace').textContent='Stop capture';$('traceStatus').textContent='CAPTURING · UP TO 60 S';}else{$('captureTrace').textContent='Capture data';$('traceStatus').textContent='CAPTURE READY · '+capturedTrace.length+' FRAMES';}$('exportTrace').disabled=!capturedTrace.length;};
$('exportTrace').onclick=()=>{if(!capturedTrace.length)return;const blob=new Blob([JSON.stringify({format:'supa-canvas-response-trace',sampleRateHz:Math.round(capturedTrace.length/(capturedTrace.at(-1).t-capturedTrace[0].t||1)),frames:capturedTrace},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='supa-canvas-response-trace.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 function frame(ms){const t=ms/1000,dt=last?Math.min(t-last,.1):0;last=t;renderDt=dt||.016;analyze(t);const features={beat:beat.pulse,tempo:beat.tempo,impact,presence:highFlux,melody:melody.strength,glide:melody.glide,vocal:melody.vocal};applyMasterBindings(features);if(audioActive){modulation=SupaModulation.step(routes,bands,dt,routeStates,features);clock=SupaModulation.advance(clock,dt,true,tempoMotion()+modulation.speed,masterValues.speed);advanceEngines(dt);render(t);}else{present();}if(t-traceTime>.033){traceTime=t;recordTrace(t);}if(t-uiTime>.065){uiTime=t;document.querySelectorAll('.route-meter').forEach((row,i)=>{const v=audioActive?(modulation.meters[i]||0):0;row.querySelector('meter').value=v;row.querySelector('span').textContent=Math.round(v*100)+'% active';});for(const [key,v]of [['bass',bass],['mid',mid],['high',high]]){$(key+'Text').textContent=Math.round(v*100)+'%';$(key+'Meter').value=v}$('rmsText').textContent=rms>0?Math.max(-96,20*Math.log10(rms)).toFixed(1)+' dBFS':'−∞ dBFS';const fieldIntensity=audioActive?clamp(audioLoudness*(.18+(modulation.intensity||0)*.82)+impact*.24):0;$('intensityText').textContent=Math.round(fieldIntensity*100)+'%';$('intensityMeter').value=fieldIntensity;$('bpmText').textContent=beat.confidence>.18?Math.round(beat.bpm)+' BPM':'Listening';$('beatConfidence').textContent=beat.confidence>.18?Math.round(beat.confidence*100)+'% confidence':'Listening for pulses';$('beatMeter').value=beat.confidence;$('onset').textContent=!audioActive?'Dormant · holding still':beat.pulse>.55?'Beat detected':mode==='demo'?'Synthetic test audio':'Audio driving canvas';$('melodyState').textContent=melody.confidence>.12?`MELODY ${Math.round(130*Math.pow(1400/130,melody.pitch))} HZ · ${Math.round(melody.confidence*100)}%`:'MELODY LISTENING';for(const key of ['smooth','speed']){const bound=masterBindings[key]!=='none';if(bound)$(key+'BindState').textContent=`AUDIO BOUND · ${masterValues[key].toFixed(key==='smooth'?2:1)}${key==='speed'?'×':''}`;}drawRawSpectrum();drawWaveform();drawSpectrogram();drawSignalTrace()}requestAnimationFrame(frame)}requestAnimationFrame(frame);
const controls=['effect','palette','gain','smooth','speed','brightness','noise'];
function sceneData(){return {format:'supa-canvas',version:3,canvas:{width:960,height:540},settings:Object.fromEntries(controls.map(id=>[id,$(id).value])),masterBindings,fixtures,routes:SupaModulation.validate(routes)};}
function restoreScene(s){
 if(s&&s.settings)s={...s,settings:{noise:'-60',...s.settings}};
 if(s?.settings?.smooth!==undefined)s.settings.smooth=String(s.version<3?clamp(.25+(Number(s.settings.smooth)||0)*.8,.25,1):clamp(Number(s.settings.smooth)||0,0,2));
 if(s?.settings?.speed!==undefined)s.settings.speed=String(s.version<3?clamp((Number(s.settings.speed)||0)*.4,.15,.6):clamp(Number(s.settings.speed)||0,0,1));
 if(s?.settings?.effect){const legacy={generative:'organic',aurora:'currents',radial:'pulse',tunnel:'currents',wave:'pulse',plasma:'currents',orbit:'bloom',rain:'embers',feedback:'currents',reaction:'bloom',wavefront:'pulse'};s.settings.effect=legacy[s.settings.effect]||s.settings.effect;}
 if(s.format!=='supa-canvas'||![1,2,3].includes(s.version)||!Array.isArray(s.fixtures)||s.fixtures.length<1||s.fixtures.length>16)throw Error('Unsupported scene format.');
 for(const f of s.fixtures){if(typeof f.name!=='string'||f.name.length>60||!Number.isInteger(f.count)||f.count<2||f.count>1000||!Array.isArray(f.points)||f.points.length<2||f.points.length>32||f.points.some(p=>!Array.isArray(p)||p.length!==2||p.some(n=>typeof n!=='number'||!Number.isFinite(n)||n<0||n>1)))throw Error('Invalid LED path.');}
 for(const id of controls){const el=$(id),v=s.settings?.[id];if(v===undefined)throw Error('Missing effect setting.');if(el.tagName==='SELECT'){if(![...el.options].some(o=>o.value===v))throw Error('Unknown effect or palette.');}else if(!['number','string'].includes(typeof v)||v===''||!Number.isFinite(Number(v))||+v<+el.min||+v>+el.max)throw Error('Effect setting out of range.');}
 const restoredRoutes=s.version===1?[]:SupaModulation.validate(s.routes);const savedBindings=s.masterBindings||{};
 for(const key of ['smooth','speed'])masterBindings[key]=Object.hasOwn(SupaModulation.sources,savedBindings[key])?savedBindings[key]:'none';renderMasterBindings();
 routes=restoredRoutes.filter((r,i,a)=>a.findIndex(other=>JSON.stringify(other)===JSON.stringify(r))===i);routeStates=[];fixtures=s.fixtures;selected=0;for(const id of controls){$(id).value=s.settings[id];$(id).oninput?.();}syncRequiredRoutes();renderRoutes();refresh();updateLook();
}
$('save').onclick=()=>{const blob=new Blob([JSON.stringify(sceneData(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='supa-canvas-scene.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message('Scene exported. Audio is not included.');};
$('load').onclick=()=>$('file').click();$('file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>1000000)throw Error('Scene is too large.');restoreScene(JSON.parse(await file.text()));persist();message('Scene loaded.');}catch(error){message('Could not load scene: '+error.message)}finally{e.target.value=''}};
function audioMessage(text){$('audioMessage').textContent=text;}
$('setup').onclick=()=>{$('audioSetup').open=true;$('audioSetup').scrollIntoView({behavior:'smooth',block:'start'});};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await canvas.parentElement.requestFullscreen();}catch(e){message('Fullscreen is unavailable: '+e.message);}};
document.addEventListener('fullscreenchange',()=>{$('fullscreen').textContent=document.fullscreenElement?'Exit fullscreen ×':'Fullscreen ⤢';});
const engineInfo={organic:{hint:'Impact Structure spawns bass bodies; treble lights their tips. Peak intensity follows full-song energy.',required:['Impact → Structure','Treble → Extra brightness','Full spectrum → Peak intensity','Tempo → Motion speed']},currents:{hint:'Impact Structure injects new trails. Peak intensity sets their visible energy.',required:['Impact → Structure','Full spectrum → Peak intensity','Tempo → Motion speed']},bloom:{hint:'Impact Structure seeds new mycelium growth. Peak intensity controls the bloom’s bright tips.',required:['Impact → Structure','Full spectrum → Peak intensity','Tempo → Motion speed']},pulse:{hint:'Impact Structure launches a new tidal wave. Peak intensity sets the crest brightness.',required:['Impact → Structure','Full spectrum → Peak intensity','Tempo → Motion speed']},embers:{hint:'Treble novelty Structure spawns new embers; treble brightness and Peak intensity light their tips.',required:['Presence → Structure','Treble → Extra brightness','Full spectrum → Peak intensity','Tempo → Motion speed']},melody:{hint:'A stabilized harmonic pitch track draws a ribbon that follows the main melodic rise, fall, and glide.',required:['Melody → Structure','Melody glide → Motion speed','Full spectrum → Peak intensity']},vocal:{hint:'Harmonic mid presence creates paired vocal halos, anchored to the tracked melodic pitch.',required:['Vocal presence → Structure','Melody → Extra brightness','Full spectrum → Peak intensity']},spectrum:{hint:'Sharp spectral spikes seed a shared water-like field. Bass and vocal-band centroids steer their lateral drift.',required:['Full spectrum → Structure','Full spectrum → Peak intensity','Tempo → Motion speed']}};
const engineRoutes={organic:[{source:'impact',target:'blobs',response:'level',amount:1,threshold:.04,release:.16},{source:'high',target:'light',response:'peak',amount:.8,threshold:.1,release:.35},{source:'full',target:'intensity',response:'level',amount:.8,threshold:.05,release:.4},{source:'tempo',target:'speed',response:'level',amount:1,threshold:0,release:.2}],currents:[{source:'impact',target:'blobs',response:'level',amount:1,threshold:.04,release:.16},{source:'full',target:'intensity',response:'level',amount:.8,threshold:.05,release:.4},{source:'tempo',target:'speed',response:'level',amount:1,threshold:0,release:.2}],bloom:[{source:'impact',target:'blobs',response:'level',amount:1,threshold:.04,release:.16},{source:'full',target:'intensity',response:'level',amount:.8,threshold:.05,release:.4},{source:'tempo',target:'speed',response:'level',amount:1,threshold:0,release:.2}],pulse:[{source:'impact',target:'blobs',response:'level',amount:1,threshold:.04,release:.16},{source:'full',target:'intensity',response:'level',amount:.8,threshold:.05,release:.4},{source:'tempo',target:'speed',response:'level',amount:1,threshold:0,release:.2}],embers:[{source:'presence',target:'blobs',response:'level',amount:1,threshold:.04,release:.12},{source:'high',target:'light',response:'peak',amount:.9,threshold:.08,release:.3},{source:'full',target:'intensity',response:'level',amount:.8,threshold:.05,release:.4},{source:'tempo',target:'speed',response:'level',amount:1,threshold:0,release:.2}],melody:[{source:'melody',target:'blobs',response:'level',amount:1,threshold:.08,release:.25},{source:'glide',target:'speed',response:'level',amount:.8,threshold:.02,release:.18},{source:'full',target:'intensity',response:'level',amount:.8,threshold:.05,release:.4}],vocal:[{source:'vocal',target:'blobs',response:'level',amount:1,threshold:.06,release:.3},{source:'melody',target:'light',response:'level',amount:.8,threshold:.08,release:.3},{source:'full',target:'intensity',response:'level',amount:.8,threshold:.05,release:.4}],spectrum:[{source:'full',target:'blobs',response:'level',amount:1,threshold:.05,release:.24},{source:'full',target:'intensity',response:'level',amount:.8,threshold:.05,release:.4},{source:'tempo',target:'speed',response:'level',amount:1,threshold:0,release:.2}]};
function syncRequiredRoutes(){const effect=$('effect').value,required=engineRoutes[effect]||[];let changed=false;for(const route of routes){if((route.requiredFor||[]).includes(effect)&&!required.some(spec=>spec.source===route.source&&spec.target===route.target)){const kept=route.requiredFor.filter(value=>value!==effect);if(kept.length)route.requiredFor=kept;else delete route.requiredFor;changed=true;}}for(const spec of required){let route=routes.find(candidate=>candidate.source===spec.source&&candidate.target===spec.target);if(route){const marked=new Set(route.requiredFor||[]);if(!marked.has(effect)){marked.add(effect);route.requiredFor=[...marked];changed=true;}if(!route.enabled){route.enabled=true;changed=true;}}else if(routes.length<12){route={...SupaModulation.create(spec.source,spec.target),...spec,enabled:true,requiredFor:[effect]};routes.push(route);changed=true;}else $('routeStatus').textContent='Remove a non-required pairing to make room for this engine.';}return changed;}
const looks={drift:{noise:'-60',effect:'currents',palette:'neon',gain:'1.5',smooth:'0.8',speed:'0.3',brightness:'0.8'},pulse:{noise:'-60',effect:'pulse',palette:'fire',gain:'1.8',smooth:'0.45',speed:'0.55',brightness:'0.9'},liquid:{noise:'-60',effect:'organic',palette:'candy',gain:'1.7',smooth:'0.7',speed:'0.3',brightness:'0.9'},bloom:{noise:'-60',effect:'bloom',palette:'ice',gain:'1.5',smooth:'0.65',speed:'0.35',brightness:'0.9'}};
function updateLook(){const info=engineInfo[$('effect').value]||engineInfo.organic;$('effectHint').textContent=info.hint;$('requiredDrivers').innerHTML=`<span class="required-drivers__label">REQUIRED DRIVERS</span><div class="required-drivers__items">${info.required.map(value=>`<span>${value}</span>`).join('')}</div>`;document.querySelectorAll('[data-look]').forEach(b=>b.setAttribute('aria-pressed',String(controls.every(id=>$(id).value===looks[b.dataset.look][id]))));}
function activateEngine(){const changed=syncRequiredRoutes();renderRoutes();updateLook();if(changed)$('routeStatus').textContent='Required pairings added or linked to this engine.';persist();}
document.querySelectorAll('[data-look]').forEach(b=>b.onclick=()=>{for(const [id,value]of Object.entries(looks[b.dataset.look])){$(id).value=value;$(id).oninput?.();}activateEngine();});
for(const id of controls)$(id).addEventListener('input',updateLook);
$('effect').addEventListener('change',activateEngine);
$('openAudio').onclick=()=>{stop();audio=new AudioContext();audio.resume().catch(e=>audioMessage(e.message));$('audioFile').click();};
$('audioFile').oncancel=()=>stop();
$('audioFile').onchange=async e=>{
 const file=e.target.files[0];e.target.value='';if(!file||!audio)return;const token=audioEpoch;busy(true);
 try{if(token!==audioEpoch)return;analyser=audio.createAnalyser();analyser.fftSize=2048;analyser.minDecibels=-100;analyser.maxDecibels=-10;analyser.smoothingTimeConstant=.05;mediaURL=URL.createObjectURL(file);$('player').src=mediaURL;source=audio.createMediaElementSource($('player'));source.connect(analyser);analyser.connect(audio.destination);mode='file';$('player').classList.remove('hidden');await $('player').play();if(token!==audioEpoch)return;$('status').textContent='AUDIO FILE · '+file.name;audioMessage('Local playback. Pause, scrub, or switch looks while listening.');}
 catch(e){if(token===audioEpoch){stop();audioMessage('Could not play this file: '+e.message);}}finally{busy(false);}
};
function renderRoutes(){
 const host=$('routes');host.replaceChildren();$('routeEmpty').hidden=routes.length>0;$('addRoute').disabled=routes.length>=12;
 routes.forEach((route,i)=>{
  const required=(route.requiredFor||[]).includes($('effect').value),fixed=required&&$('effect').value==='spectrum';const card=document.createElement('div');card.className='route'+(route.enabled?'':' route-muted')+(required?' route-required':'')+(fixed?' route-required--fixed':'');
  card.innerHTML=`<div class="route-main"><input type="checkbox" aria-label="Enable pairing ${i+1}"><label>Audio band<select aria-label="Pairing ${i+1} audio band" data-key="source"></select></label><span>→</span><label>Attribute<select aria-label="Pairing ${i+1} attribute" data-key="target"></select></label><label class="route-response">Response<select aria-label="Pairing ${i+1} response" data-key="response"><option value="level">Average level</option><option value="peak">Strongest peak</option></select></label><button class="route-remove" aria-label="Remove pairing ${i+1}">×</button></div><div class="route-frequency" hidden><label>From Hz <input type="number" min="30" max="11999" data-key="low" aria-label="Pairing ${i+1} low frequency"></label><label>To Hz <input type="number" min="31" max="12000" data-key="high" aria-label="Pairing ${i+1} high frequency"></label></div><div class="route-params"></div><div class="route-meter"><meter min="0" max="1" aria-label="Pairing ${i+1} activity"></meter><span>0% active</span></div>`;
  if(required)card.querySelector('.route-main').insertAdjacentHTML('beforeend',`<span class="route-required-label">${fixed?'FIXED':'REQUIRED'} · ${$('effect').selectedOptions?.[0]?.textContent||$('effect').value}</span>`);
  for(const [key,options]of [['source',SupaModulation.sources],['target',SupaModulation.targets]])card.querySelector(`[data-key="${key}"]`).replaceChildren(...Object.entries(options).map(([value,label])=>new Option(typeof label==='string'?label:label.label,value)));
  for(const key of ['source','target','response','low','high']){const el=card.querySelector(`[data-key="${key}"]`);el.value=route[key];el.disabled=fixed||(required&&['source','target','low','high'].includes(key));el.onchange=()=>{
   const next={...route,[key]:el.type==='number'?Number(el.value):el.value};
   try{SupaModulation.validate([next]);Object.assign(route,next);routeStates[i]={value:0};card.querySelector('.route-frequency').hidden=route.source!=='custom';$('routeStatus').textContent='Pairing updated.';persist();}catch(e){el.value=route[key];$('routeStatus').textContent=e.message;}
  };}
  card.querySelector('.route-frequency').hidden=route.source!=='custom';
  const toggle=card.querySelector('input[type=checkbox]');toggle.checked=required?true:route.enabled;toggle.disabled=required;toggle.onchange=()=>{route.enabled=toggle.checked;routeStates[i]={value:0};card.classList.toggle('route-muted',!route.enabled);persist();};
  const remove=card.querySelector('button');remove.disabled=required;remove.onclick=()=>{routes.splice(i,1);routeStates.splice(i,1);renderRoutes();persist();};
  for(const [key,label,min,max,step]of [['amount','Amount',0,2,.05],['threshold','Threshold',0,.95,.01],['release','Release',.05,2,.05]]){
   const wrap=document.createElement('label');wrap.textContent=label+' ';const output=document.createElement('output'),input=document.createElement('input');input.type='range';input.min=min;input.max=max;input.step=step;input.value=route[key];input.setAttribute('aria-label',`Pairing ${i+1} ${label.toLowerCase()}`);
   const show=()=>output.value=key==='release'?route[key].toFixed(2)+' s':key==='threshold'?Math.round(route[key]*100)+'%':route[key].toFixed(2)+'×';show();input.disabled=fixed;input.oninput=()=>{route[key]=+input.value;show();};wrap.append(output,input);card.querySelector('.route-params').append(wrap);
  }
  host.append(card);
 });
}
$('addRoute').onclick=()=>{if(routes.length>=12)return;routes.push(SupaModulation.create());renderRoutes();persist();};
$('generative').onclick=()=>{
 const starter=[SupaModulation.create('bass','blobs'),{...SupaModulation.create('mid','speed'),amount:.7},{...SupaModulation.create('high','peaks'),response:'peak',release:.6},{...SupaModulation.create('full','intensity'),amount:.6,threshold:.06,release:.45}];
 const missing=starter.filter(r=>!routes.some(existing=>existing.source===r.source&&existing.target===r.target));
 if(routes.length+missing.length>12){$('routeStatus').textContent='Remove a pairing to make room for the starter.';return;}
 routes.push(...missing);renderRoutes();persist();$('routeStatus').textContent=missing.length?'Added missing starter pairings. Existing pairings are kept.':'Starter pairings are already present; no duplicates added.';
};
syncRequiredRoutes();renderRoutes();
const storageKey='supa-canvas.scene.v1';let savedJSON='';
function persist(){try{const data=JSON.stringify(sceneData());if(data!==savedJSON){localStorage.setItem(storageKey,data);savedJSON=data;$('savedState').textContent='Scene saved in this browser';}}catch(e){$('savedState').textContent='Auto-save unavailable · export to keep scene';}}
try{const saved=localStorage.getItem(storageKey);if(saved){restoreScene(JSON.parse(saved));savedJSON=saved;$('savedState').textContent='Previous scene restored';}}catch(e){$('savedState').textContent='Could not restore scene · use Load scene';}
syncRequiredRoutes();renderRoutes();updateLook();setInterval(persist,1000);
window.addEventListener('pagehide',()=>{persist();cleanup();});
