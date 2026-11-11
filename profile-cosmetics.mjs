export const profileFrames = [
  ['classic', 'Classic'],
  ['rounded', 'Rounded'],
  ['triple', 'Triple layer'],
  ['reversed', 'Reversed'],
  ['pixel', 'Pixel border'],
  ['glass', 'Tinted glass'],
  ['ticket', 'Arcade ticket']
];

export const profileTitles = [
  { id: 'none', name: 'No title', level: 1 },
  { id: 'someone', name: 'someone', level: 1, commandOnly: true },
  { id: 'grind', name: 'i grind levels', level: 16 },
  { id: 'harder', name: 'i grind levels, but harder', level: 17 },
  { id: 'website', name: 'i use this website', level: 5 },
  { id: 'sleep', name: 'sleep is optional', level: 10 },
  { id: 'xp', name: 'i love xp and im only here for it', level: 25 }
];

export function profileAppearance(row, level) {
  const ownedTitles = JSON.parse(row?.owned_titles || '[]')
    .filter(id => profileTitles.some(title => title.id === id && title.commandOnly));
  const title = profileTitles.find(title => title.id === row?.profile_title);
  return {
    profileFrame: profileFrames.some(([id]) => id === row?.profile_frame) ? row.profile_frame : 'classic',
    profileTitle: title && level >= title.level && (!title.commandOnly || ownedTitles.includes(title.id))
      ? title.id : 'none',
    ownedTitles
  };
}

export const profileCardCss = `
.profile-card-frame { position:relative; isolation:isolate; }
.profile-card-frame .profile-top { z-index:0; }
.profile-card-content { display:flex; align-items:center; gap:inherit; width:100%; min-width:0; }
.profile-card-content > div { min-width:0; }
.profile-title { margin:4px 0 0; color:var(--profile-accent,#d0c3ff); font-size:14px; font-weight:700; line-height:1.4; overflow-wrap:anywhere; }
.profile-card-frame[data-frame="reversed"] .profile-card-content { transform:scaleX(-1); }
.profile-card-frame:is([data-frame="rounded"],[data-frame="triple"],[data-frame="pixel"],[data-frame="glass"],[data-frame="ticket"]) .profile-top::before { display:none; }
.profile-card-frame[data-frame="rounded"]::before,
.profile-card-frame[data-frame="triple"]::before,
.profile-card-frame[data-frame="triple"]::after { content:""; position:absolute; z-index:-1; inset:0; pointer-events:none; }
.profile-card-frame[data-frame="rounded"]::before { transform:translate(5px,6px) rotate(-1deg); border:1px solid var(--profile-border,#645679); border-radius:26px; background:var(--profile-back,#211b2b); }
.profile-card-frame[data-frame="rounded"] .profile-top { border-radius:26px; background:linear-gradient(140deg,var(--profile-back,#2d263d),var(--profile-front,#1b1a23)); border-color:var(--profile-border,#807099); box-shadow:inset 0 0 0 4px var(--profile-back,#282333); }
.profile-card-frame[data-frame="triple"] { margin-inline:8px; }
.profile-card-frame[data-frame="triple"] .profile-top { transform:rotate(-1deg); border-color:var(--profile-border,#a08ac5); }
.profile-card-frame[data-frame="triple"]::before { transform:translate(3px,4px) rotate(-2deg); border:1px solid var(--profile-border,#8b70c1); background:var(--profile-back,#231e2d); }
.profile-card-frame[data-frame="triple"]::after { z-index:-2; transform:translate(6px,8px) rotate(-3deg); border:1px solid var(--profile-border,#644c91); background:color-mix(in srgb,var(--profile-back,#1b1725) 65%,var(--profile-bg,#1b1725)); }
.profile-card-frame[data-frame="pixel"] .profile-top { border:0; background:var(--profile-front,#30274c); clip-path:polygon(0 10px,10px 10px,10px 0,calc(100% - 10px) 0,calc(100% - 10px) 10px,100% 10px,100% calc(100% - 10px),calc(100% - 10px) calc(100% - 10px),calc(100% - 10px) 100%,10px 100%,10px calc(100% - 10px),0 calc(100% - 10px)); box-shadow:inset 0 0 0 5px var(--profile-border,#8973c1),inset 0 0 0 9px var(--profile-back,#242036); }
.profile-card-frame[data-frame="glass"] .profile-top { border-radius:10px; border-color:var(--profile-border,#71668e); background:linear-gradient(125deg,color-mix(in srgb,var(--profile-accent,#8078aa) 23%,transparent),var(--profile-front,#352f5066) 45%,color-mix(in srgb,var(--profile-accent,#ae8dda) 16%,transparent)); box-shadow:inset 0 1px 0 #d6ceff42,0 12px 30px #0005; }
.profile-card-frame[data-frame="ticket"] .profile-top { border-style:dashed; border-color:var(--profile-border,#9b825a); border-radius:8px; background:var(--profile-front,#282219); }
.profile-card-frame[data-frame="ticket"] .profile-card-content > div { border-left:1px dashed var(--profile-border,#9b825a); padding-left:14px; }
@media(max-width:600px) {
  .profile-card-frame[data-frame="triple"] { margin-inline:9px; }
  .profile-card-frame[data-frame="triple"]::after { transform:translate(4px,7px) rotate(-3deg); }
}
`;
