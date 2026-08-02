import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const DAILY = path.join(ROOT, 'daily');
const OUT = path.join(ROOT, 'dist');
const BASE = 'https://observations.xufentu.com';
const REPO = 'https://github.com/xufentu-creator/human-observation-notes';
const AUTHOR = 'Xufen Tu';
const SITE = 'Human Observation Notes';

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const esc = (s='') => String(s).replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const strip = s => String(s).replace(/!\[[^\]]*\]\([^)]*\)/g,' ').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/[*_`>#-]/g,' ').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const slugify = s => String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g,'-').replace(/^-+|-+$/g,'').slice(0,120) || 'observation';
const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');
const formatDate = d => { const s=String(d||'').trim(); let m=s.match(/^(20\d{2})-(\d{2})-(\d{2})$/); if(m) return `${m[1]}-${m[2]}-${m[3]}`; m=s.match(/^(20\d{2})年(\d{1,2})月(\d{1,2})日$/); return m ? `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}` : ''; };

function git(args, fallback='') {
  try { return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore','pipe','ignore'] }).trim(); }
  catch { return fallback; }
}

function parseFrontmatter(raw) {
  if (!raw.startsWith('---\n')) return [{}, raw];
  const end = raw.indexOf('\n---\n', 4);
  if (end < 0) return [{}, raw];
  const meta = {};
  for (const line of raw.slice(4,end).split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (m) meta[m[1]] = m[2].replace(/^['"]|['"]$/g,'');
  }
  return [meta, raw.slice(end+5)];
}

function markdown(md) {
  const lines = md.replace(/\r/g,'').split('\n');
  const out = [];
  let para=[]; let list=false; let quote=[];
  const flushPara=()=>{ if(para.length){ out.push(`<p>${inline(para.join(' '))}</p>`); para=[]; }};
  const flushQuote=()=>{ if(quote.length){ out.push(`<blockquote>${quote.map(x=>inline(x)).join('<br>')}</blockquote>`); quote=[]; }};
  const closeList=()=>{ if(list){ out.push('</ul>'); list=false; }};
  for (const line of lines) {
    if (/^```/.test(line)) { flushPara(); flushQuote(); closeList(); continue; }
    const h=line.match(/^(#{1,4})\s+(.+)$/);
    if(h){ flushPara(); flushQuote(); closeList(); const n=Math.min(4,h[1].length+1); out.push(`<h${n}>${inline(h[2])}</h${n}>`); continue; }
    const img=line.match(/^!\[([^\]]*)\]\(([^)]+)\)\s*$/);
    if(img){ flushPara(); flushQuote(); closeList(); out.push(`<figure><img loading="lazy" src="${esc(resolveAsset(img[2]))}" alt="${esc(img[1])}">${img[1]?`<figcaption>${esc(img[1])}</figcaption>`:''}</figure>`); continue; }
    const li=line.match(/^[-*]\s+(.+)$/);
    if(li){ flushPara(); flushQuote(); if(!list){out.push('<ul>');list=true;} out.push(`<li>${inline(li[1])}</li>`); continue; }
    if(/^>\s?/.test(line)){ flushPara(); closeList(); quote.push(line.replace(/^>\s?/,'')); continue; }
    if(!line.trim()){ flushPara(); flushQuote(); closeList(); continue; }
    para.push(line.trim());
  }
  flushPara(); flushQuote(); closeList();
  return out.join('\n');
}

function inline(s) {
  return esc(s)
    .replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g,'<em>$1</em>')
    .replace(/`([^`]+)`/g,'<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g,(_,t,u)=>`<a href="${esc(u)}">${t}</a>`);
}
function resolveAsset(u){ return /^https?:|^data:|^\//.test(u) ? u : `${BASE}/${u.replace(/^\.\//,'')}`; }

function readObservation(file) {
  const rel = path.relative(ROOT,file).replaceAll('\\','/');
  const raw = fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'');
  const [meta, body0] = parseFrontmatter(raw);
  let body=body0.trim();
  const lines=body.split(/\r?\n/);
  let date = formatDate(meta.date) || (path.basename(file).match(/(20\d{2}-\d{2}-\d{2})/)||[])[1] || formatDate(lines[0]?.trim());
  let title = meta.title || '';
  let start=0;
  if (!title && date && lines[0]?.trim()===date) start=1;
  while(start<lines.length && !lines[start].trim()) start++;
  if(!title && lines[start]) {
    title=lines[start].replace(/^#+\s*/,'').trim();
    start++;
  }
  body=lines.slice(start).join('\n').trim();
  title=title || path.basename(file,path.extname(file));
  const desc=meta.description || strip(body).slice(0,180);
  const topics=(meta.topics||meta.topic||'Human Judgment, AI Governance, Responsibility, Decision Architecture').split(/[,;|]/).map(x=>x.trim()).filter(Boolean).slice(0,6);
  const slug=`${date||'undated'}-${slugify(path.basename(file,path.extname(file)).replace(/^20\d{2}[-_]?\d{2}[-_]?\d{2}[-_]?/,''))}`;
  const first=git(['log','--follow','--diff-filter=A','--format=%ad','--date=short','--',rel],date).split('\n').filter(Boolean).at(-1)||date;
  const updated=git(['log','-1','--format=%ad','--date=short','--',rel],date)||date;
  const commit=git(['log','-1','--format=%H','--',rel],'');
  const words=(body.match(/[\u4e00-\u9fff]|[A-Za-z0-9]+/g)||[]).length;
  const minutes=Math.max(1,Math.ceil(words/300));
  return {rel,raw,body,title,date:first||date,updated,commit,desc,topics,slug,minutes,hash:sha256(raw),html:markdown(body)};
}

function listFiles(dir) {
  const files=[];
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,e.name);
    if(e.isDirectory()) files.push(...listFiles(p));
    else if(e.name.toLowerCase().endsWith('.md') || !path.extname(e.name)) files.push(p);
  }
  return files;
}

const observations=listFiles(DAILY).map(readObservation).sort((a,b)=>(b.date||'').localeCompare(a.date||'') || a.title.localeCompare(b.title));

const css=`:root{--ink:#171717;--muted:#6c6c68;--line:#e5e3de;--paper:#fbfaf7;--card:#fff;--accent:#215a52;--max:820px}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--paper);color:var(--ink);font-family:ui-serif,Georgia,"Noto Serif SC","Songti SC",serif;line-height:1.82}.top{border-bottom:1px solid var(--line);background:rgba(251,250,247,.94);position:sticky;top:0;z-index:5;backdrop-filter:blur(10px)}.topin{max-width:1120px;margin:auto;padding:18px 24px;display:flex;justify-content:space-between;align-items:center;gap:24px}.brand{font-family:ui-sans-serif,system-ui,sans-serif;font-weight:650;letter-spacing:.01em}.brand a,.nav a{color:inherit;text-decoration:none}.nav{display:flex;gap:18px;font:14px ui-sans-serif,system-ui,sans-serif;color:var(--muted)}main{max-width:1120px;margin:auto;padding:70px 24px 110px}.hero{max-width:860px;margin-bottom:60px}.eyebrow,.meta,.topics,.evidence,.archive{font-family:ui-sans-serif,system-ui,sans-serif}.eyebrow{font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:var(--accent)}h1{font-size:clamp(38px,6vw,72px);line-height:1.12;margin:16px 0 22px;font-weight:600;letter-spacing:-.03em}.lead{font-size:20px;color:#484843;max-width:720px}.search{margin-top:34px;width:min(520px,100%);padding:14px 16px;border:1px solid var(--line);border-radius:4px;background:#fff;font:16px ui-sans-serif,system-ui,sans-serif}.list{border-top:1px solid var(--line)}.item{display:grid;grid-template-columns:130px 1fr;gap:26px;padding:30px 0;border-bottom:1px solid var(--line)}.date{font:14px ui-sans-serif,system-ui,sans-serif;color:var(--muted)}.item h2{font-size:26px;line-height:1.35;margin:0 0 10px;font-weight:560}.item h2 a{color:inherit;text-decoration:none}.item p{margin:0;color:#55554f}.article{max-width:var(--max);margin:auto}.article h1{font-size:clamp(36px,6vw,58px)}.meta{display:flex;flex-wrap:wrap;gap:12px 22px;color:var(--muted);font-size:14px;padding-bottom:30px;border-bottom:1px solid var(--line)}.content{font-size:19px;padding-top:34px}.content p{margin:0 0 1.4em}.content h2,.content h3{line-height:1.35;margin:2.2em 0 .8em}.content blockquote{margin:2em 0;padding:0 0 0 22px;border-left:3px solid var(--accent);color:#484843}.content img{max-width:100%;height:auto;display:block;margin:38px auto}.content figcaption{text-align:center;color:var(--muted);font:13px ui-sans-serif,system-ui,sans-serif}.content a{color:var(--accent)}.topics{display:flex;gap:8px;flex-wrap:wrap;margin:30px 0}.topics span{border:1px solid var(--line);padding:5px 9px;font-size:12px;color:#555}.evidence{margin-top:60px;padding:26px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);font-size:14px}.evidence dl{display:grid;grid-template-columns:150px 1fr;gap:10px 20px}.evidence dt{color:var(--muted)}.evidence dd{margin:0;word-break:break-all}.actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:24px}.btn{display:inline-block;padding:9px 13px;border:1px solid var(--line);color:var(--ink);text-decoration:none;background:#fff;font:13px ui-sans-serif,system-ui,sans-serif}.footer{margin-top:70px;color:var(--muted);font:13px ui-sans-serif,system-ui,sans-serif}.archive h1{font-size:48px}.year{margin:44px 0 16px;font-size:28px}.archive ul{list-style:none;padding:0}.archive li{display:grid;grid-template-columns:120px 1fr;gap:20px;padding:12px 0;border-bottom:1px solid var(--line)}.archive a{color:inherit;text-decoration:none}@media(max-width:650px){main{padding-top:45px}.item,.archive li{grid-template-columns:1fr;gap:6px}.topin{padding:14px 18px}.nav{display:none}.content{font-size:18px}.evidence dl{grid-template-columns:1fr}.evidence dt{margin-top:10px}}@media print{.top,.actions,.search{display:none}body{background:#fff}main{padding:0}.article{max-width:none}}`;
fs.writeFileSync(path.join(OUT,'styles.css'),css);

function shell({title,description,canonical,body,jsonld=''}){
 return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${canonical}"><meta property="og:type" content="article"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${canonical}"><meta name="twitter:card" content="summary"><link rel="stylesheet" href="${BASE}/styles.css"><link rel="alternate" type="application/rss+xml" title="${SITE}" href="${BASE}/rss.xml">${jsonld}</head><body><header class="top"><div class="topin"><div class="brand"><a href="${BASE}/">${SITE}</a></div><nav class="nav"><a href="${BASE}/archive/">Archive</a><a href="${REPO}">GitHub Source</a><a href="https://xufentu.com">Xufen Tu</a></nav></div></header>${body}</body></html>`;
}

const listHtml=observations.map(o=>`<article class="item" data-search="${esc((o.title+' '+o.desc+' '+o.topics.join(' ')).toLowerCase())}"><div class="date">${esc(o.date||'Undated')}</div><div><h2><a href="${BASE}/observations/${o.slug}/">${esc(o.title)}</a></h2><p>${esc(o.desc)}</p></div></article>`).join('\n');
const homepage=shell({title:`${SITE} — ${AUTHOR}`,description:'Dated public observations on human judgment, responsibility, verification, and decision-making in AI-mediated environments.',canonical:`${BASE}/`,jsonld:`<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@type':'CollectionPage',name:SITE,url:BASE,author:{'@type':'Person',name:AUTHOR,url:'https://xufentu.com'},hasPart:observations.slice(0,100).map(o=>({'@type':'Article',headline:o.title,url:`${BASE}/observations/${o.slug}/`,datePublished:o.date}))})}</script>`,body:`<main><section class="hero"><div class="eyebrow">Public research observation archive</div><h1>Human Observation Notes</h1><p class="lead">Dated observations by Xufen Tu on human judgment, responsibility, verification, and decision-making in AI-mediated environments.</p><input id="search" class="search" type="search" placeholder="Search observations" aria-label="Search observations"></section><section class="list" id="list">${listHtml}</section><div class="footer">${observations.length} public observation records · <a href="${BASE}/archive/">Complete archive</a> · <a href="${REPO}">Canonical source and version history</a></div></main><script>const q=document.getElementById('search');q.addEventListener('input',()=>{const v=q.value.toLowerCase().trim();document.querySelectorAll('.item').forEach(x=>x.hidden=v&&!x.dataset.search.includes(v))})</script>`});
fs.writeFileSync(path.join(OUT,'index.html'),homepage);

for(const o of observations){
 const dir=path.join(OUT,'observations',o.slug); fs.mkdirSync(dir,{recursive:true});
 const immutable=o.commit?`${REPO}/blob/${o.commit}/${o.rel}`:`${REPO}/blob/main/${o.rel}`;
 const source=`${REPO}/blob/main/${o.rel}`;
 const history=`${REPO}/commits/main/${o.rel}`;
 const cite=`Tu, Xufen. “${o.title}.” Human Observation Notes, ${o.date}. ${BASE}/observations/${o.slug}/`;
 const json={'@context':'https://schema.org','@type':'ScholarlyArticle',headline:o.title,description:o.desc,author:{'@type':'Person',name:AUTHOR,url:'https://xufentu.com'},datePublished:o.date,dateModified:o.updated,inLanguage:/[\u4e00-\u9fff]/.test(o.body)?'zh-CN':'en',mainEntityOfPage:`${BASE}/observations/${o.slug}/`,url:`${BASE}/observations/${o.slug}/`,isBasedOn:immutable,keywords:o.topics.join(', '),identifier:o.hash,citation:source,publisher:{'@type':'Person',name:AUTHOR}};
 const page=shell({title:`${o.title} — ${SITE}`,description:o.desc,canonical:`${BASE}/observations/${o.slug}/`,jsonld:`<script type="application/ld+json">${JSON.stringify(json)}</script>`,body:`<main><article class="article"><div class="eyebrow">Public Observation Record</div><h1>${esc(o.title)}</h1><div class="meta"><span>Published ${esc(o.date||'Undated')}</span><span>Updated ${esc(o.updated||o.date||'')}</span><span>${o.minutes} min read</span><span>Author ${AUTHOR}</span></div><div class="topics">${o.topics.map(t=>`<span>${esc(t)}</span>`).join('')}</div><div class="content">${o.html}</div><section class="evidence"><h2>Record and citation</h2><dl><dt>Canonical URL</dt><dd><a href="${BASE}/observations/${o.slug}/">${BASE}/observations/${o.slug}/</a></dd><dt>Original source</dt><dd><a href="${source}">${esc(o.rel)}</a></dd><dt>Version history</dt><dd><a href="${history}">GitHub commit history</a></dd><dt>Immutable version</dt><dd><a href="${immutable}">${o.commit?o.commit.slice(0,12):'Current main version'}</a></dd><dt>SHA-256</dt><dd>${o.hash}</dd><dt>Citation</dt><dd id="citation">${esc(cite)}</dd></dl><div class="actions"><button class="btn" onclick="navigator.clipboard.writeText(document.getElementById('citation').textContent)">Copy citation</button><a class="btn" href="${source}">View source</a><a class="btn" href="${history}">View history</a><button class="btn" onclick="window.print()">Print / Save PDF</button></div></section><div class="footer"><a href="${BASE}/">All observations</a> · <a href="${BASE}/archive/">Archive</a></div></article></main>`});
 fs.writeFileSync(path.join(dir,'index.html'),page);
}

const years={}; for(const o of observations){ const y=(o.date||'Undated').slice(0,4); (years[y]??=[]).push(o); }
const archiveBody=Object.entries(years).sort((a,b)=>b[0].localeCompare(a[0])).map(([y,arr])=>`<h2 class="year">${esc(y)}</h2><ul>${arr.map(o=>`<li><span>${esc(o.date||'')}</span><a href="${BASE}/observations/${o.slug}/">${esc(o.title)}</a></li>`).join('')}</ul>`).join('');
fs.mkdirSync(path.join(OUT,'archive'),{recursive:true});
fs.writeFileSync(path.join(OUT,'archive','index.html'),shell({title:`Archive — ${SITE}`,description:'Complete chronological archive of Human Observation Notes.',canonical:`${BASE}/archive/`,body:`<main class="archive"><div class="eyebrow">Complete public record</div><h1>Observation Archive</h1>${archiveBody}<div class="footer"><a href="${BASE}/">Return to latest observations</a></div></main>`}));

const urls=[`${BASE}/`,`${BASE}/archive/`,...observations.map(o=>`${BASE}/observations/${o.slug}/`)];
fs.writeFileSync(path.join(OUT,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(u=>`<url><loc>${u}</loc></url>`).join('')}</urlset>`);
fs.writeFileSync(path.join(OUT,'robots.txt'),`User-agent: *\nAllow: /\nSitemap: ${BASE}/sitemap.xml\n`);
fs.writeFileSync(path.join(OUT,'rss.xml'),`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${SITE}</title><link>${BASE}/</link><description>Dated public observations by ${AUTHOR}.</description>${observations.slice(0,30).map(o=>`<item><title>${esc(o.title)}</title><link>${BASE}/observations/${o.slug}/</link><guid>${BASE}/observations/${o.slug}/</guid><pubDate>${new Date((o.date||'1970-01-01')+'T00:00:00Z').toUTCString()}</pubDate><description>${esc(o.desc)}</description></item>`).join('')}</channel></rss>`);
fs.writeFileSync(path.join(OUT,'CNAME'),'observations.xufentu.com\n');
fs.writeFileSync(path.join(OUT,'.nojekyll'),'');
fs.writeFileSync(path.join(OUT,'404.html'),shell({title:`Page not found — ${SITE}`,description:'The requested observation page was not found.',canonical:`${BASE}/404.html`,body:`<main><section class="hero"><div class="eyebrow">404</div><h1>Page not found</h1><p class="lead">The requested record is unavailable. The complete public archive remains accessible below.</p><p><a href="${BASE}/">Return to Human Observation Notes</a></p></section></main>`}));

// Copy non-Markdown assets under daily, preserving paths.
function copyAssets(src,rel='daily'){
 for(const e of fs.readdirSync(src,{withFileTypes:true})){
   const p=path.join(src,e.name), r=path.join(rel,e.name);
   if(e.isDirectory()) copyAssets(p,r);
   else if(!e.name.toLowerCase().endsWith('.md')){ const dest=path.join(OUT,r); fs.mkdirSync(path.dirname(dest),{recursive:true}); fs.copyFileSync(p,dest); }
 }
}
copyAssets(DAILY);
console.log(`Built ${observations.length} static observation pages in dist/`);
