# 最简单上传方式

不要重新上传原来的 daily、patterns、research-context 等文件。

只把本压缩包中的 `site` 文件夹上传到现有仓库根目录。

最终结构：

- daily/（原样保留）
- patterns/（原样保留）
- research-context/（原样保留）
- site/（本次新增）
- README.md（原样保留）
- LICENSE（原样保留）

Cloudflare Pages：
- Framework preset: None
- Build command: 留空
- Build output directory: site

绑定域名：observations.xufentu.com

以后继续在原来的 daily/ 写 Markdown。文件名中的原始日期会自动显示，例如：
`2026-08-01-title.md`

网站不会修改、复制或重新生成你的日记文件。
