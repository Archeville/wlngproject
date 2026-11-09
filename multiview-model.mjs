export const GRID={columns:32,rows:24,cell:64,maxStreams:12};
const number=(v,min,max,fallback)=>Number.isFinite(v)?Math.max(min,Math.min(max,Math.round(v))):fallback;
const text=(v,max)=>typeof v==='string'?v.slice(0,max):'';
export function geometry(value={},chat=false){if(!value||typeof value!=='object')value={};const w=number(value.w,4,32,chat?5:8),h=number(value.h,chat?6:4,24,6);return {x:number(value.x,0,32-w,0),y:number(value.y,0,24-h,0),w,h};}
export function normalizeLayout(value={}){
 if(!value||typeof value!=='object')value={};
 const seen=new Set(),tiles=[];
 for(const item of (Array.isArray(value.tiles)?value.tiles:[]).slice(0,12)){
  if(!item||typeof item.channelId!=='string'||!/^[-\w]{1,128}$/.test(item.channelId)||seen.has(item.channelId))continue;
  seen.add(item.channelId);tiles.push({channelId:item.channelId,name:text(item.name,128)||item.channelId,...geometry(item),chat:item.chat&&typeof item.chat==='object'?geometry(item.chat,true):null});
 }
 return {zoom:number(value.zoom,25,150,75),tiles};
}
export function liveForChannel(streams,id,now=Date.now()){
 return streams.find(s=>s.channel?.id===id&&s.status==='live'&&/^[\w-]{11}$/.test(s.id||'')&&(s.start_actual||!Number.isFinite(Date.parse(s.start_scheduled))||Date.parse(s.start_scheduled)<=now))||null;
}
export function normalizeSaves(value){return (Array.isArray(value)?value:[]).slice(0,10).filter(v=>v&&typeof v.id==='string'&&/^[\w-]{1,64}$/.test(v.id)).map(v=>({id:v.id,name:text(v.name,40)||'Untitled layout',layout:normalizeLayout(v.layout)}));}
