import multer from 'multer';
import { AppError } from '../utils/app-error.js';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

// Shared config (size/type limits) for every single-image-upload endpoint —
// each caller picks its own multipart field name since it's part of that
// endpoint's own contract, not something worth forcing to match across
// unrelated modules (Cars vs Clients).
function createImageUpload(fieldName: string) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE_BYTES },
    fileFilter: (_req, file, callback) => {
      if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
        callback(new AppError(400, 'INVALID_FILE_TYPE', 'Seules les images JPEG, PNG ou WEBP sont autorisées.'));
        return;
      }
      callback(null, true);
    },
  }).single(fieldName);
}

export const uploadCarImage = createImageUpload('image');
export const uploadClientDocument = createImageUpload('document');
export const uploadPaymentAttachment = createImageUpload('attachment');
