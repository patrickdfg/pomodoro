'use strict';
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const STATE_KEY = 'study-bunny-v1';
const TIMER_KEY = 'study-bunny-timer-v1';
const modes = {work:'집중 시간', shortBreak:'짧은 휴식', longBreak:'긴 휴식', free:'나만의 집중 시간'};
const navigation = [['home','home','홈'],['timer','timer','타이머'],['tasks','tasks','할 일'],['decorate','palette','꾸미기'],['stats','chart','공부 기록']];
const themes = [
 {id:'sunny',name:'햇살 공부방',description:'햇살 가득한 오후의 공부방',filter:'none',overlay:'transparent'},
 {id:'moon',name:'달빛 공부방',description:'고요한 달빛 아래, 나만의 집중 시간',filter:'brightness(.63) saturate(.75) hue-rotate(18deg)',overlay:'#7771b94d'},
 {id:'peach',name:'복숭아빛',description:'따뜻한 복숭아빛으로 물든 작은 공간',filter:'sepia(.16) saturate(.85)',overlay:'#ffc3b136'},
 {id:'blossom',name:'벚꽃 오후',description:'벚꽃처럼 포근한 분홍빛 오후',filter:'hue-rotate(323deg) saturate(.78) brightness(1.08)',overlay:'#f5c8df30'},
 {id:'lavender',name:'라벤더 꿈',description:'보랏빛 꿈을 차곡차곡 쌓는 시간',filter:'hue-rotate(310deg) saturate(.65)',overlay:'#d4c2f02e'},
 {id:'mint',name:'초록 정원',description:'초록 정원에서 천천히 자라나요',filter:'hue-rotate(23deg) saturate(.65) brightness(1.07)',overlay:'#e3efcc22'}
];
const accessories = [{id:'none',name:'기본 공부방',emoji:''},{id:'flowers',name:'튤립 화분',emoji:'🌷'},{id:'tea',name:'따뜻한 차',emoji:'☕'},{id:'carrot',name:'당근 간식',emoji:'🥕'}];
function dateKey(date = new Date()) {return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
function defaults(){return {tasks:[],settings:{work:25,shortBreak:5,longBreak:15,free:30,sound:true},theme:'sunny',accessory:'none',goal:100,history:[],onboarded:false};}
function readState(){
 const base=defaults();
 try {
  const saved=JSON.parse(localStorage.getItem(STATE_KEY));
  if(!saved || typeof saved!=='object')return base;
  if(Array.isArray(saved.tasks))base.tasks=saved.tasks.filter(t=>t&&typeof t.id==='string'&&typeof t.title==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(t.date)).map(t=>({...t,title:t.title.slice(0,80),emoji:['📒','📖','✏️','🏋️','🌷'].includes(t.emoji)?t.emoji:'📒',done:!!t.done}));
  for(const key of Object.keys(modes)){const val=Number(saved.settings?.[key]);const max=key==='shortBreak'?60:key==='longBreak'?120:180;if(Number.isInteger(val)&&val>=1&&val<=max)base.settings[key]=val;}
  base.settings.sound=saved.settings?.sound!==false;
  if(themes.some(t=>t.id===saved.theme))base.theme=saved.theme;
  if(accessories.some(a=>a.id===saved.accessory))base.accessory=saved.accessory;
  if(Number.isInteger(saved.goal)&&saved.goal>0&&saved.goal<=1440)base.goal=saved.goal;
  if(Array.isArray(saved.history))base.history=saved.history.filter(h=>h&&typeof h.id==='string'&&typeof h.date==='string'&&Number.isFinite(h.minutes)&&h.minutes>0&&h.minutes<=180&&['work','free'].includes(h.mode));
  base.onboarded=!!saved.onboarded;
 }catch{/* A blocked storage area or corrupt value should not prevent studying. */}
 return base;
}
let state=readState(), storageWarning=false, filter='today', toastId, audioContext, day=dateKey();
function writeJSON(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{if(!storageWarning){storageWarning=true;toast('이 브라우저에서는 저장할 수 없어요. 현재 화면에서는 계속 사용할 수 있어요.');}return false;}}
function updateState(change){const latest=storageWarning?state:readState();change(latest);state=latest;writeJSON(STATE_KEY,state);}
function uniqueId(){return globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;}
if(!state.onboarded){updateState(s=>{s.tasks=[['📒','수학 문제 풀기'],['📖','영어 단어 30개 외우기'],['📖','독서 30분 하기'],['🏋️','운동하기'],['✏️','일기 쓰기']].map(([emoji,title])=>({id:uniqueId(),emoji,title,date:day,done:false}));s.onboarded=true;});}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastId);toastId=setTimeout(()=>$('#toast').classList.remove('visible'),3800);}
function icon(name,cls='icon'){return `<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;}
for(const nav of $$('.desktop-nav,.mobile-nav'))nav.innerHTML=navigation.map(([view,svg,label])=>`<button data-view-link="${view}">${icon(svg)}<span>${label}</span></button>`).join('');
function setView(){const view=location.hash.slice(1);document.body.dataset.view=navigation.some(n=>n[0]===view)?view:'home';const active=document.body.dataset.view;$$('[data-view-link]').forEach(b=>{b.classList.toggle('active',b.dataset.viewLink===active);if(b.dataset.viewLink===active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});$('.stats-panel').hidden=active!=='stats';renderStats();}
window.addEventListener('hashchange',()=>{setView();window.scrollTo({top:0,behavior:'instant'});});
function taskRow(task,compact){
 const row=document.createElement('li');row.className=`task-row${task.done?' done':''}`;
 const check=document.createElement('button');check.className='check-task';check.dataset.toggleTask=task.id;check.setAttribute('aria-pressed',String(task.done));check.setAttribute('aria-label',`${task.title} ${task.done?'완료 취소':'완료하기'}`);check.textContent='✓';
 const emoji=document.createElement('span');emoji.className='task-emoji';emoji.textContent=task.emoji;emoji.setAttribute('aria-hidden','true');
 const title=document.createElement('span');title.className='task-title';title.textContent=task.title;
 if(!compact&&filter!=='today'){const due=document.createElement('small');due.className='task-due';due.textContent=` ${Number(task.date.slice(5,7))}/${Number(task.date.slice(8))}`;title.append(due);}
 const pet=document.createElement('span');pet.innerHTML=icon('bunny','task-pet');
 row.append(check,emoji,title,pet);
 if(!compact){const remove=document.createElement('button');remove.className='delete-task';remove.dataset.deleteTask=task.id;remove.setAttribute('aria-label',`${task.title} 삭제`);remove.textContent='×';row.append(remove);}
 return row;
}
function fillTasks(selector,tasks,compact){const list=$(selector);list.replaceChildren();if(!tasks.length){const empty=document.createElement('li');empty.className='empty-tasks';empty.textContent=filter==='done'&&!compact?'완료한 할 일이 여기에 모여요. ♡':'새로운 작은 할 일을 적어볼까요?';list.append(empty);}else tasks.forEach(t=>list.append(taskRow(t,compact)));}
function renderTasks(){
 const today=dateKey(),todayTasks=state.tasks.filter(t=>t.date===today),done=todayTasks.filter(t=>t.done).length;
 fillTasks('#home-tasks',todayTasks.slice(0,5),true);
 const start=new Date();start.setHours(0,0,0,0);start.setDate(start.getDate()-((start.getDay()+6)%7));const end=new Date(start);end.setDate(end.getDate()+6);
 const shown=state.tasks.filter(t=>filter==='today'?t.date===today:filter==='week'?t.date>=dateKey(start)&&t.date<=dateKey(end):filter==='done'?t.done:true);
 fillTasks('#all-tasks',shown,false);
 $('#home-progress-text').textContent=`${done}/${todayTasks.length} 완료`;
 const percentage=todayTasks.length?done/todayTasks.length*100:0;$('#task-progress').style.width=`${percentage}%`;$('.progress-track').style.setProperty('--progress',`${Math.max(3,Math.min(97,percentage))}%`);
 $$('.filter-tabs button').forEach(b=>{const active=b.dataset.filter===filter;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
}
function renderDecor(){
 const theme=themes.find(t=>t.id===state.theme);document.body.dataset.theme=theme.id;document.documentElement.style.setProperty('--room-filter',theme.filter);document.documentElement.style.setProperty('--room-overlay',theme.overlay);
 $('#theme-grid').innerHTML=themes.map(t=>`<button class="theme-choice" data-theme-choice="${t.id}" aria-label="${t.name}" aria-pressed="${t.id===state.theme}" style="--thumb-filter:${t.filter};--thumb-overlay:${t.overlay}"><img src="assets/study-room.webp" alt="" loading="lazy"><span class="theme-name">${t.name}</span>${t.id===state.theme?'<span class="theme-check" aria-hidden="true">✓</span>':''}</button>`).join('');
 $('#accessory-grid').innerHTML=accessories.map(a=>`<button class="accessory-choice" data-accessory="${a.id}" aria-pressed="${a.id===state.accessory}"><span aria-hidden="true">${a.emoji||'♡'}</span>${a.name}</button>`).join('');
 $$('.scene-accessory').forEach(el=>el.textContent=accessories.find(a=>a.id===state.accessory).emoji);$('#decor-caption').textContent=theme.description;
}
function records(date){const entries=state.history.filter(h=>h.date===date);return {minutes:entries.reduce((s,h)=>s+h.minutes,0),sessions:entries.filter(h=>h.mode==='work').length};}
function renderStats(){
 const today=records(dateKey());$('#total-time').textContent=`${today.minutes}분`;$('#completed-count').textContent=`${today.sessions}회`;
 $('#stats-minutes').innerHTML=`${today.minutes}<small>분</small>`;$('#stats-sessions').innerHTML=`${today.sessions}<small>회</small>`;
 $('#goal-message').textContent=today.minutes>=state.goal?`오늘의 ${state.goal}분 목표를 달성했어요! 정말 멋져요. ♡`:`오늘의 목표 ${state.goal}분 중 ${today.minutes}분을 채웠어요. 천천히 함께해요!`;
 const days=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-6+i);return {key:dateKey(d),label:i===6?'오늘':`${d.getMonth()+1}/${d.getDate()}`,minutes:records(dateKey(d)).minutes};});const max=Math.max(60,...days.map(d=>d.minutes));
 $('#week-chart').innerHTML=days.map((d,i)=>`<div class="chart-column${i===6?' today':''}" aria-label="${d.key}: ${d.minutes}분"><span>${d.minutes}</span><div class="chart-bar" style="--bar-height:${Math.max(3,d.minutes/max*145)}px"></div><span>${d.label}</span></div>`).join('');
 const cycle=today.sessions%4;$('#session-label').textContent=`포모도로 ${cycle+1}/4`;$('#session-bunnies').innerHTML=Array.from({length:4},(_,i)=>icon('bunny',i<cycle?'complete':'')).join('');$('#session-bunnies').setAttribute('aria-label',`이번 사이클 ${cycle}회 완료`);
}
function renderDate(){const now=new Date();$('#today-date').textContent=`${now.getMonth()+1}월 ${now.getDate()}일 (${['일','월','화','수','목','금','토'][now.getDay()]})`;$('#greeting').textContent=now.getHours()<12?'좋은 아침이에요!':now.getHours()<18?'좋은 하루예요!':'포근한 저녁이에요!';}
function freshTimer(mode='work'){return {id:uniqueId(),mode,total:state.settings[mode]*60,remaining:state.settings[mode]*60,running:false,endAt:0};}
function readTimer(){try{const t=JSON.parse(localStorage.getItem(TIMER_KEY));if(t&&typeof t.id==='string'&&Object.hasOwn(modes,t.mode)&&Number.isInteger(t.total)&&t.total>0&&t.total<=10800&&Number.isFinite(t.remaining)&&t.remaining>=0&&t.remaining<=t.total&&typeof t.running==='boolean'&&(!t.running||(Number.isFinite(t.endAt)&&t.endAt>0&&t.endAt<=Date.now()+10800000)))return t;}catch{}return freshTimer();}
let timer=readTimer();
function saveTimer(){writeJSON(TIMER_KEY,timer);}
function renderTimer(){
 const mins=Math.floor(timer.remaining/60),secs=timer.remaining%60;const text=`${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
 $('#timer-display').textContent=text;document.title=`${timer.running?`(${text}) `:''}Study Bunny · 나의 작은 집중 공간`;
 $('#timer-ring').style.setProperty('--angle',`${(1-timer.remaining/timer.total)*360}deg`);$('#mode-label').textContent=modes[timer.mode];
 $('#btn-start span').textContent=timer.running?'일시정지':timer.remaining<timer.total?'계속하기':'시작하기';$('#btn-start svg').style.display=timer.running?'none':'';
 $('#btn-start').setAttribute('aria-label',timer.running?'타이머 일시정지':'타이머 시작');
 const status=timer.mode==='work'||timer.mode==='free'?'지금,<br><strong>좋은 집중을 하고 있어요!</strong><br>토끼도 함께 집중할게요. ♡':'잠깐,<br><strong>쉬어가도 괜찮아요.</strong><br>토끼와 함께 에너지를 채워요. ♡';$('#timer-status').innerHTML=status;
 $$('[data-mode]').forEach(b=>{const active=b.dataset.mode===timer.mode;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));b.querySelector('small').textContent=`(${state.settings[b.dataset.mode]}분)`;});
}
function initAudio(){try{audioContext??=new(window.AudioContext||window.webkitAudioContext)();if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});}catch{}}
function playAlarm(){if(!state.settings.sound||!audioContext)return;try{[0,.2,.4].forEach((offset,i)=>{const oscillator=audioContext.createOscillator(),gain=audioContext.createGain(),start=audioContext.currentTime+offset;oscillator.frequency.value=[523.25,659.25,783.99][i];gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(.12,start+.02);gain.gain.exponentialRampToValueAtTime(.0001,start+.3);oscillator.connect(gain);gain.connect(audioContext.destination);oscillator.start(start);oscillator.stop(start+.31);});}catch{}}
function completeTimer(){
 const finished={...timer};
 if(['work','free'].includes(finished.mode))updateState(s=>{if(!s.history.some(h=>h.id===finished.id)){s.history.push({id:finished.id,date:dateKey(new Date(finished.endAt)),minutes:finished.total/60,mode:finished.mode});}});
 const sessions=records(dateKey(new Date(finished.endAt))).sessions;
 timer=freshTimer(finished.mode==='work'?(sessions%4===0?'longBreak':'shortBreak'):finished.mode==='free'?'free':'work');saveTimer();renderTimer();renderStats();playAlarm();
 toast(finished.mode==='work'?`집중 완료! ${sessions%4===0?'긴':'짧은'} 휴식을 시작해봐요. ♡`:finished.mode==='free'?'나만의 집중 시간을 채웠어요! ♡':'휴식 끝! 다시 토끼와 함께 집중해볼까요?');
}
function tick(){
 if(day!==dateKey()){day=dateKey();state=storageWarning?state:readState();renderDate();renderTasks();renderStats();}
 if(!timer.running)return;
 timer.remaining=Math.max(0,Math.ceil((timer.endAt-Date.now())/1000));renderTimer();if(timer.remaining===0)completeTimer();
}
$('#btn-start').addEventListener('click',()=>{if(timer.running){tick();if(timer.running){timer.running=false;timer.endAt=0;saveTimer();renderTimer();}}else{initAudio();timer.running=true;timer.endAt=Date.now()+timer.remaining*1000;saveTimer();renderTimer();}});
$('#btn-reset').addEventListener('click',()=>{if(timer.running&&!confirm('진행 중인 타이머를 처음부터 다시 시작할까요?'))return;timer=freshTimer(timer.mode);saveTimer();renderTimer();toast('타이머를 처음으로 되돌렸어요.');});
function switchMode(mode){if(timer.running&&!confirm('타이머가 진행 중이에요. 모드를 바꾸면 초기화돼요. 바꿀까요?'))return;timer=freshTimer(mode);saveTimer();renderTimer();}
function openDialog(action){
 if(action==='add-task'){const form=$('#task-form');form.reset();form.elements.date.value=dateKey();$('#task-dialog').showModal();form.elements.title.focus();}
 if(action==='settings'){const form=$('#settings-form');Object.keys(modes).forEach(m=>form.elements[m].value=state.settings[m]);form.elements.sound.checked=state.settings.sound;$('#settings-dialog').showModal();}
 if(action==='goal'){$('#goal-form').elements.goal.value=state.goal;$('#goal-dialog').showModal();}
}
document.addEventListener('click',event=>{
 const button=event.target.closest('button');if(!button)return;
 if(button.dataset.viewLink)location.hash=button.dataset.viewLink;
 if(button.dataset.action)openDialog(button.dataset.action);
 if(button.hasAttribute('data-close'))button.closest('dialog').close();
 if(button.dataset.mode)switchMode(button.dataset.mode);
 if(button.dataset.filter){filter=button.dataset.filter;renderTasks();}
 if(button.dataset.toggleTask){let done;updateState(s=>{const task=s.tasks.find(t=>t.id===button.dataset.toggleTask);if(task){task.done=!task.done;done=task.done;}});renderTasks();if(done)toast('작은 할 일 하나 완료! 정말 잘했어요. ♡');}
 if(button.dataset.deleteTask){updateState(s=>s.tasks=s.tasks.filter(t=>t.id!==button.dataset.deleteTask));renderTasks();toast('할 일을 지웠어요.');}
 if(button.dataset.themeChoice){updateState(s=>s.theme=button.dataset.themeChoice);renderDecor();toast('공부방 분위기를 바꿨어요. ♡');}
 if(button.dataset.accessory){updateState(s=>s.accessory=button.dataset.accessory);renderDecor();toast('나만의 작은 공간을 꾸몄어요. ♡');}
 if(button.dataset.decor){const isBackground=button.dataset.decor==='background';$('#theme-grid').hidden=!isBackground;$('#accessory-grid').hidden=isBackground;$$('[data-decor]').forEach(b=>{const active=b===button;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});}
});
$('#task-form').addEventListener('submit',event=>{event.preventDefault();const form=event.currentTarget,title=form.elements.title.value.trim();if(!title){form.elements.title.setCustomValidity('할 일을 적어주세요.');form.elements.title.reportValidity();return;}updateState(s=>s.tasks.push({id:uniqueId(),title,emoji:form.elements.emoji.value,date:form.elements.date.value,done:false}));renderTasks();$('#task-dialog').close();toast('새로운 작은 할 일을 추가했어요. ♡');});
$('#task-form').elements.title.addEventListener('input',event=>event.target.setCustomValidity(''));
$('#settings-form').addEventListener('submit',event=>{event.preventDefault();const form=event.currentTarget;updateState(s=>{Object.keys(modes).forEach(m=>s.settings[m]=Number(form.elements[m].value));s.settings.sound=form.elements.sound.checked;});timer=freshTimer(timer.mode);saveTimer();renderTimer();$('#settings-dialog').close();toast('나에게 맞는 집중 리듬을 저장했어요.');});
$('#goal-form').addEventListener('submit',event=>{event.preventDefault();updateState(s=>s.goal=Number(event.currentTarget.elements.goal.value));renderStats();$('#goal-dialog').close();toast('오늘의 목표를 저장했어요. 함께 해봐요!');});
window.addEventListener('storage',event=>{if(event.key===STATE_KEY){state=readState();renderTasks();renderStats();renderDecor();}if(event.key===TIMER_KEY){timer=readTimer();tick();renderTimer();}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){tick();renderDate();}});
renderDate();renderTasks();renderDecor();renderStats();setView();tick();renderTimer();setInterval(tick,250);

