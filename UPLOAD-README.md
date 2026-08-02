# Upload only these files

Upload the contents of this package to the root of the existing `human-observation-notes` repository.

Add or replace only:

- `.github/workflows/pages.yml`
- `scripts/build.mjs`
- `package.json`
- `VERSION`
- `CHANGELOG-v1.2.0.md`

Do not upload, replace, move, rename, or delete:

- `daily/`
- `patterns/`
- `research-context/`
- existing research Markdown files
- Git history

After committing:

1. Open `Settings → Pages`.
2. Change Source from `Deploy from a branch` to `GitHub Actions`.
3. Open `Actions` and wait for `Build and deploy observation archive` to complete successfully.
4. Open `https://observations.xufentu.com/`.
5. Check the homepage, archive, sitemap, and at least three article pages.

Future workflow:

- Continue writing only in `daily/`.
- Every push to `daily/` automatically rebuilds the homepage, complete article directory, independent HTML pages, archive, sitemap, RSS, citations, and source records.
