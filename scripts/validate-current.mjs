import {readFileSync} from 'node:fs';
import {validateSnapshot,eligible,transform,compare} from '../lib/prices.ts';
const s=JSON.parse(readFileSync(new URL('../data/snapshot.json',import.meta.url)));
validateSnapshot(s);
for(const [frequency,basis] of [['weekly','nominal'],['monthly','nominal'],['monthly','real']]){
 const valid=eligible(s,frequency,basis);if(valid.length<2)throw Error('Insufficient matched observations');
 const endpoint=valid.at(-1).period;const baseline=valid.at(-2).period;
 compare(transform(s,frequency,basis,endpoint),baseline,endpoint,15);
}
console.log('Current snapshot and all three comparison modes validated:',s.snapshotId);
