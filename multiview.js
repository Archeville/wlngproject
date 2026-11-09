import {GRID,geometry,normalizeLayout,normalizeSaves,liveForChannel} from './multiview-model.mjs?v=20261109-multi1';
const $=s=>document.querySelector(s),panel=$('#multiview'),canvas=$('#mv-canvas'),viewport=$('#mv-viewport');
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
let layout=normalizeLayout(read('wlng-multiview-draft',{})),saves=normalizeSaves(read('wlng-multiview-saves',[])),streams=window.WLNG_STREAMS||[],active=false,drag=null,refreshUntil=0,lastFeedAt=Date.now();
const nodes=new Map(),status=message=>$('#mv-status').textContent=message;
function persist(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{status('Browser storage is unavailable or full. This layout could not be saved.');return false;}}
function saveDraft(){persist('wlng-multiview-draft',layout);}
function zoom(){canvas.style.transform=`scale(${layout.zoom/100})`;$('#mv-sizer').style.width=GRID.columns*GRID.cell*layout.zoom/100+'px';$('#mv-sizer').style.height=GRID.rows*GRID.cell*layout.zoom/100+'px';$('#mv-zoom-label').textContent=layout.zoom+'%';}
function position(node,g){Object.assign(node.style,{left:g.x*64+'px',top:g.y*64+'px',width:g.w*64+'px',height:g.h*64+'px'});}
function button(label,action){const b=document.createElement('button');b.type='button';b.className='mv-action';b.textContent=label;b.addEventListener('click',action);return b;}
function removeNodes(){for(const node of nodes.values())node.remove();nodes.clear();}
function freeSpace(w,h){const used=layout.tiles.flatMap(t=>[t,...(t.chat?[t.chat]:[])]);for(let y=0;y<=24-h;y++)for(let x=0;x<=32-w;x++)if(used.every(g=>x+w<=g.x||x>=g.x+g.w||y+h<=g.y||y>=g.y+g.h))return{x,y,w,h};return{x:0,y:0,w,h};}
function tileNode(item,chat){
 const key=item.channelId+(chat?':chat':':video');if(nodes.has(key))return nodes.get(key);
 const tile=document.createElement('section');tile.className='mv-tile';tile.setAttribute('aria-label',item.name+(chat?' chat':' stream'));
 const top=document.createElement('header'),handle=button(item.name+(chat?' · Chat':''),()=>{});handle.className='mv-handle';handle.setAttribute('aria-label','Move '+item.name+(chat?' chat':' stream'));top.append(handle);
 if(!chat)top.append(button('Chat',()=>{item.chat=item.chat?null:geometry(freeSpace(5,8),true);sync();saveDraft();}));
 top.append(button('×',()=>{if(chat)item.chat=null;else layout.tiles=layout.tiles.filter(x=>x!==item);sync();saveDraft();}));top.lastElementChild.setAttribute('aria-label',chat?'Remove chat':'Remove stream');
 const body=document.createElement('div');body.className='mv-body';const resize=button('◢',()=>{});resize.className='mv-resize';resize.setAttribute('aria-label','Resize '+item.name+(chat?' chat':' stream'));tile.append(top,body,resize);canvas.append(tile);nodes.set(key,tile);
 for(const [control,mode]of [[handle,'move'],[resize,'resize']]){
  control.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();control.setPointerCapture(e.pointerId);drag={item,chat,mode,x:e.clientX,y:e.clientY,start:{...(chat?item.chat:item)}};canvas.classList.add('mv-dragging');});
  control.addEventListener('pointermove',e=>{if(!drag||drag.item!==item||drag.mode!==mode||drag.chat!==chat)return;const dx=Math.round((e.clientX-drag.x)/(64*layout.zoom/100)),dy=Math.round((e.clientY-drag.y)/(64*layout.zoom/100));const g=geometry(mode==='move'?{...drag.start,x:drag.start.x+dx,y:drag.start.y+dy}:{...drag.start,w:drag.start.w+dx,h:drag.start.h+dy},chat);Object.assign(chat?item.chat:item,g);position(tile,g);});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])control.addEventListener(event,finishDrag);
  control.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const g=chat?item.chat:item,dx=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0,dy=e.key==='ArrowDown'?1:e.key==='ArrowUp'?-1:0;Object.assign(g,geometry(mode==='move'?{...g,x:g.x+dx,y:g.y+dy}:{...g,w:g.w+dx,h:g.h+dy},chat));position(tile,g);saveDraft();});
 }
 return tile;
}
function finishDrag(){if(!drag)return;drag=null;canvas.classList.remove('mv-dragging');saveDraft();}
window.addEventListener('blur',finishDrag);
function sync(){
 zoom();const keep=new Set();
 for(const item of layout.tiles)for(const chat of [false,true]){
  if(chat&&!item.chat)continue;const key=item.channelId+(chat?':chat':':video');keep.add(key);const node=tileNode(item,chat);position(node,chat?item.chat:item);
  const live=liveForChannel(streams,item.channelId),video=active&&live?live.id:'';const body=node.querySelector('.mv-body');
  if(body.dataset.video===video)continue;body.dataset.video=video;body.replaceChildren();
  if(video){const frame=document.createElement('iframe');frame.title=item.name+(chat?' YouTube chat':' YouTube stream');frame.referrerPolicy='strict-origin-when-cross-origin';
   if(chat)frame.src='https://www.youtube.com/live_chat?v='+video+'&embed_domain='+encodeURIComponent(location.hostname)+'&dark_theme=1';
   else {frame.src=new URL('player-embed.html?video='+encodeURIComponent(video),location.href).href;frame.allow='autoplay; encrypted-media; picture-in-picture; web-share';frame.allowFullscreen=true;}
   body.append(frame);
  }else{const note=document.createElement('p');note.className='mv-unavailable';note.textContent=item.name+' · Unavailable\nThis channel is not live.';body.append(note);}
 }
 for(const[key,node]of nodes)if(!keep.has(key)){node.remove();nodes.delete(key);}
 $('#mv-add').disabled=layout.tiles.length>=GRID.maxStreams;
 if($('#mv-picker').open)drawPicker();
 if(!layout.tiles.length)status('Choose a channel and add your first stream.');
}
function channels(){sync();}
function drawPicker(){
 const grid=$('#mv-picker-grid'),query=$('#mv-picker-search').value.trim().toLocaleLowerCase(),agency=$('#mv-picker-agency').value,kind=$('#mv-picker-status').value,seen=new Set();grid.replaceChildren();
 for(const s of streams){const id=s.channel?.id;if(typeof id!=='string'||!/^[-\w]{1,128}$/.test(id)||seen.has(id)||!/^[-\w]{11}$/.test(s.id||''))continue;const live=liveForChannel(streams,id),isLive=Boolean(live);if((kind==='live')!==isLive||agency!=='all'&&s.channel.org!==agency)continue;const name=s.channel.english_name||s.channel.name||id;if(query&&!(name+' '+s.title).toLocaleLowerCase().includes(query))continue;seen.add(id);const stream=live||s,added=layout.tiles.some(t=>t.channelId===id);
 const card=document.createElement('button');card.type='button';card.className='mv-picker-card';card.disabled=added||layout.tiles.length>=GRID.maxStreams;card.setAttribute('aria-label',(added?'Added ':'Add ')+(stream.title||name));const image=document.createElement('img');image.src='https://i.ytimg.com/vi/'+stream.id+'/hqdefault.jpg';image.alt='';image.loading='lazy';const copy=document.createElement('span'),title=document.createElement('strong'),creator=document.createElement('span'),state=document.createElement('small');title.textContent=stream.title||name;creator.textContent=name;state.textContent=added?'Added':isLive?'● LIVE'+(Number.isFinite(stream.live_viewers)?' · '+new Intl.NumberFormat().format(stream.live_viewers)+' watching':''):'Scheduled · Add channel';copy.append(title,creator,state);card.append(image,copy);card.addEventListener('click',()=>addChannel(id));grid.append(card);
 }
 if(!grid.children.length){const note=document.createElement('p');note.className='watch-note';note.textContent='No streams match these filters.';grid.append(note);}
 $('#mv-picker-note').textContent=layout.tiles.length>=GRID.maxStreams?'Your grid has the maximum of 12 streams.':layout.tiles.length+' / 12 streams · Click a stream to add it.';
}
function addChannel(id){if(layout.tiles.length>=GRID.maxStreams||layout.tiles.some(t=>t.channelId===id))return;const s=streams.find(s=>s.channel?.id===id);if(!s)return;layout.tiles.push({channelId:id,name:s.channel.english_name||s.channel.name||id,...geometry(freeSpace(8,6)),chat:null});sync();saveDraft();status('Stream added. Drag its title to place it.');}
function saveOptions(selected=$('#mv-saved').value){const select=$('#mv-saved');select.replaceChildren(new Option('Choose a layout',''));for(const save of saves)select.append(new Option(save.name,save.id));select.value=saves.some(x=>x.id===selected)?selected:'';$('#mv-save-new').disabled=saves.length>=10;for(const id of ['load','update','delete'])$('#mv-'+id).disabled=!select.value;}
$('#mv-saved').addEventListener('change',()=>saveOptions());
$('#mv-save-new').addEventListener('click',()=>{if(saves.length>=10)return;const entry={id:crypto.randomUUID(),name:$('#mv-name').value.trim().slice(0,40)||'Layout '+(saves.length+1),layout:normalizeLayout(layout)};const next=[...saves,entry];if(persist('wlng-multiview-saves',next)){saves=next;saveOptions(entry.id);status('Layout saved in this browser.');}});
$('#mv-update').addEventListener('click',()=>{const selected=$('#mv-saved').value;const next=saves.map(x=>x.id===selected?{...x,name:$('#mv-name').value.trim().slice(0,40)||x.name,layout:normalizeLayout(layout)}:x);if(persist('wlng-multiview-saves',next)){saves=next;saveOptions(selected);status('Saved layout updated.');}});
$('#mv-load').addEventListener('click',()=>{const entry=saves.find(x=>x.id===$('#mv-saved').value);if(!entry)return;finishDrag();layout=normalizeLayout(entry.layout);$('#mv-name').value=entry.name;removeNodes();sync();saveDraft();status('Layout loaded. Offline channels stay in place.');});
$('#mv-delete').addEventListener('click',()=>{const next=saves.filter(x=>x.id!==$('#mv-saved').value);if(persist('wlng-multiview-saves',next)){saves=next;saveOptions('');status('Saved layout deleted. Your current grid is still open.');}});
$('#mv-add').addEventListener('click',()=>{drawPicker();$('#mv-picker').showModal();});
for(const id of ['mv-picker-search','mv-picker-agency','mv-picker-status'])$('#'+id).addEventListener(id==='mv-picker-search'?'input':'change',drawPicker);
let zoomSaveTimer;
function zoomAt(value,clientX,clientY){const next=Math.max(25,Math.min(150,value));if(next===layout.zoom)return;finishDrag();const rect=viewport.getBoundingClientRect(),x=clientX-rect.left-viewport.clientLeft,y=clientY-rect.top-viewport.clientTop,old=layout.zoom/100,worldX=(viewport.scrollLeft+x)/old,worldY=(viewport.scrollTop+y)/old;layout.zoom=next;zoom();viewport.scrollLeft=worldX*next/100-x;viewport.scrollTop=worldY*next/100-y;clearTimeout(zoomSaveTimer);zoomSaveTimer=setTimeout(saveDraft,180);}
viewport.addEventListener('wheel',event=>{if(!event.deltaY||event.ctrlKey||event.metaKey)return;event.preventDefault();zoomAt(layout.zoom+(event.deltaY<0?5:-5),event.clientX,event.clientY);},{passive:false});
viewport.addEventListener('keydown',event=>{if(event.target.closest('input,select,textarea')||!['+','=','-','_','0'].includes(event.key))return;event.preventDefault();const rect=viewport.getBoundingClientRect();zoomAt(event.key==='0'?100:layout.zoom+(['+','='].includes(event.key)?5:-5),rect.left+viewport.clientWidth/2,rect.top+viewport.clientHeight/2);});
$('#mv-refresh').addEventListener('click',()=>{if(Date.now()<refreshUntil)return;refreshUntil=Date.now()+30000;$('#mv-refresh').disabled=true;window.dispatchEvent(new Event('wlng-refresh-streams'));status('Checking live channels…');setTimeout(()=>{$('#mv-refresh').disabled=false;},30000);});
window.addEventListener('wlng-feed-refreshed',()=>status('Live-channel check finished.'));
window.addEventListener('wlng-streams',e=>{streams=Array.isArray(e.detail)?e.detail:[];lastFeedAt=Date.now();channels();});
function show(show){active=show;panel.hidden=!show;$('#discover').hidden=show;$('#multiview-open').classList.toggle('selected',show);$('#multiview-open').setAttribute('aria-pressed',String(show));$('#hub-toggle').classList.toggle('selected',!show);finishDrag();if(show){channels();if(Date.now()-lastFeedAt>60000)window.dispatchEvent(new Event('wlng-refresh-streams'));}else removeNodes();}
$('#multiview-open').addEventListener('click',()=>show(true));for(const el of document.querySelectorAll('#hub-toggle,.agency-link,#favorites-open'))el.addEventListener('click',()=>show(false));
channels();saveOptions();
