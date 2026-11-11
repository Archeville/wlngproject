import { renderProfileGrid, profileGridCss } from './profile-layout.mjs?v=20261112-canvas1';
import { profileCardCss, profileFrames, profileTitles } from './profile-cosmetics.mjs?v=20261112-layout1';
import { skinPaint, badgeStyle, profileThemeCss, profileAwards, awardCss, profileIcons, profileIconCss, profileResponsiveCss } from './cosmetics.mjs?v=20261112-layout1';
const view=document.querySelector('main');
const match=/^\/user\/([a-z0-9_]{3,24})\/?$/i.exec(location.pathname);
if(match){
  view.replaceChildren(Object.assign(document.createElement('p'),{textContent:'Loading profile…'}));
  (async()=>{
    try{
      const response=await fetch('https://wlng.lol/api/profiles/'+encodeURIComponent(match[1].toLowerCase()),{signal:AbortSignal.timeout(12000)});
      const data=await response.json();if(!response.ok)throw new Error(data.error||'Profile unavailable.');
      const p=data.profile;
      if(!p||!/^[a-z0-9_]{3,24}$/.test(p.username)||!Number.isInteger(p.level)||p.level<1||!Number.isFinite(p.xp)||!Number.isFinite(p.required)||p.required<=0||typeof p.description!=='string')throw new Error('Profile unavailable.');
      const canonical='/user/'+p.username;if(location.pathname!==canonical){location.replace(canonical);return;}
      document.title='@'+p.username+' — WLNG';const colors=document.createElement('style');colors.textContent=profileIconCss+awardCss+profileThemeCss(p.theme)+profileResponsiveCss+profileGridCss+profileCardCss;document.head.append(colors);
      const grid=renderProfileGrid(p,p.profileLayout);
      if(grid){view.innerHTML=grid;return;}
      if(p.profileIcon!=='none'&&profileIcons.some(x=>x[0]===p.profileIcon)){const icon=document.createElement('div');icon.className='profile-side-icon icon-'+p.profileIcon;icon.setAttribute('aria-hidden','true');document.body.prepend(icon);}
      view.style.setProperty('--skin',skinPaint(p.skin,p.level));
      const frame=document.createElement('div');frame.className='profile-card-frame';frame.dataset.frame=profileFrames.find(([id])=>id===p.profileFrame)?.[0]||'classic';
      const top=document.createElement('div');top.className='profile-top';
      const content=document.createElement('div');content.className='profile-card-content';frame.append(top);top.append(content);
      const badge=document.createElement('span');badge.className='badge level-icon badge-'+badgeStyle(p.badge,p.level);badge.textContent=p.level;badge.dataset.digits=String(p.level).length;
      const title=document.createElement('div'),name=document.createElement('h1'),level=document.createElement('small');name.textContent='@'+p.username;level.textContent='Level '+p.level;title.append(name,level);content.append(badge,title);
      const selectedTitle=profileTitles.find(option=>option.id===p.profileTitle&&option.id!=='none');
      if(selectedTitle){const label=document.createElement('p');label.className='profile-title';label.textContent=selectedTitle.name;title.append(label);}
      const bar=document.createElement('div');bar.className='progress';bar.setAttribute('role','progressbar');bar.setAttribute('aria-label','XP for this level');bar.setAttribute('aria-valuenow',p.xp);bar.setAttribute('aria-valuemax',p.required);bar.setAttribute('aria-valuemin','0');
      const fill=document.createElement('div');fill.className='fill';fill.style.width=Math.max(0,Math.min(100,p.xp/p.required*100))+'%';const label=document.createElement('span');label.className='progress-label';label.textContent=p.xp.toFixed(1)+' / '+p.required+' XP';bar.append(fill,label);
      const awards=document.createElement('section');awards.className='profile-awards';awards.setAttribute('aria-label','Profile badges');for(const id of (Array.isArray(p.profileBadges)?p.profileBadges:[]).slice(0,10)){const entry=profileAwards.find(x=>x[0]===id);if(!entry)continue;const img=document.createElement('img');img.className='profile-award';img.src='/assets/profile-badges/'+id+'.png?v=20261111-badges2';img.alt='';const item=document.createElement('button');item.type='button';item.className='profile-award-item';item.setAttribute('aria-label',entry[1]);item.setAttribute('aria-describedby','award-tip-'+id);const tip=document.createElement('span');tip.className='award-tooltip';tip.id='award-tip-'+id;tip.setAttribute('role','tooltip');tip.textContent=entry[2];item.append(img,tip);awards.append(item);}view.replaceChildren(awards,frame,bar);if(p.description){const bio=document.createElement('p');bio.className='description';bio.textContent=p.description;view.append(bio);}
      
    }catch(error){view.replaceChildren(Object.assign(document.createElement('h1'),{textContent:'Profile unavailable'}),Object.assign(document.createElement('p'),{textContent:error.message}));}
  })();
}
