import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pdfToText } from '../src/mastra/lib/pdf';
import { isSupportedUpload } from '../src/mastra/lib/records';

test('PDF uploads are accepted and the follow-up report text is extracted', async () => {
  assert.equal(isSupportedUpload('Report.PDF'), true);
  assert.equal(isSupportedUpload('malware.exe'), false);
  const bytes = await readFile(new URL('../output/pdf/jordan-mercer-health-followup-2026-10-04.pdf', import.meta.url));
  const text = await pdfToText(new Uint8Array(bytes));
  assert.match(text, /Jordan Mercer/);
  assert.match(text, /2026-10-04/);
});
test('garbage bytes are rejected by the PDF reader', async () => {
  await assert.rejects(pdfToText(new TextEncoder().encode('not a pdf')));
});
