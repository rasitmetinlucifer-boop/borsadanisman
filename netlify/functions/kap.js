const KAP_URL = 'https://www.kap.org.tr/tr/bildirim-sorgu-sonuc?cat=6&cmp=Y&slf=ALL&srcbar=Y';

function clean(s='') {
  return s.replace(/<script[\s\S]*?<\/script>/gi,' ')
    .replace(/<style[\s\S]*?<\/style>/gi,' ')
    .replace(/<[^>]+>/g,' ')
    .replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"')
    .replace(/&#39;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>')
    .replace(/\s+/g,' ').trim();
}
function abs(href='') {
  if (!href) return 'https://www.kap.org.tr/tr/bildirim-sorgu';
  if (/^https?:\/\//i.test(href)) return href;
  return 'https://www.kap.org.tr' + (href.startsWith('/') ? href : '/' + href);
}
function parseRows(html) {
  const out=[];
  const rows=html.match(/<tr\b[\s\S]*?<\/tr>/gi)||[];
  for (const row of rows) {
    const cells=(row.match(/<td\b[\s\S]*?<\/td>/gi)||[]).map(clean);
    if (cells.length < 4) continue;
    const text=clean(row);
    if (!text || /Tarih\s+Kod\s+/i.test(text)) continue;
    const linkMatch=row.match(/href=["']([^"']*(?:Bildirim|bildirim)[^"']*)["']/i) || row.match(/href=["']([^"']+)["']/i);
    const date=(text.match(/(?:Bugün|Dün)(?:\s+\d{1,2}:\d{2})?|\d{2}\.\d{2}\.\d{4}\s+\d{1,2}:\d{2}/i)||[''])[0];
    const symbols=[...new Set((text.match(/\b[A-ZÇĞİÖŞÜ]{2,6}\b/g)||[]).filter(x=>!['KAP','BIST','AŞ','SPK','PAY','GENEL','FON'].includes(x)))];
    let title='';
    for (const c of cells) { if (c.length>title.length && c.length<320) title=c; }
    if (!title) title=text.slice(0,220);
    out.push({date, symbols, title, text:text.slice(0,700), url:abs(linkMatch?.[1]||'')});
  }
  const seen=new Set();
  return out.filter(x=>{const k=x.date+'|'+x.title; if(seen.has(k))return false; seen.add(k); return true;});
}
exports.handler = async (event) => {
  try {
    const raw=(event.queryStringParameters?.symbols||'').toUpperCase();
    const wanted=raw.split(',').map(s=>s.trim()).filter(Boolean).slice(0,30);
    const r=await fetch(KAP_URL,{headers:{'user-agent':'Mozilla/5.0 (compatible; BorsaDanismanPaneli/1.0)','accept-language':'tr-TR,tr;q=0.9'}});
    if(!r.ok) throw new Error('KAP HTTP '+r.status);
    const html=await r.text();
    let items=parseRows(html);
    if(wanted.length) items=items.filter(x=>wanted.some(s=>new RegExp('(^|[^A-Z0-9])'+s+'([^A-Z0-9]|$)','i').test(x.text)));
    items=items.slice(0,12);
    return {statusCode:200,headers:{'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=120, s-maxage=120','access-control-allow-origin':'*'},body:JSON.stringify({ok:true,source:'KAP',fetchedAt:new Date().toISOString(),items})};
  } catch (e) {
    return {statusCode:502,headers:{'content-type':'application/json; charset=utf-8','access-control-allow-origin':'*'},body:JSON.stringify({ok:false,error:String(e?.message||e),items:[]})};
  }
};
