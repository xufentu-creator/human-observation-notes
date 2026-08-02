(() => {
  "use strict";
  const C = window.OBS_CONFIG;
  const app = document.getElementById("app");
  const progress = document.getElementById("reading-progress");
  const API = `https://api.github.com/repos/${C.owner}/${C.repo}`;
  const RAW = `https://raw.githubusercontent.com/${C.owner}/${C.repo}/${C.branch}`;
  const cache = new Map();
  const esc = s => String(s ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
  const decodePath = p => { try { return decodeURIComponent(p); } catch { return p; } };
  const dateFromPath = p => (decodePath(p).match(/(?:^|\/)(\d{4}-\d{2}-\d{2})/)||[])[1] || "";
  const cleanName = p => decodePath(p.split("/").pop()).replace(/\.md$/i,"").replace(/^\s+/,"").replace(/^\d{4}-\d{2}-\d{2}[-_\s]*/,"").replace(/[-_]+/g," ").trim();
  const stripFrontMatter = md => md.replace(/^---\s*[\r\n]+[\s\S]*?[\r\n]+---\s*[\r\n]+/,"");
  const titleFromMarkdown = (md,path) => {
    const fm = md.match(/^---\s*[\r\n]+([\s\S]*?)[\r\n]+---/);
    const ft = fm && fm[1].match(/^title:\s*["']?(.+?)["']?\s*$/m);
    if(ft) return ft[1].trim();
    const h = stripFrontMatter(md).match(/^#\s+(.+)$/m);
    return h ? h[1].replace(/[*_`]/g,"").trim() : cleanName(path);
  };
  const summaryFromMarkdown = md => stripFrontMatter(md).replace(/^#{1,6}\s+.*$/gm,"").replace(/!\[[^\]]*\]\([^)]*\)/g,"").replace(/\[([^\]]+)\]\([^)]*\)/g,"$1").replace(/[*_`>#-]/g," ").replace(/\s+/g," ").trim().slice(0,180);
  const words = t => (t.match(/[\u3400-\u9fff]|[A-Za-z0-9]+/g)||[]).length;
  const readingTime = t => Math.max(1,Math.ceil(words(t)/260));
  const api = async url => { const r=await fetch(url,{headers:{Accept:"application/vnd.github+json"}}); if(!r.ok) throw new Error(`GitHub API ${r.status}`); return r.json(); };
  async function listNotes(){
    const tree=await api(`${API}/git/trees/${C.branch}?recursive=1`);
    return tree.tree.filter(x=>x.type==="blob"&&x.path.startsWith(`${C.contentPath}/`)&&/\.md$/i.test(x.path)).map(x=>({path:x.path,sha:x.sha,date:dateFromPath(x.path)})).sort((a,b)=>(b.date||"").localeCompare(a.date||"")||b.path.localeCompare(a.path));
  }
  async function getMarkdown(path){ if(cache.has(path)) return cache.get(path); const r=await fetch(`${RAW}/${path.split("/").map(encodeURIComponent).join("/")}`); if(!r.ok) throw new Error(`无法读取文章 (${r.status})`); const t=await r.text(); cache.set(path,t); return t; }
  function setHead(title,desc,url,type="article"){
    document.title=title; const set=(q,v)=>{let e=document.querySelector(q);if(e)e.setAttribute("content",v)};
    set('meta[name="description"]',desc);set('meta[property="og:title"]',title);set('meta[property="og:description"]',desc);set('meta[property="og:url"]',url);set('meta[property="og:type"]',type);
    let c=document.querySelector('link[rel="canonical"]');if(c)c.href=url;
  }
  function addJsonLd(data){ document.querySelectorAll('script[data-dynamic-jsonld]').forEach(x=>x.remove()); const s=document.createElement("script");s.type="application/ld+json";s.dataset.dynamicJsonld="1";s.textContent=JSON.stringify(data);document.head.appendChild(s); }
  async function renderHome(){
    progress.style.width="0"; setHead("Human Observation Notes — Xufen Tu","Dated public observations on human judgment, responsibility, verification, and decision-making.",`${C.siteUrl}/`,"website");
    addJsonLd({"@context":"https://schema.org","@type":"CollectionPage",name:"Human Observation Notes",url:`${C.siteUrl}/`,author:{"@type":"Person",name:C.author,url:C.authorUrl}});
    app.innerHTML='<section class="loading"><div class="spinner"></div><p>正在读取公开观察记录…</p></section>';
    try{
      const notes=await listNotes(); const initial=notes.slice(0,120);
      const details=await Promise.all(initial.map(async n=>{try{const md=await getMarkdown(n.path);return {...n,title:titleFromMarkdown(md,n.path),summary:summaryFromMarkdown(md)}}catch{return {...n,title:cleanName(n.path),summary:""}}}));
      app.innerHTML=`<section class="hero"><div class="eyebrow">Public Research Observations</div><h1>Human Observation Notes</h1><p>关于人类判断、责任、验证与 AI 介入环境中决策变化的长期公开观察记录。</p></section><div class="toolbar"><input id="search" class="search" type="search" placeholder="搜索标题、日期或内容" autocomplete="off"><span id="count" class="count">${details.length} records</span></div><section id="list" class="notes-list"></section><p class="notice">原始内容、日期和版本历史保存在公开 GitHub 仓库中。</p>`;
      const list=document.getElementById("list"),count=document.getElementById("count"),search=document.getElementById("search");
      const draw=arr=>{count.textContent=`${arr.length} records`;list.innerHTML=arr.map(n=>`<a class="note-row" href="#/note/${encodeURIComponent(n.path)}"><div class="note-date">${esc(n.date||"Undated")}</div><div><div class="note-title">${esc(n.title)}</div>${n.summary?`<div class="note-summary">${esc(n.summary)}${n.summary.length>=180?"…":""}</div>`:""}</div><div class="arrow">→</div></a>`).join("")||'<div class="empty">没有找到相关记录。</div>'}; draw(details);
      search.addEventListener("input",()=>{const q=search.value.trim().toLowerCase();draw(!q?details:details.filter(n=>`${n.date} ${n.title} ${n.summary}`.toLowerCase().includes(q)))});
    }catch(e){app.innerHTML=`<div class="error"><h2>暂时无法读取公开记录</h2><p>${esc(e.message)}</p><p><a href="${C.repositoryUrl}">直接访问 GitHub 仓库</a></p></div>`;}
  }
  function normalizeImages(html,path){ const base=path.substring(0,path.lastIndexOf("/")+1); const doc=document.createElement("div");doc.innerHTML=html;doc.querySelectorAll("img").forEach(img=>{const src=img.getAttribute("src")||"";if(!/^(https?:|data:|\/\/)/i.test(src)){const resolved=(base+src).split("/").reduce((a,s)=>{if(s==="..")a.pop();else if(s!==".")a.push(s);return a},[]).join("/");img.src=`${RAW}/${resolved.split("/").map(encodeURIComponent).join("/")}`;}img.loading="lazy"});return doc.innerHTML; }
  async function sha256(text){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("");}
  async function commits(path){try{return await api(`${API}/commits?path=${encodeURIComponent(path)}&per_page=100`)}catch{return []}}
  function citation(title,date,url){return `${C.author}. “${title}.” Human Observation Notes, ${date||"n.d."}. ${url}`}
  async function renderNote(encoded){
    const path=decodeURIComponent(encoded); app.innerHTML='<section class="loading"><div class="spinner"></div><p>正在读取文章…</p></section>';
    try{
      const [md,history]=await Promise.all([getMarkdown(path),commits(path)]); const title=titleFromMarkdown(md,path),date=dateFromPath(path),bodyMd=stripFrontMatter(md).replace(/^#\s+.*$/m,"").trim();
      const safe=DOMPurify.sanitize(normalizeImages(marked.parse(bodyMd,{gfm:true,breaks:false}),path)); const hash=await sha256(md); const latest=history[0]; const first=history[history.length-1]; const updated=latest?.commit?.committer?.date?.slice(0,10)||date; const published=first?.commit?.author?.date?.slice(0,10)||date;
      const blobSha=latest?.sha||C.branch; const source=`${C.repositoryUrl}/blob/${C.branch}/${path.split("/").map(encodeURIComponent).join("/")}`; const immutable=`${C.repositoryUrl}/blob/${blobSha}/${path.split("/").map(encodeURIComponent).join("/")}`; const historyUrl=`${C.repositoryUrl}/commits/${C.branch}/${path.split("/").map(encodeURIComponent).join("/")}`; const url=`${C.siteUrl}/#/note/${encodeURIComponent(path)}`; const desc=summaryFromMarkdown(md);
      setHead(`${title} — Xufen Tu`,desc,url,"article"); addJsonLd({"@context":"https://schema.org","@type":"ScholarlyArticle",headline:title,description:desc,datePublished:published,dateModified:updated,inLanguage:/[\u3400-\u9fff]/.test(md)?"zh-CN":"en",author:{"@type":"Person",name:C.author,url:C.authorUrl},mainEntityOfPage:url,isPartOf:{"@type":"CollectionPage",name:"Human Observation Notes",url:C.siteUrl},sameAs:immutable});
      app.innerHTML=`<article class="article-shell"><a class="back" href="#/">← 返回观察记录</a><header class="article-header"><div class="eyebrow">Public Observation Record</div><h1>${esc(title)}</h1><div class="meta"><span>作者 ${esc(C.author)}</span><span>首次记录 ${esc(published||"—")}</span><span>最后更新 ${esc(updated||"—")}</span><span>${readingTime(bodyMd)} 分钟阅读</span></div></header><div class="article-body">${safe}</div><section class="article-evidence"><h2>来源与引用</h2><div class="evidence-grid"><div class="evidence-item"><div class="evidence-label">Original record</div><div class="evidence-value"><a href="${source}" target="_blank" rel="noopener">GitHub source</a></div></div><div class="evidence-item"><div class="evidence-label">Revision history</div><div class="evidence-value"><a href="${historyUrl}" target="_blank" rel="noopener">${history.length} recorded revision${history.length===1?"":"s"}</a></div></div><div class="evidence-item"><div class="evidence-label">Immutable version</div><div class="evidence-value hash"><a href="${immutable}" target="_blank" rel="noopener">${esc(blobSha.slice(0,12))}</a></div></div><div class="evidence-item"><div class="evidence-label">Content SHA-256</div><div class="evidence-value hash">${hash}</div></div></div><div class="actions"><button class="button" id="copy-cite">复制引用</button><button class="button" id="copy-link">复制链接</button><a class="button" href="${immutable}" target="_blank" rel="noopener">固定版本</a><button class="button" onclick="window.print()">打印 / PDF</button></div></section></article>`;
      document.getElementById("copy-cite").onclick=()=>navigator.clipboard.writeText(citation(title,published,url)); document.getElementById("copy-link").onclick=()=>navigator.clipboard.writeText(url);
      const key=`obs-progress:${path}`; const saved=Number(localStorage.getItem(key)||0); if(saved>0&&saved<.96)setTimeout(()=>window.scrollTo({top:saved*(document.documentElement.scrollHeight-innerHeight),behavior:"smooth"}),250);
      window.onscroll=()=>{const max=document.documentElement.scrollHeight-innerHeight;const p=max>0?scrollY/max:0;progress.style.width=`${Math.min(100,p*100)}%`;localStorage.setItem(key,String(p))};
    }catch(e){app.innerHTML=`<div class="error"><h2>无法打开这篇记录</h2><p>${esc(e.message)}</p><p><a href="#/">返回首页</a></p></div>`;}
  }
  function route(){window.onscroll=null;progress.style.width="0";const h=location.hash||"#/";const m=h.match(/^#\/note\/(.+)$/);m?renderNote(m[1]):renderHome();}
  addEventListener("hashchange",route);addEventListener("DOMContentLoaded",route);
})();
