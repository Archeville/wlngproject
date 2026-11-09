export const GRID={columns:48,rows:36,cell:48,border:16,maxStreams:12};
const number=(v,min,max,fallback)=>Number.isFinite(v)?Math.max(min,Math.min(max,Math.round(v))):fallback;
const text=(v,max)=>typeof v==='string'?v.slice(0,max):'';
export function geometry(value={},chat=false){if(!value||typeof value!=='object')value={};const w=number(value.w,5,GRID.columns,chat?7:11),h=number(value.h,6,GRID.rows,8);return {x:number(value.x,0,GRID.columns-w,0),y:number(value.y,0,GRID.rows-h,0),w,h};}
export function normalizeLayout(value={}){
 if(!value||typeof value!=='object')value={};
 const seen=new Set(),tiles=[];
 for(const item of (Array.isArray(value.tiles)?value.tiles:[]).slice(0,12)){
  if(!item||typeof item.channelId!=='string'||!/^[-\w]{1,128}$/.test(item.channelId)||seen.has(item.channelId))continue;
  const convert=g=>value.version===2?g:Object.fromEntries(['x','y','w','h'].map(k=>[k,Number.isFinite(g?.[k])?g[k]*64/48:g?.[k]]));
  seen.add(item.channelId);tiles.push({channelId:item.channelId,name:text(item.name,128)||item.channelId,...geometry(convert(item)),chat:item.chat&&typeof item.chat==='object'?geometry(convert(item.chat),true):null});
 }
 return {version:2,zoom:number(value.zoom,10,150,75),view:{x:number(value.view?.x,-10000,10000,24),y:number(value.view?.y,-10000,10000,24)},tiles};
}
export function liveForChannel(streams,id,now=Date.now()){
 return streams.find(s=>s.channel?.id===id&&s.status==='live'&&/^[\w-]{11}$/.test(s.id||'')&&(s.start_actual||!Number.isFinite(Date.parse(s.start_scheduled))||Date.parse(s.start_scheduled)<=now))||null;
}
export function normalizeSaves(value){return (Array.isArray(value)?value:[]).slice(0,10).filter(v=>v&&typeof v.id==='string'&&/^[\w-]{1,64}$/.test(v.id)).map(v=>({id:v.id,name:text(v.name,40)||'Untitled layout',layout:normalizeLayout(v.layout)}));}

export function clampCamera(view,width,height,zoom){const scale=zoom/100,w=(GRID.columns*GRID.cell+GRID.border*2)*scale,h=(GRID.rows*GRID.cell+GRID.border*2)*scale;const clamp=(v,a,b)=>Math.max(Math.min(a,b),Math.min(Math.max(a,b),Number.isFinite(v)?v:24));return{x:clamp(view.x,24,width-w-24),y:clamp(view.y,24,height-h-24)};}
