(() => {
  'use strict';
  const C = window.SITE_CONFIG;
  const app = document.getElementById('app');
  const progress = document.getElementById('reading-progress');
  const api = `https://api.github.com/repos/${C.owner}/${C.repo}`;
  const raw = `https://raw.githubusercontent.com/${C.owner}/${C.repo}/${C.branch}`;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const dateFromName = n => { const m = n.match(/(20\d{2})[-_](\d{2})[-_](\d{2})/); return m ? `${m[1]}-${m[2]}-${m[3]}` : ''; };
  const cleanName = n => n.replace(/\.(md|markdown)$/i,'').replace(/^20\d{2}[-_]\d{2}[-_]\d{2}[a-z]?[-_]*/i,'').replace(/[-_]+/g,' ').replace(/\s+/g,' ').trim() || n;
  function parseFM(md){
    if(!md.startsWith('---')) return {meta:{},body:md};
    const end = md.indexOf('\n---',3); if(end < 0) return {meta:{},body:md};
    const meta = {};
    md.slice(3,end).trim().split('\n').forEach(line => { const i=line.indexOf(':'); if(i>0) meta[line.slice(0,i).trim()] = line.slice(i+1).trim().replace(/^['"]|['"]$/g,''); });
    return {meta,body:md.slice(end+4).trim()};
  }
  function titleOf(md,fallback){ const {meta,body}=parseFM(md); const h=body.match(/^#\s+(.+)$/m); return meta.title || (h && h[1].trim()) || fallback; }
  function descriptionOf(md){ const {meta,body}=parseFM(md); if(meta.description) return meta.description; return body.replace(/^#.*$/gm,'').replace(/!\[[^\]]*\]\([^)]*\)/g,'').replace(/\[[^\]]+\]\([^)]*\)/g,'').replace(/[*_>`#-]/g,'').replace(/\s+/g,' ').trim().slice(0,150); }
  function fixImages(md,path){ const base=path.split('/').slice(0,-1).join('/'); return md.replace(/!\[([^\]]*)\]\((?!https?:|data:|\/)([^)]+)\)/g,(_,a,u)=>`![${a}](${raw}/${base}/${u.replace(/^\.\//,'')})`); }
  function readingMinutes(text){ return Math.max(1,Math.ceil(text.replace(/[#>*_`\[\]()\-]/g,'').length/500)); }
  async function sha256(text){ const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)); return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join(''); }
  function decodeBase64Utf8(content){ const bytes=Uint8Array.from(atob(content.replace(/\n/g,'')),c=>c.charCodeAt(0)); return new TextDecoder('utf-8',{fatal:false}).decode(bytes); }
  async function listFiles(){
    const r=await fetch(`${api}/contents/${C.contentDir}?ref=${C.branch}`); if(!r.ok) throw new Error('暂时无法读取公开记录。');
    const data=await r.json();
    return data.filter(x=>x.type==='file'&&/\.(md|markdown)$/i.test(x.name)).map(x=>({...x,date:dateFromName(x.name),title:cleanName(x.name)})).sort((a,b)=>(b.date||b.name).localeCompare(a.date||a.name));
  }
  function listMarkup(list){
    const groups={}; list.forEach(f=>{const y=(f.date||'未标日期').slice(0,4);(groups[y]??=[]).push(f)});
    return Object.keys(groups).sort().reverse().map(y=>`<section class="year-block"><h2 class="year-title">${esc(y)}</h2>${groups[y].map(f=>`<a class="record" data-search="${esc((f.date+' '+f.title).toLowerCase())}" href="#/note/${encodeURIComponent(f.path)}"><span class="record-date">${esc(f.date||'原始日期')}</span><span class="record-title">${esc(f.title)}</span><span class="record-arrow">›</span></a>`).join('')}</section>`).join('');
  }
  async function home(){
    progress.style.width='0'; app.innerHTML='<div class="loading">正在读取公开记录…</div>';
    try{
      const list=await listFiles(); document.title=`${C.siteTitle} — ${C.author}`;
      app.innerHTML=`<section class="hero"><div class="eyebrow">Public Observation Archive</div><h1>${esc(C.siteTitle)}</h1><p>${esc(C.siteSubtitle)}</p></section><div class="searchbar"><input id="q" type="search" placeholder="搜索标题或日期" autocomplete="off"><span class="count">${list.length} 篇记录</span></div><div id="records">${listMarkup(list)}</div>`;
      document.getElementById('q').addEventListener('input',e=>{const q=e.target.value.toLowerCase().trim();document.querySelectorAll('.record').forEach(el=>el.style.display=el.dataset.search.includes(q)?'grid':'none')});
    }catch(e){app.innerHTML=`<div class="error">${esc(e.message)}</div>`}
  }
  function citations(title,published,url,immutable,sha){ const year=(published||'').slice(0,4); return {plain:`Tu, Xufen. “${title}.” Human Observation Notes, ${published}. ${url}`,apa:`Tu, X. (${year}). ${title}. Human Observation Notes. ${url}`,bibtex:`@misc{tu${year}${sha.slice(0,7)},\n  author = {Xufen Tu},\n  title = {${title.replace(/[{}]/g,'')}},\n  year = {${year}},\n  url = {${url}},\n  note = {Immutable source: ${immutable}}\n}`}; }
  async function copy(text,button){ try{await navigator.clipboard.writeText(text);const old=button.textContent;button.textContent='已复制';setTimeout(()=>button.textContent=old,1300)}catch{alert('复制失败，请手动复制。')} }
  async function note(path){
    app.innerHTML='<div class="loading">正在读取文章…</div>';
    try{
      const enc=path.split('/').map(encodeURIComponent).join('/');
      const [fr,cr]=await Promise.all([fetch(`${api}/contents/${enc}?ref=${C.branch}`),fetch(`${api}/commits?path=${encodeURIComponent(path)}&per_page=100`)]);
      if(!fr.ok) throw new Error('文章不存在或暂时无法读取。');
      const fd=await fr.json(), md=decodeBase64Utf8(fd.content), parsed=parseFM(md), title=titleOf(md,cleanName(path.split('/').pop())), desc=descriptionOf(md), fileDate=parsed.meta.date||dateFromName(path.split('/').pop());
      const commits=cr.ok?await cr.json():[], latest=commits[0], first=commits[commits.length-1], published=(fileDate||first?.commit?.author?.date||'').slice(0,10), updated=(latest?.commit?.author?.date||published).slice(0,10), commit=latest?.sha||fd.sha;
      const immutable=`https://github.com/${C.owner}/${C.repo}/blob/${commit}/${path}`, source=`https://github.com/${C.owner}/${C.repo}/blob/${C.branch}/${path}`, history=`https://github.com/${C.owner}/${C.repo}/commits/${C.branch}/${path}`, canonical=`${C.siteUrl}/#/note/${encodeURIComponent(path)}`, hash=await sha256(md), minutes=readingMinutes(parsed.body), html=marked.parse(fixImages(parsed.body,path)), cite=citations(title,published,canonical,immutable,hash), saved=JSON.parse(localStorage.getItem('hon-reading')||'{}')[path];
      document.title=`${title} — ${C.siteTitle}`;
      app.innerHTML=`<article class="article-wrap"><a class="back" href="#/">← 返回全部记录</a>${saved?.percent>5&&saved.percent<95?`<div class="resume">上次阅读到约 ${saved.percent}%</div>`:''}<header class="article-header"><div class="article-kicker">Public Observation Record</div><h1>${esc(title)}</h1><div class="article-meta"><span>${esc(published||'日期保留于原始记录')}</span>${updated&&updated!==published?`<span>更新 ${esc(updated)}</span>`:''}<span>${minutes} 分钟阅读</span><span>${esc(C.author)}</span></div></header><div class="prose">${html}</div><section class="evidence"><h2>来源与引用</h2><div class="evidence-grid"><div class="evidence-label">原始记录</div><div class="evidence-value">${esc(path)}</div><div class="evidence-label">首次公开日期</div><div class="evidence-value">${esc(published||'保留于原始记录')}</div><div class="evidence-label">最后更新</div><div class="evidence-value">${esc(updated||published)}</div><div class="evidence-label">固定版本</div><div class="evidence-value">${esc(commit.slice(0,12))}</div><div class="evidence-label">SHA-256</div><div class="evidence-value hash">${esc(hash)}</div><div class="evidence-label">规范阅读地址</div><div class="evidence-value">${esc(canonical)}</div></div><div class="actions"><a href="${source}" target="_blank" rel="noopener">原始文件</a><a href="${history}" target="_blank" rel="noopener">修改历史</a><a href="${immutable}" target="_blank" rel="noopener">固定版本</a><button id="copy-plain">复制引用</button><button id="copy-apa">APA</button><button id="copy-bib">BibTeX</button><button onclick="window.print()">打印 / PDF</button></div></section></article>`;
      document.getElementById('copy-plain').onclick=e=>copy(cite.plain,e.currentTarget);document.getElementById('copy-apa').onclick=e=>copy(cite.apa,e.currentTarget);document.getElementById('copy-bib').onclick=e=>copy(cite.bibtex,e.currentTarget);
      setJsonLd({title,desc,published,updated,canonical,source}); if(saved?.y)setTimeout(()=>scrollTo(0,saved.y),100);
    }catch(e){app.innerHTML=`<div class="error">${esc(e.message)}<br><br><a href="#/">返回首页</a></div>`}
  }
  function setJsonLd(x){ document.querySelectorAll('script[data-jsonld]').forEach(n=>n.remove()); const s=document.createElement('script');s.type='application/ld+json';s.dataset.jsonld='1';s.textContent=JSON.stringify({'@context':'https://schema.org','@type':'Article',headline:x.title,description:x.desc,datePublished:x.published,dateModified:x.updated,author:{'@type':'Person',name:C.author,url:C.authorUrl},mainEntityOfPage:x.canonical,url:x.canonical,isBasedOn:x.source,publisher:{'@type':'Person',name:C.author}});document.head.appendChild(s); }
  function route(){const h=location.hash||'#/'; if(h.startsWith('#/note/'))note(decodeURIComponent(h.slice(7)));else home();}
  window.addEventListener('scroll',()=>{const h=location.hash||'';if(!h.startsWith('#/note/'))return;const max=document.documentElement.scrollHeight-innerHeight,p=max>0?Math.round(scrollY/max*100):0;progress.style.width=`${p}%`;const path=decodeURIComponent(h.slice(7)),all=JSON.parse(localStorage.getItem('hon-reading')||'{}');all[path]={y:scrollY,percent:p,at:Date.now()};localStorage.setItem('hon-reading',JSON.stringify(all));},{passive:true});
  window.addEventListener('hashchange',()=>{scrollTo(0,0);route()}); route();
})();
