// Mirrors the backend's own limits exactly (backend/src/middleware/upload.ts
// ALLOWED_MIME_TYPES/MAX_FILE_SIZE_BYTES) so a rejected file is caught here
// with a clear message instead of round-tripping to the server first. Single
// source of truth for every place in Clients that lets the admin pick a
// document (the document manager, the queued picker on the add-client form)
// — never redefine these inline.
export const ALLOWED_DOCUMENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_DOCUMENT_SIZE_BYTES = 5 * 1024 * 1024;

export function validateClientDocumentFile(file: File): string | null {
  if (!ALLOWED_DOCUMENT_TYPES.includes(file.type)) {
    return 'Seules les images JPEG, PNG ou WEBP sont autorisées.';
  }
  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    return 'Le fichier dépasse la taille maximale autorisée (5 Mo).';
  }
  return null;
}
