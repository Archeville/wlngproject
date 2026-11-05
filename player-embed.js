const id=new URL(location.href).searchParams.get('video');
const root=document.querySelector('#embed-root');
if(!/^[A-Za-z0-9_-]{11}$/.test(id||'')){root.textContent='Video unavailable.';}else{
 const frame=document.createElement('iframe'),url=new URL('https://www.youtube.com/embed/'+id);
 url.searchParams.set('playsinline','1');url.searchParams.set('origin',location.origin);
 frame.src=url.href;frame.title='YouTube video player';frame.allow='autoplay; encrypted-media; picture-in-picture; web-share';frame.allowFullscreen=true;frame.referrerPolicy='strict-origin-when-cross-origin';root.append(frame);
}
