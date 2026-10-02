import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateSnapshot,eligible,transform,preset,compare,crossesBreak,stale,buildCsv,anniversary} from '../lib/prices.ts';
const s=JSON.parse(readFileSync(new URL('../data/snapshot.json',import.meta.url)));
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
test('Independent arithmetic fixture: nominal, real, gaps and gallons',()=>{
 const rows=[{period:'2020-01',ca:4,us:3},{period:'2021-01',ca:5,us:3.5}];
 const r=compare(rows,'2020-01','2021-01',15);assert.deepEqual([r.delta,r.percent,r.gapA,r.gapB,r.gapDelta,r.fillup],[1,25,1,1.5,.5,15]);
 const real=transform({...s,monthly:rows,cpi:[{period:'2020-01',value:100},{period:'2021-01',value:125}]},'monthly','real','2021-01');
 const t=compare(real,'2020-01','2021-01',15);assert.equal(t.a.ca,5);assert.equal(t.a.us,3.75);assert.equal(t.delta,0);assert.equal(t.gapDelta,.25);
});
test('Decline, narrowing and same-period zeros',()=>{
 const rows=[{period:'2020-01',ca:5,us:3},{period:'2021-01',ca:4,us:3}];const r=compare(rows,'2020-01','2021-01',10);close(r.percent,-20);assert.equal(r.gapDelta,-1);assert.equal(r.fillup,-10);
 const zero=compare(rows,'2021-01','2021-01',15);assert.equal(zero.delta,0);assert.equal(zero.percent,0);assert.equal(zero.gapDelta,0);
});
test('Missing observations/CPI cannot produce a comparison',()=>{
 const rows=[{period:'2020-01',ca:null,us:3},{period:'2021-01',ca:4,us:3}];assert.throws(()=>compare(rows,'2020-01','2021-01',15));
 const v=transform({...s,monthly:rows,cpi:[{period:'2021-01',value:125}]},'monthly','real','2021-01');assert.equal(v[0].ca,null);assert.equal(v[0].us,null);
 assert.throws(()=>compare(rows,'2021-01','2020-01',15));for(const g of [NaN,Infinity,0,101])assert.throws(()=>compare(rows,'2021-01','2021-01',g));
});
test('Preset offsets, absent months and leap anniversaries',()=>{
 const w=[{period:'2025-09-22',ca:4,us:3}];assert.equal(preset(w,'2026-09-28',1,'weekly'),'2025-09-22');assert.equal(preset(w,'2026-09-30',1,'weekly'),null);
 assert.equal(preset([{period:'2024-10',ca:4,us:3}],'2025-09',1,'monthly'),null);assert.equal(anniversary('2024-02-29',1,'weekly'),'2023-02-28');
});
test('Duplicate, zero, and wrong-series snapshots fail validation',()=>{
 validateSnapshot(s);for(const mutate of [x=>x.weekly.push(x.weekly[0]),x=>x.monthly[0].ca=0,x=>x.series.ca='wrong',x=>x.cpi.push(x.cpi[0])]){const copy=structuredClone(s);mutate(copy);assert.throws(()=>validateSnapshot(copy));}
});
test('Actual shared endpoints, missing October CPI and transparent breaks',()=>{
 assert.equal(eligible(s,'weekly','nominal').at(-1).period,s.coverage.weekly.last);assert.equal(eligible(s,'monthly','nominal').at(-1).period,s.coverage.monthly.last);assert.equal(eligible(s,'monthly','real').at(-1).period,s.realEndpoint);
 assert.ok(!eligible(s,'monthly','real').some(r=>r.period==='2025-10'));assert.ok(crossesBreak('2018-05','2018-05','monthly'));assert.ok(crossesBreak('2018-05-07','2018-05-14','weekly'));assert.ok(!crossesBreak('2018-06','2026-09','monthly'));
 assert.ok(stale('2026-09-01','weekly',new Date('2026-10-01')));assert.ok(!stale('2026-09','monthly',new Date('2026-10-01')));
});
test('CSV carries date, basis, sources, precision, snapshot and context',()=>{
 const endpoint='2026-08',rows=transform(s,'monthly','real',endpoint),baseline='2025-08';const csv=buildCsv({s,frequency:'monthly',basis:'real',baseline,endpoint,gallons:15,rows});
 for(const text of [s.snapshotId,'CUUR0000SA0','baseline','endpoint','2026-08','EMM_EPMR_PTE_SCA_DPG','May 14, 2018','real_price'])assert.ok(csv.includes(text));
 const missing=csv.split('\r\n').find(line=>line.startsWith('"2025-10"'));assert.ok(missing.includes('"","",""'));assert.ok(csv.includes('ca_change_percent'));
});
