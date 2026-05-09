
import { PaddleOCR } from "@paddleocr/paddleocr-js";

const imagePath = `${import.meta.dir}/receipt.jpg`;
const imgFile = Bun.file(imagePath);
const fileBuffer = await imgFile.arrayBuffer();


const ocr = await PaddleOCR.create({
  lang: "ch",
  ocrVersion: "PP-OCRv5",
  ortOptions: {
    backend: "auto"
  }
});

const [result] = await ocr.predict(fileBuffer);
console.log(result);