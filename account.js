(() => {
  const $=selector=>document.querySelector(selector),form=$('#profile-form');
  let userId=null,profile=null,busy=false,generation=0,loaded=false,clockOffset=0,cooldownTimer;
  const now=()=>Date.now()+clockOffset;
  const status=text=>{$('#profile-status').textContent=text;};
  const date=value=>new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
  function display() {
    clearTimeout(cooldownTimer);
    $('#account-signin-note').hidden=Boolean(userId);
    const ready=Boolean(userId&&loaded&&!busy);
    $('#profile-username').disabled=!ready||Boolean(profile&&now()<profile.usernameChangeAt);
    $('#profile-description').disabled=!ready||Boolean(profile&&now()<profile.descriptionChangeAt);
    $('#profile-visible').disabled=!ready;$('#profile-save').disabled=!ready;
    $('#username-rule').textContent=profile&&now()<profile.usernameChangeAt?'Next username change: '+date(profile.usernameChangeAt):'3–24 letters, numbers or underscores. Change once a week.';
    $('#description-rule').textContent=profile&&now()<profile.descriptionChangeAt?'Next description edit: '+date(profile.descriptionChangeAt):'Optional. Up to 300 characters. Edit every five minutes.';
    const link=$('#my-profile-link'),copy=$('#profile-copy');link.hidden=copy.hidden=!profile?.visible;
    if(profile)link.href='https://wlng.lol/user/'+encodeURIComponent(profile.username);
    const next=[profile?.usernameChangeAt,profile?.descriptionChangeAt].filter(x=>x>now());
    if(next.length)cooldownTimer=setTimeout(display,Math.min(...next)-now()+100);
  }
  function fill() {$('#profile-username').value=profile?.username||'';$('#profile-description').value=profile?.description||'';$('#profile-visible').checked=profile?.visible??true;}
  async function request(method,body) {
    const own=generation;
    const token=await window.WLNG_AUTH?.getAccessToken();if(own!==generation||document.hidden)throw new Error('Return to your account and try again.');if(!token)throw new Error('Please sign in with Google.');
    const response=await fetch(new URL('/api/account/profile',window.WLNG_CONFIG.apiBase),{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
    const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not update your account.');return data;
  }
  async function load() {
    if(!userId||busy||document.hidden||!$('#settings-dialog').open)return;const ownGeneration=generation;busy=true;display();status('Loading account…');
    try {const data=await request('GET');if(ownGeneration!==generation)return;profile=data.profile;loaded=true;clockOffset=data.serverNow-Date.now();fill();status('');}
    catch(e){if(ownGeneration===generation)status(e.message);}
    finally{busy=false;display();if(ownGeneration!==generation&&userId&&$('#settings-dialog').open)void load();}
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy||!userId||!loaded)return;
    if(!form.reportValidity())return;
    const ownGeneration=generation;busy=true;display();status('Saving profile…');
    try {const data=await request('POST',{username:$('#profile-username').value,description:$('#profile-description').value,visible:$('#profile-visible').checked});if(ownGeneration!==generation)return;profile=data.profile;clockOffset=data.serverNow-Date.now();fill();status(profile.visible?'Profile saved. Your link is ready.':'Profile saved and hidden from public visitors.');}
    catch(e){if(ownGeneration===generation)status(e.message);}
    finally{busy=false;display();if(ownGeneration!==generation&&userId&&$('#settings-dialog').open)void load();}
  });
  $('#profile-copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('#my-profile-link').href);status('Profile link copied.');}catch{status('Open My profile to copy the address.');}});
  $('#settings-dialog').addEventListener('close',display);
  window.addEventListener('wlng-settings-open',()=>{if(!loaded)void load();else display();});
  function authChanged(event){if(userId===event.detail.userId)return;userId=event.detail.userId;generation++;profile=null;loaded=false;fill();display();status('');if(userId&&$('#settings-dialog').open)setTimeout(()=>void load(),0);}
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&$('#settings-dialog').open&&!loaded)void load();});
  window.addEventListener('wlng-auth',authChanged);
  if(Object.hasOwn(window,'WLNG_AUTH_USER'))authChanged({detail:{userId:window.WLNG_AUTH_USER}});
  display();
})();
