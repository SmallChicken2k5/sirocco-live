import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ResultJournal, BoardJournal, classifyResult, problemLabel, resultStyle, displayName } from '../lib/results.mjs';
import { defaultConfig, normalizeConfig } from '../lib/config.mjs';
const sub=(id,points,verdict='PARTIAL',index='A')=>({id,points,verdict,index,testing:false});
const problems=[{index:'A',maxPoints:100},{index:'B',maxPoints:100}];
test('ICPC shows AC instead of numeric points; IOI preserves scores and real names',()=>{
  assert.equal(problemLabel({points:1},'ICPC'),'AC');assert.equal(problemLabel({points:100},'ICPC'),'AC');assert.equal(problemLabel({points:0,rejectedAttempts:2},'ICPC'),'−2');assert.equal(problemLabel({points:70},'IOI'),'70');
  assert.equal(resultStyle({style:'IOI'},{type:'ICPC'}),'IOI');assert.equal(resultStyle({style:'auto'},{type:'ICPC'}),'ICPC');assert.equal(displayName({name:'nick',realName:'Nguyễn An'}),'Nguyễn An');
});
test('config round trip preserves explicit style, independent effects/sound, volume and real name',()=>{
  const c=defaultConfig();c.candidates=[{id:'p',name:'nick',realName:' Nguyễn An ',group:'nonpro'}];Object.assign(c.groups.nonpro.codeforces,{style:'IOI',effects:false,sound:true,volume:150});const n=normalizeConfig(JSON.parse(JSON.stringify(c)));
  assert.equal(n.candidates[0].realName,'Nguyễn An');assert.equal(n.groups.nonpro.codeforces.style,'IOI');assert.equal(n.groups.nonpro.codeforces.effects,false);assert.equal(n.groups.nonpro.codeforces.sound,true);assert.equal(n.groups.nonpro.codeforces.volume,100);
});
test('result colors distinguish AC, failures, improvement, full marks, decrease and equality',()=>{
  assert.equal(classifyResult(sub(1,1,'OK'),0,'ICPC').tone,'success');assert.equal(classifyResult(sub(1,0,'WRONG_ANSWER'),1,'ICPC').tone,'failure');
  assert.equal(classifyResult(sub(1,60),40,'IOI').label,'Tăng điểm');assert.equal(classifyResult(sub(1,40),60,'IOI').label,'Giảm điểm');assert.equal(classifyResult(sub(1,100,'OK'),100,'IOI').tone,'success');assert.equal(classifyResult(sub(1,40),40,'IOI'),null);assert.equal(classifyResult({...sub(1,100),testing:true},0,'IOI'),null);
});
test('submission journal ignores initial history, duplicate polls, rank changes, and rejudges',()=>{
  const j=new ResultJournal();assert.deepEqual(j.consume([sub(1,40)],'IOI',problems,1000),[]);
  let e=j.consume([sub(1,40),sub(2,70)],'IOI',problems,2000);assert.equal(e.length,1);assert.equal(e[0].tone,'success');assert.equal(e[0].previousPoints,40);
  e=j.consume([sub(3,20),sub(2,70),sub(1,40)],'IOI',problems,3000);assert.equal(e.length,2);assert.equal(e[1].tone,'failure');assert.equal(e[1].previousPoints,70);
  assert.equal(j.consume([sub(3,100,'OK'),sub(2,70),sub(1,40)],'IOI',problems,4000).length,2);
  assert.equal(j.consume([sub(0,100,'OK'),sub(3,20)],'IOI',problems,5000).length,2);
});
test('pending submissions finishing after newer results are emitted exactly once, per problem',()=>{
  const j=new ResultJournal();j.consume([sub(1,0,'WA'),{...sub(2,null,'TESTING'),testing:true}],'ICPC',problems,1000);
  j.consume([sub(3,0,'WA','B'),{...sub(2,null,'TESTING'),testing:true},sub(1,0,'WA')],'ICPC',problems,2000);
  const e=j.consume([sub(3,0,'WA','B'),sub(2,1,'AC'),sub(1,0,'WA')],'ICPC',problems,3000);assert.equal(e.length,2);assert.equal(e[1].index,'A');assert.equal(e[1].tone,'success');assert.equal(j.consume([sub(2,1,'AC')],'ICPC',problems,4000).length,2);
});
test('scoreboard fallback detects only supported deltas, never invents a lower-score submission',()=>{
  const j=new BoardJournal();const p=(points,rejectedAttempts)=>({problems:[{index:'A',points,rejectedAttempts}]});assert.deepEqual(j.consume(p(0,0),'ICPC',1000),[]);
  assert.equal(j.consume(p(0,1),'ICPC',2000)[0].tone,'failure');assert.equal(j.consume(p(1,1),'ICPC',3000)[1].label,'AC');assert.equal(j.consume(p(1,1),'ICPC',4000).length,2);
});
test('a problem outside the recent API history uses the connected standings baseline, avoiding a false improvement',()=>{
  const j=new ResultJournal();j.consume([sub(1,50,'PARTIAL','B')],'IOI',problems,1000,[{index:'A',points:80}]);const events=j.consume([sub(2,60,'PARTIAL','A'),sub(1,50,'PARTIAL','B')],'IOI',problems,2000);assert.equal(events[0].tone,'failure');assert.equal(events[0].previousPoints,80);
});
