const REPO = 'https://github.com/Archeville/WLNG-plus';
const $ = selector => document.querySelector(selector);
const siteOrigin = location.origin;
const brandDot = $('.brand .brand-dot');
const editorNav = document.createElement('button');
editorNav.id='plus-editor-open';editorNav.className='nav-item';editorNav.type='button';editorNav.setAttribute('aria-pressed','false');
editorNav.innerHTML='<span class="plus-nav-star" aria-hidden="true">★</span><span>Editor</span>';
$('#multiview-open').after(editorNav);
const section=document.createElement('section');section.id='plus-editor';section.className='plus-editor-panel';section.hidden=true;
section.innerHTML=`<div class="plus-editor-heading"><h1>Editor<span>.</span></h1><span class="plus-connect" data-plus-connection>Extension not detected</span></div><p>For quick cuts and volume changes before moving to your usual editing software.</p><div class="plus-source-grid"><button class="plus-source-card" type="button" id="plus-local"><span class="plus-card-icon">▣</span><strong>Local video</strong><small>Open a video file</small></button><button class="plus-source-card" type="button" id="plus-recent"><span class="plus-card-icon">◷</span><strong>Finished streams</strong><small>Last 72 hours</small></button></div><div id="plus-archive" class="plus-archive" hidden><div class="plus-archive-bar"><h2>Finished streams</h2><div class="plus-archive-controls"><input type="search" id="plus-search" placeholder="Title or creator" aria-label="Filter finished streams"><select id="plus-org" aria-label="Agency"><option value="all">All agencies</option><option value="Hololive">Hololive</option><option value="Nijisanji">Nijisanji</option><option value="Independents">Indie</option></select></div></div><p class="plus-archive-note">Select a stream, then import your video file. YouTube downloads aren't supported.</p><p class="plus-archive-note" id="plus-archive-status" role="status"></p><div class="plus-archive-grid" id="plus-archive-grid"></div></div>`;
$('.workspace').append(section);
const dialog=$('#settings-dialog');
const main=document.createElement('div');main.className='plus-settings-main';
while(dialog.firstChild)main.append(dialog.firstChild);
const side=document.createElement('aside');side.className='plus-settings-side';
side.innerHTML=`<h2>WLNG-plus only</h2><span class="plus-connect" data-plus-connection>Extension not detected</span><a class="plus-download-button" href="${REPO}" target="_blank" rel="noopener">Download WLNG Plus</a><div class="plus-feature"><span class="plus-feature-icon">✂</span><div><strong>Video editor</strong><small>Quick edits before using your usual editing software.</small></div></div><div class="plus-feature"><span class="plus-feature-icon">▣</span><div><strong>Saved videos</strong><small>Keep video copies on your computer.</small></div></div><div class="plus-feature"><span class="plus-feature-icon">◷</span><div><strong>Finished streams</strong><small>Browse the last 72 hours.</small></div></div><div class="plus-feature"><span class="plus-feature-icon">●</span><div><strong>Live clipping</strong></div><span class="plus-coming">COMING LATER</span></div>`;
dialog.classList.add('plus-settings-layout');dialog.append(main,side);
let connected=false, version='', notified=false, archive=[], fetchedAt=0, fetching=false, nextAttemptAt=0;
function updateConnection(){
  document.querySelectorAll('[data-plus-connection]').forEach(el=>{el.dataset.connected=String(connected);el.textContent=connected?'Connected · v'+version:'Extension not detected';});
  if(brandDot){brandDot.textContent=connected?'+':'.';brandDot.classList.toggle('wlng-brand-plus',connected);}
}
function showToast(){
  if(notified)return;notified=true;
  const toast=document.createElement('div');toast.className='plus-toast';toast.setAttribute('role','status');
  toast.innerHTML='<span aria-hidden="true">+</span><div><strong>WLNG Plus connected</strong></div><button type="button" aria-label="Dismiss">×</button>';
  toast.querySelector('button').onclick=()=>toast.remove();document.body.append(toast);
  setTimeout(()=>toast.remove(),5500);
}
window.addEventListener('message',event=>{
  if(event.source!==window||event.origin!==siteOrigin||event.data?.source!=='wlng-plus'||event.data.type!=='ready'||typeof event.data.version!=='string'||!/^\d+(?:\.\d+){1,3}$/.test(event.data.version))return;
  connected=true;version=event.data.version;updateConnection();showToast();
});
function ping(){window.postMessage({source:'wlng-site',type:'ping'},siteOrigin);}
ping();window.addEventListener('wlng-settings-open',ping);
function openEditor(videoId=null){
  if(!connected){
    const note=$('#plus-missing');if(note)note.remove();
    const box=document.createElement('p');box.id='plus-missing';box.className='plus-archive-note';box.textContent='Install WLNG Plus and refresh this page to open the editor. ';
    const link=document.createElement('a');link.href=REPO;link.target='_blank';link.rel='noopener';link.textContent='Download the extension';box.append(link);section.querySelector('.plus-source-grid').after(box);return;
  }
  window.postMessage({source:'wlng-site',type:'open-editor',videoId},siteOrigin);
}
function show(){
  window.dispatchEvent(new Event('wlng-editor-open'));$('#discover').hidden=true;$('#multiview').hidden=true;section.hidden=false;
  document.body.classList.add('plus-editor-open');editorNav.classList.add('selected');editorNav.setAttribute('aria-pressed','true');$('#hub-toggle').classList.remove('selected');$('#favorites-open').classList.remove('selected');
  if(location.hash!=='#editor')history.replaceState(null,'','#editor');
  ping();
}
function hide(isMultiview=false){
  if(section.hidden)return;section.hidden=true;document.body.classList.remove('plus-editor-open');editorNav.classList.remove('selected');editorNav.setAttribute('aria-pressed','false');
  if(!isMultiview)$('#discover').hidden=false;
  if(location.hash==='#editor')history.replaceState(null,'',location.pathname+location.search);
}
editorNav.onclick=show;
for(const element of document.querySelectorAll('#hub-toggle,.agency-link,#favorites-open,#multiview-open'))element.addEventListener('click',()=>hide(element.id==='multiview-open'));
window.addEventListener('hashchange',()=>{if(location.hash==='#editor')show();});
if(location.hash==='#editor')show();
$('#plus-local').onclick=()=>openEditor();
const validStream=item=>item&&typeof item.id==='string'&&/^[A-Za-z0-9_-]{11}$/.test(item.id)&&typeof item.title==='string'&&Number.isFinite(Date.parse(item.endedAt));
function render(){
  const org=$('#plus-org').value, query=$('#plus-search').value.trim().toLowerCase(), now=Date.now();
  const results=archive.filter(item=>now-Date.parse(item.endedAt)<=72*3600000&&Date.parse(item.endedAt)<=now&&(org==='all'||item.org===org)&&(!query||[item.title,item.channel].some(v=>String(v||'').toLowerCase().includes(query))));
  const grid=$('#plus-archive-grid');grid.replaceChildren();
  for(const item of results){
    const button=document.createElement('button');button.type='button';button.className='plus-archive-card';
    const img=document.createElement('img');img.alt='';img.loading='lazy';img.src='https://i.ytimg.com/vi/'+item.id+'/mqdefault.jpg';
    const content=document.createElement('span');content.className='plus-archive-content';
    const title=document.createElement('strong');title.textContent=item.title;
    const channel=document.createElement('small');channel.textContent=item.channel||'YouTube';
    const time=document.createElement('small');time.textContent='Ended '+new Intl.DateTimeFormat(undefined,{weekday:'short',hour:'numeric',minute:'2-digit'}).format(new Date(item.endedAt));
    content.append(title,channel,time);button.append(img,content);button.onclick=()=>openEditor(item.id);grid.append(button);
  }
  $('#plus-archive-status').textContent=results.length?results.length+' finished streams':'No matching finished streams.';
}
async function fetchArchive(){
  $('#plus-archive').hidden=false;
  if(fetching)return;
  if(Date.now()-fetchedAt<600000){render();return;}
  if(Date.now()<nextAttemptAt)return;
  nextAttemptAt=Date.now()+30000;
  fetching=true;$('#plus-archive-status').textContent='Loading finished streams…';
  try{
    const response=await fetch(new URL('/api/archive',window.WLNG_CONFIG.apiBase),{signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new Error('Archive unavailable');
    const data=await response.json();if(!Array.isArray(data.streams))throw new Error('Invalid archive data');
    archive=data.streams.filter(validStream).slice(0,100);fetchedAt=Date.now();render();
  }catch{$('#plus-archive-status').textContent='Finished-stream archive unavailable. Try again shortly.';}
  finally{fetching=false;}
}
$('#plus-recent').onclick=fetchArchive;
$('#plus-search').oninput=render;$('#plus-org').onchange=render;
