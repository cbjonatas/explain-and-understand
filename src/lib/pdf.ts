// Client-side PDF text extraction (runs in the browser only).
export type PdfExtraction = {
  pages: number;
  text: string;
};

export async function extractPdfText(file: File): Promise<PdfExtraction> {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;

  const chunks: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (pageText) chunks.push(`[Página ${i}]\n${pageText}`);
  }

  return { pages: doc.numPages, text: chunks.join("\n\n") };
}
