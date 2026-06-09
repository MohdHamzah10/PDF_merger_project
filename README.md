# PDFit

A fast, privacy-first PDF toolkit that runs entirely in your browser — no uploads, no servers, no data ever leaves your device.

## Features

- **Merge** — combine multiple PDFs into one, drag to reorder before merging
- **Extract Pages** — pull specific pages out of a PDF using a range like `1-3, 5, 8-10`
- **Compress** — reduce file size with three quality presets (Screen, eBook, Printer)

## Tech Stack

- React 19 + Vite
- Tailwind CSS v4
- [pdf-lib](https://github.com/Hopding/pdf-lib) — PDF creation and manipulation
- [pdfjs-dist](https://github.com/mozilla/pdf.js) — PDF rendering (used for compression)
- [@dnd-kit](https://dndkit.com/) — drag-and-drop file reordering

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Build

```bash
npm run build
```

Output goes to the `dist/` folder, ready to deploy to any static host.
