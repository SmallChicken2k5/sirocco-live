import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WebSocketServer } from 'ws';
import * as Y from 'yjs';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { Awareness, encodeAwarenessUpdate } from 'y-protocols/awareness';
import { UsacoReader } from '../lib/usaco.mjs';

async function waitFor(fn, timeout=3500) {
  const end=Date.now()+timeout;
  while(Date.now()<end){if(fn())return;await new Promise(r=>setTimeout(r,20));}
  assert.fail('Timed out waiting for reader state');
}
function syncPacket(subtype,data){const e=encoding.createEncoder();encoding.writeVarUint(e,0);encoding.writeVarUint(e,subtype);encoding.writeVarUint8Array(e,data);return encoding.toUint8Array(e);}
async function fixture(t) {
  const doc = new Y.Doc(); const text=doc.getText('monaco');text.insert(0,'line 1\nline 2\nline 3');
  const inputDoc = new Y.Doc(); const inputText=inputDoc.getText('monaco');inputText.insert(0,'3\n1 2 3\n');
  const awareness=new Awareness(doc);awareness.setLocalState(null);
  const received=[];let connections=0;let lastSocket;let inputSocket;let totalConnections=0;
  const wss=new WebSocketServer({port:0,host:'127.0.0.1'});
  await new Promise(r=>wss.once('listening',r));
  wss.on('connection',(socket,request)=>{
    totalConnections++;
    const isInput=request.url==='/-abcdefg.input';
    if(isInput) inputSocket=socket; else {connections++;lastSocket=socket;}
    assert.ok(['/-abcdefg.cpp','/-abcdefg.input'].includes(request.url));
    const roomDoc=isInput?inputDoc:doc;
    socket.send(syncPacket(0,Y.encodeStateVector(roomDoc)));
    socket.on('message',raw=>{
      const d=decoding.createDecoder(new Uint8Array(raw));const type=decoding.readVarUint(d);const sub=type===0?decoding.readVarUint(d):null;received.push([type,sub]);
      if(type===0&&sub===0)socket.send(syncPacket(1,Y.encodeStateAsUpdate(roomDoc)));
    });
  });
  t.after(async()=>{for(const s of wss.clients)s.terminate();await new Promise(r=>wss.close(r));awareness.destroy();doc.destroy();inputDoc.destroy();});
  return {doc,text,inputDoc,inputText,awareness,received,wss,get socket(){return lastSocket;},get inputSocket(){return inputSocket;},get connections(){return connections;},get totalConnections(){return totalConnections;},endpoint:`ws://127.0.0.1:${wss.address().port}`};
}
const candidate={id:'fixture',url:'https://ide.usaco.guide/abcdefg',language:'auto'};
const meta=async()=>({language:'cpp',defaultPermission:'READ'});

test('receives initial + incremental code, follows remote selection, sends no edit or awareness writes',async t=>{
  const f=await fixture(t);let current;
  const reader=new UsacoReader(candidate,s=>current=s,{endpoint:f.endpoint,fetchMetadata:meta});
  t.after(()=>reader.stop());await reader.start();await waitFor(()=>current?.status==='live');
  assert.equal(current.code,'line 1\nline 2\nline 3');
  let update;f.doc.once('update',u=>update=u);f.text.insert(f.text.length,'\nline 4');
  f.socket.send(syncPacket(2,update));await waitFor(()=>current.code.endsWith('line 4'));
  assert.equal(current.line,4);
  const pos=Y.createRelativePositionFromTypeIndex(f.text,9);
  f.awareness.setLocalState({selection:{anchor:pos,head:pos},firebaseUserID:'test-author'});
  const e=encoding.createEncoder();encoding.writeVarUint(e,1);encoding.writeVarUint8Array(e,encodeAwarenessUpdate(f.awareness,[f.doc.clientID]));f.socket.send(encoding.toUint8Array(e));
  await waitFor(()=>current.cursorOffset===9);
  assert.ok(f.received.some(([type,sub])=>type===0&&sub===0));
  assert.ok(f.received.every(([type,sub])=>(type===0&&sub===0)||type===3),'reader must never transmit updates or local awareness');
});
test('private and nonexistent files never connect to the document websocket',async t=>{
  const f=await fixture(t);
  for(const metadata of [null,{language:'cpp',defaultPermission:'PRIVATE'}]){
    let current;const r=new UsacoReader(candidate,s=>current=s,{endpoint:f.endpoint,fetchMetadata:async()=>metadata});
    await r.start();assert.equal(current.status,'error');assert.equal(current.code,'');r.stop();
  }
  assert.equal(f.totalConnections,0);
});
test('permission changes stop the connection and clear code already displayed',async t=>{
  const f=await fixture(t);let current;let permission='READ';
  const r=new UsacoReader(candidate,s=>current=s,{endpoint:f.endpoint,fetchMetadata:async()=>({language:'cpp',defaultPermission:permission})});
  t.after(()=>r.stop());await r.start();await waitFor(()=>current?.status==='live');
  permission='PRIVATE';await r.checkMetadata();
  assert.equal(current.status,'error');assert.equal(current.code,'');assert.equal(current.input,'');assert.equal(r.socket,null);assert.equal(r.auxiliaryReaders.length,0);
});
test('reconnects and resynchronizes after a dropped connection',async t=>{
  const f=await fixture(t);let current;
  const r=new UsacoReader(candidate,s=>current=s,{endpoint:f.endpoint,fetchMetadata:meta,retryMs:30});
  t.after(()=>r.stop());await r.start();await waitFor(()=>current?.status==='live');
  f.socket.close();await waitFor(()=>f.connections===2&&current.status==='live');
  assert.equal(current.code,f.text.toString());
});

test('input uses its own read-only document and updates without moving the code focus',async t=>{
  const f=await fixture(t);let current;
  const r=new UsacoReader(candidate,s=>current=s,{endpoint:f.endpoint,fetchMetadata:meta});
  t.after(()=>r.stop());await r.start();await waitFor(()=>current?.status==='live'&&current.inputStatus==='live');
  assert.equal(current.input,'3\n1 2 3\n');const code=current.code,offset=current.editOffset,revision=current.revision;
  let update;f.inputDoc.once('update',u=>update=u);f.inputText.insert(f.inputText.length,'4 5 6\n');
  f.inputSocket.send(syncPacket(2,update));await waitFor(()=>current.input.endsWith('4 5 6\n'));
  assert.equal(current.code,code);assert.equal(current.editOffset,offset);assert.equal(current.revision,revision);
  assert.ok(f.received.every(([type,sub])=>(type===0&&sub===0)||type===3));
});
