import { PaddleOcrService } from "ppu-paddle-ocr";

const MODEL_BASE_URL =
  "https://media.githubusercontent.com/media/PT-Perkasa-Pilar-Utama/ppu-paddle-ocr-models/main";

const service = new PaddleOcrService({
    model: {
        recognition: `${MODEL_BASE_URL}/recognition/multi/en/v5/en_PP-OCRv5_mobile_rec_infer_int8.onnx`
    }
});
await service.initialize();

const imagePath = `${import.meta.dir}/receipt.jpg`;
const imgFile = Bun.file(imagePath);
const fileBuffer = await imgFile.arrayBuffer();

const result = await service.recognize(fileBuffer);
service.destroy();
