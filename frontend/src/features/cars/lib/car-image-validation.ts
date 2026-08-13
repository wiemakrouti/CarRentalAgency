// Mirrors the backend's own limits exactly (backend/src/middleware/upload.ts
// ALLOWED_MIME_TYPES/MAX_FILE_SIZE_BYTES) so a rejected file is caught here
// with a clear message instead of round-tripping to the server first. Single
// source of truth for every place in Cars that lets the admin pick an image
// (the image manager, this photo field) — never redefine these inline.
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

export function validateCarImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return 'Seules les images JPEG, PNG ou WEBP sont autorisées.';
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return 'Le fichier dépasse la taille maximale autorisée (5 Mo).';
  }
  return null;
}
