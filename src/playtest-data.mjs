export const PLAYTEST_VERSION = 'EARLY PROTOTYPE 01';

export class PlaytestSession {
  constructor() { this.attempts=0; this.runs=[]; this.open=false; }
  begin(previous) {
    if(this.open&&previous)this.finish(previous,'restarted');
    this.attempts++;this.open=true;
  }
  finish(state,result=state.phase) {
    if(!this.open)return;
    this.runs.push({result:['won','lost','restarted'].includes(result)?result:'restarted',seconds:Math.max(0,Number(state.t)||0),progress:result==='won'?100:Math.round(Math.max(0,Math.min(100,(Number(state.z)||0)/400*100))),cells:Array.isArray(state.cells)?state.cells.length:0});
    this.open=false;
  }
  summary(current) {
    const all=[...this.runs];
    if(this.open&&current)all.push({result:'in progress',seconds:Math.max(0,Number(current.t)||0),progress:Math.round(Math.max(0,Math.min(100,(Number(current.z)||0)/400*100))),cells:current.cells?.length||0});
    return {attempts:this.attempts,retries:Math.max(0,this.attempts-1),completed:all.filter(r=>r.result==='won').length,bestProgress:Math.max(0,...all.map(r=>r.progress)),last:all.at(-1)||null};
  }
}

export function feedbackReport(answers,summary,url) {
  const choice=(value,allowed)=>allowed.includes(value)?value:'Not answered';
  const lines=[`STORMLINE — ${PLAYTEST_VERSION}`,url,'',`Controls: ${choice(answers.controls,['Clear','Partly clear','Confusing'])}`,`Movement: ${choice(answers.movement,['Fun','Okay','Frustrating'])}`,`Another level? ${choice(answers.again,['Yes','Maybe','No'])}`,`Device: ${choice(answers.device,['Phone','Tablet','Computer','Not specified'])}`,'',`Attempts this visit: ${summary.attempts}`,`Retries: ${summary.retries}`,`Completed deliveries: ${summary.completed}`,`Furthest progress: ${summary.bestProgress}%`];
  if(summary.last)lines.push(`Latest run: ${summary.last.result}, ${summary.last.seconds.toFixed(1)}s, ${summary.last.cells}/3 cells`);
  lines.push('',`One thing to improve: ${String(answers.comment||'No comment').trim().slice(0,500)}`);
  return lines.join('\n');
}
