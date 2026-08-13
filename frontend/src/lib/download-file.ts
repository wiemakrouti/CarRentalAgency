// Triggers a browser "Save As" for an already-fetched blob — the
// createObjectURL + synthetic <a click> dance is the only reliable
// cross-browser way to do this without navigating away from the SPA.
export function saveBlobAsFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
