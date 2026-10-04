import { extractText, getDocumentProxy } from "unpdf";

export const MAX_PDF_BYTES = 5_000_000;

/** Extracts the text layer of a PDF. Scanned PDFs without text return an empty string. */
export async function pdfToText(bytes: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { text } = await extractText(pdf, { mergePages: true });
  return text.trim();
}
