import {barSkins,themeSkins,badgeSkins,skinPaint,badgeStyle} from './cosmetics.mjs?v=20261105-account1';
import {accountState} from './account-state.mjs';
(() => {
 const dialog=document.querySelector('#skins-dialog'),status=document.querySelector('#skin-status'),applyButton=document.querySelector('#skins-apply'),revert=document.querySelector('#skins-revert');
 let user=null,equipped={skin:'blue',theme:'none',badge:'auto',profileColors:false},draft={...equipped},level=1,busy=false,loaded=false,previewing=false;
 const dirty=()=>draft.skin!==equipped.skin||draft.theme!==equipped.theme||draft.badge!==equipped.badge||draft.profileColors!==equipped.profileColors;
 function paint(){window.WLNG_BADGE_PREVIEW=dialog.open&&previewing?draft.badge:undefined;document.documentElement.style.setProperty('--xp-skin',skinPaint(draft.skin,level));document.documentElement.dataset.skinTheme=draft.theme;for(const badge of document.querySelectorAll('[data-level]'))badge.className='level-badge level-icon badge-'+badgeStyle(draft.badge,level);}
 function group(selector,choices,field){const list=document.querySelector(selector);list.replaceChildren();for(const [id,name,unlock,color] of choices){const button=document.createElement('button');button.type='button';button.className='skin-card';button.disabled=busy||!user||!loaded||level<unlock;button.setAttribute('aria-pressed',String(draft[field]===id));const label=document.createElement('strong');label.textContent=name;const sample=document.createElement('span');sample.className=field==='badge'?'level-icon skin-badge-preview badge-'+(id==='auto'?badgeStyle(id,level):id):'skin-preview';if(field==='badge')sample.textContent=level;else sample.style.setProperty('--preview',color);const note=document.createElement('small');note.textContent=level<unlock?'Unlocks at level '+unlock:draft[field]===id?(equipped[field]===id?'Equipped':'Preview'):'Level '+unlock+' · Preview';button.append(label,sample,note);button.addEventListener('click',()=>{if(draft[field]===id)return;draft={...draft,[field]:id};previewing=true;paint();draw();status.textContent=dirty()?'Preview only. Apply to save.':'';});list.append(button);}}
 const colorToggle=document.querySelector('#profile-colors'),savePanel=document.querySelector('#skins-save-panel');
 function placeSavePanel(){const rect=dialog.getBoundingClientRect(),aside=rect.right+220<innerWidth;savePanel.style.left=aside?(rect.right+16)+'px':'auto';savePanel.style.right=aside?'auto':'16px';savePanel.style.top=aside?(Math.max(16,rect.top+60))+'px':'auto';savePanel.style.bottom=aside?'auto':'16px';}
 function syncSavePanel(){const show=dialog.open&&dirty();if(show&&!savePanel.matches(':popover-open'))savePanel.showPopover();else if(!show&&savePanel.matches(':popover-open'))savePanel.hidePopover();if(show)placeSavePanel();}
 colorToggle.addEventListener('click',()=>{draft={...draft,profileColors:!draft.profileColors};previewing=true;draw();});
 window.addEventListener('resize',placeSavePanel);
 function draw(){colorToggle.disabled=!user||!loaded||busy;colorToggle.setAttribute('aria-pressed',String(draft.profileColors));colorToggle.textContent=draft.profileColors?'Apply colors to profile: On':'Apply colors to profile: Off';syncSavePanel();group('#skin-options',barSkins,'skin');group('#theme-skin-options',themeSkins,'theme');group('#badge-skin-options',badgeSkins,'badge');applyButton.disabled=!user||!loaded||busy||!dirty();revert.disabled=!dirty()||busy;}
 function reset(){draft={...equipped};previewing=false;paint();draw();}
 applyButton.addEventListener('click',async()=>{if(applyButton.disabled)return;const input={};for(const field of ['skin','theme','badge','profileColors'])if(draft[field]!==equipped[field])input[field]=draft[field];const ownUser=user;try{await accountState.saveCosmetics(input);if(user===ownUser){reset();status.textContent=accountState.view().error||'Appearance saved.';}}catch(e){if(user===ownUser)status.textContent=e.message;}});
 revert.addEventListener('click',()=>{reset();status.textContent='Preview reverted.';});
 dialog.addEventListener('close',()=>{reset();status.textContent='';});
 document.querySelector('#skins-open').addEventListener('click',()=>{reset();if(user&&!loaded)void accountState.load();else if(!user)status.textContent='Sign in to equip skins.';});
 accountState.subscribe(view=>{
   const changedUser=user!==view.userId;user=view.userId;busy=view.busy;loaded=Boolean(view.record);
   if(changedUser){previewing=false;equipped={skin:'blue',theme:'none',badge:'auto',profileColors:false};level=1;}
   const cosmetics=view.record?.data.cosmetics;
   if(cosmetics){equipped={skin:cosmetics.skin,theme:cosmetics.theme,badge:cosmetics.badge||'auto',profileColors:cosmetics.profileColors===true};level=Math.max(cosmetics.level,window.WLNG_LEVEL||1);}
   if(!previewing||changedUser)draft={...equipped};
   if(view.error)status.textContent=view.error;else if(!user)status.textContent='Sign in to equip skins.';
   paint();draw();
 });
 window.addEventListener('wlng-level',event=>{level=event.detail.level;for(const [field,choices,fallback] of [['skin',barSkins,'blue'],['theme',themeSkins,'none'],['badge',badgeSkins,'auto']]){if(!choices.some(x=>x[0]===draft[field]&&level>=x[2]))draft[field]=fallback;}paint();draw();});
 paint();draw();
})();
