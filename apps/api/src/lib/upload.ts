import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { existsSync, mkdirSync } from 'fs';
import { env } from '@/config/env';

const storagePath = path.join(env.storageRoot, 'uploads');

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};

/** Extensions that are never allowed, regardless of the declared MIME type. */
const DANGEROUS_EXTENSIONS = new Set([
  '.svg', '.html', '.htm', '.xhtml', '.js', '.mjs', '.json', '.xml', '.exe', '.dll', '.sh', '.bat', '.cmd', '.php', '.asp', '.jsp', '.cgi', '.pl',
]);

export const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const ALLOWED_DOCUMENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

/**
 * Validates an upload by MIME type, dangerous extension, and extension/MIME
 * mismatch. Returns an error message or null when the upload is safe.
 */
export function validateUpload(mimetype: string, originalname: string, allowedTypes: string[]): string | null {
  if (!allowedTypes.includes(mimetype)) {
    return 'File type is not allowed.';
  }
  const ext = path.extname(originalname).toLowerCase();
  if (DANGEROUS_EXTENSIONS.has(ext)) {
    return 'This file type is not allowed.';
  }
  const expected = MIME_EXTENSIONS[mimetype];
  if (expected && ext && ext !== expected) {
    return 'File extension does not match its type.';
  }
  return null;
}

/** Resolves the storage extension from the allowed MIME type. */
export function resolveUploadExtension(mimetype: string): string {
  return MIME_EXTENSIONS[mimetype] ?? '.bin';
}

function storage(directory: string) {
  return multer.diskStorage({
    destination(_req, _file, cb) {
      const dir = path.join(storagePath, directory);
      ensureDir(dir);
      cb(null, dir);
    },
    filename(_req, file, cb) {
      // Store with the extension derived from the validated MIME type, never the
      // original filename, so scripts/executables cannot be disguised as media.
      const ext = resolveUploadExtension(file.mimetype);
      cb(null, `${uuidv4()}${ext}`);
    },
  });
}

function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export const photoUpload = multer({
  storage: storage('photos'),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(_req, file, callback) {
    const error = validateUpload(file.mimetype, file.originalname, ALLOWED_PHOTO_TYPES);
    if (error) { callback(new Error(error)); return; }
    callback(null, true);
  },
});

export const documentUpload = multer({
  storage: storage('documents'),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(_req, file, callback) {
    const error = validateUpload(file.mimetype, file.originalname, ALLOWED_DOCUMENT_TYPES);
    if (error) { callback(new Error(error)); return; }
    callback(null, true);
  },
});
