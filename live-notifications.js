import { streamStatus,streamLibrary,validVideoId } from './stream-library.mjs?v=20261112-discovery1';
const preference='wlng-live-alerts',pollAtKey='wlng-live-alerts-last-feed',period=180000;
export function matchingLiveStreams(streams,tabs,hidden=()=>false){
  const channels=new Set(tabs.filter(x=>x.type==='channels').flatMap(x=>x.channels));
  const found=new Map();
  for(const stream of streams)if(validVideoId(stream.id)&&streamStatus(stream)==='live'&&channels.has(stream.channel?.id)&&!hidden(stream))found.set(stream.id,stream);
  return [...found.values()];
}
export function setupLiveNotifications({favorites,getStreams,play}){
  const row=document.createElement('div');row.className='setting-row';
  row.innerHTML='<div><strong><label for="live-notifications">Favorite live alerts</label></strong><p>Notify me when a favorite creator goes live, while WLNG is open.</p><small id="live-notification-note" role="status"></small></div><input type="checkbox" id="live-notifications">';
  document.getElementById('settings-dialog').querySelector('.setting-row').after(row);
  const input=row.querySelector('input'),note=row.querySelector('small');
  const storage={get:key=>{try{return localStorage.getItem(key);}catch{return null;}},set:(key,value)=>{try{localStorage.setItem(key,value);return true;}catch{return false;}}};
  let timer=null,active=false,baseline=false,serial=0,favoriteCount=0,owner=window.WLNG_AUTH_USER||null;
  const supported=()=>typeof Notification==='function';
  const eligible=()=>supported()&&Notification.permission==='granted'&&storage.get(preference)==='1';
  function clear(){active=false;clearInterval(timer);timer=null;serial++;baseline=false;favoriteCount=0;}
  async function process(streams,seed=false){
    if(!active||!eligible()||!Array.isArray(streams))return;
    const own=serial;let tabs;
    try{tabs=await favorites.getTabs();}catch{return;}
    if(own!==serial||!active||!eligible())return;
    favoriteCount=new Set(tabs.filter(x=>x.type==='channels').flatMap(x=>x.channels)).size;
    const live=matchingLiveStreams(streams,tabs,x=>streamLibrary.isHidden(x));
    const key='wlng-alerted-v1:'+String(owner||'local');
    const run=()=>{
      if(own!==serial||!active||!eligible())return;
      let previous;try{previous=JSON.parse(storage.get(key)||'null');}catch{previous=null;}
      const now=Date.now(),seen=new Map(Array.isArray(previous)?previous.filter(x=>Array.isArray(x)&&validVideoId(x[0])&&Number.isFinite(x[1])&&now-x[1]<7*86400000):[]);
      const newStreams=seed||!baseline||!Array.isArray(previous)?[]:live.filter(s=>!seen.has(s.id));
      live.forEach(s=>seen.set(s.id,now));baseline=true;
      if(!storage.set(key,JSON.stringify([...seen].sort((a,b)=>a[1]-b[1]).slice(-500))))return;
      const notify=(title,options,onClick)=>{try{const n=new Notification(title,options);n.onclick=()=>{window.focus();onClick?.();n.close();};}catch{clear();note.textContent='Notifications are unavailable in this browser.';}};
      if(newStreams.length>3){notify(newStreams.length+' favorites are live',{body:'Open WLNG to see the streams.',tag:'wlng-live-batch'},()=>document.getElementById('favorites-open').click());return;}
      for(const stream of newStreams){const name=stream.channel?.english_name||stream.channel?.name||'Favorite creator';notify(name+' is live!',{body:String(stream.title||'').slice(0,180),tag:'wlng-live-'+stream.id},()=>play(stream.id,stream));}
    };
    try{if(navigator.locks?.request)await navigator.locks.request(key,run);else run();}catch{}
  }
  function poll(){
    if(!active||!eligible()||!navigator.onLine||!favoriteCount)return;
    const go=lock=>{if(lock===null||!active||!eligible())return;const now=Date.now();if(now-Number(storage.get(pollAtKey)||0)<period)return;if(!storage.set(pollAtKey,String(now)))return;window.dispatchEvent(new Event('wlng-refresh-streams'));};
    if(navigator.locks?.request)void navigator.locks.request('wlng-alert-feed',{ifAvailable:true},go).catch(()=>{});else go(true);
  }
  function apply(){
    input.disabled=!supported();input.checked=eligible();if(!input.checked){clear();return;}
    if(active)return;active=true;baseline=false;
    if(window.WLNG_FEED_FRESH)void process(getStreams(),true);timer=setInterval(poll,period);
  }
  input.onchange=async()=>{
    note.textContent='';
    if(!input.checked){storage.set(preference,'0');clear();return;}
    if(!supported()){input.checked=false;return;}
    let permission=Notification.permission;
    try{if(permission!=='granted')permission=await Notification.requestPermission();}catch{}
    if(permission!=='granted'){input.checked=false;storage.set(preference,'0');note.textContent='Allow notifications in your browser first.';clear();return;}
    if(!storage.set(preference,'1')){input.checked=false;note.textContent='This browser could not save the setting.';return;}
    apply();
  };
  window.addEventListener('storage',e=>{if(e.key===preference)apply();});
  window.addEventListener('wlng-auth',e=>{const next=e.detail.userId||null;if(next===owner)return;owner=next;serial++;baseline=false;if(active)void process(getStreams(),true);});
  window.addEventListener('wlng-streams',e=>{if(active&&window.WLNG_FEED_FRESH)void process(e.detail);});
  window.addEventListener('pagehide',()=>clear());
  window.addEventListener('pageshow',apply);
  apply();
  return {favoritesChanged(){if(active)void process(getStreams(),true);}};
}
