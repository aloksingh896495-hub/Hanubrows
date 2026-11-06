
const $=s=>document.querySelector(s),ws=$('#ws'),tabList=$('#tabList'),urlIn=$('#url'),hl=$('#hl');
const LOGO='icons/logo.png';
$('#lg').src=LOGO;{const l=document.createElement('link');l.rel='icon';l.href=LOGO;document.head.appendChild(l)}
const KEY='deskspace.v2';
let tabs=[],layout=null,activeId=null,rects=new Map(),uid=0,divs=[],divEls=[];
let bms=[{n:'YouTube',u:'https://www.youtube.com'},{n:'Wikipedia',u:'https://en.wikipedia.org'},{n:'NPTEL',u:'https://nptel.ac.in'},{n:'MIT OCW',u:'https://ocw.mit.edu'},{n:'Desmos',u:'https://www.desmos.com/calculator'}];

function host(u){try{return new URL(u).hostname.replace(/^www\./,'')}catch(e){return 'Page'}}
function norm(raw){
  let s=raw.trim();if(!s)return null;
  if(!/^[a-z][a-z0-9+.-]*:/i.test(s))s='https://'+s;
  let u;try{u=new URL(s)}catch(e){return null}
  const h=u.hostname.replace(/^www\./,'');let id;
  if(h==='youtube.com'||h==='m.youtube.com'){
    if(u.pathname==='/watch'&&(id=u.searchParams.get('v')))return 'https://www.youtube.com/embed/'+id+(u.searchParams.get('t')?'?start='+parseInt(u.searchParams.get('t')):'');
    if(u.pathname==='/playlist'&&u.searchParams.get('list'))return 'https://www.youtube.com/embed/videoseries?list='+u.searchParams.get('list');
    if(/^\/(live|shorts)\//.test(u.pathname))return 'https://www.youtube.com/embed/'+u.pathname.split('/')[2];
  }
  if(h==='youtu.be')return 'https://www.youtube.com/embed/'+u.pathname.slice(1);
  if(h==='vimeo.com'&&/^\/\d+/.test(u.pathname))return 'https://player.vimeo.com/video/'+u.pathname.split('/')[1];
  if(h==='drive.google.com'&&(id=(u.pathname.match(/\/file\/d\/([^/]+)/)||[])[1]))return 'https://drive.google.com/file/d/'+id+'/preview';
  if(h==='docs.google.com')return u.href.replace(/\/(edit|view)[^/]*$/,'/preview');
  return u.href;
}
function hue(s){let h=0;for(const c of s)h=(h*31+c.charCodeAt(0))%360;return h}
function fav(el,title){el.textContent=(title||'N')[0].toUpperCase();el.style.background='hsl('+hue(title||'N')+' 55% 42%)'}

/* ---------- tree helpers ---------- */
const findLeaf=(n,id)=>n.t==='leaf'?(n.tab===id?n:null):(findLeaf(n.a,id)||findLeaf(n.b,id));
function parentOf(n,x,p=null){if(n===x)return p;if(n.t==='leaf')return undefined;return parentOf(n.a,x,n)??parentOf(n.b,x,n)}
function replaceNode(o,nw){const p=parentOf(layout,o);if(!p)layout=nw;else if(p.a===o)p.a=nw;else p.b=nw}
function removeLeaf(l){const p=parentOf(layout,l);if(!p)return false;replaceNode(p,p.a===l?p.b:p.a);return true}
const leafIds=(n=layout)=>n.t==='leaf'?[n.tab]:[...leafIds(n.a),...leafIds(n.b)];

/* ---------- tabs ---------- */
function newTab(url,o={},id){
  const t={id:id||++uid,url:null,title:'New Tab',hist:[],hi:-1,blob:false,f:null};
  if(t.id>uid)uid=t.id;
  const el=document.createElement('div');el.className='pane';
  el.innerHTML='<div class="ph"><i class="fav"></i><b></b><button data-a="ext" title="Open in browser tab">↗</button><button data-a="cp" title="Close pane">✕</button></div><div class="pc"></div>';
  t.el=el;t.pc=el.querySelector('.pc');
  el.addEventListener('pointerdown',()=>setActive(t.id),true);
  el.querySelector('.ph').addEventListener('click',e=>{const a=e.target.dataset.a;if(a==='ext'&&t.url&&!t.blob)window.open(realUrl(t),'_blank','noopener');if(a==='cp')closePane(t.id)});
  ws.appendChild(el);tabs.push(t);load(t,url||null,o);return t;
}
function load(t,url,o={}){
  t.url=url;t.blob=!!o.blob;t.title=o.title||(url?(url.startsWith('yt:')?(url.length>3?'YouTube: '+url.slice(3):'YouTube'):host(url)):'New Tab');
  t.pc.innerHTML='';
  if(url&&url.startsWith('yt:')){t.f=null;t.pc.appendChild(ytView(t,url.slice(3)))}
  else if(url){const f=document.createElement('iframe');f.allow='autoplay; fullscreen; picture-in-picture; clipboard-write';f.allowFullscreen=true;f.src=url;t.pc.appendChild(f);t.f=f}
  else{t.f=null;t.pc.appendChild(home(t))}
  if(o.push!==false){t.hist=t.hist.slice(0,t.hi+1);t.hist.push({url,title:t.title,blob:t.blob});t.hi++}
  t.el.querySelector('.ph b').textContent=t.title;fav(t.el.querySelector('.ph .fav'),t.title);
  if(url&&o.push!==false)anaOpen(siteOf(t),t.title);
  if(url&&!t.blob&&o.push!==false&&!o.nohist)record(url,t.title);refreshUI();
}
function go(t,d){const n=t.hi+d;if(n<0||n>=t.hist.length)return;t.hi=n;const h=t.hist[n];load(t,h.url,{title:h.title,blob:h.blob,push:false})}
const HK='deskspace.hist';let hist=[];try{hist=JSON.parse(localStorage.getItem(HK)||'[]')}catch(e){}
function record(url,title){
  if(hist[0]&&hist[0].url===url)return;hist.unshift({url,title,ts:Date.now()});hist=hist.slice(0,500);
  try{localStorage.setItem(HK,JSON.stringify(hist))}catch(e){}
  if($('#hist').classList.contains('open'))drawHist();
}
function drawHist(){
  const q=$('#hq').value.toLowerCase(),box=$('#hlist');box.innerHTML='';
  const rows=hist.filter(h=>!q||h.url.toLowerCase().includes(q)||h.title.toLowerCase().includes(q));
  if(!rows.length){box.innerHTML='<div class="tip" style="padding:30px;margin:auto">No history yet</div>';return}
  rows.forEach(h=>{const d=document.createElement('div');d.className='hi';d.innerHTML='<b></b><small></small>';
    d.querySelector('b').textContent=h.title;
    d.querySelector('small').textContent=new Date(h.ts).toLocaleString([],{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})+' · '+h.url;
    d.onclick=()=>openSmart(act(),h.url);box.appendChild(d)});
}
let tt;function toast(m){const e=$('#toast');e.textContent=m;e.style.display='block';clearTimeout(tt);tt=setTimeout(()=>e.style.display='none',6000)}
const SITES={youtube:'https://www.youtube.com',yt:'https://www.youtube.com','google drive':'https://drive.google.com',drive:'https://drive.google.com',wikipedia:'https://en.wikipedia.org',wiki:'https://en.wikipedia.org',khan:'https://www.khanacademy.org','khan academy':'https://www.khanacademy.org',nptel:'https://nptel.ac.in','mit ocw':'https://ocw.mit.edu',desmos:'https://www.desmos.com/calculator',geogebra:'https://www.geogebra.org/calculator',coursera:'https://www.coursera.org',github:'https://github.com',google:'https://www.google.com',chatgpt:'https://chatgpt.com'};
const NOEMBED=new Set(['youtube.com','m.youtube.com','google.com','instagram.com','facebook.com','x.com','twitter.com','linkedin.com','whatsapp.com','netflix.com','chatgpt.com']);
function openSmart(t,u){
  let x;try{x=new URL(u)}catch(e){return}
  const h=x.hostname.replace(/^www\./,'');
  if((h==='youtube.com'||h==='m.youtube.com')&&(x.pathname==='/'||x.pathname==='/results')){load(t,'yt:'+(x.searchParams.get('search_query')||''));return}
  if(NOEMBED.has(h)&&!x.pathname.startsWith('/embed')){
    window.open(u,'_blank','noopener');
    toast(h+' does not allow being shown inside other pages, so it opened in a normal browser tab. Copy a video/PDF link from there and press 📋 here.');return;
  }
  load(t,u);
}
function submit(t,v){
  v=v.trim();if(!v)return;const l=v.toLowerCase(),e=encodeURIComponent;let m;
  if((m=l.match(/^(?:youtube|you tube|yt)\b\s*(.*)$/)))return load(t,'yt:'+m[1].trim());
  if(SITES[l])return openSmart(t,SITES[l]);
  if((m=l.match(/^(?:youtube|yt)\s+(.+)/))){window.open('https://www.youtube.com/results?search_query='+e(m[1]),'_blank','noopener');toast('YouTube cannot be shown inside other pages. Open your video there, copy its link, then press 📋 here to watch it in Deskspace.');return}
  if((m=l.match(/^(?:wikipedia|wiki)\s+(.+)/)))return load(t,'https://en.wikipedia.org/w/index.php?search='+e(m[1]));
  if(/\s/.test(v)||!/[.:]/.test(v)){window.open('https://www.google.com/search?q='+e(v),'_blank','noopener');toast('Searched Google in a normal browser tab.');return}
  const u=norm(v);if(u)openSmart(t,u);
}
function openNew(v){const t=newTab();findLeaf(layout,activeId).tab=t.id;activeId=t.id;render();submit(t,v)}
const cnt=n=>n.t==='leaf'?1:cnt(n.a)+cnt(n.b);
function eq(n){if(n.t==='split'){n.ratio=cnt(n.a)/(cnt(n.a)+cnt(n.b));eq(n.a);eq(n.b)}}
const act=()=>tabs.find(t=>t.id===activeId);
function setActive(id){if(activeId!==id){activeId=id;refreshUI()}}
function activate(id){
  if(!rects.has(id)){findLeaf(layout,activeId).tab=id;activeId=id;render()}else setActive(id);
}
function closeTab(id){
  const i=tabs.findIndex(x=>x.id===id);if(i<0)return;const t=tabs[i];
  const leaf=findLeaf(layout,id);t.el.remove();tabs.splice(i,1);
  if(t.blob&&t.url)URL.revokeObjectURL(t.url);
  if(!tabs.length){const n=newTab();layout={t:'leaf',tab:n.id};activeId=n.id;render();return}
  if(leaf){
    const shown=new Set(leafIds());const free=tabs.filter(x=>!shown.has(x.id));
    if(free.length)leaf.tab=free[Math.min(i,free.length-1)].id;else removeLeaf(leaf);
  }
  if(!findLeaf(layout,activeId))activeId=leafIds()[0];
  render();
}
function closePane(id){const l=findLeaf(layout,id);if(l&&removeLeaf(l)){if(activeId===id)activeId=leafIds()[0];render()}}

/* ---------- layout ---------- */
function calc(n,r){
  if(n.t==='leaf'){rects.set(n.tab,{x:r.x+3,y:r.y+3,w:Math.max(0,r.w-6),h:Math.max(0,r.h-6)});return}
  if(n.dir==='row'){const w=r.w*n.ratio;calc(n.a,{x:r.x,y:r.y,w,h:r.h});calc(n.b,{x:r.x+w,y:r.y,w:r.w-w,h:r.h});divs.push({n,r,dir:'row',x:r.x+w-4,y:r.y,w:8,h:r.h})}
  else{const h=r.h*n.ratio;calc(n.a,{x:r.x,y:r.y,w:r.w,h});calc(n.b,{x:r.x,y:r.y+h,w:r.w,h:r.h-h});divs.push({n,r,dir:'col',x:r.x,y:r.y+h-4,w:r.w,h:8})}
}
function place(){
  rects=new Map();divs=[];calc(layout,{x:0,y:0,w:ws.clientWidth,h:ws.clientHeight});
  ws.classList.toggle('multi',rects.size>1);
  tabs.forEach(t=>{const r=rects.get(t.id),e=t.el;
    if(r){Object.assign(e.style,{left:r.x+'px',top:r.y+'px',width:r.w+'px',height:r.h+'px',visibility:'visible',pointerEvents:''})}
    else{e.style.visibility='hidden';e.style.pointerEvents='none'}
    e.classList.toggle('active',t.id===activeId)});
  while(divEls.length<divs.length){const d=document.createElement('div');ws.appendChild(d);divEls.push(d);wireDiv(d,divEls.length-1)}
  while(divEls.length>divs.length)divEls.pop().remove();
  divs.forEach((v,i)=>{const d=divEls[i];d.className='dv '+v.dir;Object.assign(d.style,{left:v.x+'px',top:v.y+'px',width:v.w+'px',height:v.h+'px'})});
}
function wireDiv(d,i){
  d.addEventListener('pointerdown',e=>{
    e.preventDefault();d.setPointerCapture(e.pointerId);document.body.classList.add('dragging');
    const wr=ws.getBoundingClientRect();
    const mv=ev=>{const v=divs[i];if(!v)return;const p=v.dir==='row'?(ev.clientX-wr.left-v.r.x)/v.r.w:(ev.clientY-wr.top-v.r.y)/v.r.h;v.n.ratio=Math.min(.85,Math.max(.15,p));place()};
    const up=()=>{document.body.classList.remove('dragging');d.removeEventListener('pointermove',mv);d.removeEventListener('pointerup',up);save()};
    d.addEventListener('pointermove',mv);d.addEventListener('pointerup',up);
  });
}
function render(){place();refreshUI()}

/* ---------- UI ---------- */
function refreshUI(){
  tabList.innerHTML='';
  tabs.forEach(t=>{
    const d=document.createElement('div');
    d.className='tab'+(t.id===activeId?' active':rects.has(t.id)?' shown':'');
    d.innerHTML='<i class="fav"></i><span></span><button title="Close tab">✕</button>';
    fav(d.querySelector('.fav'),t.title);d.querySelector('span').textContent=t.title;
    d.querySelector('button').onclick=e=>{e.stopPropagation();closeTab(t.id)};
    d.addEventListener('pointerdown',e=>tabDown(e,t,d));
    tabList.appendChild(d);
  });
  ws.querySelectorAll('.pane').forEach(()=>{});
  tabs.forEach(t=>t.el.classList.toggle('active',t.id===activeId));
  const t=act();if(!t)return;
  if(document.activeElement!==urlIn)urlIn.value=t.blob?t.title:(t.url&&t.url.startsWith('yt:')?('youtube '+t.url.slice(3)).trim():(t.url||''));
  $('#back').disabled=t.hi<=0;$('#fwd').disabled=t.hi>=t.hist.length-1;
  $('#star').classList.toggle('on',!!t.url&&!t.blob&&bms.some(b=>b.u===t.url));
  save();
}
function home(t){
  const d=document.createElement('div');d.className='home';
  d.innerHTML='<img class="big" src="'+LOGO+'" alt=""><div class="sb"><img src="'+LOGO+'" alt=""><input placeholder="Search or Enter URL" autocomplete="off"></div><div class="bms"></div><div class="tip">Type a site name (youtube, nptel, wikipedia physics…) or paste a link. Drag a tab from the top onto the screen to split it. ⛶ hides the bars for focus.</div>';
  d.querySelector('input').addEventListener('keydown',e=>{if(e.key==='Enter')submit(t,e.target.value)});
  const box=d.querySelector('.bms');
  bms.forEach((b,i)=>{
    const e=document.createElement('div');e.className='bm';
    e.innerHTML='<div class="c"></div><span></span><button class="rm" title="Remove">✕</button>';
    const c=e.querySelector('.c');c.textContent=b.n[0].toUpperCase();c.style.background='hsl('+hue(b.n)+' 55% 38%)';
    e.querySelector('span').textContent=b.n;
    e.onclick=ev=>{if(ev.target.closest('.rm')){bms.splice(i,1);rehome();return}openSmart(t,b.u)};
    box.appendChild(e);
  });
  return d;
}
function rehome(){tabs.forEach(t=>{if(!t.url){t.pc.innerHTML='';t.pc.appendChild(home(t))}});refreshUI()}

/* ---------- drag a tab onto the screen ---------- */
function target(x,y){
  const w=ws.getBoundingClientRect();if(y<w.top||x<w.left||x>w.right||y>w.bottom)return null;
  const px=x-w.left,py=y-w.top;
  for(const [id,r] of rects){
    if(px>=r.x&&px<=r.x+r.w&&py>=r.y&&py<=r.y+r.h){
      const f=[(px-r.x)/r.w,1-(px-r.x)/r.w,(py-r.y)/r.h,1-(py-r.y)/r.h];
      const m=Math.min(...f);const z=m<.28?['l','r','t','b'][f.indexOf(m)]:'c';
      return {id,zone:z,r};
    }
  }
  return null;
}
function showHl(d){
  if(!d){hl.style.display='none';return}
  const {r,zone}=d;let x=r.x,y=r.y,w=r.w,h=r.h;
  if(zone==='l')w/=2;if(zone==='r'){x+=w/2;w/=2}if(zone==='t')h/=2;if(zone==='b'){y+=h/2;h/=2}
  Object.assign(hl.style,{display:'block',left:x+'px',top:y+'px',width:w+'px',height:h+'px'});
}
function applyDrop(id,d){
  const tl=findLeaf(layout,d.id);if(!tl)return;const sl=findLeaf(layout,id);
  if(d.zone==='c'){
    if(id===d.id){setActive(id);return}
    if(sl){sl.tab=d.id}tl.tab=id;
  }else{
    if(id===d.id)return;
    if(sl)removeLeaf(sl);
    const nl={t:'leaf',tab:id},first=d.zone==='l'||d.zone==='t';
    replaceNode(tl,{t:'split',dir:(d.zone==='l'||d.zone==='r')?'row':'col',ratio:.5,a:first?nl:tl,b:first?tl:nl});
  }
  activeId=id;render();
}
function tabDown(e,t,d){
  if(e.target.closest('button')||e.button!==0)return;
  const sx=e.clientX,sy=e.clientY;let drag=false,ghost=null,drop=null;
  d.setPointerCapture(e.pointerId);
  const mv=ev=>{
    if(!drag&&Math.hypot(ev.clientX-sx,ev.clientY-sy)>6){drag=true;document.body.classList.add('dragging');ghost=document.createElement('div');ghost.className='ghost';ghost.textContent=t.title;document.body.appendChild(ghost)}
    if(!drag)return;
    ghost.style.left=ev.clientX+12+'px';ghost.style.top=ev.clientY+12+'px';
    drop=target(ev.clientX,ev.clientY);showHl(drop);
  };
  const up=ev=>{
    d.removeEventListener('pointermove',mv);d.removeEventListener('pointerup',up);d.removeEventListener('pointercancel',up);
    document.body.classList.remove('dragging');hl.style.display='none';if(ghost)ghost.remove();
    if(!drag){activate(t.id);return}
    if(ev.type==='pointercancel')return;
    if(drop)applyDrop(t.id,drop);
    else{ /* reorder inside the tab strip */
      const others=[...tabList.children].filter(c=>+c.dataset.id!==t.id);
      const kids=[...tabList.children];let idx=0;
      kids.forEach((c,i)=>{if(tabs[i]!==t){const b=c.getBoundingClientRect();if(ev.clientX>b.left+b.width/2)idx++}});
      tabs=tabs.filter(x=>x!==t);tabs.splice(idx,0,t);refreshUI();
    }
  };
  d.addEventListener('pointermove',mv);d.addEventListener('pointerup',up);d.addEventListener('pointercancel',up);
}

/* ---------- persistence ---------- */
function save(){try{localStorage.setItem(KEY,JSON.stringify({tabs:tabs.map(t=>({id:t.id,url:t.blob?null:t.url,title:t.blob?'New Tab':t.title})),layout,activeId,bms}))}catch(e){}}
function restore(){
  try{
    const s=JSON.parse(localStorage.getItem(KEY)||'null');if(!s||!s.tabs.length)return false;
    s.tabs.forEach(x=>newTab(x.url,{title:x.title,nohist:true},x.id));
    const ok=n=>n.t==='leaf'?tabs.some(t=>t.id===n.tab):ok(n.a)&&ok(n.b);
    if(!ok(s.layout))return false;
    layout=s.layout;activeId=tabs.some(t=>t.id===s.activeId)?s.activeId:leafIds()[0];
    if(Array.isArray(s.bms))bms=s.bms;return true;
  }catch(e){return false}
}

/* ---------- controls ---------- */
$('#newTab').onclick=()=>{const t=newTab();findLeaf(layout,activeId).tab=t.id;activeId=t.id;render();rehome()};
$('#back').onclick=()=>go(act(),-1);$('#fwd').onclick=()=>go(act(),1);
$('#rl').onclick=()=>{const t=act();if(t.f)t.f.src=t.f.src};
$('#home').onclick=()=>load(act(),null);
$('#ext').onclick=()=>{const t=act();if(t.url&&!t.blob)window.open(realUrl(t),'_blank','noopener')};
urlIn.addEventListener('keydown',e=>{if(e.key==='Enter'){submit(act(),urlIn.value);urlIn.blur()}});
urlIn.addEventListener('focus',()=>urlIn.select());
$('#star').onclick=()=>{const t=act();if(!t.url||t.blob)return;const i=bms.findIndex(b=>b.u===t.url);if(i>=0)bms.splice(i,1);else bms.push({n:t.title,u:t.url});rehome()};
$('#single').onclick=()=>{layout={t:'leaf',tab:activeId};render()};
$('#file').onclick=()=>$('#picker').click();
$('#picker').onchange=e=>{
  [...e.target.files].forEach(f=>{const t=newTab(URL.createObjectURL(f),{blob:true,title:f.name});findLeaf(layout,activeId).tab=t.id;activeId=t.id});
  e.target.value='';render();
};
addEventListener('blur',()=>setTimeout(()=>{const t=tabs.find(x=>x.f&&x.f===document.activeElement);if(t)setActive(t.id)},0));
new ResizeObserver(()=>place()).observe(ws);

const focus=on=>document.body.classList.toggle('focus',on);
$('#focusBtn').onclick=()=>focus();$('#fhShow').onclick=()=>focus(false);
const doEq=()=>{eq(layout);place();save()};$('#eq').onclick=doEq;$('#fhEq').onclick=doEq;
const hist_=()=>{$('#hist').classList.toggle('open');drawHist()};
$('#histBtn').onclick=hist_;$('#fhHist').onclick=hist_;$('#hx').onclick=()=>$('#hist').classList.remove('open');
$('#hq').oninput=drawHist;
$('#hclear').onclick=()=>{hist=[];try{localStorage.removeItem(HK)}catch(e){}drawHist()};
$('#pasteBtn').onclick=async()=>{try{const s=await navigator.clipboard.readText();if(!s.trim())throw 0;openNew(s)}catch(e){toast('Clipboard is blocked here. Click the address bar and press Ctrl+V instead.')}};
addEventListener('paste',e=>{if(/INPUT|TEXTAREA/.test(document.activeElement.tagName))return;const s=(e.clipboardData.getData('text')||'').trim();if(s)openNew(s)});
addEventListener('keydown',e=>{
  if(e.key==='Escape'){if($('#hist').classList.contains('open'))$('#hist').classList.remove('open');else focus(false)}
  if(e.altKey&&e.key.toLowerCase()==='f'){e.preventDefault();focus()}
});
/* ---------- YouTube search (free API key, one-time) ---------- */
const realUrl=t=>t.url.startsWith('yt:')?'https://www.youtube.com/results?search_query='+encodeURIComponent(t.url.slice(3)):t.url;
const getKey=()=>{try{return localStorage.getItem('deskspace.ytkey')||''}catch(e){return ''}};
function ytView(t,q){
  const d=document.createElement('div');d.className='home yt';
  d.innerHTML='<div class="sb"><img src="'+LOGO+'" alt=""><input placeholder="Search YouTube — e.g. class 11 physics lecture" autocomplete="off"></div><div class="res"></div>';
  const inp=d.querySelector('input'),res=d.querySelector('.res');inp.value=q;
  inp.addEventListener('keydown',e=>{if(e.key==='Enter'&&inp.value.trim())load(t,'yt:'+inp.value.trim())});
  const msg=x=>{res.innerHTML='';const p=document.createElement('div');p.className='tip';p.style.gridColumn='1/-1';p.textContent=x;res.appendChild(p)};
  if(!q){msg('Type what you want to watch and press Enter.');return d}
  const key=getKey();
  if(!key){
    res.innerHTML='<div class="kf"><div class="tip">YouTube search needs a free API key (one-time setup): Google Cloud Console → enable “YouTube Data API v3” → Create credentials → API key. It is stored only on this device.</div><input placeholder="Paste API key"><button>Save &amp; search</button><a target="_blank" rel="noopener">Or open this search in a normal browser tab ↗</a></div>';
    res.querySelector('a').href='https://www.youtube.com/results?search_query='+encodeURIComponent(q);
    res.querySelector('button').onclick=()=>{const k=res.querySelector('input').value.trim();if(!k)return;try{localStorage.setItem('deskspace.ytkey',k)}catch(e){}load(t,'yt:'+q,{push:false})};
    return d;
  }
  msg('Searching…');
  fetch('https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&maxResults=16&q='+encodeURIComponent(q)+'&key='+encodeURIComponent(key))
    .then(r=>r.json()).then(j=>{
      if(j.error){msg('YouTube said: '+j.error.message);return}
      res.innerHTML='';
      if(!j.items.length){msg('No videos found.');return}
      j.items.forEach(v=>{
        const c=document.createElement('div');c.className='vc';
        const im=document.createElement('img');im.src=v.snippet.thumbnails.medium.url;
        const a=document.createElement('div');a.textContent=v.snippet.title;
        const b=document.createElement('small');b.textContent=v.snippet.channelTitle;
        c.append(im,a,b);
        c.onclick=()=>load(t,'https://www.youtube.com/embed/'+v.id.videoId+'?autoplay=1&rel=0',{title:v.snippet.title});
        res.appendChild(c);
      });
    }).catch(()=>msg('Could not reach YouTube. Check your internet connection.'));
  return d;
}

/* ================= ANALYTICS (stored on this device) ================= */
let booted=false,tick=0;
const AK='sb.analytics.v1';let AN={days:{}};
try{AN=JSON.parse(localStorage.getItem(AK))||AN;if(!AN.days)AN={days:{}}}catch(e){}
const dkey=x=>{x=x||new Date();return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0')};
const dayOf=k=>AN.days[k]||(AN.days[k]={active:0,study:0,sites:{},log:[]});
const anaSave=()=>{try{localStorage.setItem(AK,JSON.stringify(AN))}catch(e){}};
function siteOf(t){if(!t.url)return null;if(t.blob)return 'Local files';if(t.url.startsWith('yt:'))return 'youtube.com';return host(t.url)}
function siteRec(d,h){return d.sites[h]||(d.sites[h]={ms:0,opens:0})}
function anaOpen(h,title){
  if(!booted||!h)return;const d=dayOf(dkey());siteRec(d,h).opens++;
  d.log.push({t:Date.now(),h,title:String(title||h).slice(0,90)});if(d.log.length>400)d.log.shift();anaSave();
}
/* ---- stopwatch ---- */
const SK='sb.stopwatch';let sw={ms:0,run:false,t0:0,last:0,hide:false,show:false};
try{Object.assign(sw,JSON.parse(localStorage.getItem(SK)||'{}'))}catch(e){}
const swSave=()=>{try{localStorage.setItem(SK,JSON.stringify(sw))}catch(e){}};
const swNow=()=>sw.ms+(sw.run?Date.now()-sw.t0:0);
const p2=n=>String(n).padStart(2,'0');
const hms=ms=>{const s=Math.floor(ms/1000);return p2(Math.floor(s/3600))+':'+p2(Math.floor(s%3600/60))+':'+p2(s%60)};
function swCredit(){if(sw.run){const n=Date.now();dayOf(dkey()).study+=n-sw.last;sw.last=n}}
function swDraw(){
  $('#sw').hidden=!sw.show;$('#swd').textContent=hms(swNow());
  $('#swp').textContent=sw.run?'⏸':'▶';$('#swc').classList.toggle('off',sw.hide);
  document.querySelector('[data-a=sw]').classList.toggle('on',sw.show);
}
$('#swp').onclick=()=>{
  if(sw.run){swCredit();sw.ms+=Date.now()-sw.t0;sw.run=false}else{sw.run=true;sw.t0=sw.last=Date.now()}
  swSave();anaSave();swDraw();
};
$('#swr').onclick=()=>{swCredit();sw.ms=0;sw.run=false;swSave();anaSave();swDraw()};
$('#swh').onclick=()=>{sw.hide=true;swSave();swDraw()};
$('#swd').onclick=()=>{if(sw.hide){sw.hide=false;swSave();swDraw()}};
$('#swx').onclick=()=>{sw.show=false;swSave();swDraw()};
/* ---- real clock ---- */
const CK='sb.clock';let ck={show:false,h24:false};
try{Object.assign(ck,JSON.parse(localStorage.getItem(CK)||'{}'))}catch(e){}
function ckDraw(){
  $('#clk').hidden=!ck.show;document.querySelector('[data-a=clk]').classList.toggle('on',ck.show);
  if(!ck.show)return;const n=new Date();
  $('#clkd').textContent=n.toLocaleTimeString([], {hour12:!ck.h24,hour:'2-digit',minute:'2-digit',second:'2-digit'});
  $('#clks').textContent=n.toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'short'});
}
$('#clkd').onclick=()=>{ck.h24=!ck.h24;try{localStorage.setItem(CK,JSON.stringify(ck))}catch(e){}ckDraw()};
/* ---- 1-second heartbeat: active time per website + study time ---- */
setInterval(()=>{
  const d=dayOf(dkey());
  if(document.visibilityState==='visible'){
    d.active+=1000;const seen=new Set();
    rects.forEach((r,id)=>{const t=tabs.find(x=>x.id===id),h=t&&siteOf(t);if(h&&!seen.has(h)){seen.add(h);siteRec(d,h).ms+=1000}});
  }
  swCredit();if(sw.run&&tick%5===0)swSave();
  if(++tick%5===0)anaSave();
},1000);
setInterval(()=>{if(sw.show)$('#swd').textContent=hms(swNow());ckDraw()},250);
addEventListener('pagehide',()=>{swCredit();swSave();anaSave()});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){swCredit();swSave();anaSave()}});
/* ---- analytics panel ---- */
let aview=dkey();
const fmt=ms=>{const s=Math.round(ms/1000),h=Math.floor(s/3600),m=Math.floor(s%3600/60);return h?h+'h '+m+'m':m?m+'m '+(s%60)+'s':s+'s'};
const E=(tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e};
function renderAna(){
  const b=$('#abody');b.innerHTML='';
  const d=AN.days[aview]||{active:0,study:0,sites:{},log:[]};
  $('#adate').textContent=aview===dkey()?'Today · '+aview:aview;$('#anext').disabled=aview>=dkey();
  const sites=Object.entries(d.sites).sort((a,c)=>c[1].ms-a[1].ms);
  const cards=E('div','cards');
  [['Screen time',fmt(d.active)],['Study (stopwatch)',fmt(d.study)],['Websites',sites.length],['Links opened',d.log.length],['Top website',sites[0]?sites[0][0]:'—']]
    .forEach(([k,v])=>{const c=E('div','card');c.append(E('small','',k),E('b','',String(v)));cards.appendChild(c)});
  b.appendChild(cards);
  b.appendChild(E('h4','','Time on each website'));
  const mx=Math.max(1,...sites.map(s=>s[1].ms));
  sites.forEach(([h,s])=>{const r=E('div','row'),bar=E('i');bar.style.width=Math.max(2,s.ms/mx*100)+'%';r.append(E('span','',h),bar,E('em','',fmt(s.ms)+' · opened '+s.opens+'×'));b.appendChild(r)});
  if(!sites.length)b.appendChild(E('p','mut','Nothing recorded for this day yet.'));
  b.appendChild(E('h4','','Last 7 days'));
  const lg=E('div','leg');lg.innerHTML='<span><i></i>Screen time</span><span><i class="st"></i>Study</span>';b.appendChild(lg);
  const keys=[];for(let i=6;i>=0;i--){const x=new Date();x.setDate(x.getDate()-i);keys.push(dkey(x))}
  const m7=Math.max(1,...keys.map(k=>(AN.days[k]||{}).active||0));
  const wk=E('div','week');
  keys.forEach(k=>{const dd=AN.days[k]||{active:0,study:0};const c=E('div','col'+(k===aview?' sel':''));
    const bars=E('div','bars'),a=E('i'),s=E('i','st');a.style.height=Math.max(2,dd.active/m7*88)+'px';s.style.height=Math.max(2,dd.study/m7*88)+'px';bars.append(a,s);
    c.append(bars,E('span','',new Date(k+'T00:00').toLocaleDateString(undefined,{weekday:'short'})),E('span','',fmt(dd.study)));
    c.onclick=()=>{aview=k;renderAna()};wk.appendChild(c)});
  b.appendChild(wk);
  b.appendChild(E('h4','','What I opened (timeline)'));
  d.log.slice().reverse().forEach(x=>{const r=E('div','tl');const tm=new Date(x.t);r.append(E('span','',p2(tm.getHours())+':'+p2(tm.getMinutes())),E('span','',x.h),E('span','',x.title));b.appendChild(r)});
  if(!d.log.length)b.appendChild(E('p','mut','No links opened on this day.'));
}
const openAna=()=>{swCredit();aview=dkey();renderAna();$('#ana').hidden=false};
$('#ax').onclick=()=>$('#ana').hidden=true;
$('#ana').addEventListener('pointerdown',e=>{if(e.target.id==='ana')$('#ana').hidden=true});
$('#aprev').onclick=()=>{const x=new Date(aview+'T00:00');x.setDate(x.getDate()-1);aview=dkey(x);renderAna()};
$('#anext').onclick=()=>{const x=new Date(aview+'T00:00');x.setDate(x.getDate()+1);if(dkey(x)<=dkey()){aview=dkey(x);renderAna()}};
$('#aexp').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(AN,null,2)],{type:'application/json'}));a.download='study-browser-analytics-'+dkey()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)};
$('#aclr').onclick=()=>{if(confirm('Delete ALL analytics data from this device?')){AN={days:{}};anaSave();renderAna()}};
addEventListener('keydown',e=>{if(e.key==='Escape')$('#ana').hidden=true});
/* ---- faint draggable side handle + slide-out bar ---- */
const grip=$('#grip'),side=$('#side');let gy=45;
try{gy=+localStorage.getItem('sb.gripY')||45}catch(e){}
function placeSide(){
  grip.style.top=gy+'%';
  const top=Math.min(Math.max(8,grip.offsetTop+33-side.offsetHeight/2),innerHeight-side.offsetHeight-8);side.style.top=top+'px';
}
const sideOpen=on=>{side.classList.toggle('open',on);grip.classList.toggle('on',on);if(on)placeSide()};
grip.addEventListener('pointerdown',e=>{
  e.preventDefault();grip.setPointerCapture(e.pointerId);const sy=e.clientY;let moved=false;
  const mv=ev=>{if(!moved&&Math.abs(ev.clientY-sy)>6){moved=true;document.body.classList.add('dragging')}
    if(moved){gy=Math.min(90,Math.max(4,(ev.clientY-33)/innerHeight*100));grip.style.top=gy+'%';if(side.classList.contains('open'))placeSide()}};
  const up=()=>{grip.removeEventListener('pointermove',mv);grip.removeEventListener('pointerup',up);document.body.classList.remove('dragging');
    if(moved){try{localStorage.setItem('sb.gripY',gy)}catch(e){}}else sideOpen(!side.classList.contains('open'))};
  grip.addEventListener('pointermove',mv);grip.addEventListener('pointerup',up);
});
let installEv=null;
addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEv=e;$('#sideInst').hidden=false});
addEventListener('appinstalled',()=>{$('#sideInst').hidden=true});
side.addEventListener('click',e=>{
  const bt=e.target.closest('button');if(!bt)return;
  if(bt.id==='sideX'){sideOpen(false);return}
  const a=bt.dataset.a;
  if(a==='sw'){sw.show=!sw.show;swSave();swDraw()}
  if(a==='clk'){ck.show=!ck.show;try{localStorage.setItem(CK,JSON.stringify(ck))}catch(e){}ckDraw()}
  if(a==='ana')openAna();
  if(a==='focus')focus();
  if(a==='inst'&&installEv){installEv.prompt();installEv=null;$('#sideInst').hidden=true}
  sideOpen(false);
});
addEventListener('resize',()=>{if(side.classList.contains('open'))placeSide()});
const wdg=$('#widgets');new ResizeObserver(()=>{wdg.style.top=(ws.getBoundingClientRect().top+8)+'px'}).observe(ws);
swDraw();ckDraw();
if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol))addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));

if(!restore()){const t=newTab();layout={t:'leaf',tab:t.id};activeId=t.id}
render();
booted=true;
