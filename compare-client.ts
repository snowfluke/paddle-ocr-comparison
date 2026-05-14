// @ts-nocheck
import { PaddleOCR } from "@paddleocr/paddleocr-js";
import { PaddleOcrService } from "ppu-paddle-ocr/web";
import Tesseract from "tesseract.js";

const MODEL_BASE_URL =
  "https://media.githubusercontent.com/media/PT-Perkasa-Pilar-Utama/ppu-paddle-ocr-models/main";

const DEFAULT_GROUND_TRUTH = `ALFAMART ARTHA GADING N / 081294665105
PT.SUMBER ALFARIA TRIJAYA, TBK
ALFA TOWER LT.12, ALAM SUTERA, TANGERANG
NPWP : 01.336.238.9-054.000
KOMP. RUKO ARTHA GADING NIAGA KELAPA GAD
Bon JA19-789-17015H94 Kasir : MARDIYAN
MARLBORO LGT 20 1 44,900 44,900
Total Item 1 44,900
Tunai 44,900
Kembalian 0
PPN ( 0)
Tgl. 17-01-2024 15:31:44 V.2023.11.0
Kritik&Saran:1500959
SMS/WA: 081110640888`;

let currentBlob = null;
let currentCanvas = null;

function $(id) {
  return document.getElementById(id);
}

function show(el) {
  if (typeof el === "string") el = $(el);
  el.classList.remove("hidden");
}

function hide(el) {
  if (typeof el === "string") el = $(el);
  el.classList.add("hidden");
}

function setStatus(panel, status, text) {
  const badge = $(panel + "-status");
  badge.className = "status-badge status-" + status;
  badge.textContent = text;
}

function setGlobalStatus(text) {
  $("global-status").textContent = text;
}

function getGroundTruth() {
  return $("ground-truth").value;
}

function formatMs(ms) {
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(2)}s`;
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = new Uint32Array((m + 1) * (n + 1));
  const w = m + 1;
  for (let i = 0; i <= m; i++) dp[i] = i;
  for (let j = 1; j <= n; j++) dp[j * w] = j;
  for (let j = 1; j <= n; j++) {
    for (let i = 1; i <= m; i++) {
      if (a[i - 1] === b[j - 1]) {
        dp[j * w + i] = dp[(j - 1) * w + i - 1];
      } else {
        dp[j * w + i] = 1 + Math.min(
          dp[(j - 1) * w + i - 1],
          dp[(j - 1) * w + i],
          dp[j * w + i - 1],
        );
      }
    }
  }
  return dp[n * w + m];
}

function normalizeText(text) {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join("\n");
}

function charAccuracy(predicted, truth) {
  const p = normalizeText(predicted);
  const t = normalizeText(truth);
  const maxLen = Math.max(p.length, t.length);
  if (maxLen === 0) return 100;
  return ((1 - levenshtein(p, t) / maxLen) * 100);
}

function wordAccuracy(predicted, truth) {
  const pWords = normalizeText(predicted).toLowerCase().split(/\s+/);
  const tWords = normalizeText(truth).toLowerCase().split(/\s+/);
  const maxLen = Math.max(pWords.length, tWords.length);
  if (maxLen === 0) return 100;
  return ((1 - levenshtein(pWords.join(" "), tWords.join(" ")) / Math.max(pWords.join(" ").length, tWords.join(" ").length)) * 100);
}

function accuracyClass(acc) {
  if (acc >= 95) return "accuracy-high";
  if (acc >= 80) return "accuracy-mid";
  return "accuracy-low";
}

function renderDiff(predicted, truth) {
  const pLines = normalizeText(predicted).split("\n");
  const tLines = normalizeText(truth).split("\n");
  const maxLines = Math.max(pLines.length, tLines.length);
  let html = "";
  for (let i = 0; i < maxLines; i++) {
    const pLine = pLines[i] || "";
    const tLine = tLines[i] || "";
    if (pLine === tLine) {
      html += `<span class="diff-same">${escapeHtml(pLine)}</span>\n`;
    } else {
      html += `<span class="diff-remove">${escapeHtml(tLine)}</span>\n`;
      html += `<span class="diff-add">${escapeHtml(pLine)}</span>\n`;
    }
  }
  return html;
}

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function setButtonsDisabled(disabled) {
  $("run-btn").disabled = disabled;
  $("bench5-btn").disabled = disabled;
  $("bench10-btn").disabled = disabled;
  $("autofill-btn").disabled = disabled;
}

async function loadImageBlob() {
  if (currentBlob) return currentBlob;
  const img = $("receipt-img") as HTMLImageElement;
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  canvas.getContext("2d").drawImage(img, 0, 0);
  currentBlob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b), "image/jpeg"));
  return currentBlob;
}

async function getCanvas() {
  if (currentCanvas) return currentCanvas;
  currentCanvas = await blobToCanvas(await loadImageBlob());
  return currentCanvas;
}

async function blobToCanvas(blob) {
  const img = new Image();
  img.src = URL.createObjectURL(blob);
  await new Promise((r) => (img.onload = r));
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  canvas.getContext("2d").drawImage(img, 0, 0);
  URL.revokeObjectURL(img.src);
  return canvas;
}

async function getImageBitmap(blob) {
  return await createImageBitmap(blob);
}

async function runOfficial(blob) {
  const truth = getGroundTruth();
  const initStart = performance.now();
  const ocr = await PaddleOCR.create({
    lang: "en",
    ocrVersion: "PP-OCRv5",
    ortOptions: {
      backend: "wasm",
      wasmPaths: "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0/dist/",
    },
  });
  const initTime = performance.now() - initStart;

  const predictStart = performance.now();
  const [result] = await ocr.predict(blob);
  const predictTime = performance.now() - predictStart;

  await ocr.dispose();

  const text = result.items.map((i) => i.text).join("\n");
  const normalizedText = normalizeText(text);

  return {
    initTime,
    predictTime,
    detMs: result.metrics?.detMs ?? null,
    recMs: result.metrics?.recMs ?? null,
    totalMs: result.metrics?.totalMs ?? null,
    boxes: result.metrics?.detectedBoxes ?? result.items?.length ?? null,
    lines: result.items?.length ?? null,
    text: normalizedText,
    accuracy: charAccuracy(text, truth),
    wordAcc: wordAccuracy(text, truth),
  };
}

async function runPpu(canvas) {
  const truth = getGroundTruth();
  const initStart = performance.now();

  const service = new PaddleOcrService({
      model: {
          detection: `${MODEL_BASE_URL}/detection/PP-OCRv5_mobile_det_infer.ort`,
          recognition: `${MODEL_BASE_URL}/recognition/multi/en/v5/en_PP-OCRv5_mobile_rec_infer_int8.ort`
      }
  });
  await service.initialize();
  const initTime = performance.now() - initStart;

  const predictStart = performance.now();
  const result = await service.recognize(canvas, { noCache: true });
  const predictTime = performance.now() - predictStart;

  await service.destroy();

  const text = normalizeText(result.text);

  return {
    initTime,
    predictTime,
    detMs: null,
    recMs: null,
    totalMs: null,
    boxes: result.lines?.flat().length ?? null,
    lines: result.lines?.length ?? null,
    text,
    accuracy: charAccuracy(result.text, truth),
    wordAcc: wordAccuracy(result.text, truth),
  };
}

async function runTesseract(canvas) {
  const truth = getGroundTruth();
  const initStart = performance.now();
  const worker = await Tesseract.createWorker("eng");
  const initTime = performance.now() - initStart;

  const predictStart = performance.now();
  const result = await worker.recognize(canvas);
  const predictTime = performance.now() - predictStart;

  await worker.terminate();

  const text = result.data?.text ?? "";
  const normalizedText = normalizeText(text);
  const lines = result.data?.lines ?? [];
  const words = result.data?.words ?? [];

  return {
    initTime,
    predictTime,
    detMs: null,
    recMs: null,
    totalMs: null,
    boxes: words.length || null,
    lines: lines.length || normalizedText.split("\n").length,
    text: normalizedText,
    accuracy: charAccuracy(text, truth),
    wordAcc: wordAccuracy(text, truth),
  };
}

function renderPanel(prefix, r, truth) {
  show(prefix + "-metrics");
  $(prefix + "-init").textContent = formatMs(r.initTime);
  $(prefix + "-predict").textContent = formatMs(r.predictTime);
  $(prefix + "-det").textContent = r.detMs != null ? formatMs(r.detMs) : "—";
  $(prefix + "-rec").textContent = r.recMs != null ? formatMs(r.recMs) : "—";
  $(prefix + "-boxes").textContent = r.boxes ?? "—";
  $(prefix + "-lines").textContent = r.lines ?? "—";

  $(prefix + "-accuracy-badge").textContent = `${r.accuracy.toFixed(1)}% accuracy`;
  $(prefix + "-accuracy-badge").className = "accuracy-badge " + accuracyClass(r.accuracy);
  show(prefix + "-accuracy-badge");

  $(prefix + "-text").innerHTML = renderDiff(r.text, truth);
  show(prefix + "-result");
}

function displayResults(official, ppu, tesseract) {
  const truth = getGroundTruth();
  if (official) renderPanel("official", official, truth);
  if (ppu) renderPanel("ppu", ppu, truth);
  if (tesseract) renderPanel("tesseract", tesseract, truth);

  if (official && ppu && tesseract) {
    show("summary");
    const body = $("summary-body");
    body.innerHTML = "";

    const rows = [
      { label: "Init Time", values: [official.initTime, ppu.initTime, tesseract.initTime], unit: "ms", lower: true },
      { label: "Predict Time", values: [official.predictTime, ppu.predictTime, tesseract.predictTime], unit: "ms", lower: true },
      { label: "Char Accuracy", values: [official.accuracy, ppu.accuracy, tesseract.accuracy], unit: "%", lower: false },
      { label: "Word Accuracy", values: [official.wordAcc, ppu.wordAcc, tesseract.wordAcc], unit: "%", lower: false },
      { label: "Lines Detected", values: [official.lines, ppu.lines, tesseract.lines], unit: "", lower: null },
    ];

    for (const row of rows) {
      const tr = document.createElement("tr");
      const best = row.lower !== null
        ? (row.lower ? Math.min(...row.values) : Math.max(...row.values))
        : null;

      const fmt = (v) => row.unit === "ms" ? formatMs(v) : (row.unit === "%" ? v.toFixed(1) + "%" : String(v));
      const cell = (v) => `<td class="${best !== null && v === best ? "winner" : ""}">${fmt(v)}</td>`;

      tr.innerHTML = `<td>${row.label}</td>${cell(row.values[0])}${cell(row.values[1])}${cell(row.values[2])}`;
      body.appendChild(tr);
    }
  }
}

async function runComparison() {
  setButtonsDisabled(true);
  setGlobalStatus("Loading image...");
  setStatus("official", "running", "Loading...");
  setStatus("ppu", "running", "Loading...");
  setStatus("tesseract", "running", "Loading...");

  const blob = await loadImageBlob();
  const canvas = await getCanvas();

  let officialResult = null;
  let ppuResult = null;
  let tesseractResult = null;

  setGlobalStatus("Warming up @paddleocr/paddleocr-js...");
  setStatus("official", "running", "Warming up...");
  try {
    const ocr = await PaddleOCR.create({
      lang: "en",
      ocrVersion: "PP-OCRv5",
      ortOptions: {
        backend: "wasm",
        wasmPaths: "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0/dist/",
      },
    });
    await ocr.predict(blob);
    await ocr.dispose();
    setStatus("official", "ready", "Warmed up");
  } catch (e) {
    console.error("Official warmup error:", e);
  }

  setGlobalStatus("Warming up ppu-paddle-ocr...");
  setStatus("ppu", "running", "Warming up...");
  try {
    const service = new PaddleOcrService({
      model: {
        detection: `${MODEL_BASE_URL}/detection/PP-OCRv5_mobile_det_infer.ort`,
        recognition: `${MODEL_BASE_URL}/recognition/multi/en/v5/en_PP-OCRv5_mobile_rec_infer_int8.ort`
      }
    });
    await service.initialize();
    await service.recognize(canvas, { noCache: true });
    await service.destroy();
    setStatus("ppu", "ready", "Warmed up");
  } catch (e) {
    console.error("PPU warmup error:", e);
  }

  setGlobalStatus("Warming up tesseract.js...");
  setStatus("tesseract", "running", "Warming up...");
  try {
    const worker = await Tesseract.createWorker("eng");
    await worker.recognize(canvas);
    await worker.terminate();
    setStatus("tesseract", "ready", "Warmed up");
  } catch (e) {
    console.error("Tesseract warmup error:", e);
  }

  setGlobalStatus("Running @paddleocr/paddleocr-js...");
  setStatus("official", "running", "Running...");
  try {
    officialResult = await runOfficial(blob);
    setStatus("official", "done", "Done");
  } catch (e) {
    console.error("Official OCR error:", e);
    setStatus("official", "error", "Error: " + e.message);
  }

  setGlobalStatus("Running ppu-paddle-ocr...");
  setStatus("ppu", "running", "Running...");
  try {
    ppuResult = await runPpu(canvas);
    setStatus("ppu", "done", "Done");
  } catch (e) {
    console.error("PPU OCR error:", e);
    setStatus("ppu", "error", "Error: " + e.message);
  }

  setGlobalStatus("Running tesseract.js...");
  setStatus("tesseract", "running", "Running...");
  try {
    tesseractResult = await runTesseract(canvas);
    setStatus("tesseract", "done", "Done");
  } catch (e) {
    console.error("Tesseract OCR error:", e);
    setStatus("tesseract", "error", "Error: " + e.message);
  }

  setGlobalStatus("");
  displayResults(officialResult, ppuResult, tesseractResult);
  setButtonsDisabled(false);
}

async function runBenchmark(runs) {
  setButtonsDisabled(true);
  setGlobalStatus("Loading image...");
  setStatus("official", "running", "Benchmarking...");
  setStatus("ppu", "running", "Benchmarking...");
  setStatus("tesseract", "running", "Benchmarking...");

  const blob = await loadImageBlob();
  const canvas = await getCanvas();

  const officialTimes = [];
  const ppuTimes = [];
  const tesseractTimes = [];

  let ocr = null;
  let service = null;
  let worker = null;

  setGlobalStatus("Initializing & warming up @paddleocr/paddleocr-js...");
  try {
    ocr = await PaddleOCR.create({
      lang: "en",
      ocrVersion: "PP-OCRv5",
      ortOptions: {
        backend: "wasm",
        wasmPaths: "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0/dist/",
      },
    });
    await ocr.predict(blob);
  } catch (e) {
    console.error("Official init/warmup error:", e);
    setStatus("official", "error", "Init Error");
    setGlobalStatus("");
    setButtonsDisabled(false);
    return;
  }

  for (let i = 0; i < runs; i++) {
    setGlobalStatus(`@paddleocr/paddleocr-js run ${i + 1}/${runs}...`);
    const start = performance.now();
    try {
      await ocr.predict(blob);
      officialTimes.push(performance.now() - start);
    } catch (e) {
      console.error("Official predict error:", e);
    }
  }
  try { await ocr.dispose(); } catch {}

  setGlobalStatus("Initializing & warming up ppu-paddle-ocr...");
  try {
    service = new PaddleOcrService({
      model: {
        detection: `${MODEL_BASE_URL}/detection/PP-OCRv5_mobile_det_infer.ort`,
        recognition: `${MODEL_BASE_URL}/recognition/multi/en/v5/en_PP-OCRv5_mobile_rec_infer_int8.ort`
      }
    });
    await service.initialize();
    await service.recognize(canvas, { noCache: true });
  } catch (e) {
    console.error("PPU init/warmup error:", e);
    setStatus("ppu", "error", "Init Error");
    setGlobalStatus("");
    setButtonsDisabled(false);
    return;
  }

  for (let i = 0; i < runs; i++) {
    setGlobalStatus(`ppu-paddle-ocr run ${i + 1}/${runs}...`);
    const start = performance.now();
    try {
      await service.recognize(canvas, { noCache: true });
      ppuTimes.push(performance.now() - start);
    } catch (e) {
      console.error("PPU predict error:", e);
    }
  }
  try { await service.destroy(); } catch {}

  setGlobalStatus("Initializing & warming up tesseract.js...");
  try {
    worker = await Tesseract.createWorker("eng");
    await worker.recognize(canvas);
  } catch (e) {
    console.error("Tesseract init/warmup error:", e);
    setStatus("tesseract", "error", "Init Error");
    setGlobalStatus("");
    setButtonsDisabled(false);
    return;
  }

  for (let i = 0; i < runs; i++) {
    setGlobalStatus(`tesseract.js run ${i + 1}/${runs}...`);
    const start = performance.now();
    try {
      await worker.recognize(canvas);
      tesseractTimes.push(performance.now() - start);
    } catch (e) {
      console.error("Tesseract predict error:", e);
    }
  }
  try { await worker.terminate(); } catch {}

  setStatus("official", "done", "Done");
  setStatus("ppu", "done", "Done");
  setStatus("tesseract", "done", "Done");
  setGlobalStatus("");

  const avg = (arr) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const offAvg = avg(officialTimes);
  const ppuAvg = avg(ppuTimes);
  const tesAvg = avg(tesseractTimes);
  const offMin = officialTimes.length > 0 ? Math.min(...officialTimes) : 0;
  const offMax = officialTimes.length > 0 ? Math.max(...officialTimes) : 0;
  const ppuMin = ppuTimes.length > 0 ? Math.min(...ppuTimes) : 0;
  const ppuMax = ppuTimes.length > 0 ? Math.max(...ppuTimes) : 0;
  const tesMin = tesseractTimes.length > 0 ? Math.min(...tesseractTimes) : 0;
  const tesMax = tesseractTimes.length > 0 ? Math.max(...tesseractTimes) : 0;

  show("benchmark-section");
  const body = $("benchmark-body");
  body.innerHTML = "";

  for (let i = 0; i < runs; i++) {
    const tr = document.createElement("tr");
    const o = officialTimes[i];
    const p = ppuTimes[i];
    const t = tesseractTimes[i];
    const fmt = (v) => v != null ? formatMs(v) : "—";
    const vals = [o, p, t].filter((v) => v != null);
    const winner = vals.length > 0 ? Math.min(...vals) : null;
    const cls = (v) => v != null && v === winner ? "winner" : "";
    tr.innerHTML = `<td>${i + 1}</td><td class="${cls(o)}">${fmt(o)}</td><td class="${cls(p)}">${fmt(p)}</td><td class="${cls(t)}">${fmt(t)}</td>`;
    body.appendChild(tr);
  }

  const sumRow = document.createElement("tr");
  sumRow.innerHTML = `<td><strong>Avg</strong></td><td><strong>${formatMs(offAvg)}</strong> (min ${formatMs(offMin)}, max ${formatMs(offMax)})</td><td><strong>${formatMs(ppuAvg)}</strong> (min ${formatMs(ppuMin)}, max ${formatMs(ppuMax)})</td><td><strong>${formatMs(tesAvg)}</strong> (min ${formatMs(tesMin)}, max ${formatMs(tesMax)})</td>`;
  body.appendChild(sumRow);

  setButtonsDisabled(false);
}

async function autofillGroundTruth() {
  const btn = $("autofill-btn");
  const status = $("autofill-status");
  btn.disabled = true;
  status.textContent = "Running ppu-paddle-ocr...";

  try {
    const canvas = await getCanvas();
    const service = new PaddleOcrService();
    await service.initialize();
    status.textContent = "Recognizing...";
    const result = await service.recognize(canvas, { noCache: true });
    await service.destroy();

    const text = normalizeText(result.text);
    $("ground-truth").value = text;
    status.textContent = `Done (${result.lines?.length ?? 0} lines)`;
  } catch (e) {
    console.error("Autofill error:", e);
    status.textContent = "Error: " + e.message;
  }

  btn.disabled = false;
}

function setupImageUpload() {
  const fileInput = $("file-input");
  const dropZone = $("drop-zone");
  const dropText = $("drop-text");
  const img = $("receipt-img");

  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    await setImageFile(file);
  });

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover");
  });

  dropZone.addEventListener("drop", async (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      await setImageFile(file);
    }
  });

  async function setImageFile(file) {
    currentBlob = null;
    currentCanvas = null;

    const blob = file;
    currentBlob = blob;

    const url = URL.createObjectURL(blob);
    img.src = url;
    dropText.innerHTML = `<strong>${escapeHtml(file.name)}</strong> (${(file.size / 1024).toFixed(1)} KB) &mdash; drop or click to change`;

    const canvasEl = document.createElement("canvas");
    const imgEl = new Image();
    imgEl.src = url;
    await new Promise((r) => { imgEl.onload = r; });
    canvasEl.width = imgEl.naturalWidth || imgEl.width;
    canvasEl.height = imgEl.naturalHeight || imgEl.height;
    canvasEl.getContext("2d").drawImage(imgEl, 0, 0);
    currentCanvas = canvasEl;

    $("autofill-status").textContent = "";
  }
}

async function initModels() {
  const btn = $("init-btn");
  btn.disabled = true;

  setGlobalStatus("Downloading & initializing @paddleocr/paddleocr-js...");
  try {
    const ocr = await PaddleOCR.create({
      lang: "en",
      ocrVersion: "PP-OCRv5",
      ortOptions: {
        backend: "wasm",
        wasmPaths: "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0/dist/",
      },
    });
    await ocr.dispose();
  } catch (e) {
    console.error("Official init error:", e);
  }

  setGlobalStatus("Downloading & initializing ppu-paddle-ocr...");
  try {
    const service = new PaddleOcrService({
      model: {
        detection: `${MODEL_BASE_URL}/detection/PP-OCRv5_mobile_det_infer.ort`,
        recognition: `${MODEL_BASE_URL}/recognition/multi/en/v5/en_PP-OCRv5_mobile_rec_infer_int8.ort`
      }
    });
    await service.initialize();
    await service.destroy();
  } catch (e) {
    console.error("PPU init error:", e);
  }

  setGlobalStatus("Downloading & initializing tesseract.js...");
  try {
    const worker = await Tesseract.createWorker("eng");
    await worker.terminate();
  } catch (e) {
    console.error("Tesseract init error:", e);
  }

  setGlobalStatus("Ready");
  btn.textContent = "✓ Models Ready";
  setButtonsDisabled(false);
}

$("init-btn").addEventListener("click", () => initModels());
$("autofill-btn").addEventListener("click", () => autofillGroundTruth());
$("reset-gt-btn").addEventListener("click", () => {
  $("ground-truth").value = DEFAULT_GROUND_TRUTH;
  $("autofill-status").textContent = "Reset to default";
});
$("run-btn").addEventListener("click", () => runComparison());
$("bench5-btn").addEventListener("click", () => runBenchmark(5));
$("bench10-btn").addEventListener("click", () => runBenchmark(10));

setupImageUpload();
