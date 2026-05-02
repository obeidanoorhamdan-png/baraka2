// Smart image preprocessor:
// - Magic-byte sniffing (don't trust file.type / extension alone)
// - Dimension/size limits
// - Downscales to max 1600px on the longest side
// - Re-encodes as JPEG (with progressive fallback)
// - Returns a new File ready for upload + a data URL preview

export type PreparedFile = {
  file: File;
  preview: string;
  width?: number;
  height?: number;
  originalSize: number;
  finalSize: number;
  detectedType: string;
};

const MAX_BYTES_INPUT = 15 * 1024 * 1024; // 15 MB raw input allowed
const MAX_DIM = 1600;
const MAX_PIXELS = 32_000_000; // ~32 MP guard against decompression bombs
const TARGET_QUALITY = 0.82;

export const ALLOWED_MAGIC = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];

// Sniff first bytes to confirm a real file (defends against renamed extensions)
async function sniffType(file: File): Promise<string> {
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const hex = (n: number) => head[n]?.toString(16).padStart(2, "0");

  // PDF: %PDF
  if (head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46) return "application/pdf";
  // JPEG: FF D8 FF
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "image/jpeg";
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return "image/png";
  // GIF: GIF87a / GIF89a
  if (head[0] === 0x47 && head[1] === 0x49 && head[2] === 0x46) return "image/gif";
  // WEBP: RIFF....WEBP
  if (head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46
      && head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50) return "image/webp";
  // HEIC/HEIF box "ftyp" at offset 4
  if (head[4] === 0x66 && head[5] === 0x74 && head[6] === 0x79 && head[7] === 0x70) return "image/heic";

  return `unknown/${hex(0)}${hex(1)}${hex(2)}${hex(3)}`;
}

export async function prepareUpload(file: File): Promise<PreparedFile> {
  if (file.size > MAX_BYTES_INPUT) throw new Error("file_too_large");

  const detected = await sniffType(file);
  if (!ALLOWED_MAGIC.includes(detected) && detected !== "image/heic") {
    throw new Error("invalid_file_type");
  }

  // PDFs and HEIC/HEIF: pass-through (browsers can't reliably decode HEIC to canvas)
  if (detected === "application/pdf" || detected === "image/heic") {
    return {
      file,
      preview: detected === "application/pdf" ? "" : URL.createObjectURL(file),
      originalSize: file.size,
      finalSize: file.size,
      detectedType: detected,
    };
  }

  // Decode → resize → re-encode
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) {
    return {
      file,
      preview: URL.createObjectURL(file),
      originalSize: file.size,
      finalSize: file.size,
      detectedType: detected,
    };
  }

  const { width, height } = bitmap;
  if (width * height > MAX_PIXELS) {
    bitmap.close();
    throw new Error("image_too_large_dimensions");
  }

  const longest = Math.max(width, height);
  const scale = longest > MAX_DIM ? MAX_DIM / longest : 1;
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("encode_failed"))),
      "image/jpeg",
      TARGET_QUALITY,
    ),
  );

  const baseName = file.name.replace(/\.[^.]+$/, "").replace(/[^\w\u0600-\u06FF\-]+/g, "_").slice(0, 40) || "image";
  const compressed = new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
  const preview = canvas.toDataURL("image/jpeg", 0.6);

  return {
    file: compressed,
    preview,
    width: w,
    height: h,
    originalSize: file.size,
    finalSize: compressed.size,
    detectedType: detected,
  };
}

export const formatBytes = (n: number) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
};
