// Smart image preprocessor:
// - Validates type & size
// - Reads EXIF-aware via createImageBitmap
// - Downscales to max 1600px on the longest side
// - Re-encodes as JPEG (or keeps PNG/PDF as-is)
// - Returns a new File ready for upload + a data URL preview

export type PreparedFile = {
  file: File;
  preview: string;
  width?: number;
  height?: number;
  originalSize: number;
  finalSize: number;
};

const MAX_BYTES_INPUT = 15 * 1024 * 1024; // 15 MB raw input allowed
const MAX_DIM = 1600;
const TARGET_QUALITY = 0.82;

export const ALLOWED_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
];

export async function prepareUpload(file: File): Promise<PreparedFile> {
  if (!ALLOWED_TYPES.includes(file.type) && !file.type.startsWith("image/")) {
    throw new Error("invalid_file_type");
  }
  if (file.size > MAX_BYTES_INPUT) {
    throw new Error("file_too_large");
  }

  // PDFs and HEIC/HEIF: pass-through (browsers can't reliably decode HEIC to canvas)
  if (file.type === "application/pdf" || file.type === "image/heic" || file.type === "image/heif") {
    return {
      file,
      preview: file.type === "application/pdf" ? "" : URL.createObjectURL(file),
      originalSize: file.size,
      finalSize: file.size,
    };
  }

  // Decode → resize → re-encode
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) {
    // Fallback: just return original
    return {
      file,
      preview: URL.createObjectURL(file),
      originalSize: file.size,
      finalSize: file.size,
    };
  }

  const { width, height } = bitmap;
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

  const baseName = file.name.replace(/\.[^.]+$/, "");
  const compressed = new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
  const preview = canvas.toDataURL("image/jpeg", 0.6);

  return {
    file: compressed,
    preview,
    width: w,
    height: h,
    originalSize: file.size,
    finalSize: compressed.size,
  };
}

export const formatBytes = (n: number) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
};
