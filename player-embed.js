const params=new URL(location.href).searchParams;
const id=params.get('video');
const root=document.querySelector('#embed-root');
if(!/^[A-Za-z0-9_-]{11}$/.test(id||'')){root.textContent='Video unavailable.';}else{
 const frame=document.createElement('iframe'),url=new URL('https://www.youtube.com/embed/'+id);
 url.searchParams.set('playsinline','1');url.searchParams.set('origin',location.origin);
 if(params.get('audio')==='1'){
  url.searchParams.set('enablejsapi','1');
  enableAudioFocus(frame);
 }
 frame.src=url.href;frame.title='YouTube video player';frame.allow='autoplay; encrypted-media; picture-in-picture; web-share';frame.allowFullscreen=true;frame.referrerPolicy='strict-origin-when-cross-origin';root.append(frame);
}

function enableAudioFocus(frame) {
 let player, loading=false, ready=false, originalMute;
 let desired='restore';
 function apply() {
  if (!ready) return;
  if (desired==='restore') {
   if (originalMute===undefined) return;
   if (originalMute) player.mute(); else player.unMute();
   originalMute=undefined;
   return;
  }
  if (originalMute===undefined) originalMute=player.isMuted();
  if (desired==='mute') player.mute(); else player.unMute();
 }
 function unavailable() {
  loading=false;
  window.parent.postMessage({type:'wlng-audio-unavailable'},location.origin);
 }
 function connect() {
  if (loading) return;
  loading=true;
  window.onYouTubeIframeAPIReady=()=>{
   try {
    player=new window.YT.Player(frame,{events:{
     onReady(event){player=event.target;ready=true;apply();},
     onStateChange(event){if(ready&&event.data===1&&desired==='mute')player.mute();}
    }});
   } catch { unavailable(); }
  };
  const script=document.createElement('script');
  script.src='https://www.youtube.com/iframe_api';
  script.addEventListener('error',()=>{script.remove();unavailable();},{once:true});
  document.head.append(script);
 }
 window.addEventListener('message',event=>{
  if(event.source!==window.parent||event.origin!==location.origin||event.data?.type!=='wlng-audio-focus')return;
  if(!['mute','focus','restore'].includes(event.data.mode))return;
  desired=event.data.mode;
  if(ready)apply();
  else if(desired!=='restore')connect();
 });
}
