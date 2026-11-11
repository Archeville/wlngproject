import { profileCardCss, profileFrames, profileTitles } from './profile-cosmetics.mjs?v=20261111-frames1';
import {barSkins,themeSkins,badgeSkins,skinPaint,badgeStyle,profileAwards,profileIcons} from './cosmetics.mjs?v=20261108-profileedit1';
import {accountState} from './account-state.mjs';
(() => {
 const dialog=document.querySelector('#skins-dialog'),status=document.querySelector('#skin-status'),applyButton=document.querySelector('#skins-apply'),revert=document.querySelector('#skins-revert');
 let user=null,equipped={skin:'blue',theme:'none',badge:'auto',profileColors:false,profileTheme:'none',profileIcon:'none',profileFrame:'classic',profileTitle:'none',profileBadges:[]},draft={...equipped},level=1,busy=false,loaded=false,previewing=false,ownedAwards=[],ownedTitles=[];
 const dirty=()=>draft.skin!==equipped.skin||draft.theme!==equipped.theme||draft.badge!==equipped.badge||draft.profileTheme!==equipped.profileTheme||draft.profileIcon!==equipped.profileIcon||draft.profileFrame!==equipped.profileFrame||draft.profileTitle!==equipped.profileTitle||JSON.stringify(draft.profileBadges)!==JSON.stringify(equipped.profileBadges);
 function paint(){window.WLNG_BADGE_PREVIEW=dialog.open&&previewing?draft.badge:undefined;document.documentElement.style.setProperty('--xp-skin',skinPaint(draft.skin,level));document.documentElement.dataset.skinTheme=draft.theme;for(const badge of document.querySelectorAll('[data-level]'))badge.className='level-badge level-icon badge-'+badgeStyle(draft.badge,level);}
 function group(selector,choices,field){const list=document.querySelector(selector);list.replaceChildren();for(const [id,name,unlock,color] of choices){const button=document.createElement('button');button.type='button';button.className='skin-card';button.disabled=busy||!user||!loaded||level<unlock;button.setAttribute('aria-pressed',String(draft[field]===id));const label=document.createElement('strong');label.textContent=name;const sample=document.createElement('span');sample.className=field==='badge'?'level-icon skin-badge-preview badge-'+(id==='auto'?badgeStyle(id,level):id):'skin-preview';if(field==='badge'){sample.textContent=level;sample.dataset.digits=String(level).length;}else sample.style.setProperty('--preview',color);const note=document.createElement('small');note.textContent=level<unlock?'Unlocks at level '+unlock:draft[field]===id?(equipped[field]===id?'Equipped':'Preview'):'Level '+unlock+' · Preview';button.append(label,sample,note);button.addEventListener('click',()=>{if(draft[field]===id)return;draft={...draft,[field]:id};previewing=true;paint();draw();status.textContent=dirty()?'Preview only. Apply to save.':'';});list.append(button);}}
 const savePanel=document.querySelector('#skins-save-panel');
 const cardPreview=document.querySelector('#profile-card-preview');
 const framePicker=document.querySelector('#profile-frame-picker');
 const titlePicker=document.querySelector('#profile-title-picker');
 const cardStyles=document.createElement('style');
 cardStyles.textContent=profileCardCss+`
   .profile-demo { color:#f5f5f8; padding:18px 12px 25px; max-width:540px; }
   .profile-demo .profile-top { position:relative; isolation:isolate; display:flex; align-items:center; gap:14px; padding:16px; background:#19191e; border:1px solid #53515d; }
   .profile-demo .profile-top::before { content:""; position:absolute; z-index:-1; inset:5px -5px -5px 5px; background:#15151b; border:1px solid #403d4a; transform:rotate(-1deg); }
   .profile-demo .skin-badge-preview { display:grid; place-items:center; flex:0 0 45px; height:45px; }
   .profile-demo strong { overflow-wrap:anywhere; }
   #card-preview-level-text { color:#c5c3ce; font-size:12px; }
   .profile-card-options { display:flex; flex-wrap:wrap; gap:10px; }
   .profile-card-options label { display:grid; gap:5px; min-width:0; flex:1 1 180px; }
   .profile-card-options select { width:100%; min-width:0; }
 `;
 document.head.append(cardStyles);
 function drawProfileCard(){
   const canEquip=title=>level>=title.level&&(!title.commandOnly||ownedTitles.includes(title.id));
   const title=profileTitles.find(option=>option.id===draft.profileTitle);
   const shownTitle=title&&canEquip(title)&&title.id!=='none'?title.name:'';
   const label=document.querySelector('#card-preview-title');
   label.hidden=!shownTitle;
   label.textContent=shownTitle;
   cardPreview.dataset.frame=draft.profileFrame;
   document.querySelector('#card-preview-level-text').textContent='Level '+level;
   const icon=document.querySelector('#card-preview-level');
   icon.textContent=level;
   icon.dataset.digits=String(level).length;
   icon.className='skin-badge-preview level-icon badge-'+badgeStyle(draft.badge,level);
   framePicker.replaceChildren(...profileFrames.map(([id,name])=>new Option(name,id)));
   framePicker.value=draft.profileFrame;
   titlePicker.replaceChildren(...profileTitles.map(option=>{
     const requirement=option.commandOnly?(canEquip(option)?'':' · Admin grant'):option.level>1?' · Level '+option.level:'';
     const entry=new Option(option.name+requirement,option.id);
     entry.disabled=!canEquip(option);
     return entry;
   }));
   titlePicker.value=title&&canEquip(title)?title.id:'none';
   framePicker.disabled=titlePicker.disabled=busy||!user||!loaded;
 }
 for(const [picker,field] of [[framePicker,'profileFrame'],[titlePicker,'profileTitle']]){
   picker.addEventListener('change',()=>{
     draft={...draft,[field]:picker.value};
     previewing=true;
     draw();
   });
 }
 function placeSavePanel(){const rect=dialog.getBoundingClientRect(),aside=rect.right+220<innerWidth;savePanel.style.left=aside?(rect.right+16)+'px':'auto';savePanel.style.right=aside?'auto':'16px';savePanel.style.top=aside?(Math.max(16,rect.top+60))+'px':'auto';savePanel.style.bottom=aside?'auto':'16px';}
 function syncSavePanel(){const show=dialog.open&&dirty();dialog.classList.toggle('has-preview',show);if(show&&!savePanel.matches(':popover-open'))savePanel.showPopover();else if(!show&&savePanel.matches(':popover-open'))savePanel.hidePopover();if(show)placeSavePanel();}
 window.addEventListener('resize',placeSavePanel);
 const customizeTabs=[...document.querySelectorAll('[data-customize]')];
 function selectSection(button){for(const tab of customizeTabs){const active=tab===button;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;tab.classList.toggle('selected',active);document.querySelector('#customize-'+tab.dataset.customize).hidden=!active;}}
 customizeTabs.forEach((button,index)=>{
   button.addEventListener('click',()=>selectSection(button));
   button.addEventListener('keydown',event=>{let next;if(event.key==='ArrowRight')next=(index+1)%customizeTabs.length;else if(event.key==='ArrowLeft')next=(index+customizeTabs.length-1)%customizeTabs.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=customizeTabs.length-1;else return;event.preventDefault();selectSection(customizeTabs[next]);customizeTabs[next].focus();});
 });
 function drawIcons(){const list=document.querySelector('#profile-icon-options');list.replaceChildren();for(const [id,name]of profileIcons){const button=document.createElement('button');button.type='button';button.className='skin-card';button.disabled=busy||!user||!loaded;button.setAttribute('aria-pressed',String(draft.profileIcon===id));button.textContent=name;if(id!=='none'){const img=document.createElement('img');img.src='/assets/profile-icons/'+id+'.png?v=20261111-badges2';img.alt='';button.append(img);}button.addEventListener('click',()=>{draft={...draft,profileIcon:id};previewing=true;draw();});list.append(button);}}
 function drawAwards(){const list=document.querySelector('#profile-award-options');list.replaceChildren();for(const [id,name]of profileAwards){if(!ownedAwards.includes(id))continue;const button=document.createElement('button');button.type='button';button.className='skin-card';const selected=draft.profileBadges.includes(id);button.disabled=busy||!loaded||(!selected&&draft.profileBadges.length>=10);button.setAttribute('aria-pressed',String(selected));const img=document.createElement('img');img.src='/assets/profile-badges/'+id+'.png?v=20261111-badges2';img.alt=name;const label=document.createElement('strong');label.textContent=name;const note=document.createElement('small');note.textContent=selected?'Selected':'Show on profile';button.append(img,label,note);button.addEventListener('click',()=>{draft={...draft,profileBadges:selected?draft.profileBadges.filter(x=>x!==id):[...draft.profileBadges,id]};previewing=true;draw();});list.append(button);}if(!list.children.length)list.textContent='No profile badges owned yet.';}
 function draw(){drawProfileCard();drawAwards();group('#profile-theme-options',themeSkins,'profileTheme');group('#profile-level-options',badgeSkins,'badge');drawIcons();syncSavePanel();group('#skin-options',barSkins,'skin');group('#theme-skin-options',themeSkins,'theme');group('#badge-skin-options',badgeSkins,'badge');applyButton.disabled=!user||!loaded||busy||!dirty();revert.disabled=!dirty()||busy;}
 function reset(){draft={...equipped};previewing=false;paint();draw();}
 applyButton.addEventListener('click',async()=>{if(applyButton.disabled)return;const input={};for(const field of ['skin','theme','badge','profileTheme','profileIcon','profileBadges','profileFrame','profileTitle'])if(JSON.stringify(draft[field])!==JSON.stringify(equipped[field]))input[field]=draft[field];const ownUser=user;try{await accountState.saveCosmetics(input);if(user===ownUser){reset();status.textContent=accountState.view().error||'Appearance saved.';}}catch(e){if(user===ownUser)status.textContent=e.message;}});
 revert.addEventListener('click',()=>{reset();status.textContent='Preview reverted.';});
 dialog.addEventListener('close',()=>{reset();status.textContent='';});
 document.querySelector('#skins-open').addEventListener('click',()=>{reset();if(user&&!loaded)void accountState.load();else if(!user)status.textContent='Sign in to equip skins.';});
 accountState.subscribe(view=>{
   const changedUser=user!==view.userId;user=view.userId;busy=view.busy;loaded=Boolean(view.record);
   if(changedUser){ownedAwards=[];ownedTitles=[];previewing=false;equipped={skin:'blue',theme:'none',badge:'auto',profileColors:false,profileTheme:'none',profileIcon:'none',profileFrame:'classic',profileTitle:'none',profileBadges:[]};level=1;}
   const username=view.record?.data.profile?.username;
   document.querySelector('#card-preview-name').textContent=username?'@'+username:'@preview';
   const cosmetics=view.record?.data.cosmetics;
   if(cosmetics){ownedAwards=cosmetics.ownedAwards||[];ownedTitles=cosmetics.ownedTitles||[];equipped={skin:cosmetics.skin,theme:cosmetics.theme,badge:cosmetics.badge||'auto',profileColors:cosmetics.profileColors===true,profileTheme:cosmetics.profileTheme||'none',profileIcon:cosmetics.profileIcon||'none',profileFrame:cosmetics.profileFrame||'classic',profileTitle:cosmetics.profileTitle||'none',profileBadges:cosmetics.profileBadges||[]};level=Math.max(cosmetics.level,window.WLNG_LEVEL||1);}
   if(!previewing||changedUser)draft={...equipped};
   if(view.error)status.textContent=view.error;else if(!user)status.textContent='Sign in to equip skins.';
   paint();draw();
 });
 window.addEventListener('wlng-level',event=>{level=event.detail.level;for(const [field,choices,fallback] of [['skin',barSkins,'blue'],['theme',themeSkins,'none'],['profileTheme',themeSkins,'none'],['badge',badgeSkins,'auto']]){if(!choices.some(x=>x[0]===draft[field]&&level>=x[2]))draft[field]=fallback;}paint();draw();});
 paint();draw();
})();
