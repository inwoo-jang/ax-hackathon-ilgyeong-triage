// ===== 규칙(코드) 계산: 수당 구간·금액. AI 아님 =====
const PAY = {
  jt: [[0.90,150000],[0.70,131250],[0.60,112500],[0.50,93750],[0,0]],
  we: [[0.90,300000],[0.70,262500],[0.60,225000],[0.50,187500],[0,0]]
};
const BLABEL = ['90%+','70-90%','60-70%','50-60%','<50% 미지급'];
const THR = [0.90,0.70,0.60,0.50];
const FULL = PAY.jt[0][1] + PAY.we[0][1]; // 만점 총수당 450,000

function tierOf(r){ for(let i=0;i<THR.length;i++){ if(r>=THR[i]) return i; } return 4; }
function payOf(r,k){ return PAY[k][tierOf(r)][1]; }
function bandOf(r){ return BLABEL[tierOf(r)]; }
const won = n => (n<0?'-':'')+'₩'+Math.abs(Math.round(n)).toLocaleString('ko-KR');
const pct = r => r==null?'—':Math.round(r*100)+'%';
// 현재 출석률 셀: P2가 막 시작돼 현재 기간 데이터가 없으면(—) 지난 P1 출석률을 병기.
// 지난 기간이 미지급(<50%)이면 빨간색(출석 장려 필요), 아니면 회색.
function curRate(p, k){
  const c = p[k==='jt'?'jc':'wc'];
  if(c.cur!=null) return pct(c.cur);
  const past = fullRate(p,k,0,3);
  const col = past<0.50 ? 'var(--red)' : 'var(--mut2)';
  return `<span style="color:${col}">—<small style="font-weight:500;margin-left:2px">지난 ${pct(past)}</small></span>`;
}
function pgParts(pg){ const i=pg.lastIndexOf('_'); return i<0?{name:pg,code:''}:{name:pg.slice(0,i),code:pg.slice(i+1)}; }
function pgLabel(pg){ const {name,code}=pgParts(pg); const we=name.includes('일경험'); return `<span class="pglabel ${we?'we':'jt'}">${name}</span>${code?`<span class="pgcode">${code}</span>`:''}`; }
function gchip(g){ return `<span class="gtxt">(${g})</span>`; }
function pchip(cw){ const s=cw<=4?'p1':'p2'; return `<span class="pchip ${s}">${s.toUpperCase()}</span>`; }
function docChip(doc){ return doc==='미비' ? `<span class="doc-chip miss">미비</span>` : `<span class="doc-chip ok">완료</span>`; }
function docToggle(doc){ const ok=doc!=='미비'; return `<span class="doc-ctrl" onclick="toggleDoc()"><span style="font-size:11px;font-weight:600;color:var(--mut)">서류 제출</span> <span class="sw sw-doc ${ok?'on':''}"></span> <b style="font-size:11.5px;color:${ok?'var(--green)':'var(--amber)'}">${ok?'완료':'미비'}</b></span>`; }
function toggleDoc(){
  if(!CUR) return;
  CUR.doc = CUR.doc==='미비'?'완료':'미비';
  CUR.actionable = (CUR.feasib==='결정적') || (CUR.doc==='미비' && CUR.feasib!=='만회불가');
  const c=document.getElementById('docCtrl'); if(c) c.innerHTML=docToggle(CUR.doc);
  toast('서류 '+CUR.doc+'(으)로 변경'+(CUR.doc==='미비'?' · 지급 보류 위험':''));
}
const hrs = (a,t)=>`<span class="hours"><b>${a}</b><span class="u">/${t}h</span></span>`;
// 더미 연락처 (전 참여자 동일) · 개인정보라 기본 숨김, 참고용(전화연결 X)
const CONTACT = { main:'010-0000-0000', sub:'010-1111-1111' };
const DEMO_DAY = 20; // 데모 기준일 2026-06-20
function contactRow(){
  return `<div class="qcontact"><span class="phone" onclick="event.stopPropagation()">📞 ${CONTACT.main}</span><span class="phone sub" onclick="event.stopPropagation()">보조 ${CONTACT.sub}</span></div>`;
}

// ===== 현재 주차(기준 시점): 프로그램(코호트)별로 다름 =====
const PROGS = [...new Set(DATA.map(d=>d.pg))].sort();
const CW = {}; PROGS.forEach((p,i)=>{ CW[p] = 2 + (i*3 % 7); }); // 2~8주차 분산(최소 1주 이력 확보)

// 종료까지 남은 주: 8주 일정 기준. 0 = 마지막주
function weeksLeft(p){ return 8 - p.cw; }
function ddayBadge(p){
  const wl=weeksLeft(p);
  return `<span class="badge dday">${wl<=0?'마지막주':'종료 D-'+wl+'주'}</span>`;
}

// ===== 만회 계산: 수당은 4주 기간(P1:1~4주 / P2:5~8주)별 정산. 현재 주차가 속한 기간을 기준으로 만회 판단 =====
function curPeriod(cw){ return cw<=4 ? [0,3,'1~4주'] : [4,7,'5~8주']; }
function fullRate(p,k,s,e){ let a=0,t=0; for(let i=s;i<=e;i++){a+=p[k+'_w'][i];t+=p[k+'_wt'][i];} return t?a/t:0; }
function periodConf(p,k,s,e){ let a=0,t=0; for(let i=s;i<=e;i++){ if(i<=p.cw-2){a+=p[k+'_w'][i];t+=p[k+'_wt'][i];} } return t?a/t:null; } // 현재 주차 이전(확정)만
function kcalc(p,k){
  const cw=p.cw, att=p[k+'_w'], tot=p[k+'_wt'];
  const [s,e,plabel]=curPeriod(cw);
  let cAtt=0,cTot=0,remTot=0,pTot=0;
  for(let i=s;i<=e;i++){
    pTot+=tot[i];
    if(i<=cw-2){ cAtt+=att[i]; cTot+=tot[i]; } else remTot+=tot[i]; // 현재 주차 이전=확정 / 이후=남은
  }
  const cur=cTot>0?cAtt/cTot:null, max=pTot?(cAtt+remTot)/pTot:0, min=pTot?cAtt/pTot:0;
  return {cw,plabel,cAtt,cTot,remTot,pTot,cur,max,min};
}

// 참여자 파생값 계산 (출석 시간 수정 시 재호출해 재계산)
function derive(p){
  p.p2stage = p.cw>4;
  p.jc = kcalc(p,'jt'); p.wc = kcalc(p,'we');
  p.settledPay = p.p2stage ? (payOf(fullRate(p,'jt',0,3),'jt')+payOf(fullRate(p,'we',0,3),'we')) : 0;
  const jExp = p.jc.cur!=null ? p.jc.cur : fullRate(p,'jt',0,3);
  const wExp = p.wc.cur!=null ? p.wc.cur : fullRate(p,'we',0,3);
  p.expPay = payOf(jExp,'jt') + payOf(wExp,'we');
  p.maxPay = payOf(p.jc.max,'jt') + payOf(p.wc.max,'we');
  p.minPay = payOf(p.jc.min,'jt') + payOf(p.wc.min,'we');
  p.swing = Math.max(0, p.maxPay - p.expPay); // 개입가치 = 최대 출석 시 − 현재 출석률 유지 시
  const failBoth = p.jc.max < 0.50 && p.wc.max < 0.50;
  const bothTop = (p.jc.cur!=null&&p.jc.cur>=0.90) && (p.wc.cur!=null&&p.wc.cur>=0.90);
  p.feasib = failBoth ? '만회불가' : (bothTop ? '안전' : '결정적');
  p.actionable = (p.feasib==='결정적') || (p.doc==='미비' && p.feasib!=='만회불가');
}
DATA.forEach(p=>{
  p.cw = CW[p.pg];
  p.p2stage = p.cw>4;
  if(p.p2stage) p.doc='완료'; // P2단계는 P1 정산 시 서류 완비됨
  derive(p);
  p.status = 'untouched';
  // 연락 기록 더미 시드 (일부 참여자)
  p.contacts = [];
  if(p.id%4===1) p.contacts.push({d:11+(p.id%7), memo:'출석 독려 문자 발송'});
  if(p.id%9===3) p.contacts.push({d:15+(p.id%4), memo:'전화 통화 — 출석 상황 점검'});
});

// 우선순위: 결정적 먼저 → 개입가치(swing) 큰 순 → 마감 임박 → 서류 미비 먼저
const FB_ORDER = {결정적:0,안전:1,만회불가:2}; // 만회불가는 맨 뒤
function prioritySort(a,b){
  return FB_ORDER[a.feasib]-FB_ORDER[b.feasib]
    || b.swing-a.swing
    || weeksLeft(a)-weeksLeft(b)
    || (b.doc==='미비')-(a.doc==='미비');
}

// 헤드라인 집계
const HEAD = {
  total: DATA.length,
  swingTotal: DATA.filter(p=>p.actionable).reduce((s,p)=>s+p.swing,0), // 개입으로 좌우되는 금액
  decisiveCnt: DATA.filter(p=>p.feasib==='결정적').length,
  failCnt: DATA.filter(p=>p.feasib==='만회불가').length,
  safeCnt: DATA.filter(p=>p.feasib==='안전').length,
  docMiss: DATA.filter(p=>p.doc==='미비').length,
  docHold: DATA.filter(p=>p.doc==='미비' && p.feasib!=='만회불가').reduce((s,p)=>s+p.expPay,0) // 서류로 막힌 금액
};

function feasibChip(f){
  const m={결정적:['출석 장려','fb-act'],만회불가:['만회 불가','fb-fail'],안전:['이상 없음','fb-safe']};
  return `<span class="fb ${m[f][1]}">${m[f][0]}</span>`;
}
function reasonShort(p){
  if(p.feasib==='만회불가') return `미달 확정`;
  if(p.feasib==='안전') return `90%+ 유지`;
  return `최대 ${bandOf(p.jc.max)}/${bandOf(p.wc.max)} 도달 가능`;
}

// ===== AI 생성 (사전 배치: 화면녹화용. 실서비스는 API) =====
function genAI(p, prompt){
  const nm=p.nm, cw=p.cw, wl=weeksLeft(p);
  const wkTxt = wl<=0?'마지막주':`종료까지 ${wl}주`;
  let summary, reason, msg, call, channel;
  if(p.feasib==='만회불가'){
    summary = `${nm} — 현재 ${cw}주차. 남은 출석을 모두 채워도 만회 상한이 직무훈련 ${pct(p.jc.max)}·일경험 ${pct(p.wc.max)}로 미지급선 미달. 수학적으로 회복 불가.`;
    reason = `남은 출석을 다 채워도 50% 미달 → 출석 독려로는 회복이 어려움. 면담 검토 대상.`;
    msg = `${nm}님, 안녕하세요. 현재 출석 상황을 함께 점검하고 향후 참여 계획을 논의하고자 연락드립니다. 편하실 때 면담 일정을 알려주시면 감사하겠습니다.`;
    call = `① 인사 — "안녕하세요 ${nm}님, 운영 담당자입니다. 잠시 통화 괜찮으세요?"\n② 상황 — 현재 출석으로는 이번 정산 기준을 맞추기 어려운 상황임을 차분히 안내\n③ 면담 제안 — "앞으로의 참여 계획을 함께 논의하고 싶어요. 편한 시간 알려주시겠어요?"\n④ 마무리 — 가능한 지원 방법을 함께 찾겠다고 안내`;
    channel = '직접 연락(면담)';
  } else if(p.doc==='미비' && p.feasib!=='결정적'){
    summary = `${nm} — 현재 ${cw}주차, 출결은 양호하나 서류 미비로 수당 지급 보류 상태. 출석과 무관하게 서류 완비 전까지 미지급.`;
    reason = `출석으로 해결되지 않는 행정 블로커. 서류 제출만 받으면 ${won(p.maxPay)} 지급 가능 → 서류 독촉이 1순위 조치.`;
    msg = `${nm}님, 안녕하세요. 출석은 잘 하고 계신데 제출 서류가 일부 누락되어 수당 지급이 보류되고 있어요. 서류만 보완하면 바로 처리되니 확인 부탁드립니다.`;
    call = `① 인사 — "안녕하세요 ${nm}님."\n② 핵심 — "출석은 잘 하고 계신데, 제출 서류가 일부 누락되어 수당 지급이 보류되고 있어요."\n③ 안내 — 필요한 서류와 제출 방법 설명\n④ 마무리 — "서류만 보완되면 바로 처리됩니다. 언제까지 제출 가능하실까요?"`;
    channel = '안내 문자';
  } else if(p.feasib==='결정적'){
    const remWk=remIdx(p).length, jc=p.jc, wc=p.wc;
    const nh=c=>{ const t=tierOf(c.max); return {band:BLABEL[t], need:Math.max(0, Math.ceil(THR[t]*c.pTot - c.cAtt))}; };
    const jn=nh(jc), wn=nh(wc);
    const rateP=(jc.cur!=null||wc.cur!=null)?`현재 출석률이 직무훈련 ${pct(jc.cur)}·일경험 ${pct(wc.cur)}인데, `:`이번 정산 기간이 막 시작됐는데, `;
    const guide=(jn.need===0&&wn.need===0)
      ? `남은 ${remWk}주 동안 지금처럼만 출석을 유지하시면 직무훈련 ${jn.band}·일경험 ${wn.band} 구간 수당을 지킬 수 있어요.`
      : `남은 ${remWk}주 동안 직무훈련 ${jn.need}h·일경험 ${wn.need}h 이상만 더 출석하시면 직무훈련 ${jn.band}·일경험 ${wn.band} 구간 수당을 지킬 수 있어요.`;
    summary = `${nm} — 현재 ${cw}주차(${wkTxt}). 현재 출석률 직무훈련 ${pct(jc.cur)}·일경험 ${pct(wc.cur)}. 남은 ${remWk}주 직무훈련 ${jn.need}h·일경험 ${wn.need}h 더 채우면 ${jn.band}/${wn.band} 도달.`;
    reason = `남은 출석으로 수당 구간이 바뀌는 출석 장려 대상 → 개입가치 ${won(p.swing)}. ${wkTxt}라 지금 독려해야 만회할 수 있어요.${p.doc==='미비'?' (서류 미비 동반 — 함께 안내)':''}`;
    msg = `${nm}님, 안녕하세요 운영 담당자입니다. ${rateP}${guide} 출석에 어려운 점이 있으면 편하게 말씀해 주세요.`;
    const callRate=(jc.cur!=null||wc.cur!=null)?`현재 출석률이 직무훈련 ${pct(jc.cur)}, 일경험 ${pct(wc.cur)} 정도예요.`:`이번 정산 기간이 막 시작된 시점이에요.`;
    call = `① 인사 — "안녕하세요 ${nm}님, 운영 담당자입니다. 잠깐 통화 괜찮으세요?"\n② 현황 — "${callRate}"\n③ 핵심 — "${guide.replace(/h/g,'시간')}"\n④ 경청 — "혹시 출석에 어려운 점이 있으신가요?" 어려움 청취\n⑤ 마무리 — 남은 기간 출석 독려 + 필요 시 지원 안내${p.doc==='미비'?'\n⑥ 서류 — 미제출 서류도 함께 안내':''}`;
    channel = (p.swing>=100000)?'직접 연락(전화)':'안내 문자';
  } else {
    summary = `${nm} — 현재 ${cw}주차. 남은 출석과 무관하게 수당 구간 확정(안전). 개입 불필요.`;
    reason = `이미 구간이 확정되어 개입으로 바뀌지 않음. 모니터링만.`;
    msg = `${nm}님, 안녕하세요. 참여 잘 이어가고 계신지 확인차 인사드립니다. 어려운 점 있으면 언제든 연락 주세요.`;
    call = `① 인사 — "안녕하세요 ${nm}님, 잘 지내시죠?"\n② 확인 — 참여 잘 이어가고 있는지 가볍게 확인\n③ 마무리 — "어려운 점 있으면 언제든 연락 주세요."`;
    channel = '안내 문자';
  }
  // 담당자 추가 지시(상황·톤) 반영 — 실서비스는 AI API 호출. 데모는 톤 인식 mock 재작성.
  if(prompt && prompt.trim()){
    const pt=prompt.trim();
    if(/따뜻|다정|친근|부드|격려|정겨/.test(pt)){
      msg = `${nm}님, 안녕하세요 :) 잘 지내고 계시죠? 운영 담당자예요. ` +
        msg.replace(/^[^.]*\.\s*/,'').replace(/(편하게 )?말씀해 주세요\.?\s*$/,'편하게 말씀해 주세요. 늘 응원하고 있을게요!').replace(/감사합니다\.?\s*$/,'언제든 편히 연락 주세요!');
      call = call.replace('잠깐 통화 괜찮으세요?','잠깐 통화 괜찮으세요? 목소리 들으니 반갑네요 :)').replace('어려움 청취','어려운 점을 따뜻하게 들어주기').replace('출석 독려','따뜻한 출석 응원');
    } else if(/정중|격식|공식/.test(pt)){
      msg = msg.replace(/안녕하세요[^.]*\./,'안녕하세요. 운영 담당자입니다.').replace(/(편하게 )?말씀해 주세요\.?\s*$/,'말씀해 주시면 감사하겠습니다.');
    } else if(/간결|짧/.test(pt)){
      msg = msg.replace(/안녕하세요[^.]*\.\s*/,`${nm}님, `).replace(/\s*출석에 어려운 점이 있으면 편하게 말씀해 주세요\.?\s*$/,'');
    } else {
      msg = msg.replace(/(감사합니다|응원하겠습니다!?|말씀해 주세요)\.?\s*$/,'').trim() + ` 더불어 ${pt} 관련 안내도 함께 드리겠습니다. 필요하시면 편하게 말씀해 주세요.`;
      call += `\n⑥ ${pt} — 관련 내용 함께 안내`;
    }
  }
  return {summary, reason, msg, call, channel};
}

// ===== 상태 =====
let CURVIEW='dash', CUR=null, LOGS=[], WFh={jt:{},we:{}}, WFmax=false, EDITMODE=false, CEDIT=-1, SELDATE=DEMO_DAY, CID=0, BATCH=new Set(), SHOWCONTACT=false, QSORT='swing', QDIR=1, QDOC=false, QPAY=false, APIKEY='', BRIDGE_OK=false;
function toggleQDoc(){ QDOC=!QDOC; renderDash(); }
function toggleQPay(){ QPAY=!QPAY; renderDash(); }
function setQSort(s){ if(QSORT===s) QDIR=-QDIR; else { QSORT=s; QDIR=1; } renderDash(); }
function arrow(){ const desc = QSORT==='swing' ? (QDIR>0) : (QDIR<0); return desc?'↑':'↓'; } // ↑=높은값순, ↓=낮은값순
function setMax(on){ // 체크: 남은 주 전부 배정시간 만땅 / 해제: 현재 출석률 유지 기본값
  WFmax=on; const p=CUR;
  const jr=on?1:(p.jc.cur??fullRate(p,'jt',0,3)), wr=on?1:(p.wc.cur??fullRate(p,'we',0,3));
  remIdx(p).forEach(i=>{ WFh.jt[i]=Math.round(p.jt_wt[i]*jr); WFh.we[i]=Math.round(p.we_wt[i]*wr); });
  renderWF();
}
function mask(nm){ return nm; }
function toggleHelp(btn){ const m=btn.closest('.money'); if(m) m.querySelector('.formula').classList.toggle('show'); }
function toggleContact(){ SHOWCONTACT=!SHOWCONTACT; renderDash(); } // 오늘의 처리 큐 연락처 표시 토글

// ===== 라우팅 =====
const TITLES = {dash:['오늘 할 일','로그인 직후 · 처리 대상 우선순위'],list:['참여자 관리','검색 · 필터 · 일괄 처리'],logs:['처리 내역','확정 이력 · AI vs 실제'],mentors:['멘토별 현황','멘토당 5명 위험 요약']};
document.getElementById('nav').onclick = e=>{ const a=e.target.closest('a'); if(!a) return; go(a.dataset.v); };
function go(v){
  CURVIEW=v;
  document.querySelectorAll('#nav a').forEach(a=>a.classList.toggle('on',a.dataset.v===v));
  document.getElementById('vtitle').textContent=TITLES[v][0];
  document.getElementById('vsub').textContent=TITLES[v][1];
  ({dash:renderDash,list:renderList,logs:renderLogs,mentors:renderMentors}[v])();
}

// ===== 대시보드 =====
function renderDash(){
  const v=document.getElementById('view');
  // 처리 대상 = 개선 가능(결정적) 또는 서류 미비. 지급확정 주간 모아보기 시 4·8주 전체.
  let liveQ = QPAY
    ? DATA.filter(p=>(p.cw===4||p.cw===8) && p.status!=='paid' && p.status!=='hold')
    : DATA.filter(p=>p.status==='untouched' && p.actionable);
  if(QDOC) liveQ = liveQ.filter(p=>p.doc==='미비');
  const cmp = QSORT==='rate' ? (a,b)=>((a.jc.cur??1)+(a.wc.cur??1))-((b.jc.cur??1)+(b.wc.cur??1))
    : QSORT==='swing' ? (a,b)=>b.swing-a.swing   // 개입가치 높은순 기본
    : (a,b)=>a.nm.localeCompare(b.nm,'ko');
  liveQ.sort((a,b)=>cmp(a,b)*QDIR);
  v.innerHTML = `
  <div class="headline">
    <div class="money save">
      <div class="lab">오늘 개입으로 좌우되는 금액 <button class="qmark" onclick="toggleHelp(this)" title="계산 방법 보기">?</button></div>
      <div class="val">${won(HEAD.swingTotal)}</div>
      <div class="desc">현재 출석률을 유지할 때보다, 지금 독려해 출석을 더 채우면 추가로 받을 수 있는 수당의 합이에요.</div>
      <div class="formula">🧮 규칙 계산 · 처리 대상별 (최대 출석 시 수당 − 현재 출석률 유지 시 수당)을 모두 더한 값.</div>
    </div>
    <div class="money risk">
      <div class="lab">서류 미비로 보류된 금액 <button class="qmark" onclick="toggleHelp(this)" title="계산 방법 보기">?</button></div>
      <div class="val">${won(HEAD.docHold)}</div>
      <div class="desc">출석은 되는데 서류가 없어 지급이 막힌 금액이에요. 서류만 제출하면 지급 가능합니다.</div>
      <div class="formula">🧮 규칙 계산 · 서류 미비(만회 가능자)의 현재 추세 유지 시 예상 수당 합.</div>
    </div>
  </div>
  <div class="cards">
    <div class="card"><div class="n">${HEAD.total}</div><div class="t">전체 참여자</div><div class="x">프로그램별 현재 주차 상이</div></div>
    <div class="card"><div class="n" style="color:var(--amber)">${HEAD.decisiveCnt}</div><div class="t">출석 장려 대상</div><div class="x">출석 채우면 수당 구간 ↑</div></div>
    <div class="card"><div class="n" style="color:var(--amber)">${HEAD.docMiss}</div><div class="t">서류 미비</div><div class="x">지급 보류 · 처리 대상</div></div>
    <div class="card" style="opacity:.7"><div class="n" style="color:var(--mut2)">${HEAD.failCnt}</div><div class="t">만회 불가</div><div class="x">처리 대상 아님</div></div>
  </div>
  <div class="sec-h"><h2>오늘 먼저 볼 대상 · ${liveQ.length}명</h2></div>
  <div class="qbar">
    <div class="qsort-grp"><span class="qsort-lbl">정렬</span>
      <span class="seg-grp">
        <button class="seg ${QSORT==='swing'?'on':''}" onclick="setQSort('swing')">개입가치${QSORT==='swing'?' '+arrow():''}</button>
        <button class="seg ${QSORT==='rate'?'on':''}" onclick="setQSort('rate')">출석률${QSORT==='rate'?' '+arrow():''}</button>
        <button class="seg ${QSORT==='name'?'on':''}" onclick="setQSort('name')">가나다${QSORT==='name'?' '+arrow():''}</button>
      </span>
    </div>
    <div class="qfilt-grp">
      <button class="filt-btn ${QPAY?'on':''}" onclick="toggleQPay()">📦 지급확정 주간(4·8주)</button>
      <button class="filt-btn ${SHOWCONTACT?'on':''}" onclick="toggleContact()">📞 연락처 보기</button>
      <button class="filt-btn ${QDOC?'on':''}" onclick="toggleQDoc()"><svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor"><path d="M1.5 2h13a.5.5 0 0 1 .4.8L10 9v4.5a.5.5 0 0 1-.72.45l-2-1A.5.5 0 0 1 7 12.5V9L1.1 2.8A.5.5 0 0 1 1.5 2z"/></svg> 서류 미비만 보기</button>
    </div>
  </div>
  <div class="queue ${SHOWCONTACT?'qc-on':''}">${liveQ.length?liveQ.map((p,i)=>qcard(p,i)).join(''):'<div class="empty">오늘 먼저 볼 대상이 없습니다.</div>'}</div>`;
  bindQ();
}
function statChip(s){ const m={untouched:['미처리','s-untouched'],contacted:['연락 완료','s-progress'],paid:['확정 완료','s-done'],hold:['보류','s-hold']}; const v=m[s]||m.untouched; return `<span class="stat ${v[1]}">${v[0]}</span>`; }
function qcard(p,i){
  return `<div class="qcard" data-id="${p.id}">
    <div class="qrank"><span>${i+1}</span></div>
    <div class="qid">
      <div><span class="idname">${p.nm}</span> ${gchip(p.gd)}</div>
      <div class="qbirth">${p.by}</div>
      <div class="qprog">${pgLabel(p.pg)} <span class="wkchip-sm">· 현재 ${p.cw}주차</span> ${pchip(p.cw)}</div>
    </div>
    <div>
      <div class="qreason">${feasibChip(p.feasib)} <span class="rtxt">${reasonShort(p)}</span>${p.doc==='미비'?' · <span class="docwarn">서류 미비</span>':''}</div>
      <div class="qrate">현재 출석률 직무훈련 <b>${curRate(p,'jt')}</b> · 일경험 <b>${curRate(p,'we')}</b></div>
    </div>
    ${SHOWCONTACT?`<div class="qcc">${contactRow()}</div>`:''}
    <div class="qpay">
      <div class="x" style="font-size:10.5px;color:var(--mut2)">개입가치</div>
      <div class="p" style="color:var(--green)">${p.swing>0?won(p.swing):'—'}</div>
      <div class="d" style="color:var(--mut2);font-weight:500">최대 ${won(p.maxPay)}</div>
    </div>
    <div class="qmeta">${ddayBadge(p)}${statChip(p.status)}</div>
  </div>`;
}
function bindQ(){ document.querySelectorAll('.qcard').forEach(c=>c.onclick=()=>openDetail(+c.dataset.id)); }

// ===== 리스트 =====
let LF={q:'',type:'',feasib:'',doc:'',sort:'priority'};
function renderList(){
  const v=document.getElementById('view');
  v.innerHTML=`
  <div class="filters">
    <input id="f-q" placeholder="이름 검색" value="${LF.q}">
    <select id="f-type"><option value="">수당유형 전체</option><option value="직무훈련">직무훈련</option><option value="일경험">일경험</option></select>
    <select id="f-feasib"><option value="">상태 전체</option><option value="결정적">출석 장려 대상</option><option value="만회불가">만회 불가</option><option value="안전">이상 없음</option></select>
    <select id="f-doc"><option value="">서류 전체</option><option value="미비">서류 미비</option><option value="완료">서류 완료</option></select>
    <select id="f-sort"><option value="priority">우선순위순</option><option value="swing">개입가치순</option><option value="week">주차순</option></select>
  </div>
  <div class="listcount" id="lcount"></div>
  <div class="lgrid">
    <div class="lrow lhead">
      <div><input type="checkbox" class="chk" id="ck-all"></div>
      <div>참여자</div><div>프로그램</div><div>현재 주차</div>
      <div class="ctr">출석률<br>(직무훈련)</div><div class="ctr">출석률<br>(일경험)</div>
      <div>최대 도달 수당</div><div>개입가치</div><div>상태</div><div>서류</div><div>처리</div>
    </div>
    <div id="lbody"></div>
  </div>
  <div class="batchbar" id="bbar">
    <div><b id="bcount">0</b>명 선택 · 동일 사유 묶음 → AI가 각자 맥락에 맞춰 개별 문구 동시 생성</div>
    <button class="btn ai" onclick="openBatch()">🤖 AI 일괄 문구 생성</button>
  </div>`;
  document.getElementById('f-q').oninput=e=>{LF.q=e.target.value; fillList();};
  ['type','feasib','doc','sort'].forEach(k=>document.getElementById('f-'+k).onchange=e=>{LF[k]=e.target.value; fillList();});
  document.getElementById('f-type').value=LF.type; document.getElementById('f-feasib').value=LF.feasib;
  document.getElementById('f-doc').value=LF.doc; document.getElementById('f-sort').value=LF.sort;
  document.getElementById('ck-all').onclick=e=>{ filtered().forEach(p=> e.target.checked?BATCH.add(p.id):BATCH.delete(p.id)); fillList(); };
  fillList();
}
function filtered(){
  let r=DATA.filter(p=>{
    if(LF.q && !p.nm.includes(LF.q)) return false;
    if(LF.type && !p.pg.includes(LF.type)) return false;
    if(LF.feasib && p.feasib!==LF.feasib) return false;
    if(LF.doc && p.doc!==LF.doc) return false;
    return true;
  });
  if(LF.sort==='priority') r.sort(prioritySort);
  else if(LF.sort==='swing') r.sort((a,b)=>b.swing-a.swing);
  else r.sort((a,b)=>b.cw-a.cw);
  return r;
}
function fillList(){
  const rows=filtered();
  const b=document.getElementById('lbody');
  const lc=document.getElementById('lcount'); if(lc) lc.textContent=`전체 ${DATA.length}명 중 ${rows.length}명`;
  if(!rows.length){ b.innerHTML=`<div class="empty">조건에 맞는 참여자 없음 · 필터를 초기화해 주세요</div>`; updateBatch(); return; }
  b.innerHTML=rows.map(p=>`<div class="lrow" data-id="${p.id}">
    <div><input type="checkbox" class="chk row-ck" data-id="${p.id}" ${BATCH.has(p.id)?'checked':''}></div>
    <div><span class="idname" style="font-size:14px">${p.nm}</span> ${gchip(p.gd)}<div class="idsub"><span class="b">${p.by}</span></div></div>
    <div>${pgLabel(p.pg)}</div>
    <div><b>${p.cw}주차</b> ${pchip(p.cw)} <span style="color:var(--mut2);font-size:11px">${weeksLeft(p)<=0?'마지막주':'D-'+weeksLeft(p)+'주'}</span></div>
    <div class="ctr" style="font-weight:700">${curRate(p,'jt')}</div><div class="ctr" style="font-weight:700">${curRate(p,'we')}</div>
    <div>${won(p.maxPay)}</div>
    <div class="${p.swing>0?'pos':''}">${p.swing>0?won(p.swing):'—'}</div>
    <div>${feasibChip(p.feasib)}</div>
    <div>${docChip(p.doc)}</div>
    <div>${statChip(p.status)}</div>
  </div>`).join('');
  b.querySelectorAll('.lrow').forEach(r=>r.onclick=e=>{ if(e.target.classList.contains('row-ck')) return; openDetail(+r.dataset.id); });
  b.querySelectorAll('.row-ck').forEach(ck=>ck.onclick=e=>{ e.stopPropagation(); const id=+ck.dataset.id; ck.checked?BATCH.add(id):BATCH.delete(id); updateBatch(); });
  updateBatch();
}
function updateBatch(){ const n=BATCH.size; document.getElementById('bcount').textContent=n; document.getElementById('bbar').classList.toggle('show',n>0); }

// ===== 상세 패널 =====
function openDetail(id, edit){
  EDITMODE = !!edit; CEDIT=-1; SELDATE=DEMO_DAY;
  const p=DATA.find(x=>x.id===id); CUR=p; WFh={jt:{},we:{}}; WFmax=false;
  // 기본값=현재율 유지. 현재 기간 데이터가 없으면(기간 시작 시점) 직전 P1 출석률을 습관 기준으로 사용
  const jr=p.jc.cur ?? fullRate(p,'jt',0,3), wr=p.wc.cur ?? fullRate(p,'we',0,3);
  remIdx(p).forEach(i=>{ WFh.jt[i]=Math.round(p.jt_wt[i]*jr); WFh.we[i]=Math.round(p.we_wt[i]*wr); });
  const g=genAI(p);
  const wl=weeksLeft(p);
  document.getElementById('panel').innerHTML=`
   <div class="ph"><span class="x" onclick="closeDetail()">✕</span>
     <div class="nm">${p.nm} ${gchip(p.gd)} ${feasibChip(p.feasib)}</div>
     <div class="meta" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:6px">${pgLabel(p.pg)} <span class="wkchip">현재 ${p.cw}주차</span> ${pchip(p.cw)} ${ddayBadge(p)} <span>${p.by}</span> ${statChip(p.status)} <span id="docCtrl">${docToggle(p.doc)}</span></div>
     <div style="margin-top:10px">${contactRow()}</div>
   </div>
   <div class="pb">
     <div class="block">
       <div class="block-h">만회 분석 (현재 ${p.cw}주차 · ${p.jc.plabel} 정산 기준)</div>
       <div class="kindrow">${manjeBox('직무훈련','jt',p)}${manjeBox('일경험','we',p)}</div>
       <div class="manje-sum">${manjeSummary(p)}</div>
     </div>
     <div class="block">
       <div class="block-h">정산 기간별 현재 출석률 (1~4주 / 5~8주)</div>
       ${periodTable(p)}
     </div>
     <div class="block">
       <div class="block-h">수당 구간 기준표 <button class="qmark" onclick="toggleBandRef(this)">?</button></div>
       <div class="bandref" id="bandRef" style="display:none">${bandTable(p)}</div>
     </div>
     <div class="block">
       <div class="block-h">What-if 시뮬레이터 — ${p.jc.plabel} 남은 출석 채우기</div>
       <div class="whatif" id="wf"></div>
     </div>
     <div class="block wk-block" id="wkBlock">
       <div class="block-h">주차별 출석 시간 <span style="font-weight:500;color:var(--mut2);font-size:11px">· 현재 ${p.cw}주차까지(지난 주차)</span>${EDITMODE?' <span style="color:var(--ai);font-weight:700;font-size:11px">✏️ 수정 중</span>':''}</div>
       <div id="weeklyWrap">${EDITMODE?weeklyEdit(p):weeklyTable(p)}</div>
       <div class="spark" style="margin-top:10px">${spark(p)}</div>
       <div style="font-size:10.5px;color:var(--mut2);margin-top:5px;display:flex;justify-content:space-between"><span>1주</span><span>주차별 출석률 추이</span><span>${Math.max(1,p.cw-1)}주</span></div>
     </div>
     <div class="block">
       <div class="block-h">연락 기록</div>
       <div id="ccalWrap">${contactCal(p)}</div>
       <div class="cadd">
         <span id="selDateLbl" class="cadd-d">선택: 6/${DEMO_DAY}</span>
         <input id="cMemo" placeholder="연락 메모 입력 (예: 출석 독려 안내, 서류 요청)">
         <button class="btn pri" onclick="addContact()">+ 기록 추가</button>
       </div>
     </div>
     <div class="block">
       <div class="block-h">AI 조치 추천 <span class="tag-ai">🤖 AI 생성</span></div>
       <div class="aicard">
         <div class="ah">🤖 AI 운영 어시스턴트</div>
         <div class="ai-field"><div class="fl">상태 요약</div><div class="fv" id="ai-sum">${g.summary}</div></div>
         <div class="ai-field"><div class="fl">우선순위 근거</div><div class="fv" id="ai-rsn">${g.reason}</div></div>
         <div class="ai-field"><div class="fl">📱 메시지 문구 (문자·알림용 · 수정 가능)</div>
           <textarea class="ai-msg" id="ai-msg">${g.msg}</textarea></div>
         <div class="ai-field"><div class="fl">📞 전화 통화 스크립트 (수정 가능)</div>
           <textarea class="ai-msg" id="ai-call" style="min-height:96px">${g.call}</textarea></div>
         <div class="ai-field"><div class="fl">✏️ 추가 지시 — 안내할 상황·톤 (선택, 입력 후 다시 생성)</div>
           <textarea class="ai-prompt" id="ai-prompt" placeholder="예: 따뜻한 톤으로 / 장학금 신청 / 다음 주 일정 강조"></textarea></div>
         <div class="gen-note">🤖 AI 생성 초안 · 추천 채널 <b style="color:var(--ai)">${g.channel}</b> · <a style="color:var(--ai);cursor:pointer" onclick="regen()">다시 생성</a> · 확정은 항상 운영자</div>
       </div>
     </div>
   </div>
   <div class="pfoot">
     ${EDITMODE
       ? `<button class="btn pri" onclick="saveWeekly()">저장</button><button class="btn" onclick="cancelEdit()">취소</button>`
       : (p.cw===4||p.cw===8)
         ? `<button class="btn pri" onclick="confirmAction('paid')">확정 완료</button><button class="btn" onclick="confirmAction('contacted')">연락 완료</button><button class="btn" onclick="editWeekly()">출석시간 수정</button><button class="btn" onclick="confirmAction('hold')">보류</button>`
         : `<button class="btn pri" onclick="confirmAction('contacted')">연락 완료</button><button class="btn" onclick="editWeekly()">출석시간 수정</button><button class="btn" onclick="confirmAction('hold')">보류</button>`}
   </div>`;
  renderWF();
  document.getElementById('ov').classList.add('show');
  const pn=document.getElementById('panel'); pn.classList.add('show');
  pn.classList.toggle('editing', EDITMODE); // 수정 모드: 출석시간 블록만 활성화, 나머지 흐리게
  if(EDITMODE){ const w=document.getElementById('wkBlock'); if(w&&w.scrollIntoView) w.scrollIntoView({behavior:'smooth',block:'center'}); }
}
// 만회 박스: 현재 출석률(확정) + 도달 가능 범위(하한~상한)
function manjeBox(label,k,p){
  const c=k==='jt'?p.jc:p.wc;
  const maxC=tierOf(c.max), minC=tierOf(c.min);
  const col=c.max>=0.9?'var(--green)':c.max>=0.7?'var(--amber)':'var(--red)';
  const locked = maxC===minC;
  return `<div class="kbox"><div class="kt">${label} · 현재 출석률</div>
    <div class="kr" style="color:${col}">${pct(c.cur)}</div>
    <div class="kd" style="color:var(--mut)">현재 ${c.cAtt}/${c.cTot}h · 남은 ${c.remTot}h</div>
    <div class="gauge" style="margin-top:9px">
      <div class="fill" style="width:${c.min*100}%;background:var(--mut2)"></div>
      <div class="fill" style="position:absolute;left:${c.min*100}%;width:${(c.max-c.min)*100}%;background:${col};opacity:.45"></div>
      ${THR.map(t=>`<span class="mark" style="left:${t*100}%"></span>`).join('')}
    </div>
    <div class="kd" style="margin-top:6px">도달 가능 구간: <b>${bandOf(c.max)}</b>${locked?' (확정)':` ~ ${bandOf(c.min)}`}</div>
    <div class="kd" style="color:var(--mut2);margin-top:2px">최대 ${won(payOf(c.max,k))} / 최소 ${won(payOf(c.min,k))}</div></div>`;
}
function manjeSummary(p){
  if(p.feasib==='만회불가') return `<b class="neg">만회 불가</b> — 남은 출석을 다 채워도 미지급선에 못 미쳐 출석 독려로는 회복이 어려워요.`;
  if(p.feasib==='안전') return `<b class="pos">안전</b> — 남은 출석과 상관없이 수당 구간이 정해져 있어 별도 개입은 필요 없어요.`;
  let s=`<b style="color:var(--amber)">출석 장려 대상</b> — 남은 출석을 채우면 <b>${won(p.maxPay)}</b>, 현재 출석률 유지 시 <b>${won(p.expPay)}</b>. 개입가치 <b class="pos">${won(p.swing)}</b>.`;
  if(p.doc==='미비') s+=` <span class="docwarn">서류 미비 — 지급 위해 서류도 필요.</span>`;
  return s;
}
// 정산 기간(P1:1~4주 / P2:5~8주)별 현재 출석률
function periodTable(p){
  const rows=[['1~4주 (P1)',0,3],['5~8주 (P2)',4,7]];
  let h='<table class="bandtbl"><tr><th>정산 기간</th><th>직무훈련</th><th>일경험</th><th>상태</th></tr>';
  for(const [lab,s,e] of rows){
    const jr=periodConf(p,'jt',s,e), wr=periodConf(p,'we',s,e);
    const startWk=s+1, endWk=e+1; // 기간 주차 범위(1-based). 마지막 주차까지는 진행 중
    const st = p.cw>endWk ? '정산 확정' : (p.cw>=startWk?'진행 중':'미시작');
    const cls = p.cw>endWk ? 'done' : (p.cw>=startWk?'now':'done');
    h+=`<tr><td>${lab}</td><td>${pct(jr)}</td><td>${pct(wr)}</td><td><span class="phase-chip ${cls}">${st}</span></td></tr>`;
  }
  return h+'</table><div style="font-size:10.5px;color:var(--mut2);margin-top:6px">현재 '+p.cw+'주차 시점까지의 출석률입니다. ‘진행 중’ 기간은 남은 출석으로 바뀔 수 있어요.</div>';
}
// 수당 구간 기준표 (도달 가능 범위 강조)
function bandTable(p){
  const jr=[tierOf(p.jc.max),tierOf(p.jc.min)], wr=[tierOf(p.wc.max),tierOf(p.wc.min)];
  let rows='';
  for(let t=0;t<5;t++){
    const jc=t>=jr[0]&&t<=jr[1], wc=t>=wr[0]&&t<=wr[1];
    rows+=`<tr><td>${BLABEL[t]}</td><td class="${jc?'cur':''}">${won(PAY.jt[t][1])}</td><td class="${wc?'cur':''}">${won(PAY.we[t][1])}</td></tr>`;
  }
  return `<table class="bandtbl"><tr><th>4주 출석률 구간</th><th>직무훈련</th><th>일경험</th></tr>${rows}</table>
    <div style="font-size:10.5px;color:var(--mut2);margin-top:6px">파란 범위 = 남은 출석에 따라 도달 가능한 구간</div>`;
}
function toggleBandRef(btn){ const r=document.getElementById('bandRef'); r.style.display = r.style.display==='none'?'block':'none'; }
// 주차별 출석 시간 표 (지난 주차)
function weeklyTable(p){
  let rows='';
  for(let i=0;i<p.cw-1;i++){
    rows+=`<tr><td>${i+1}주</td><td>${p.jt_w[i]}/${p.jt_wt[i]}h <span class="wtp">${pct(p.jt_wt[i]?p.jt_w[i]/p.jt_wt[i]:0)}</span></td><td>${p.we_w[i]}/${p.we_wt[i]}h <span class="wtp">${pct(p.we_wt[i]?p.we_w[i]/p.we_wt[i]:0)}</span></td></tr>`;
  }
  if(!rows) return '<div style="color:var(--mut2);font-size:12px">아직 진행한 주차가 없습니다.</div>';
  return `<table class="wtbl"><tr><th>주차</th><th>직무훈련</th><th>일경험</th></tr>${rows}</table>`;
}
// 연락 캘린더 + 기록
function contactCal(p){
  const first=new Date(2026,5,1).getDay(), days=30;
  const marked=new Set((p.contacts||[]).map(c=>c.d));
  let cells='';
  for(let i=0;i<first;i++) cells+='<div class="cal-d emp"></div>';
  for(let d=1;d<=days;d++) cells+=`<div class="cal-d clk ${marked.has(d)?'has':''} ${d===SELDATE?'sel':''} ${d===DEMO_DAY?'today':''}" onclick="selectCalDate(${d})" title="${d}일 선택">${d}</div>`;
  const items=(p.contacts||[]).map((c,i)=>({...c,i})).sort((a,b)=>a.d-b.d);
  const log=items.length
    ? items.map(c=> c.i===CEDIT
        ? `<div class="clog-i edit"><b>6/${c.d}</b> <input id="cedit-input" class="cedit-in" value="${(c.memo||'').replace(/"/g,'&quot;')}"><span class="cacts"><button class="cbtn save" onclick="saveContact()" title="저장">✓</button><button class="cbtn" onclick="cancelContact()" title="취소">✕</button></span></div>`
        : `<div class="clog-i"><b>6/${c.d}</b> <span class="cmemo">${c.memo}</span><span class="cacts"><button class="cbtn" onclick="editContact(${c.i})" title="수정">✎</button><button class="cbtn del" onclick="delContactAt(${c.i})" title="삭제">✕</button></span></div>`
      ).join('')
    : '<div style="color:var(--mut2);font-size:12px;padding:8px 0">아직 연락 기록이 없습니다.</div>';
  return `<div class="ccal">
    <div class="cal">
      <div class="cal-top">2026. 6 <span style="font-weight:500;color:var(--mut2);font-size:10px">· 날짜 선택 후 '기록 추가'</span></div>
      <div class="cal-grid">${['일','월','화','수','목','금','토'].map(w=>`<div class="cal-w">${w}</div>`).join('')}${cells}</div>
    </div>
    <div class="clog"><div class="clog-h">연락한 날짜 · 메모 <span style="font-weight:500;color:var(--mut2)">(✎ 수정 · ✕ 삭제)</span></div>${log}</div>
  </div>`;
}
function spark(p){
  let html=''; const last=p.cw-1; // 현재 주차 이전(이미 지난) 주만 표시, 미래는 숨김
  for(let i=0;i<last;i++){
    const att=p.jt_w[i]+p.we_w[i], tot=p.jt_wt[i]+p.we_wt[i], r=tot?att/tot:0;
    const col=r>=0.9?'var(--green)':r>=0.7?'var(--amber)':'var(--red)';
    html+=`<div class="bar" style="height:${Math.max(r*100,4)}%;background:${col}" title="${i+1}주 · ${att}/${tot}h (${pct(r)})"></div>`;
    if(i===3 && last>4) html+=`<div class="sep" title="P1 │ P2"></div>`;
  }
  if(!html) html='<div style="color:var(--mut2);font-size:11px">아직 출석 기록이 없습니다 (1주차)</div>';
  return html;
}
// What-if: 남은(현재~8주) 시간 내 추가 출석 입력 → 최종 출석률/수당
// 현재 정산 기간의 '남은 주차' 인덱스 (현재 주차 이후 ~ 기간 끝)
function remIdx(p){ const [s,e]=curPeriod(p.cw); const a=[]; for(let i=s;i<=e;i++) if(i>p.cw-2) a.push(i); return a; }
function wfKind(p,k,label){
  const c=k==='jt'?p.jc:p.wc;
  const weeks=remIdx(p).map(i=>{ const tot=p[k+'_wt'][i];
    return `<div class="wk-in"><label>${i+1}주</label><input type="number" min="0" max="${tot}" value="${WFh[k][i]??0}" oninput="setWk('${k}',${i},this.value,${tot})"><span class="wk-tot">/${tot}h</span></div>`; }).join('');
  return `<div class="wf-kind">
    <div class="wf-krow"><span>${label}</span><span class="wf-rem">지난 ${c.cAtt}/${c.cTot}h · 현재 출석률 ${pct(c.cur)}</span></div>
    <div id="wf-g-${k}"></div>
    <div class="wf-weeks">${weeks||'<span style="color:var(--mut2);font-size:11px">남은 주차 없음 (기간 종료)</span>'}</div>
  </div>`;
}
function setWk(k,i,v,max){ WFh[k][i]=Math.max(0,Math.min(max,Math.round(+v||0))); updateWF(); }
function renderWF(){
  const p=CUR;
  document.getElementById('wf').innerHTML=`
    <div class="wf-pay">
      <span style="font-size:11px;color:var(--mut2)">최종 예상 수당</span>
      <span class="sim" id="wf-sim"></span><span class="chg" id="wf-chg"></span>
      <span style="font-size:10.5px;color:var(--mut2);margin-left:4px">· 현재 추세 유지 시 ${won(p.expPay)}</span>
    </div>
    <label class="wf-max"><input type="checkbox" ${WFmax?'checked':''} onchange="setMax(this.checked)"> 최대 출석 가정 (남은 주 모두 배정시간 채움)</label>
    ${wfKind(p,'jt','직무훈련')}
    ${wfKind(p,'we','일경험')}
    <div style="font-size:10.5px;color:var(--mut2);margin-top:11px">주마다 배정된 출석 시간이 있어요. <b style="color:var(--rule)">기본값은 현재 출석률을 유지했을 때</b>의 시간이고, 칸에 시간을 입력해 이번주·다음주 출석을 조정하면 최종 출석률·수당이 실시간 계산됩니다. (지난 주차는 확정)</div>`;
  updateWF();
}
function updateWF(){
  const p=CUR;
  const rate=k=>{ const c=k==='jt'?p.jc:p.wc; let add=0; for(const i in WFh[k]) add+=WFh[k][i]; return c.pTot?(c.cAtt+add)/c.pTot:0; };
  const jr=rate('jt'), wr=rate('we');
  const simPay=payOf(jr,'jt')+payOf(wr,'we'); const chg=simPay-p.expPay;
  const sim=document.getElementById('wf-sim'); sim.textContent=won(simPay);
  sim.style.color=chg>0?'var(--green)':'var(--txt)';
  const ce=document.getElementById('wf-chg'); ce.textContent=chg>0?'▲'+won(chg):(chg<0?'▼'+won(-chg):''); ce.className='chg '+(chg<0?'neg':'pos');
  document.getElementById('wf-g-jt').innerHTML=miniGauge('직무훈련 최종',jr);
  document.getElementById('wf-g-we').innerHTML=miniGauge('일경험 최종',wr);
}
function miniGauge(label,r){
  const col=r>=0.9?'var(--green)':r>=0.7?'var(--amber)':'var(--red)';
  return `<div style="flex:1"><div style="font-size:11px;color:var(--mut2);display:flex;justify-content:space-between"><span>${label}</span><b style="color:${col}">${pct(r)} · ${bandOf(r)}</b></div>
    <div class="gauge" style="margin:5px 0 0"><div class="fill" style="width:${r*100}%;background:${col}"></div>${THR.map(t=>`<span class="mark" style="left:${t*100}%"></span>`).join('')}</div></div>`;
}
// 실시간 AI 호출 — 규칙 기반 초안(숫자·사실)은 유지하고, 운영자 지시(상황·톤)만 반영해 재작성.
// 경로: ① API 키 있으면 Anthropic API 직접 호출  ② 없으면 로컬 Claude 브리지(bridge.py)  ③ 실패 시 mock.
const BRIDGE_URL = 'http://localhost:8787';
function aiPrompt(p, instruction){
  const g = genAI(p); // 규칙이 만든 사실 초안(출석률·남은 주차·필요 시간·수당 구간)
  const sys = "너는 '미래내일 일경험' 사업의 운영 담당자다. 아래 '기준 초안'에 담긴 숫자와 사실(출석률, 남은 주차, 더 채울 시간, 수당 구간)은 절대 바꾸지 마라. 운영자의 추가 지시(참여자 상황·톤)를 자연스럽게 반영해 문자 안내(msg)와 전화 통화 스크립트(call)를 다시 써라. 전화 스크립트는 ①인사 ②현황 ③핵심(필요 시간·구간) ④경청 ⑤마무리 흐름을 유지한다. 정중하고 따뜻한 운영자 말투. 반드시 JSON만 출력: {\"msg\":\"...\",\"call\":\"...\"}";
  const user = `[기준 초안 · 문자]\n${g.msg}\n\n[기준 초안 · 전화]\n${g.call}\n\n[운영자 추가 지시]\n${instruction||'(없음 — 기본 톤 유지)'}\n\n위 지시를 반영하되 숫자·사실은 그대로 두고 msg와 call을 JSON으로 다시 작성해줘.`;
  return { g, sys, user };
}
function parseAI(text, g){ const j=text.match(/\{[\s\S]*\}/); if(!j) throw new Error('JSON 파싱 실패'); const m=JSON.parse(j[0]); return { msg:m.msg||g.msg, call:m.call||g.call, summary:g.summary, reason:g.reason }; }
async function callAnthropic(sys, user){
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method:'POST',
    headers:{ 'content-type':'application/json', 'x-api-key':APIKEY, 'anthropic-version':'2023-06-01', 'anthropic-dangerous-direct-browser-access':'true' },
    body: JSON.stringify({ model:'claude-sonnet-4-6', max_tokens:1200, system:sys, messages:[{role:'user',content:user}] })
  });
  if(!res.ok){ throw new Error('API HTTP '+res.status+' '+(await res.text()).slice(0,120)); }
  const data = await res.json();
  return (data.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('\n');
}
async function callBridge(sys, user){
  const res = await fetch(BRIDGE_URL, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({system:sys, user:user}) });
  if(!res.ok) throw new Error('브리지 HTTP '+res.status);
  return (await res.json()).text||'';
}
async function callClaude(p, instruction){
  const { g, sys, user } = aiPrompt(p, instruction);
  const text = APIKEY ? await callAnthropic(sys, user) : await callBridge(sys, user);
  return parseAI(text, g);
}
async function checkBridge(){
  const badge=document.getElementById('aiMode');
  try{ const r=await fetch(BRIDGE_URL,{method:'GET'}); if(!r.ok) throw 0; BRIDGE_OK=true; if(badge) badge.textContent='🟢 로컬 Claude'; toast('✅ 로컬 Claude 브리지 연결됨'); }
  catch(e){ BRIDGE_OK=false; if(badge) badge.textContent='⚪ mock'; toast('⚠️ 브리지 미연결 — 터미널에서 python3 bridge.py 실행 후 다시 시도'); }
}
async function regen(){
  if(!CUR) return;
  const note=event&&event.target; const reset=()=>{ if(note) note.innerHTML='다시 생성'; };
  if(note) note.innerHTML='<span class="spin"></span> 생성 중';
  const prompt=(document.getElementById('ai-prompt')||{}).value||'';
  const apply=(g,live)=>{ document.getElementById('ai-sum').textContent=g.summary; document.getElementById('ai-rsn').textContent=g.reason; document.getElementById('ai-msg').value=g.msg; document.getElementById('ai-call').value=g.call; reset();
    toast(live?'✅ 실시간 Claude로 재생성 완료':(prompt.trim()?'🤖 추가 지시 반영(mock)':'🤖 mock 문구 적용'));
  };
  if(APIKEY || BRIDGE_OK){
    toast('🤖 Claude 호출 중…');
    try{ const r=await callClaude(CUR, prompt); apply(r, true); return; }
    catch(e){ toast('⚠️ 실시간 호출 실패 — mock으로 대체'); console.warn(e); }
  }
  setTimeout(()=>apply(genAI(CUR,prompt), false), (APIKEY||BRIDGE_OK)?0:600);
}
function confirmAction(kind){
  const p=CUR; const g=genAI(p);
  const label={paid:'확정 완료',contacted:'연락 완료',hold:'보류'}[kind]||'처리';
  const isCall=g.channel.includes('전화')||g.channel.includes('면담');
  if(kind==='hold'){ p.status='hold'; LOGS.unshift({t:nowStr(),id:p.id,nm:p.nm,type:'보류',ai:'',final:'',result:'hold',reason:'',summary:''}); toast('⏸ 보류 — 3일 후 재알림(스누즈)'); closeDetail(); go(CURVIEW); return; }
  p.status = kind==='paid' ? 'paid' : 'contacted';
  p.contacts.push({d:DEMO_DAY, memo:label}); // 연락/처리 기록 (그날 날짜 자동)
  LOGS.unshift({ t:nowStr(), id:p.id, nm:p.nm, type: isCall?'직접연락':(p.doc==='미비'?'서류안내':'출석독려'),
    ai:g.msg, final:(document.getElementById('ai-msg')||{}).value||g.msg, result:kind, reason:'', summary:g.summary });
  toast('✅ '+label+' · 기록됨');
  closeDetail(); go(CURVIEW);
}
function weeklyEdit(p){
  const ps = p.p2stage?4:0; // 현재 정산 기간 시작 인덱스 (P2단계면 P1(1~4주)은 확정 → 잠금)
  const cell=(k,i)=> i>=ps
    ? `<input type="number" class="wein" id="ew-${k}-${i}" min="0" max="${p[k+'_wt'][i]}" value="${p[k+'_w'][i]}"><span class="wtp">/${p[k+'_wt'][i]}h</span>`
    : `<span style="color:var(--mut2)">${p[k+'_w'][i]}/${p[k+'_wt'][i]}h 🔒</span>`;
  let rows='';
  for(let i=0;i<p.cw-1;i++){
    rows+=`<tr><td>${i+1}주${i>=ps?'':' <span style="font-size:9px;color:var(--mut2)">확정</span>'}</td><td>${cell('jt',i)}</td><td>${cell('we',i)}</td></tr>`;
  }
  if(!rows) return '<div style="color:var(--mut2);font-size:12px">수정할 지난 주차가 없습니다.</div>';
  return `<table class="wtbl wedit"><tr><th>주차</th><th>직무훈련</th><th>일경험</th></tr>${rows}</table>
    <div style="font-size:10.5px;color:var(--mut2);margin-top:6px">✏️ <b>현재 정산 기간(${p.jc.plabel})</b> 주차만 수정 가능 · P1은 정산 확정되어 🔒 잠금. 저장 시 서버 반영·만회 재계산.</div>`;
}
function editWeekly(){ openDetail(CUR.id, true); }
function cancelEdit(){ openDetail(CUR.id, false); }
function saveWeekly(){
  const p=CUR;
  for(let i=0;i<p.cw-1;i++){
    const jt=document.getElementById('ew-jt-'+i), we=document.getElementById('ew-we-'+i);
    if(jt) p.jt_w[i]=Math.max(0, Math.min(p.jt_wt[i], Math.round(+jt.value||0)));
    if(we) p.we_w[i]=Math.max(0, Math.min(p.we_wt[i], Math.round(+we.value||0)));
  }
  derive(p); // 수정된 출석 시간으로 재계산
  toast('💾 서버 전송 완료 · 출석 시간 수정·재계산됨 (mock)');
  openDetail(p.id, false);
}
function selectCalDate(d){ // 날짜는 '선택'만, 추가는 '기록 추가' 버튼으로
  if(!CUR) return;
  SELDATE=d;
  document.getElementById('ccalWrap').innerHTML=contactCal(CUR);
  const lbl=document.getElementById('selDateLbl'); if(lbl) lbl.textContent='선택: 6/'+d;
}
function addContactOn(d){
  if(!CUR) return;
  const inp=document.getElementById('cMemo');
  const memo=(inp&&inp.value.trim())||'연락';
  const cid=++CID; // 연락 기록 ↔ 처리 내역(LOGS) 연결 키
  CUR.contacts.push({d, memo, cid});
  if(CUR.status==='untouched') CUR.status='contacted';
  LOGS.unshift({ t:(d===DEMO_DAY?nowStr():'6/'+d), id:CUR.id, nm:CUR.nm, type:'연락', ai:'(직접 기록)', final:memo, result:'contacted', reason:'', summary:'운영자 수동 연락 기록', cid });
  if(inp) inp.value='';
  CEDIT=-1; document.getElementById('ccalWrap').innerHTML=contactCal(CUR);
  toast('6/'+d+' 연락 기록 추가됨 · 처리 내역 반영');
}
function addContact(){ addContactOn(SELDATE); } // 선택한 날짜로 추가
function editContact(i){ if(!CUR) return; CEDIT=i; document.getElementById('ccalWrap').innerHTML=contactCal(CUR); const inp=document.getElementById('cedit-input'); if(inp) inp.focus(); }
function cancelContact(){ CEDIT=-1; if(CUR) document.getElementById('ccalWrap').innerHTML=contactCal(CUR); }
function saveContact(){ if(!CUR) return; const inp=document.getElementById('cedit-input'); const c=CUR.contacts[CEDIT];
  if(inp&&CEDIT>=0&&c){ c.memo=inp.value.trim()||c.memo; if(c.cid){ const l=LOGS.find(x=>x.cid===c.cid); if(l) l.final=c.memo; } } // 처리 내역 메모도 동기화
  CEDIT=-1; document.getElementById('ccalWrap').innerHTML=contactCal(CUR); toast('메모 수정됨'); }
function delContactAt(i){ if(!CUR) return; const c=CUR.contacts[i];
  if(c){ if(c.cid) LOGS=LOGS.filter(l=>l.cid!==c.cid); CUR.contacts.splice(i,1); } // 처리 내역에서도 삭제
  CEDIT=-1; document.getElementById('ccalWrap').innerHTML=contactCal(CUR); toast('기록 삭제됨 · 처리 내역 반영'); }
function closeDetail(){ document.getElementById('ov').classList.remove('show'); document.getElementById('panel').classList.remove('show'); CUR=null; }

// ===== 일괄 처리 =====
function openBatch(){
  const ids=[...BATCH]; const ps=DATA.filter(p=>ids.includes(p.id));
  const m=document.getElementById('modal');
  m.innerHTML=`<div class="mbox"><div class="mh"><h3>🤖 AI 일괄 문구 생성 · ${ps.length}명</h3><span class="x" style="cursor:pointer;color:var(--mut)" onclick="closeModal()">✕</span></div>
   <div class="mc">
     <div style="background:var(--ai-bg);border:1px solid #cabfff;border-radius:6px;padding:12px;margin-bottom:16px;font-size:12.5px;color:#473a9e">
       AI가 <b>각자 맥락(이름·현재 주차·남은·개입가치)</b>에 맞춰 개별 문구를 동시 생성했습니다. 단건 ${ps.length}회 반복 대신 한 번에 검토·발송하는 스케일 동선입니다.
     </div>
     <div id="bcards"><div class="empty"><span class="spin"></span> AI가 ${ps.length}명 개별 문구 생성 중…</div></div>
   </div></div>`;
  m.classList.add('show');
  setTimeout(()=>{
    document.getElementById('bcards').innerHTML=ps.map(p=>{ const g=genAI(p); return `<div class="bcard">
      <div class="bn">${p.nm} ${gchip(p.gd)} ${pgLabel(p.pg)} <span style="color:var(--mut2);font-weight:500;font-size:11px">· 현재 ${p.cw}주차 · 개입가치 ${won(p.swing)}</span></div>
      <textarea class="ai-msg" style="min-height:62px">${g.msg}</textarea></div>`; }).join('')
      + `<div class="actions" style="margin-top:6px"><button class="btn pri" onclick="sendBatch(${ps.length})">일괄 검토 완료 · ${ps.length}건 발송 (mock)</button></div>`;
  },1100);
}
function sendBatch(n){
  [...BATCH].forEach(id=>{ const p=DATA.find(x=>x.id===id); const g=genAI(p); if(p.status==='untouched') p.status='contacted';
    LOGS.unshift({t:nowStr(),id:p.id,nm:p.nm,type:'출석독려(일괄)',ai:g.msg,final:g.msg,result:'contacted',reason:'',summary:g.summary}); });
  BATCH.clear(); closeModal(); toast(`📨 ${n}건 일괄 발송 완료 · 로그 기록됨`); go(CURVIEW);
}
function closeModal(){ document.getElementById('modal').classList.remove('show'); }

// ===== 로그 =====
function renderLogs(){
  const v=document.getElementById('view');
  if(!LOGS.length){ v.innerHTML=`<div class="empty">아직 확정된 조치가 없습니다.<br>대시보드 큐 또는 리스트에서 조치를 확정하면 여기에 기록됩니다.</div>`; return; }
  v.innerHTML=`<div class="sec-h"><h2>처리 내역 · ${LOGS.length}건</h2><div class="hint">연락·정산확정 처리 이력</div></div>
   <table><thead><tr><th>시각</th><th>참여자</th><th>조치</th><th>결과</th></tr></thead><tbody>
   ${LOGS.map(l=>`<tr style="cursor:pointer" onclick="openDetail(${l.id})"><td style="color:var(--mut2)">${l.t}</td><td><b>${l.nm}</b></td><td>${l.type}</td>
     <td>${({paid:'<span class="pos">확정완료</span>',contacted:'<span style="color:#2b5fd0">연락완료</span>',hold:'<span style="color:var(--amber)">보류</span>'})[l.result]||l.result}</td></tr>`).join('')}
   </tbody></table>
   <div style="margin-top:16px;background:#fff;border:1px solid var(--line);border-radius:6px;padding:14px;font-size:12.5px;color:var(--mut)">
     처리 요약 — 확정완료 ${LOGS.filter(l=>l.result==='paid').length} · 연락완료 ${LOGS.filter(l=>l.result==='contacted').length} · 보류 ${LOGS.filter(l=>l.result==='hold').length}
   </div>`;
}

// ===== 멘토 그룹 =====
function renderMentors(){
  const v=document.getElementById('view');
  const groups={};
  DATA.forEach(p=>{ (groups[p.pg]=groups[p.pg]||[]).push(p); });
  v.innerHTML=`<div class="sec-h"><h2>멘토 그룹 뷰</h2></div>
   <div class="grp">${Object.entries(groups).map(([pg,ps])=>{
     const act=ps.filter(p=>p.actionable).length; const cw=ps[0].cw;
     return `<div class="gcard"><div class="gn">${pgLabel(pg)} <span class="fb ${act?'fb-act':'fb-safe'}">처리 대상 ${act}</span></div>
       <div class="gx">담당 ${ps.length}명 · 현재 ${cw}주차 (${weeksLeft(ps[0])<=0?'마지막주':'종료 D-'+weeksLeft(ps[0])+'주'})</div>
       <div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:5px">${ps.filter(p=>p.actionable).slice(0,6).map(p=>`<span class="mband" style="cursor:pointer" onclick="openDetail(${p.id})">${p.nm} ${gchip(p.gd)} ${won(p.swing)}</span>`).join('')||'<span style="color:var(--mut2);font-size:12px">처리 대상 없음</span>'}</div></div>`;
   }).join('')}</div>`;
}

// ===== 유틸 =====
let _t=0; function nowStr(){ _t++; const mm=String(9+Math.floor(_t/6)).padStart(2,'0'); const ss=String((_t*10)%60).padStart(2,'0'); return `오늘 ${mm}:${ss}`; }
function toast(msg){ const t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(t._); t._=setTimeout(()=>t.classList.remove('show'),2400); }

go('dash');
