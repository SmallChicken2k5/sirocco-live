import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createStudio } from '../server.mjs';
import { defaultConfig } from '../lib/config.mjs';

test('local API saves configuration, serves two viewer routes and blocks external mutations',async t=>{
  const dataDir=await mkdtemp(path.join(tmpdir(),'sirocco-test-'));
  let studio=await createStudio({dataDir,port:0});
  t.after(async()=>{await studio.close();await rm(dataDir,{recursive:true,force:true});});
  const base=()=>`http://127.0.0.1:${studio.port}`;
  for(const route of ['/','/view/nonpro','/view/pro','/app.js','/style.css','/studio.css','/assets/sirocco-symbol.png','/assets/icons.svg','/assets/geist-vietnamese.woff2'])assert.equal((await fetch(base()+route)).status,200);
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
