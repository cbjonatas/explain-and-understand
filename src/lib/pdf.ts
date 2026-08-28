// Client-side PDF text extraction (runs in the browser only).
export type PdfExtraction = {
  pages: number;
  text: string;
};

/**
 * Safely converts a File or Blob to ArrayBuffer across all browser engines,
 * including WebKit / iOS Safari which may have quirks with direct stream/buffer access.
 */
async function fileToArrayBuffer(file: File | Blob): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === "function") {
    try {
      return await file.arrayBuffer();
    } catch {
      // Fall back to FileReader on any error
    }
  }

  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
      } else {
        reject(new Error("Não foi possível converter o arquivo para ArrayBuffer."));
      }
    };
    reader.onerror = () => {
      reject(reader.error || new Error("Erro ao ler o arquivo PDF."));
    };
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Extracts plain text from a single PDF page using standard synchronous text item arrays,
 * avoiding any ReadableStream methods or async iterators that break on WebKit/iOS.
 */
async function extractPageText(page: {
  getTextContent: (params?: Record<string, unknown>) => Promise<{ items: Array<{ str?: string }> }>;
}): Promise<string> {
  try {
    const textContent = await page.getTextContent({
      includeMarkedContent: false,
      disableNormalization: false,
    });

    if (!textContent || !Array.isArray(textContent.items)) {
      return "";
    }

    const parts: string[] = [];
    for (const item of textContent.items) {
      if (item && typeof item === "object" && "str" in item && typeof item.str === "string") {
        if (item.str.trim()) {
          parts.push(item.str);
        }
      }
    }

    return parts.join(" ").replace(/\s+/g, " ").trim();
  } catch (err) {
    console.warn("Erro ao extrair texto da página:", err);
    return "";
  }
}

/**
 * Main PDF text extractor.
 * Uses pdfjs-dist with ArrayBuffer and standard promise APIs.
 */
export async function extractPdfText(file: File): Promise<PdfExtraction> {
  // Import the legacy build for maximum browser compatibility (Safari/iOS, Chrome, Firefox, Edge)
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const worker = await import("pdfjs-dist/legacy/build/pdf.worker.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default || worker;

  // ArrayBuffer only — no stream APIs
  const buffer = await fileToArrayBuffer(file);
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    cMapPacked: true,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  });

  const doc = await loadingTask.promise;
  const chunks: string[] = [];

  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      try {
        const pageText = await extractPageText(page as never);
        if (pageText) {
          chunks.push(`[Página ${i}]\n${pageText}`);
        }
      } finally {
        page.cleanup?.();
      }
    }
  } finally {
    await doc.destroy();
  }

  const text = chunks.join("\n\n");
  const cleanText = text.replace(/\[Página \d+\]/g, "").trim();

  // If no text or too short, inform cleanly that it's likely a scanned image without selectable text
  if (cleanText.length < 40) {
    throw new Error(
      "Não foi possível extrair texto deste PDF: o arquivo parece ser uma imagem digitalizada (escaneada) ou não contém texto selecionável. Por favor, envie um PDF com texto selecionável.",
    );
  }

  return { pages: doc.numPages, text };
}
