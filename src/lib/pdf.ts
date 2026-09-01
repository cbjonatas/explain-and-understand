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
      const buffer = await file.arrayBuffer();
      if (buffer && buffer.byteLength > 0) {
        return buffer;
      }
    } catch {
      // Fall back to FileReader on any engine error
    }
  }

  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
      } else {
        reject(new Error("Não foi possível converter o arquivo para buffer de memória."));
      }
    };
    reader.onerror = () => {
      reject(reader.error || new Error("Erro ao ler o arquivo PDF."));
    };
    reader.readAsArrayBuffer(file);
  });
}

type TextItem = { str?: string };

function joinItems(items: unknown): string[] {
  const parts: string[] = [];
  if (!items) return parts;
  const list = Array.isArray(items) ? (items as TextItem[]) : [];
  for (const item of list) {
    if (item && typeof item === "object" && typeof item.str === "string" && item.str.trim()) {
      parts.push(item.str);
    }
  }
  return parts;
}

/**
 * iOS/WebKit does not implement async iteration over ReadableStream
 * (`for await (const x of stream)`), which is exactly what pdf.js
 * `getTextContent()` uses internally — it throws
 * "undefined is not a function (near '...value of readableStream...')" and the
 * page ends up with no text. Reading the same stream with an explicit reader
 * works on every engine, so we do that first and only fall back to
 * `getTextContent()` when the streaming API is unavailable.
 */
async function extractPageText(page: any): Promise<string> {
  if (typeof page?.streamTextContent === "function") {
    const stream = page.streamTextContent({
      includeMarkedContent: false,
      disableNormalization: false,
    });
    const reader = stream?.getReader?.();
    if (reader) {
      const parts: string[] = [];
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          parts.push(...joinItems(value?.items));
        }
      } finally {
        try {
          reader.releaseLock?.();
        } catch {
          // ignore
        }
      }
      return parts.join(" ").replace(/\s+/g, " ").trim();
    }
  }

  const textContent = await page.getTextContent({
    includeMarkedContent: false,
    disableNormalization: false,
  });
  return joinItems(textContent?.items).join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Main PDF text extractor.
 * Uses pdfjs-dist with ArrayBuffer, Uint8Array and standard promise APIs.
 */
export async function extractPdfText(file: File): Promise<PdfExtraction> {
  // Import the legacy build for maximum browser compatibility (Safari/iOS, Chrome, Firefox, Edge)
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  try {
    const worker = await import("pdfjs-dist/legacy/build/pdf.worker.mjs?url");
    if (worker?.default) {
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    }
  } catch {
    // Safe fallback if worker resolution is handled internally
  }

  // Convert to ArrayBuffer -> Uint8Array
  const buffer = await fileToArrayBuffer(file);
  const uint8Data = new Uint8Array(buffer);

  if (uint8Data.byteLength === 0) {
    throw new Error("O arquivo PDF selecionado está vazio.");
  }

  // Load document safely via PDFDocumentLoadingTask
  const loadingTask = pdfjs.getDocument({
    data: uint8Data,
    cMapPacked: true,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  });

  let doc: any = null;
  const chunks: string[] = [];

  try {
    doc = await loadingTask.promise;
    const numPages = Number(doc?.numPages) || 0;

    if (numPages === 0) {
      throw new Error("O documento PDF não contém páginas válidas.");
    }

    for (let i = 1; i <= numPages; i++) {
      let page: any = null;
      try {
        page = await doc.getPage(i);
        const pageText = await extractPageText(page);
        if (pageText) {
          chunks.push(`[Página ${i}]\n${pageText}`);
        }
      } catch (pageError) {
        console.warn(`Aviso ao ler a página ${i}:`, pageError);
      } finally {
        if (page && typeof page.cleanup === "function") {
          try {
            page.cleanup();
          } catch {
            // Safe ignore
          }
        }
      }
    }
  } finally {
    // Safe cleanup without calling non-existent .destroy() on doc proxy
    if (doc && typeof doc.cleanup === "function") {
      try {
        doc.cleanup();
      } catch {
        // Safe ignore
      }
    }
    if (loadingTask && typeof loadingTask.destroy === "function") {
      try {
        await loadingTask.destroy();
      } catch {
        // Safe ignore
      }
    }
  }

  const text = chunks.join("\n\n");
  const cleanText = text.replace(/\[Página \d+\]/g, "").trim();

  // If no text or too short, inform cleanly that it's likely a scanned image without selectable text
  if (cleanText.length < 40) {
    throw new Error(
      "Não foi possível extrair texto deste PDF: o arquivo parece ser uma imagem digitalizada (escaneada) ou não contém texto selecionável. Por favor, envie um PDF com texto selecionável.",
    );
  }

  return { pages: doc?.numPages ?? chunks.length, text };
}
