# Sunset Cover Maker

![make.fun bounty](https://make.fun/badge/gta6-cover-art-01.svg)
![rank](https://make.fun/badge/gta6-cover-art-01/foxybbacd-hub/gta6-cover-art-maker/rank.svg)
![reward](https://make.fun/badge/gta6-cover-art-01/foxybbacd-hub/gta6-cover-art-maker/reward.svg)

An entry for [Make GTA 6 Cover Art](https://make.fun/bounty/gta6-cover-art-01) on make.fun.

A web app that turns a photo and a caption into GTA 6-style cover art, exported as a PNG to share. It runs entirely offline in desktop Chrome from static files — no build step, no network requests, photos never leave the machine.

## What it does

- **Multi-panel poster layouts** — Quad 2×2, Hero + strip, and Trio columns, so one photo can fill several panels or each panel can hold a different photo.
- **Any photo** — add your own photos from your machine (or use the two built-in samples), click a panel to select it, then drag the photo inside it to crop and scroll to zoom. Each panel keeps its own crop.
- **Bold caption lettering** — editable caption and tagline in condensed Anton type with outline and glow, in three positions and a size slider; `|` splits the caption over two lines.
- **Vice City sunset grades** — Sunset, Neon, Noir and Vice colour grades that re-grade every panel and repaint the sunset strip: a hand-drawn striped sun, skyline and palm silhouettes, all original canvas art.
- **Fast export** — one click exports a PNG in 1080 × 1080, 1080 × 1350 or 1920 × 1080.

## Try it

```sh
node serve.ts
# open http://localhost:8080
```

## Files

- `app/index.html`, `app/style.css`, `app/src/` — the app (vanilla JS + canvas, no libraries).
- `app/fonts/` — Anton and Archivo Black under the SIL Open Font License (`OFL.txt`).
- `app/samples/` — two sample photos made with an image model for make.fun, free to use.
- `screenshots/` — the entry's screenshots: the exported covers and the editor at work.
- `main.ts` — hands the entry in: copies `app/` and `screenshots/` to `/output` and writes `dossier.json`.

Original art only: no game logos, artwork, characters or fonts.
