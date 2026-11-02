import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createViewGateway, viewerState} from '../lib/view-gateway.mjs';

function fixture() {
  return {config:{version:2,title:'Viewer fixture',demo:false,groups:{nonpro:{title:'Shared'},pro:{title:'Private'}},candidates:[
    {id:'one',name:'Shared user',group:'nonpro',enabled:true,url:'private-share-link'},
    {id:'two',name:'Private user',group:'pro',enabled:true},
    {id:'hidden',name:'Hidden user',group:'nonpro',enabled:false},
  ]},snapshots:{one:{id:'one',code:'shared code'},two:{id:'two',code:'private code'},hidden:{id:'hidden',code:'hidden code'}},
  contests:{nonpro:{groupId:'nonpro',participants:{one:{points:100},two:{points:999},hidden:{points:777}}},pro:{groupId:'pro',participants:{two:{points:888}}}}};
}

async function setup(t) {
  let state=fixture(),writes=0;
  const upstream=http.createServer((req,res)=>{
    if(req.method!=='GET')writes++;
    if(req.url==='/api/state'){res.setHeader('content-type','application/json');res.end(JSON.stringify(state));return;}
    res.setHeader('content-type',req.url==='/app.js'?'text/javascript':'text/html');res.end('fixture asset');
  });
  await new Promise(r=>upstream.listen(0,'127.0.0.1',r));
  const gateway=await createViewGateway({upstream:`http://127.0.0.1:${upstream.address().port}`,port:0,refreshMs:20});
  t.after(async()=>{await gateway.close();upstream.closeAllConnections();await new Promise(r=>upstream.close(r));});
  return {gateway,base:`http://127.0.0.1:${gateway.port}`,setState:value=>{state=value;},writes:()=>writes};
}

test('public state contains only the selected enabled candidates and their contest results',()=>{
  const state=viewerState(fixture(),'nonpro'),text=JSON.stringify(state);
  assert.deepEqual(Object.keys(state.config.groups),['nonpro']);assert.deepEqual(state.config.candidates.map(c=>c.id),['one']);
  assert.deepEqual(Object.keys(state.snapshots),['one']);assert.deepEqual(Object.keys(state.contests.nonpro.participants),['one']);
  for(const privateValue of ['private-share-link','Private user','private code','hidden code','999','777','888'])assert.ok(!text.includes(privateValue),privateValue);
  assert.deepEqual(viewerState(fixture(),'missing').config.candidates,[]);
});

test('viewer port serves the chosen view and assets, blocks every admin route and all writes',async t=>{
  const {base,writes}=await setup(t);
  let response=await fetch(base+'/',{redirect:'manual'});assert.equal(response.status,302);assert.equal(response.headers.get('location'),'/view/nonpro');
  for(const route of ['/view/nonpro','/app.js','/studio.css','/api/state'])assert.equal((await fetch(base+route)).status,200,route);
  for(const route of ['/index.html','/view/pro','/view/candidate/one','/api/config','/api/export','/api/archive','/api/codeforces/connection','/api/vnoj/pair','/api/health','/server.mjs','/data/config.json','/api/state/../config','/api/%63onfig'])assert.equal((await fetch(base+route)).status,404,route);
  for(const method of ['POST','PUT','PATCH','DELETE','OPTIONS']){
    response=await fetch(base+'/api/config',{method,headers:{'content-type':'application/json','x-http-method-override':'GET'},body:'{}'});assert.equal(response.status,403,method);
  }
  const state=await(await fetch(base+'/api/state?group=pro&admin=true')).json();assert.deepEqual(Object.keys(state.config.groups),['nonpro']);
  assert.equal(writes(),0);assert.equal(response.headers.get('access-control-allow-origin'),null);
});

test('initial and subsequent SSE frames are scoped, including moving a candidate out of the shared group',async t=>{
  const {base,setState}=await setup(t),abort=new AbortController();
  const timeout=setTimeout(()=>abort.abort(),5000);
  const response=await fetch(base+'/api/events?group=pro',{signal:abort.signal}),reader=response.body.getReader(),decoder=new TextDecoder();
  assert.ok(response.headers.get('content-type').includes('text/event-stream'));
  let buffer='';
  async function next() {
    while(!buffer.includes('\n\n')){const {value,done}=await reader.read();assert.equal(done,false);buffer+=decoder.decode(value,{stream:true});}
    const end=buffer.indexOf('\n\n'),frame=buffer.slice(0,end);buffer=buffer.slice(end+2);
    assert.ok(frame.startsWith('event: state\n'));return JSON.parse(frame.split('\ndata: ')[1]);
  }
  try {
    const initial=await next();assert.equal(initial.snapshots.one.code,'shared code');assert.equal(initial.snapshots.two,undefined);
    const moved=fixture();moved.config.candidates[0].group='pro';moved.snapshots.one.code='new private code';setState(moved);
    const update=await next();assert.deepEqual(update.config.candidates,[]);assert.deepEqual(update.snapshots,{});assert.deepEqual(update.contests.nonpro.participants,{});assert.ok(!JSON.stringify(update).includes('private code'));
  }finally{clearTimeout(timeout);abort.abort();await reader.cancel().catch(()=>{});}
});

test('public host header cannot redirect upstream requests; invalid source URLs are rejected',async t=>{
  const {gateway}=await setup(t);
  const result=await new Promise((resolve,reject)=>{
    const req=http.get({hostname:'127.0.0.1',port:gateway.port,path:'/api/state',headers:{host:'viewer.example.test'}},res=>{
      let text='';res.on('data',chunk=>text+=chunk);res.on('end',()=>resolve({status:res.statusCode,state:JSON.parse(text)}));
    });req.on('error',reject);
  });
  assert.equal(result.status,200);assert.deepEqual(Object.keys(result.state.config.groups),['nonpro']);
  for(const upstream of ['http://example.test','http://127.0.0.1:8765/api/config','http://user:pass@127.0.0.1:8765','https://127.0.0.1:8765'])await assert.rejects(createViewGateway({upstream,port:0}),/localhost/);
});
