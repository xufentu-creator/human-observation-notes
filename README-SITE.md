# Public Reading Site

The reading site is generated from the existing `daily/` directory. Original notes remain unchanged.

## Optional article front matter

```md
---
title: 标题
date: 2026-08-02
description: 一句话摘要
cover: assets/example.jpg
topics:
  - Human Judgment
  - Responsibility
faq:
  - question: 文章真正讨论什么？
    answer: 只填写文章已经明确回答的真实内容。
---
```

FAQ is optional and is never invented by the build.

## Cloudflare Pages

- Build command: `npm run build`
- Build output directory: `dist`
- Node version: 20 or later
- Custom domain: `observations.xufentu.com`

Keep all existing files and folders. Add only `site/`, `scripts/`, `package.json`, `VERSION`, `CHANGELOG.md`, and this file.
