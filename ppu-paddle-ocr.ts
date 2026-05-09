import { PaddleOcrService } from "ppu-paddle-ocr";

const service = new PaddleOcrService();
await service.initialize();

const imagePath = `${import.meta.dir}/receipt.jpg`;
const imgFile = Bun.file(imagePath);
const fileBuffer = await imgFile.arrayBuffer();

const result = await service.recognize(fileBuffer);
service.destroy();
