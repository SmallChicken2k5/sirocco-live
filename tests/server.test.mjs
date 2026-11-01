import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createStudio } from '../server.mjs';
import { defaultConfig } from '../lib/config.mjs';

test('local API saves configuration, serves built-in viewer routes and blocks external mutations',async t=>{
  const dataDir=await mkdtemp(path.join(tmpdir(),'sirocco-test-'));
  let studio=await createStudio({dataDir,port:0});
  t.after(async()=>{await studio.close();await rm(dataDir,{recursive:true,force:true});});
  const base=()=>`http://127.0.0.1:${studio.port}`;
  for(const route of ['/','/view/nonpro','/view/pro','/view/icpc','/app.js','/style.css','/studio.css','/assets/sirocco-symbol.png','/assets/icons.svg','/assets/geist-vietnamese.woff2'])assert.equal((await fetch(base()+route)).status,200);
  assert.equal((await fetch(base()+'/favicon.ico')).headers.get('content-type'),'image/png');
  assert.equal((await fetch(base()+'/assets/../package.json')).status,404);
  const config=defaultConfig();config.candidates=[{id:'an',name:'An',url:'',group:'nonpro',language:'cpp',enabled:true}];
  let r=await fetch(base()+'/api/config',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(config)});assert.equal(r.status,200);
  assert.equal((await(await fetch(base()+'/api/config')).json()).candidates[0].name,'An');
  r=await fetch(base()+'/api/config',{method:'POST',headers:{'content-type':'application/json',Origin:'https://external.test'},body:JSON.stringify(config)});assert.equal(r.status,403);
  r=await fetch(base()+'/api/config',{method:'POST',headers:{'content-type':'text/plain'},body:'{}'});assert.equal(r.status,415);
  r=await fetch(base()+'/api/config',{method:'POST',headers:{'content-type':'application/json'},body:'{broken'});assert.equal(r.status,400);
  r=await fetch(base()+'/api/demo',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});assert.equal(r.status,409);
  await studio.close();studio=await createStudio({dataDir,port:0});
  assert.equal(studio.config.candidates[0].name,'An');
  const state=await(await fetch(base()+'/api/state')).json();assert.equal(state.config.candidates[0].url,undefined);assert.equal(state.snapshots.an.status,'waiting');
});

test('custom source membership, title and settings persist through restart and deletion',async t=>{
  const dataDir=await mkdtemp(path.join(tmpdir(),'sirocco-sources-'));let studio=await createStudio({dataDir,port:0});
  t.after(async()=>{await studio.close();await rm(dataDir,{recursive:true,force:true});});
  const post=config=>fetch(`http://127.0.0.1:${studio.port}/api/config`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(config)});
  const config=defaultConfig();config.groups['icpc-bang-a']={...config.groups.icpc,title:'ICPC · Bảng A',fontSize:12};config.candidates=[{id:'fixture',name:'Fixture',group:'icpc-bang-a',url:''}];
  assert.equal((await post(config)).status,200);await studio.close();studio=await createStudio({dataDir,port:0});
  assert.equal(studio.config.groups['icpc-bang-a'].title,'ICPC · Bảng A');assert.equal(studio.config.candidates[0].group,'icpc-bang-a');
  assert.equal((await fetch(`http://127.0.0.1:${studio.port}/view/icpc-bang-a`)).status,200);
  const next=structuredClone(studio.config);next.candidates[0].group='icpc';delete next.groups['icpc-bang-a'];assert.equal((await post(next)).status,200);
  const state=await(await fetch(`http://127.0.0.1:${studio.port}/api/state`)).json();assert.equal(state.config.groups['icpc-bang-a'],undefined);assert.equal(state.contests['icpc-bang-a'],undefined);assert.equal(state.config.candidates[0].group,'icpc');assert.equal(state.snapshots.fixture.status,'waiting');
});
test('demo provides six explicit demo snapshots, split four plus two, without USACO writes',async t=>{
  const dataDir=await mkdtemp(path.join(tmpdir(),'sirocco-demo-'));
  const studio=await createStudio({dataDir,port:0});
  t.after(async()=>{await studio.close();await rm(dataDir,{recursive:true,force:true});});
  const base=`http://127.0.0.1:${studio.port}`;
  const r=await fetch(base+'/api/demo',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});assert.equal(r.status,200);
  const state=await(await fetch(base+'/api/state')).json();assert.equal(state.config.demo,true);
  assert.equal(state.config.candidates.filter(c=>c.group==='nonpro').length,4);assert.equal(state.config.candidates.filter(c=>c.group==='pro').length,2);
  assert.equal(Object.keys(state.snapshots).length,6);
  assert.ok(Object.values(state.snapshots).every(s=>s.mode==='demo'&&s.code.length>100&&s.input.length>0&&s.inputStatus==='demo'));
});

test('Codeforces connection uses a dedicated API and never leaks credentials through state, exports or SSE',async t=>{
  const dataDir=await mkdtemp(path.join(tmpdir(),'sirocco-cf-api-'));
  const apiKey='fixture-api-key-only',apiSecret='fixture-api-secret-only';
  let request;
  const studio=await createStudio({dataDir,port:0,codeforcesOptions:{intervalMs:0,fetchImpl:async url=>{request=url;return new Response(JSON.stringify({status:'OK',result:{contest:{id:123456,name:'Fixture Gym',type:'IOI',phase:'FINISHED'},problems:[{index:'A',points:100}],rows:[{party:{members:[{handle:'fixture_user'}],participantType:'MANAGER'},rank:1,points:45,problemResults:[{points:45}]}]}}));}}});
  t.after(async()=>{await studio.close();await rm(dataDir,{recursive:true,force:true});});
  const base=`http://127.0.0.1:${studio.port}`;
  let r=await fetch(base+'/api/codeforces/check',{method:'POST',headers:{'content-type':'application/json',origin:'https://external.test'},body:JSON.stringify({apiKey,apiSecret,contest:'123456'})});assert.equal(r.status,403);
  r=await fetch(base+'/api/codeforces/check',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({apiKey,apiSecret,contest:'123456',handle:'fixture_user',asManager:true})});assert.equal(r.status,200);
  const connected=await r.json();assert.equal(connected.configured,true);assert.equal(connected.lastCheck.participant.points,45);assert.equal(connected.lastCheck.participant.rank,null);
  assert.equal(request.searchParams.get('asManager'),'true');assert.ok(request.searchParams.has('apiSig'));
  for(const route of ['/api/codeforces/connection','/api/state','/api/config','/api/export','/api/archive']){const text=await(await fetch(base+route)).text();assert.ok(!text.includes(apiKey),route);assert.ok(!text.includes(apiSecret),route);}
  const controller=new AbortController();const stream=await fetch(base+'/api/events',{signal:controller.signal});const reader=stream.body.getReader();const text=new TextDecoder().decode((await reader.read()).value);assert.ok(!text.includes(apiKey));assert.ok(!text.includes(apiSecret));controller.abort();await reader.cancel().catch(()=>{});
  r=await fetch(base+'/api/codeforces/disconnect',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});assert.equal((await r.json()).configured,false);
});

test('saved contest mappings publish score SSE updates independently of USACO code snapshots',async t=>{
  const dataDir=await mkdtemp(path.join(tmpdir(),'sirocco-cf-live-'));let score=145;
  const fixture=()=>({contest:{id:123456,name:'Fixture Gym',type:'IOI',phase:'CODING'},problems:[{index:'A',points:100},{index:'B',points:100}],rows:[{party:{members:[{handle:'fixture_user'}],participantType:'CONTESTANT'},rank:3,points:score,penalty:0,problemResults:[{points:100},{points:score-100}]}]});
  const studio=await createStudio({dataDir,port:0,codeforcesOptions:{intervalMs:0,fetchImpl:async url=>new Response(JSON.stringify({status:'OK',result:url.pathname.endsWith('contest.status')?[{id:99,contestId:123456,author:{members:[{handle:'fixture_user'}],participantType:'CONTESTANT'},problem:{index:'B'},verdict:'PARTIAL',points:20,creationTimeSeconds:1700000000}]:fixture()}))}});
  t.after(async()=>{await studio.close();await rm(dataDir,{recursive:true,force:true});});
  const base=`http://127.0.0.1:${studio.port}`,post=(route,value)=>fetch(base+route,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(value)});
  const config=defaultConfig();config.candidates=[{id:'one',name:'Fixture',url:'',group:'nonpro',enabled:true,codeforcesHandle:'fixture_user'}];config.groups.nonpro.codeforces={enabled:true,url:'123456',asManager:false,refreshSeconds:30,showOnLive:true};
  assert.equal((await post('/api/config',config)).status,200);assert.equal(studio.contests.get('nonpro').status,'credentials');
  await post('/api/codeforces/check',{contest:'123456',handle:'fixture_user',apiKey:'fixture-api-key-only',apiSecret:'fixture-api-secret-only'});
  const wait=async predicate=>{const end=Date.now()+2500;while(Date.now()<end){if(predicate())return;await new Promise(r=>setTimeout(r,5));}throw Error('Missing live score update');};
  await wait(()=>studio.contests.get('nonpro')?.participants.one?.lastSubmission?.id===99);
  const codeSnapshot=JSON.stringify(studio.snapshots.get('one'));
  const abort=new AbortController(),stream=await fetch(base+'/api/events',{signal:abort.signal}),reader=stream.body.getReader();
  const initial=new TextDecoder().decode((await reader.read()).value);assert.ok(initial.includes('"points":145'));assert.ok(!initial.includes('fixture-api-secret-only'));
  score=175;assert.equal((await post('/api/codeforces/refresh',{groupId:'nonpro'})).status,200);
  await wait(()=>studio.contests.get('nonpro')?.participants.one?.points===175);
  const event=new TextDecoder().decode((await reader.read()).value);assert.ok(event.includes('event: contest'));assert.ok(!event.includes('fixture-api-key-only'));
  assert.equal(JSON.stringify(studio.snapshots.get('one')),codeSnapshot);
  assert.equal((await(await fetch(base+'/api/state')).json()).contests.nonpro.participants.one.points,175);
  abort.abort();await reader.cancel().catch(()=>{});
});
