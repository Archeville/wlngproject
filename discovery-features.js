import { streamStatus, streamLibrary, safeChannelPhoto, validVideoId } from './stream-library.mjs?v=20261112-discovery1';
export const validChannelId=id=>typeof id==='string'&&/^UC[A-Za-z0-9_-]{22}$/.test(id);
const youtube=id=>'https://www.youtube.com/watch?v='+id;
const text=(value,max)=>String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,max);
const $=id=>document.getElementById(id);
const node=(tag,className,label)=>{const e=document.createElement(tag);if(className)e.className=className;if(label!==undefined)e.textContent=label;return e;};
const button=(label,fn,className='watch-button')=>{const e=node('button',className,label);e.type='button';e.onclick=fn;return e;};
const link=(id,label='Open on YouTube')=>{const a=node('a','watch-button',label);a.href=youtube(id);a.target='_blank';a.rel='noopener';return a;};
export function setupDiscoveryFeatures({favorites,getStreams,getPlayer,play,time,onNavigate}){
  let owner=window.WLNG_AUTH_USER||null,generation=0,items=[],loaded=false,pending=null,busy=false,mode='',channelId='',channelData=null,channelGeneration=0;
  const detailsCache=new Map(),detailsPending=new Map();
  const nav=button('Watch later',()=>openLater(),'nav-item');nav.id='watch-later-open';nav.setAttribute('aria-pressed','false');nav.innerHTML='<svg aria-hidden="true"><use href="#i-clock"/></svg><span>Watch later</span>';$('stream-history-open').before(nav);
  const panel=node('section','discovery-extra');panel.id='media-discovery-section';panel.hidden=true;
  const head=node('div','discovery-extra-head'),title=node('h1','','Watch later.'),back=button('Back to stream hub',()=>{$('hub-toggle').click();});head.append(title,back);
  const status=node('p','discovery-extra-status');status.setAttribute('role','status');
  const body=node('div','discovery-extra-body');panel.append(head,status,body);document.querySelector('.workspace').append(panel);
  const toast=node('div','discovery-feedback');toast.hidden=true;toast.setAttribute('role','status');document.body.append(toast);let toastTimer;
  function feedback(message){const output=$('player-dialog').open?playerFeedback:toast;output.textContent=message;output.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>output.hidden=true,3500);}
  const playerSave=button('Watch later',()=>{const item=getPlayer();if(item)void add(item);});playerSave.id='player-watch-later';playerSave.style.display='inline-flex';playerSave.style.alignItems='center';playerSave.style.gap='6px';playerSave.innerHTML='<svg aria-hidden="true" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7"><use href="#i-clock"/></svg><span>Watch later</span>';$('player-favorite').after(playerSave);
  const playerFeedback=node('span','watch-note');playerFeedback.setAttribute('role','status');playerFeedback.hidden=true;playerSave.after(playerFeedback);
  const playerChannel=$('player-channel');playerChannel.classList.add('player-channel-link');playerChannel.tabIndex=0;playerChannel.setAttribute('role','button');playerChannel.title='Open creator page';
  function clickPlayerChannel(){const item=getPlayer();if(validChannelId(item?.channel?.id)){const dialog=$('player-dialog');if(dialog.open)dialog.close();openChannel(item.channel.id);}}
  playerChannel.onclick=clickPlayerChannel;playerChannel.onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();clickPlayerChannel();}};
  function updateButtons(){
    const ids=new Set(items.map(i=>i.id)),current=getPlayer();
    for(const b of document.querySelectorAll('.stream-watch-later')){
      const active=ids.has(b.closest('[data-id]')?.dataset.id);b.classList.toggle('saved',active);b.setAttribute('aria-pressed',String(active));b.title=active?'Saved to Watch Later':'Save to Watch Later';
    }
    const saved=Boolean(current&&ids.has(current.id));
    playerSave.disabled=!current||busy;playerSave.querySelector('span').textContent=saved?'Saved':'Watch later';playerSave.setAttribute('aria-pressed',String(saved));
    playerChannel.tabIndex=validChannelId(current?.channel?.id)?0:-1;playerChannel.classList.toggle('available',playerChannel.tabIndex===0);
  }
  async function request(input){
    const own=generation,token=await window.WLNG_AUTH?.getAccessToken();if(!token||own!==generation)throw Error('Sign in to save streams.');
    const response=await fetch('/api/account/watch-later',{method:input?'POST':'GET',headers:{Authorization:'Bearer '+token,...(input?{'Content-Type':'application/json'}:{})},...(input?{body:JSON.stringify(input)}:{}),signal:AbortSignal.timeout(10000)});
    const data=await response.json();if(own!==generation)throw Error('Your account changed.');
    if(!response.ok&&response.status!==409)throw Error(data.error||'Watch Later is unavailable.');
    if(!Array.isArray(data.items)||data.items.length>100||!data.items.every(x=>validVideoId(x.id)))throw Error('Could not load Watch Later.');
    items=data.items;loaded=true;updateButtons();if(mode==='later')renderLater();if(data.error)throw Error(data.error);
  }
  async function loadLater(){
    if(!owner||loaded)return;if(pending)return pending;const own=generation;
    pending=request().catch(e=>{if(own===generation&&mode==='later')status.textContent=e.message;}).finally(()=>{if(own===generation)pending=null;});return pending;
  }
  async function mutate(input){
    if(!owner){feedback('Sign in to save streams.');return;}if(busy||pending){feedback('Wait for the current change.');return;}
    const own=generation;busy=true;updateButtons();
    try{await request(input);feedback(input.action==='add'?'Saved to Watch Later':'Removed from Watch Later');}
    catch(e){if(own===generation)feedback(e.message);}
    finally{if(own===generation){busy=false;updateButtons();if(mode==='later')renderLater();}}
  }
  function add(item){
    if(!validVideoId(item?.id))return;
    if(items.some(x=>x.id===item.id)){feedback('Already in Watch Later');return;}
    return mutate({action:'add',id:item.id,title:text(item.title,220),channel:text(item.channel?.english_name||item.channel?.name,128)});
  }
  function show(next){
    onNavigate();window.dispatchEvent(new Event('wlng-discovery-section-open'));
    $('discover').hidden=true;$('multiview').hidden=true;panel.hidden=false;mode=next;
    document.body.classList.add('discovery-extra-open');nav.classList.toggle('selected',next==='later');nav.setAttribute('aria-pressed',String(next==='later'));$('hub-toggle').classList.remove('selected');$('favorites-open').classList.remove('selected');status.textContent='';
  }
  function hide(multiview=false){
    if(panel.hidden)return;panel.hidden=true;mode='';channelGeneration++;document.body.classList.remove('discovery-extra-open');nav.classList.remove('selected');nav.setAttribute('aria-pressed','false');
    if(!multiview)$('discover').hidden=false;
    if(/^#channel\//.test(location.hash)||location.hash==='#watch-later')history.replaceState(null,'',location.pathname+location.search);
  }
  for(const e of document.querySelectorAll('#hub-toggle,.agency-link,#favorites-open,#multiview-open'))e.addEventListener('click',()=>hide(e.id==='multiview-open'));
  function openLater(){
    show('later');title.textContent='Watch later.';if(location.hash!=='#watch-later')history.replaceState(null,'','#watch-later');
    renderLater();if(owner&&!loaded){status.textContent='Loading your saved streams…';void loadLater();}
  }
  function renderLater(){
    body.replaceChildren();
    if(!owner){status.textContent='Sign in to save links across devices.';return;}
    status.textContent=loaded?items.length+' / 100 saved':'Loading…';
    if(!items.length&&loaded){body.append(node('p','discovery-empty','No saved streams yet.'));return;}
    const list=node('div','later-list');
    for(const item of items){
      const row=node('article','later-row'),a=node('a','later-main');a.href=youtube(item.id);a.target='_blank';a.rel='noopener';
      const img=node('img','later-thumb');img.alt='';img.loading='lazy';img.src='https://i.ytimg.com/vi/'+item.id+'/mqdefault.jpg';
      const info=node('div','later-info');info.append(node('strong','',item.title||'YouTube stream'),node('small','',item.channel||'YouTube'));
      a.append(img,info);const remove=button('Remove',()=>void mutate({action:'remove',id:item.id}));remove.disabled=busy;row.append(a,remove);list.append(row);
    }
    body.append(list);
  }
  window.addEventListener('wlng-auth',e=>{const user=e.detail.userId||null;if(user===owner)return;owner=user;generation++;items=[];loaded=false;busy=false;pending=null;updateButtons();if(mode==='later'){renderLater();void loadLater();}});
  function streamCard(item,last=false){
    const card=node('article','channel-stream-card'),img=node('img');img.alt='';img.loading='lazy';img.src='https://i.ytimg.com/vi/'+item.id+'/mqdefault.jpg';
    const info=node('div','channel-stream-info');info.append(node('strong','',item.title||'YouTube stream'),node('small','',last?time(item.startedAt):streamStatus(item)==='live'?'● Live now':time(item.start_scheduled||item.available_at)));
    const actions=node('div','channel-stream-actions');actions.append(last?link(item.id,'Watch on YouTube'):button('Open stream',()=>play(item.id,item)),button('▱ Save',()=>void add(last?{...item,channel:channelData?.last?.channel}:item)));
    card.append(img,info,actions);return card;
  }
  function renderChannel(){
    body.replaceChildren();const data=channelData,streams=getStreams().filter(x=>x.channel?.id===channelId&&!streamLibrary.isHidden(x));
    const info=streams[0]?.channel||data?.last?.channel||streamLibrary.creator(channelId);
    const name=info.english_name||info.name||'YouTube channel';title.textContent=name;
    const top=node('div','creator-page-header'),photo=safeChannelPhoto(info.photo);
    if(photo){const img=node('img','creator-page-avatar');img.alt='';img.src=photo;top.append(img);}
    const label=node('div','creator-page-label');label.append(node('h2','',name));if(info.org)label.append(node('p','',info.org==='Independents'?'Indie':info.org));
    const external=node('a','watch-button','YouTube channel');external.href='https://www.youtube.com/channel/'+channelId;external.target='_blank';external.rel='noopener';
    const favorite=button('♡ Favorite creator',()=>void favorites.openPicker({channel:{id:channelId,name}}));favorite.id='creator-favorite';
    top.append(label,favorite,external);body.append(top);updateChannelFavorite();
    const live=streams.filter(s=>streamStatus(s)==='live'),upcoming=streams.filter(s=>streamStatus(s)==='upcoming').sort((a,b)=>Date.parse(a.start_scheduled||a.available_at)-Date.parse(b.start_scheduled||b.available_at));
    function group(label,entries,empty,last=false){const section=node('section','creator-page-group');section.append(node('h3','',label));const grid=node('div','creator-page-grid');for(const item of entries)grid.append(streamCard(item,last));section.append(entries.length?grid:node('p','discovery-empty',empty));body.append(section);}
    if(live.length)group('Live now',live,'');
    group('Scheduled streams',upcoming,'No scheduled streams in the current feed.');
    group('Last streamed',data?.last?[data.last]:[],data?.error?data.error:data?'No past stream found.':'Loading…',true);
    status.textContent='';
  }
  async function openChannel(id){
    if(!validChannelId(id))return;
    show('channel');channelId=id;channelData=detailsCache.get(id)?.data||null;const own=++channelGeneration;
    if(location.hash!=='#channel/'+id)history.pushState(null,'','#channel/'+id);renderChannel();
    void favorites.getTabs().then(updateChannelFavorite).catch(()=>{});
    const cached=detailsCache.get(id);if(cached&&Date.now()-cached.at<20*60000)return;
    try{
      if(!detailsPending.has(id))detailsPending.set(id,(async()=>{const response=await fetch('/api/channels/'+id,{signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('Last stream unavailable.');const data=await response.json();if(data.last&&(!validVideoId(data.last.id)||data.last.channel?.id!==id))throw Error('Invalid channel data.');return data;})().finally(()=>detailsPending.delete(id)));
      const data=await detailsPending.get(id);
      if(detailsCache.size>=50)detailsCache.delete(detailsCache.keys().next().value);detailsCache.set(id,{data,at:Date.now()});if(own===channelGeneration&&mode==='channel'){channelData=data;renderChannel();}
    }catch(e){if(own===channelGeneration&&mode==='channel'){channelData={error:e.message};renderChannel();}}
  }
  function route(){const match=/^#channel\/(UC[A-Za-z0-9_-]{22})$/.exec(location.hash);if(match)void openChannel(match[1]);else if(location.hash==='#watch-later')openLater();else if(!panel.hidden)$('hub-toggle').click();}
  window.addEventListener('hashchange',route);
  window.addEventListener('wlng-streams',()=>{if(mode==='channel')renderChannel();});
  window.addEventListener('wlng-open-channel',e=>void openChannel(e.detail));
  function updateChannelFavorite(){
    const favorite=$('creator-favorite');if(!favorite||mode!=='channel')return;
    const saved=favorites.contains(channelId);favorite.textContent=saved?'♥ Favorited':'♡ Favorite creator';favorite.setAttribute('aria-pressed',String(saved));
  }
  updateButtons();
  return {add,updateButtons,openChannel,route,updateChannelFavorite};
}
