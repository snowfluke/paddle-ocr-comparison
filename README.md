# PaddleOCR SDK Comparison

Benchmark and compare the accuracy of two PaddleOCR JavaScript SDKs running in the browser:

- **@paddleocr/paddleocr-js** — the official PaddlePaddle browser SDK
- **ppu-paddle-ocr** — a lightweight, type-safe Bun/Node.js implementation

## Live Demo

Hosted on GitHub Pages: **[snowfluke.github.io/paddle-ocr-comparison](https://snowfluke.github.io/paddle-ocr-comparison)**

## Features

- **Speed benchmarking** — warm up models, then time predict calls
- **Accuracy measurement** — Levenshtein distance against ground truth text
- **Line-by-line diff** — visual comparison of predicted vs ground truth
- **Custom images** — drag & drop any image to compare
- **Autofill ground truth** — use ppu-paddle-ocr to auto-fill ground truth for new images
- **Benchmark mode** — run 5x or 10x predictions for average timing

## Deploy to GitHub Pages

```bash
bun run build:compare
git add -A
git commit -m "build: rebuild compare-client.js bundle"
git push
```

GitHub Pages serves `index.html`, `compare-client.js`, and `receipt.jpg` directly — no server needed.

## Development

```bash
bun install
bun run build:compare   # Build the client bundle
bun run serve:compare   # Local dev server at http://localhost:3000
```

## How It Works

The comparison page runs both OCR engines entirely in the browser using **ONNX Runtime Web (WASM)**. No Node.js server required during use.

| SDK | Backend | Input |
|---|---|---|
| @paddleocr/paddleocr-js | `PaddleOCR.create()` + `predict()` | `Blob` / `File` |
| ppu-paddle-ocr | `PaddleOcrService` + `recognize()` | `HTMLCanvasElement` |

Both SDKs are bundled into a single `compare-client.js` (~12 MB) that loads WASM assets from CDN on first run. Subsequent runs use browser cache.

## File Structure

```
├── index.html           # Comparison page (served by GitHub Pages)
├── compare-client.ts    # Source → built to compare-client.js
├── compare-client.js    # Bundled output (git-tracked for GitHub Pages)
├── build-compare.ts     # Bun build script (stubs @napi-rs/canvas for browser)
├── serve-compare.ts     # Local dev server
├── stubs/               # Browser polyfill stubs
├── receipt.jpg          # Default test image
├── receipt-ground-truth.txt
└── package.json
```