// Client-side PDF text extraction (runs in the browser only).
export type PdfExtraction = {
  pages: number;
  text: string;
};

export async function extractPdfText(file: File): Promise<PdfExtraction> {
  // The legacy build ships the polyfills older Safari/iOS versions need.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const worker = await import("pdfjs-dist/legacy/build/pdf.worker.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;

  const chunks: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const items = Array.from(content?.items ?? []) as Array<{ str?: string }>;
    const pageText = items
      .map((item) => (typeof item?.str === "string" ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (pageText) chunks.push(`[Página ${i}]\n${pageText}`);
  }

  const text = chunks.join("\n\n");
  if (!text.trim()) {
    throw new Error(
      "Não foi possível ler texto neste PDF. Envie um arquivo com texto selecionável (não escaneado).",
    );
  }

  return { pages: doc.numPages, text };
}
