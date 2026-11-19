import {GRID,geometry,normalizeLayout,normalizeSaves,liveForChannel,clampCamera} from './multiview-model.mjs?v=20261109-chat4';
import {matchesFavoriteTab} from './favorites-model.mjs?v=20261112-discovery1';
import {streamLibrary,streamStatus} from './stream-library.mjs?v=20261112-discovery1';
const $=s=>document.querySelector(s),panel=$('#multiview'),canvas=$('#mv-canvas'),viewport=$('#mv-viewport');
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
let layout=normalizeLayout(read('wlng-multiview-draft',{})),saves=normalizeSaves(read('wlng-multiview-saves',[])),streams=window.WLNG_STREAMS||[],active=false,drag=null,refreshUntil=0,lastFeedAt=Date.now();
const nodes=new Map(),status=message=>$('#mv-status').textContent=message;
let focusedAudio=null;
function sendAudio(frame,id){
 const mode=focusedAudio===null?'restore':focusedAudio===id?'focus':'mute';
 frame.contentWindow?.postMessage({type:'wlng-audio-focus',mode},location.origin);
}
function updateAudio(){
 const focusedTile=focusedAudio===null?null:nodes.get(focusedAudio+':video');
 if(focusedAudio!==null&&!focusedTile?.querySelector('.mv-body iframe'))focusedAudio=null;
 for(const [key,node] of nodes){
  if(!key.endsWith(':video'))continue;
  const id=key.slice(0,-6);
  const control=node.querySelector('.mv-audio-focus');
  const frame=node.querySelector('.mv-body iframe');
  const selected=focusedAudio===id;
  control.disabled=!frame;
  control.setAttribute('aria-pressed',String(selected));
  node.classList.toggle('mv-audio-active',selected);
  if(frame)sendAudio(frame,id);
 }
 $('#mv-clear-audio').hidden=focusedAudio===null;
}
$('#mv-clear-audio').addEventListener('click',()=>{
 focusedAudio=null;
 updateAudio();
 $('#mv-audio-status').textContent='Audio focus cleared.';
});
window.addEventListener('message',event=>{
 if(event.origin!==location.origin||event.data?.type!=='wlng-audio-unavailable'||focusedAudio===null)return;
 for(const [key,node] of nodes){
  if(!key.endsWith(':video')||node.querySelector('.mv-body iframe')?.contentWindow!==event.source)continue;
  $('#mv-audio-status').textContent='YouTube audio controls are unavailable for one of these streams.';
  break;
 }
});
function persist(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{status('Browser storage is unavailable or full. This layout could not be saved.');return false;}}
function saveDraft(){persist('wlng-multiview-draft',layout);}
let panning=null,pickerAgency='all';
function zoom(){if(active){layout.view=clampCamera(layout.view,viewport.clientWidth,viewport.clientHeight,layout.zoom);}canvas.style.width=GRID.columns*GRID.cell+'px';canvas.style.height=GRID.rows*GRID.cell+'px';canvas.style.transform=`translate(${layout.view.x}px,${layout.view.y}px) scale(${layout.zoom/100})`;$('#mv-zoom-label').textContent=layout.zoom+'%';}
function position(node,g){Object.assign(node.style,{left:g.x*GRID.cell+'px',top:g.y*GRID.cell+'px',width:g.w*GRID.cell+'px',height:g.h*GRID.cell+'px'});}
function button(label,action){const b=document.createElement('button');b.type='button';b.className='mv-action';b.textContent=label;b.addEventListener('click',action);return b;}
function removeNodes(){for(const node of nodes.values())node.remove();nodes.clear();}
function freeSpace(w,h){const used=layout.tiles.flatMap(t=>[t,...(t.chat?[t.chat]:[])]);for(let y=0;y<=GRID.rows-h;y++)for(let x=0;x<=GRID.columns-w;x++)if(used.every(g=>x+w<=g.x||x>=g.x+g.w||y+h<=g.y||y>=g.y+g.h))return{x,y,w,h};return{x:0,y:0,w,h};}
function tileNode(item,chat){
 const key=item.channelId+(chat?':chat':':video');if(nodes.has(key))return nodes.get(key);
 const tile=document.createElement('section');tile.className='mv-tile';tile.setAttribute('aria-label',item.name+(chat?' chat':' stream'));
 const top=document.createElement('header'),handle=button(item.name+(chat?' · Chat':''),()=>{});handle.className='mv-handle';handle.setAttribute('aria-label','Move '+item.name+(chat?' chat':' stream'));top.append(handle);
 if(chat){const themeButton=button(item.chat.theme==='light'?'Black chat':'White chat',()=>{item.chat.theme=item.chat.theme==='light'?'dark':'light';themeButton.textContent=item.chat.theme==='light'?'Black chat':'White chat';sync();saveDraft();});themeButton.title='Switch between white and black YouTube chat';top.append(themeButton);}
 if(!chat){
  const audio=button('Audio',()=>{
   focusedAudio=focusedAudio===item.channelId?null:item.channelId;
   updateAudio();
   $('#mv-audio-status').textContent=focusedAudio?'Audio focus: '+item.name+'.':'Audio focus cleared.';
  });
  audio.classList.add('mv-audio-focus');
  audio.setAttribute('aria-label','Focus audio on '+item.name);
  top.append(audio,button('Chat',()=>{item.chat=item.chat?null:geometry(freeSpace(7,11),true);sync();saveDraft();}));
 }
 top.append(button('×',()=>{if(chat)item.chat=null;else layout.tiles=layout.tiles.filter(x=>x!==item);sync();saveDraft();}));top.lastElementChild.setAttribute('aria-label',chat?'Remove chat':'Remove stream');
 const body=document.createElement('div');body.className='mv-body';const resize=button('◢',()=>{});resize.className='mv-resize';resize.setAttribute('aria-label','Resize '+item.name+(chat?' chat':' stream'));tile.append(top,body,resize);canvas.append(tile);nodes.set(key,tile);
 for(const [control,mode]of [[handle,'move'],[resize,'resize']]){
  control.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();control.setPointerCapture(e.pointerId);drag={item,chat,mode,x:e.clientX,y:e.clientY,start:{...(chat?item.chat:item)}};canvas.classList.add('mv-dragging');});
  control.addEventListener('pointermove',e=>{if(!drag||drag.item!==item||drag.mode!==mode||drag.chat!==chat)return;const dx=Math.round((e.clientX-drag.x)/(GRID.cell*layout.zoom/100)),dy=Math.round((e.clientY-drag.y)/(GRID.cell*layout.zoom/100));const g=geometry(mode==='move'?{...drag.start,x:drag.start.x+dx,y:drag.start.y+dy}:{...drag.start,w:drag.start.w+dx,h:drag.start.h+dy},chat);Object.assign(chat?item.chat:item,g);position(tile,g);});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])control.addEventListener(event,finishDrag);
  control.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const g=chat?item.chat:item,dx=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0,dy=e.key==='ArrowDown'?1:e.key==='ArrowUp'?-1:0;Object.assign(g,geometry(mode==='move'?{...g,x:g.x+dx,y:g.y+dy}:{...g,w:g.w+dx,h:g.h+dy},chat));position(tile,g);saveDraft();});
 }
 return tile;
}
function finishDrag(){if(!drag)return;drag=null;canvas.classList.remove('mv-dragging');saveDraft();}
window.addEventListener('blur',finishDrag);
function sync(){
 zoom();const keep=new Set();
 const visible=streams.filter(stream=>!streamLibrary.isHidden(stream));
 for(const item of layout.tiles)for(const chat of [false,true]){
  if(chat&&!item.chat)continue;const key=item.channelId+(chat?':chat':':video');keep.add(key);const node=tileNode(item,chat);position(node,chat?item.chat:item);
  const live=liveForChannel(visible,item.channelId),video=active&&live?live.id:'';const body=node.querySelector('.mv-body');
  const source=video+(chat?':'+(item.chat.theme||'dark'):'');if(body.dataset.source===source)continue;body.dataset.source=source;body.dataset.video=video;body.replaceChildren();
  if(video){const frame=document.createElement('iframe');frame.title=item.name+(chat?' YouTube chat':' YouTube stream');frame.referrerPolicy='strict-origin-when-cross-origin';
   if(chat){frame.style.colorScheme='only light';frame.src='https://www.youtube.com/live_chat?v='+video+'&embed_domain='+encodeURIComponent(location.hostname)+'&dark_theme='+(item.chat.theme==='light'?'0':'1');}
   else {
    frame.src=new URL('player-embed.html?audio=1&video='+encodeURIComponent(video),location.href).href;
    frame.allow='autoplay; encrypted-media; picture-in-picture; web-share';
    frame.allowFullscreen=true;
    frame.addEventListener('load',()=>sendAudio(frame,item.channelId));
   }
   body.append(frame);
   if(!chat)streamLibrary.record(live);
  }else{const note=document.createElement('p');note.className='mv-unavailable';note.textContent=item.name+' · Unavailable\nNo visible live stream for this channel.';body.append(note);}
 }
 for(const[key,node]of nodes)if(!keep.has(key)){node.remove();nodes.delete(key);}
 updateAudio();
 $('#mv-add').disabled=layout.tiles.length>=GRID.maxStreams;
 if($('#mv-picker').open)drawPicker();
 if(!layout.tiles.length)status('Choose a channel and add your first stream.');
}
function channels(){sync();}
function drawPicker(){
 const grid=$('#mv-picker-grid'),query=$('#mv-picker-search').value.trim().toLocaleLowerCase(),agency=pickerAgency,kind=$('#mv-picker-status').value,seen=new Set();grid.replaceChildren();
 const visible=streams.filter(stream=>!streamLibrary.isHidden(stream));
 for(const s of visible){const id=s.channel?.id;if(typeof id!=='string'||!/^[-\w]{1,128}$/.test(id)||seen.has(id)||!/^[-\w]{11}$/.test(s.id||''))continue;const live=liveForChannel(visible,id),isLive=Boolean(live);if((kind==='live')!==isLive||agency!=='all'&&s.channel.org!==agency)continue;const name=s.channel.english_name||s.channel.name||id;if(query&&!(name+' '+s.title).toLocaleLowerCase().includes(query))continue;seen.add(id);const stream=live||s,added=layout.tiles.some(t=>t.channelId===id);
 const card=document.createElement('button');card.type='button';card.className='mv-picker-card';card.disabled=added||layout.tiles.length>=GRID.maxStreams;card.setAttribute('aria-label',(added?'Added ':'Add ')+(stream.title||name));const image=document.createElement('img');image.src='https://i.ytimg.com/vi/'+stream.id+'/hqdefault.jpg';image.alt='';image.loading='lazy';const copy=document.createElement('span'),title=document.createElement('strong'),creator=document.createElement('span'),state=document.createElement('small');title.textContent=stream.title||name;creator.textContent=name;state.textContent=added?'Added':isLive?'● LIVE'+(Number.isFinite(stream.live_viewers)?' · '+new Intl.NumberFormat().format(stream.live_viewers)+' watching':''):'Scheduled · Add channel';copy.append(title,creator,state);card.append(image,copy);card.addEventListener('click',()=>addChannel(id));grid.append(card);
 }
 if(!grid.children.length){const note=document.createElement('p');note.className='watch-note';note.textContent='No streams match these filters.';grid.append(note);}
 $('#mv-picker-note').textContent=layout.tiles.length>=GRID.maxStreams?'Your grid has the maximum of 12 streams.':layout.tiles.length+' / 12 streams · Click a stream to add it.';
}
function appendChannel(stream){
 const id=stream.channel.id;
 layout.tiles.push({channelId:id,name:stream.channel.english_name||stream.channel.name||id,...geometry(freeSpace(11,8)),chat:null});
}
function addChannel(id){
 if(layout.tiles.length>=GRID.maxStreams||layout.tiles.some(t=>t.channelId===id))return;
 const visible=streams.filter(stream=>!streamLibrary.isHidden(stream));
 const stream=liveForChannel(visible,id)||visible.find(item=>item.channel?.id===id);
 if(!stream)return;
 appendChannel(stream);sync();saveDraft();
 status('“'+(stream.title||stream.channel.name||id)+'” added');
}
const importDialog=$('#mv-favorites-dialog'),importSelect=$('#mv-favorites-tab'),importStatus=$('#mv-favorites-status'),importButton=$('#mv-favorites-add');
let importTabs=[],importGeneration=0;
function favoriteCandidates(){
 const tab=importTabs.find(item=>item.id===importSelect.value);
 if(!tab)return [];
 const used=new Set(layout.tiles.map(tile=>tile.channelId));
 const candidates=[];
 for(const stream of streams){
  const id=stream.channel?.id;
  if(typeof id!=='string'||!/^[-\w]{1,128}$/.test(id)||used.has(id)||streamStatus(stream)!=='live'||streamLibrary.isHidden(stream))continue;
  if(!matchesFavoriteTab(tab,stream,'live'))continue;
  used.add(id);
  candidates.push(stream);
 }
 return candidates;
}
function refreshFavoriteImport(){
 if(!importDialog.open||!importTabs.length)return;
 const candidates=favoriteCandidates().length;
 const available=GRID.maxStreams-layout.tiles.length;
 const count=Math.min(candidates,available);
 importButton.disabled=count===0;
 importStatus.textContent=!available?'The grid already has 12 streams.':!candidates?'No new live creators match this tab.':count+' live '+(count===1?'creator':'creators')+' will be added'+(count<candidates?' (the grid limit is 12).':'.');
}
async function loadFavoriteImport(){
 const generation=++importGeneration;
 importTabs=[];
 importSelect.replaceChildren(new Option('Loading tabs…',''));
 importSelect.disabled=importButton.disabled=true;
 importStatus.textContent='';
 try{
  const tabs=await window.WLNG_FAVORITES.getTabs();
  if(generation!==importGeneration||!importDialog.open)return;
  importTabs=tabs;
  importSelect.replaceChildren(...tabs.map(tab=>new Option(tab.name,tab.id)));
  importSelect.value=window.WLNG_FAVORITES.activeTab().id;
  importSelect.disabled=false;
  refreshFavoriteImport();
 }catch(error){
  if(generation===importGeneration&&importDialog.open)importStatus.textContent=error.message;
 }
}
$('#mv-from-favorites').addEventListener('click',()=>{
 importDialog.showModal();
 void loadFavoriteImport();
});
importSelect.addEventListener('change',refreshFavoriteImport);
importButton.addEventListener('click',()=>{
 if(importButton.disabled)return;
 const candidates=favoriteCandidates().slice(0,GRID.maxStreams-layout.tiles.length);
 if(!candidates.length){refreshFavoriteImport();return;}
 for(const stream of candidates)appendChannel(stream);
 sync();
 saveDraft();
 importDialog.close();
 status(candidates.length+' live '+(candidates.length===1?'creator':'creators')+' added from Favorites.');
});
window.addEventListener('wlng-auth',()=>{if(importDialog.open)void loadFavoriteImport();});
window.addEventListener('wlng-library-change',()=>{if(active)sync();refreshFavoriteImport();});
function saveOptions(selected=$('#mv-saved').value){const select=$('#mv-saved');select.replaceChildren(new Option('Choose a layout',''));for(const save of saves)select.append(new Option(save.name,save.id));select.value=saves.some(x=>x.id===selected)?selected:'';$('#mv-save-new').disabled=saves.length>=10;for(const id of ['load','update','delete'])$('#mv-'+id).disabled=!select.value;}
$('#mv-saved').addEventListener('change',()=>saveOptions());
$('#mv-save-new').addEventListener('click',()=>{if(saves.length>=10)return;const entry={id:crypto.randomUUID(),name:$('#mv-name').value.trim().slice(0,40)||'Layout '+(saves.length+1),layout:normalizeLayout(layout)};const next=[...saves,entry];if(persist('wlng-multiview-saves',next)){saves=next;saveOptions(entry.id);status('Layout saved in this browser.');}});
$('#mv-update').addEventListener('click',()=>{const selected=$('#mv-saved').value;const next=saves.map(x=>x.id===selected?{...x,name:$('#mv-name').value.trim().slice(0,40)||x.name,layout:normalizeLayout(layout)}:x);if(persist('wlng-multiview-saves',next)){saves=next;saveOptions(selected);status('Saved layout updated.');}});
$('#mv-load').addEventListener('click',()=>{const entry=saves.find(x=>x.id===$('#mv-saved').value);if(!entry)return;finishDrag();layout=normalizeLayout(entry.layout);$('#mv-name').value=entry.name;removeNodes();sync();saveDraft();status('Layout loaded. Offline channels stay in place.');});
$('#mv-delete').addEventListener('click',()=>{const next=saves.filter(x=>x.id!==$('#mv-saved').value);if(persist('wlng-multiview-saves',next)){saves=next;saveOptions('');status('Saved layout deleted. Your current grid is still open.');}});
$('#mv-add').addEventListener('click',()=>{drawPicker();$('#mv-picker').showModal();});
for(const id of ['mv-picker-search','mv-picker-status'])$('#'+id).addEventListener(id==='mv-picker-search'?'input':'change',drawPicker);
for(const button of document.querySelectorAll('[data-mv-agency]'))button.addEventListener('click',()=>{pickerAgency=button.dataset.mvAgency;for(const tab of document.querySelectorAll('[data-mv-agency]'))tab.setAttribute('aria-pressed',String(tab===button));drawPicker();});
let zoomSaveTimer;
function zoomAt(value,clientX,clientY){const next=Math.max(10,Math.min(150,value));if(next===layout.zoom)return;finishDrag();const rect=viewport.getBoundingClientRect(),x=clientX-rect.left-viewport.clientLeft,y=clientY-rect.top-viewport.clientTop,old=layout.zoom/100,worldX=(x-layout.view.x)/old,worldY=(y-layout.view.y)/old;layout.zoom=next;layout.view={x:x-worldX*next/100,y:y-worldY*next/100};zoom();clearTimeout(zoomSaveTimer);zoomSaveTimer=setTimeout(saveDraft,180);}
function finishPan(){if(!panning)return;panning=null;viewport.classList.remove('mv-panning');saveDraft();}
viewport.addEventListener('pointerdown',e=>{if(e.target.closest('.mv-tile')||![0,1].includes(e.button))return;e.preventDefault();viewport.focus({preventScroll:true});viewport.setPointerCapture(e.pointerId);panning={x:e.clientX,y:e.clientY,start:{...layout.view}};viewport.classList.add('mv-panning');});
viewport.addEventListener('pointermove',e=>{if(!panning)return;layout.view={x:panning.start.x+e.clientX-panning.x,y:panning.start.y+e.clientY-panning.y};zoom();});
for(const event of ['pointerup','pointercancel','lostpointercapture'])viewport.addEventListener(event,finishPan);window.addEventListener('blur',finishPan);
viewport.addEventListener('keydown',e=>{if(e.target!==viewport||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();layout.view.x+=e.key==='ArrowLeft'?48:e.key==='ArrowRight'?-48:0;layout.view.y+=e.key==='ArrowUp'?48:e.key==='ArrowDown'?-48:0;zoom();saveDraft();});
new ResizeObserver(()=>{if(active)zoom();}).observe(viewport);
viewport.addEventListener('wheel',event=>{if(!event.deltaY||event.ctrlKey||event.metaKey)return;event.preventDefault();zoomAt(layout.zoom+(event.deltaY<0?5:-5),event.clientX,event.clientY);},{passive:false});
viewport.addEventListener('keydown',event=>{if(event.target.closest('input,select,textarea')||!['+','=','-','_','0'].includes(event.key))return;event.preventDefault();const rect=viewport.getBoundingClientRect();zoomAt(event.key==='0'?100:layout.zoom+(['+','='].includes(event.key)?5:-5),rect.left+viewport.clientWidth/2,rect.top+viewport.clientHeight/2);});
let expanded=false,previousInert=null;
function setExpanded(next){if(next===expanded)return;const before=viewport.getBoundingClientRect(),oldCenter={x:(viewport.clientWidth/2-layout.view.x)/(layout.zoom/100),y:(viewport.clientHeight/2-layout.view.y)/(layout.zoom/100)};expanded=next;document.body.classList.toggle('mv-expanded',expanded);const topbar=$('.topbar'),sidebar=$('#sidebar');if(expanded){previousInert={topbar:topbar.inert,sidebar:sidebar.inert};topbar.inert=sidebar.inert=true;}else if(previousInert){topbar.inert=previousInert.topbar;sidebar.inert=$('#menu-toggle').getAttribute('aria-expanded')!=='true';previousInert=null;}$('#mv-expand').textContent=expanded?'Exit expanded grid':'Expand grid';$('#mv-expand').setAttribute('aria-pressed',String(expanded));layout.view={x:viewport.clientWidth/2-oldCenter.x*layout.zoom/100,y:viewport.clientHeight/2-oldCenter.y*layout.zoom/100};zoom();const after=viewport.getBoundingClientRect();if(!matchMedia('(prefers-reduced-motion: reduce)').matches&&!document.body.classList.contains('reduce-motion')){viewport.getAnimations().forEach(a=>a.cancel());viewport.animate([{transform:'translate('+(before.left-after.left)+'px,'+(before.top-after.top)+'px) scale('+(before.width/after.width)+','+(before.height/after.height)+')'},{transform:'none'}],{duration:280,easing:'cubic-bezier(.2,.8,.2,1)'});}saveDraft();}
$('#mv-expand').addEventListener('click',()=>setExpanded(!expanded));
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&expanded&&!document.querySelector('dialog[open]')){event.preventDefault();setExpanded(false);$('#mv-expand').focus();}});
$('#mv-refresh').addEventListener('click',()=>{if(Date.now()<refreshUntil)return;refreshUntil=Date.now()+30000;$('#mv-refresh').disabled=true;window.dispatchEvent(new Event('wlng-refresh-streams'));status('Checking live channels…');setTimeout(()=>{$('#mv-refresh').disabled=false;},30000);});
window.addEventListener('wlng-feed-refreshed',()=>status(''));
window.addEventListener('wlng-streams',e=>{streams=Array.isArray(e.detail)?e.detail:[];lastFeedAt=Date.now();channels();refreshFavoriteImport();});
function show(show){if(!show&&expanded)setExpanded(false);active=show;panel.hidden=!show;$('#discover').hidden=show;$('#multiview-open').classList.toggle('selected',show);$('#multiview-open').setAttribute('aria-pressed',String(show));$('#hub-toggle').classList.toggle('selected',!show&&$('#favorites-open').getAttribute('aria-pressed')!=='true');finishDrag();finishPan();if(show){channels();if(Date.now()-lastFeedAt>60000)window.dispatchEvent(new Event('wlng-refresh-streams'));}else{focusedAudio=null;removeNodes();updateAudio();$('#mv-audio-status').textContent='';}}
$('#multiview-open').addEventListener('click',()=>show(true));for(const el of document.querySelectorAll('#hub-toggle,.agency-link,#favorites-open'))el.addEventListener('click',()=>show(false));
channels();saveOptions();
