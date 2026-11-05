import { levelProgress } from './levels.mjs';
// One shared account request for XP and cosmetics. No polling or expiry writes.
export function createAccountState({ win=window, doc=document, fetcher=fetch, clock=()=>Date.now(), storage, locks=navigator.locks, makeChannel=name=>new BroadcastChannel(name) }={}) {
  if(storage===undefined){try{storage=win.localStorage;}catch{storage=null;}}
  let user=null, record=null, busy=false, error='', generation=0, pendingLoad=null;
  const listeners=new Set(), requestIds={}, key=()=>`wlng-account-v2:${user}`;
  let channel; try { channel=makeChannel('wlng-account-v2'); } catch {}
  const view=()=>({userId:user,record,busy,error});
  const emit=()=>{for(const listener of listeners)listener(view());};
  function valid(candidate){
    const d=candidate?.data;
    return candidate?.userId===user && d && Number.isFinite(d.currentXp) && d.currentXp>=0 && Number.isFinite(d.serverNow) && Number.isFinite(candidate.receivedAt) && Number.isFinite(candidate.version) && Number.isFinite(candidate.checkedAt) && candidate.checkedAt<=clock()+1000 && (!d.endsAt||Number.isFinite(d.endsAt));
  }
  function accept(candidate,publish=false){
    if(!valid(candidate)||record&&candidate.version<record.version)return false;
    record=candidate; error='';
    if(publish){try{storage?.setItem(key(),JSON.stringify(record));}catch{}channel?.postMessage(record);}
    emit();return true;
  }
  function cached(){try{const candidate=JSON.parse(storage?.getItem(key()));return valid(candidate)&&clock()-candidate.checkedAt<15000?candidate:null;}catch{return null;}}
  const serial=fn=>locks?.request?locks.request('wlng-account-v2:'+user,fn):fn();
  async function api(path,body){
    const own=generation;
    const token=await win.WLNG_AUTH?.getAccessToken();if(own!==generation)throw Error('Your account changed. Please try again.');if(!token)throw Error('Please sign in.');if(doc.hidden)throw Error('Return to WLNG and try again.');
    const response=await fetcher(new URL(path,win.WLNG_CONFIG.apiBase),{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
    const data=await response.json();if(!response.ok)throw Error(data.error||'Could not load your account.');return data;
  }
  function load(){
    if(!user||doc.hidden)return Promise.resolve();
    if(pendingLoad)return pendingLoad;
    const own=generation;
    pendingLoad=serial(async()=>{
      if(own!==generation||doc.hidden)return;
      const cache=cached();if(cache){accept(cache);return;}
      busy=true;emit();
      try{const data=await api('/api/xp/state');if(own!==generation)return;accept({userId:user,data,receivedAt:clock(),checkedAt:clock(),version:data.serverNow},true);}
      catch(e){if(own===generation){error=e.message;emit();}}
      finally{if(own===generation){busy=false;emit();}}
    }).finally(()=>{pendingLoad=null;if(own!==generation&&user&&!doc.hidden)void load();});
    return pendingLoad;
  }
  async function mutate(action){
    if(!user||busy||doc.hidden)return;
    const own=generation;
    busy=true;error='';emit();
    try{await serial(async()=>{
      if(own!==generation||doc.hidden)return;
      const requestId=requestIds[action] ||= crypto.randomUUID();
      const data=await api('/api/xp/'+action,{requestId});if(own!==generation)return;
      const cosmetics=record?.data.cosmetics||{skin:'blue',theme:'none',badge:'auto'};
      const level=levelProgress(data.currentXp).level;
      data.cosmetics=action==='delete'?{skin:'blue',theme:'none',badge:'auto',level}:{...cosmetics,level};
      accept({userId:user,data,receivedAt:clock(),checkedAt:clock(),version:data.serverNow},true);delete requestIds[action];
    });}catch(e){if(own===generation)error=e.message;}
    finally{if(own===generation){busy=false;emit();}else{busy=false;if(user&&!doc.hidden)void load();}}
  }
  async function saveCosmetics(input){
    if(!user||busy||doc.hidden||!record)return;
    const own=generation;busy=true;error='';emit();
    try{await serial(async()=>{
      if(own!==generation||doc.hidden)return;
      const cosmetics=await api('/api/account/skin',input);if(own!==generation)return;
      // Preserve the XP anchor; only cosmetics changed in this response.
      accept({...record,data:{...record.data,cosmetics},version:cosmetics.serverNow},true);
    });}catch(e){if(own===generation){error=e.message;throw e;}}
    finally{if(own===generation){busy=false;emit();}else{busy=false;if(user&&!doc.hidden)void load();}}
  }
  function auth(event){
    if(user===event.detail.userId)return;
    user=event.detail.userId;generation++;record=null;busy=false;error='';
    for(const k of Object.keys(requestIds))delete requestIds[k];emit();
    // Supabase auth callbacks must return before calling getSession().
    if(user&&!doc.hidden)setTimeout(()=>void load(),0);
  }
  win.addEventListener('wlng-auth',auth);
  doc.addEventListener('visibilitychange',()=>{if(!doc.hidden&&user&&!record)void load();});
  if(channel)channel.onmessage=event=>{if(user)accept(event.data);};
  if(Object.hasOwn(win,'WLNG_AUTH_USER'))auth({detail:{userId:win.WLNG_AUTH_USER}});
  return {subscribe(fn){listeners.add(fn);fn(view());return()=>listeners.delete(fn);},view,load,mutate,saveCosmetics};
}
export const accountState=typeof window==='undefined'?null:createAccountState();
