import { skinPaint, badgeStyle, profileThemeCss, profileAwards, awardCss } from './cosmetics.mjs?v=20261107-awards2';
const view=document.querySelector('main');
const match=/^\/user\/([a-z0-9_]{3,24})\/?$/i.exec(location.pathname);
if(match){
  view.replaceChildren(Object.assign(document.createElement('p'),{textContent:'Loading profile…'}));
  (async()=>{
    try{
      const response=await fetch('https://wlng-api.wlng.workers.dev/api/profiles/'+encodeURIComponent(match[1].toLowerCase()),{signal:AbortSignal.timeout(12000)});
      const data=await response.json();if(!response.ok)throw new Error(data.error||'Profile unavailable.');
      const p=data.profile;
      if(!p||!/^[a-z0-9_]{3,24}$/.test(p.username)||!Number.isInteger(p.level)||p.level<1||!Number.isFinite(p.xp)||!Number.isFinite(p.required)||p.required<=0||typeof p.description!=='string')throw new Error('Profile unavailable.');
      const canonical='/user/'+p.username;if(location.pathname!==canonical){location.replace(canonical);return;}
      document.title='@'+p.username+' — WLNG';const colors=document.createElement('style');colors.textContent=awardCss+profileThemeCss(p.theme);document.head.append(colors);
      view.style.setProperty('--skin',skinPaint(p.skin,p.level));
      const top=document.createElement('div');top.className='profile-top';
      const badge=document.createElement('span');badge.className='badge level-icon badge-'+badgeStyle(p.badge,p.level);badge.textContent=p.level;badge.dataset.digits=String(p.level).length;
      const title=document.createElement('div'),name=document.createElement('h1'),level=document.createElement('small');name.textContent='@'+p.username;level.textContent='Level '+p.level;title.append(name,level);top.append(badge,title);
      const bar=document.createElement('div');bar.className='progress';bar.setAttribute('role','progressbar');bar.setAttribute('aria-label','XP for this level');bar.setAttribute('aria-valuenow',p.xp);bar.setAttribute('aria-valuemax',p.required);bar.setAttribute('aria-valuemin','0');
      const fill=document.createElement('div');fill.className='fill';fill.style.width=Math.max(0,Math.min(100,p.xp/p.required*100))+'%';const label=document.createElement('span');label.className='progress-label';label.textContent=p.xp.toFixed(1)+' / '+p.required+' XP';bar.append(fill,label);
      const awards=document.createElement('section');awards.className='profile-awards';awards.setAttribute('aria-label','Profile badges');for(const id of (Array.isArray(p.profileBadges)?p.profileBadges:[]).slice(0,10)){const entry=profileAwards.find(x=>x[0]===id);if(!entry)continue;const img=document.createElement('img');img.className='profile-award';img.src='/assets/profile-badges/'+id+'.png';img.alt='';const item=document.createElement('button');item.type='button';item.className='profile-award-item';item.setAttribute('aria-label',entry[1]);item.setAttribute('aria-describedby','award-tip-'+id);const tip=document.createElement('span');tip.className='award-tooltip';tip.id='award-tip-'+id;tip.setAttribute('role','tooltip');tip.textContent=entry[2];item.append(img,tip);awards.append(item);}view.replaceChildren(awards,top,bar);if(p.description){const bio=document.createElement('p');bio.className='description';bio.textContent=p.description;view.append(bio);}
      
    }catch(error){view.replaceChildren(Object.assign(document.createElement('h1'),{textContent:'Profile unavailable'}),Object.assign(document.createElement('p'),{textContent:error.message}));}
  })();
}
