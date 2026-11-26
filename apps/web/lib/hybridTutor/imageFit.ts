export function fittedSize(width: number, height: number, maxEdge = 1280) {
  const longest = Math.max(width, height, 1);
  const scale = Math.min(1, maxEdge / longest);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale,
  };
}

/** Shrink a question photo before it is sent, so a camera shot does not burn mobile data. */
export async function compressImageFile(file: File, maxEdge = 1280, quality = 0.72): Promise<File> {
  if (!file.type.startsWith("image/") || typeof createImageBitmap !== "function") return file;
  const bitmap = await createImageBitmap(file);
  const size = fittedSize(bitmap.width, bitmap.height, maxEdge);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) return file;
  context.drawImage(bitmap, 0, 0, size.width, size.height);
  bitmap.close?.();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob || blob.size >= file.size) return file;
  return new File([blob], "question.jpg", { type: "image/jpeg" });
}
