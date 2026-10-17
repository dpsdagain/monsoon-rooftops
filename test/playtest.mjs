import assert from 'node:assert/strict';
import { PlaytestSession, feedbackReport } from '../src/playtest-data.mjs';

const session=new PlaytestSession();
assert.equal(session.summary().attempts,0);
session.begin();session.finish({phase:'lost',t:3,z:60,cells:[]});session.finish({phase:'lost',t:3,z:60,cells:[]});
assert.equal(session.runs.length,1,'a result must not be counted twice');
session.begin();const active={phase:'paused',t:4,z:90,cells:[0]};
assert.equal(session.summary(active).last.result,'in progress');assert.equal(session.runs.length,1,'viewing feedback must not finish the run');
session.begin(active);assert.equal(session.runs[1].result,'restarted');
session.finish({phase:'won',t:16,z:384,cells:[0,1,2]});
assert.deepEqual({...session.summary(),last:null},{attempts:3,retries:2,completed:1,bestProgress:100,last:null});
const report=feedbackReport({controls:'Clear',movement:'Fun',again:'Yes',device:'Phone',comment:'The release cue helped.'},session.summary(),'https://example.com/game/');
assert.match(report,/Attempts this visit: 3/);assert.match(report,/Retries: 2/);assert.match(report,/Completed deliveries: 1/);assert.match(report,/Controls: Clear/);assert.match(report,/The release cue helped/);
const invalid=feedbackReport({controls:'arbitrary',comment:'a'.repeat(900)},session.summary(),'https://example.com/game/');assert.match(invalid,/Controls: Not answered/);assert.equal(invalid.split('One thing to improve: ')[1].length,500);
console.log('PASS playtest attempts, retry accounting, completion, report fields and comment bounds');
