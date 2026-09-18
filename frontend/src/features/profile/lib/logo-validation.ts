// Mirrors the backend's multer config for this endpoint (see
// backend/src/middleware/upload.ts) — same convention as Cars'
// car-image-validation.ts: each upload surface keeps its own copy since the
// limits are part of that endpoint's own contract.
export const ALLOWED_LOGO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024;

export function validateLogoFile(file: File): string | null {
  if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
    return 'Seules les images JPEG, PNG ou WEBP sont autorisées.';
  }
  if (file.size > MAX_LOGO_SIZE_BYTES) {
    return 'Le logo ne doit pas dépasser 5 Mo.';
  }
  return null;
}
