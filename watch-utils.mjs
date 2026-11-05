export function relatedLives(streams,current,now=Date.now()) {
 const org=current?.channel?.org;
 if(!['Hololive','Nijisanji','Independents'].includes(org))return [];
 return streams.filter(x=>x.id!==current.id&&/^[A-Za-z0-9_-]{11}$/.test(x.id||'')&&x.channel?.org===org&&x.status==='live'&&!( !x.start_actual&&Number.isFinite(Date.parse(x.start_scheduled))&&Date.parse(x.start_scheduled)>now)).sort((a,b)=>(b.live_viewers||0)-(a.live_viewers||0)).slice(0,6);
}

export function isOperaBrowser(userAgent='',brands=[],hasOperaMarker=false){return hasOperaMarker||/\b(?:OPR|Opera|OPiOS|OPGX)\//i.test(userAgent)||brands.some(item=>/^Opera(?: GX)?$/i.test(item.brand||''));}

export function isOperaGXBrowser(userAgent='',brands=[]){return /\b(?:OPGX\/|Opera[ /]GX\b)/i.test(userAgent)||brands.some(x=>/^Opera GX$/i.test(x.brand||''));}
