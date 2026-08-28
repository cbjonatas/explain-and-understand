// Client-side PDF text extraction (runs in the browser only).
export type PdfExtraction = {
  pages: number;
  text: string;
};

type TextItem = { str?: string };
type TextChunk = { items?: TextItem[] };

// Safari/iOS does not implement async iteration over ReadableStream, which is
// what pdf.js `getTextContent()` uses internally. We read the stream manually
// with a reader instead, which works in every browser.
async function readPageText(page: {
  streamTextContent: (params?: Record<string, unknown>) => ReadableStream<TextChunk>;
}): Promise<string> {
  const stream = page.streamTextContent({ disableNormalization: false });
  const reader = stream.getReader();
  const parts: string[] = [];

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      for (const item of value?.items ?? []) {
        if (typeof item?.str === "string") parts.push(item.str);
      }
    }
  } finally {
    reader.releaseLock?.();
  }

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

export async function extractPdfText(file: File): Promise<PdfExtraction> {
  // The legacy build ships the polyfills older Safari/iOS versions need.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const worker = await import("pdfjs-dist/legacy/build/pdf.worker.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  // ArrayBuffer only — no stream/blob APIs that differ across browsers.
  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;

  const chunks: string[] = [];
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const pageText = await readPageText(page as never);
      if (pageText) chunks.push(`[Página ${i}]\n${pageText}`);
      page.cleanup();
    }
  } finally {
    await doc.destroy();
  }

  const text = chunks.join("\n\n");
  if (text.replace(/\[Página \d+\]/g, "").trim().length < 40) {
    throw new Error(
      "Não foi possível extrair texto deste PDF: ele parece ser digitalizado (imagem). Envie um PDF com texto selecionável.",
    );
  }

  return { pages: doc.numPages, text };
}
