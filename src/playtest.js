import { feedbackReport } from './playtest-data.mjs';
import './playtest.css';

export function attachPlaytestFeedback({root,session,getState,onOpen}) {
  const dialog=document.createElement('dialog');dialog.id='sl-feedback';dialog.className='sl-feedback';dialog.setAttribute('aria-labelledby','sl-feedback-title');
  dialog.innerHTML=`<form id="sl-feedback-form"><div class="sl-feedback-top"><span>EARLY PROTOTYPE / PLAYTEST</span><button type="button" class="sl-feedback-close" aria-label="Close feedback">✕</button></div><h2 id="sl-feedback-title">How did the run feel?</h2><p class="sl-feedback-intro">Three quick answers help shape the next version.</p>
    <fieldset><legend>Did the controls make sense?</legend>${radios('controls',['Clear','Partly clear','Confusing'])}</fieldset>
    <fieldset><legend>How did the movement feel?</legend>${radios('movement',['Fun','Okay','Frustrating'])}</fieldset>
    <fieldset><legend>Would you try another level?</legend>${radios('again',['Yes','Maybe','No'])}</fieldset>
    <label class="sl-feedback-label">What did you play on?<select name="device"><option>Not specified</option><option>Phone</option><option>Tablet</option><option>Computer</option></select></label>
    <label class="sl-feedback-label">One thing to improve <span>(optional)</span><textarea name="comment" maxlength="500" rows="2" placeholder="A confusing moment, something you liked, or a change you want…"></textarea></label>
    <p class="sl-feedback-note" id="sl-feedback-session"></p><p class="sl-feedback-note">Nothing is sent automatically. Copy your answers and paste them back to the person who sent you this game.</p>
    <button class="sl-primary sl-feedback-copy" type="submit">COPY FEEDBACK <span>↗</span></button><p role="status" class="sl-feedback-status"></p><textarea class="sl-feedback-report" aria-label="Your feedback report" readonly hidden rows="7"></textarea></form>`;
  root.append(dialog);
  dialog.querySelector('.sl-feedback-close').onclick=()=>dialog.close();
  const status=dialog.querySelector('[role=status]'),report=dialog.querySelector('.sl-feedback-report');
  dialog.querySelector('form').addEventListener('submit',async event=>{
    event.preventDefault();const fields=new FormData(event.currentTarget),answers=Object.fromEntries(fields);
    const text=feedbackReport(answers,session.summary(getState()),`${location.origin}${location.pathname}`);
    report.value=text;report.hidden=false;
    try {await navigator.clipboard.writeText(text);status.textContent='Copied. Paste this report back to your playtest host.';}
    catch {status.textContent='Select and copy the report below, then send it back to your playtest host.';report.focus();report.select();}
  });
  return {
    dialog,
    open() {
      onOpen?.();const s=session.summary(getState());
      dialog.querySelector('#sl-feedback-session').textContent=`This report includes your answers and this visit’s ${s.attempts} attempt${s.attempts===1?'':'s'}, ${s.retries} retr${s.retries===1?'y':'ies'} and ${s.completed} completed deliver${s.completed===1?'y':'ies'}.`;
      status.textContent='';report.hidden=true;dialog.showModal();
    },
  };
}

function radios(name,values) {return `<div class="sl-feedback-options">${values.map(value=>`<label><input type="radio" name="${name}" value="${value}" required><span>${value}</span></label>`).join('')}</div>`;}
