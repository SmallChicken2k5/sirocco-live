import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { ResultAudio } from '../web/result-effects.js';

test('VNOJ companion reads only the active own session and sends its exact scores without cookies or code',async()=>{
  const source=await readFile(new URL('../companion/vnoj/content.js',import.meta.url),'utf8');const sent=[],requests=[];
  const raw={contest:{replay_duration:18000},problems:[{id:11,label:'A',code:'sample_a',points:100}],own:{id:502,real_start:1700000000,user:{username:'fixture_user'},subs:[[11,70,10],[11,20,20],[11,100,30]]}};
  const sandbox={location:{pathname:'/contest/fixture/'},AbortSignal,Date,console,DOMParser:class{parseFromString(){return{querySelectorAll:()=>[]};}},setInterval:()=>{},chrome:{storage:{local:{get:async()=>({pairToken:'fixture'}),set:async()=>{}}},runtime:{sendMessage:async m=>sent.push(m)}},fetch:async u=>{requests.push(u);return u.includes('ranking')?new Response(JSON.stringify(raw),{headers:{'content-type':'application/json'}}):new Response('<html></html>');}};
  vm.runInNewContext(source,sandbox);for(let i=0;i<30&&!sent.length;i++)await new Promise(r=>setTimeout(r,5));
  assert.equal(sent.length,1);assert.equal(sent[0].payload.participationId,502);assert.equal(sent[0].payload.username,'fixture_user');assert.deepEqual(Array.from(sent[0].payload.submissions,s=>s.points),[70,20,100]);assert.equal(sent[0].payload.submissions.at(-1).verdict,'AC');assert.ok(requests.every(u=>u.startsWith('/contest/fixture/')));assert.equal(sent[0].payload.code,undefined);assert.equal(sent[0].payload.cookie,undefined);
});
test('VNOJ companion does not relay another user from a public ranking response',async()=>{
  const source=await readFile(new URL('../companion/vnoj/content.js',import.meta.url),'utf8');let sent=0;const sandbox={location:{pathname:'/contest/fixture/'},AbortSignal,setInterval:()=>{},chrome:{storage:{local:{get:async()=>({pairToken:'fixture'}),set:async()=>{}}},runtime:{sendMessage:async()=>sent++}},fetch:async()=>new Response(JSON.stringify({participations:[{id:502,user:{username:'fixture_user'}}]}),{headers:{'content-type':'application/json'}})};vm.runInNewContext(source,sandbox);await new Promise(r=>setTimeout(r,20));assert.equal(sent,0);
});
test('sound effect uses distinct bounded notes, volume control, and stays silent until enabled',async()=>{
  const notes=[],levels=[];class Audio{constructor(){this.state='suspended';this.currentTime=0;this.destination={};}async resume(){this.state='running';}createOscillator(){const n={frequency:{value:0},connect(){},start(){notes.push(n.frequency.value);},stop(){}};return n;}createGain(){return{gain:{setValueAtTime(){},linearRampToValueAtTime(v){levels.push(v);},exponentialRampToValueAtTime(){}},connect(){}};}}
  globalThis.window={AudioContext:Audio};try{const audio=new ResultAudio();audio.play('success',100);assert.equal(notes.length,0);assert.equal(await audio.enable(),true);audio.play('success',50);assert.deepEqual(notes,[523.25,659.25,783.99]);assert.ok(levels.every(v=>v===.08));audio.play('failure',50);assert.deepEqual(notes.slice(-2),[220,164.81]);audio.play('success',0);assert.equal(notes.length,5);}finally{delete globalThis.window;}
});

test('audio automatically starts when permitted and reports later browser state changes',()=>{
  let resumes=0,changes=0;
  class Audio{constructor(){this.state='suspended';}resume(){resumes++;this.state='running';return Promise.resolve();}}
  globalThis.window={AudioContext:Audio};try{
    const audio=new ResultAudio();assert.equal(audio.prepare(()=>changes++),'running');
    assert.equal(audio.prepare(()=>changes++),'running');assert.equal(resumes,1);
    audio.context.onstatechange();assert.equal(changes,1);
    audio.context.state='suspended';assert.equal(audio.prepare(()=>changes++),'suspended');assert.equal(resumes,1);
  }finally{delete globalThis.window;}
});

test('blocked autoplay never waits or retries on updates; a user click can unlock the same context',async()=>{
  let resumes=0;
  class Audio{constructor(){this.state='suspended';}resume(){resumes++;if(resumes===1)return new Promise(()=>{});this.state='running';this.onstatechange();return Promise.resolve();}}
  globalThis.window={AudioContext:Audio};try{
    const audio=new ResultAudio();assert.equal(audio.prepare(()=>{}),'suspended');
    assert.equal(audio.prepare(()=>{}),'suspended');assert.equal(resumes,1);
    assert.equal(await audio.enable(),true);assert.equal(audio.prepare(()=>{}),'running');assert.equal(resumes,2);
  }finally{delete globalThis.window;}
});

test('unavailable or denied audio fails quietly without an unhandled rejection',async()=>{
  globalThis.window={};try{
    const audio=new ResultAudio();assert.equal(audio.prepare(()=>{}),'unavailable');assert.equal(await audio.enable(),false);
    window.AudioContext=class{constructor(){this.state='suspended';}resume(){return Promise.reject(new Error('NotAllowedError'));}};
    assert.equal(audio.prepare(()=>{}),'suspended');await new Promise(r=>setImmediate(r));assert.equal(await audio.enable(),false);
  }finally{delete globalThis.window;}
});
