import { describe, it, expect } from 'vitest';
import { validateUpload, resolveUploadExtension, ALLOWED_PHOTO_TYPES, ALLOWED_DOCUMENT_TYPES } from '@/lib/upload';

describe('File upload security', () => {
  it('allows allowed image types', () => {
    expect(validateUpload('image/png', 'photo.png', ALLOWED_PHOTO_TYPES)).toBeNull();
    expect(validateUpload('image/jpeg', 'photo.jpg', ALLOWED_PHOTO_TYPES)).toBeNull();
    expect(validateUpload('image/webp', 'photo.webp', ALLOWED_PHOTO_TYPES)).toBeNull();
  });

  it('rejects disallowed MIME types', () => {
    expect(validateUpload('application/x-msdownload', 'app.exe', ALLOWED_PHOTO_TYPES)).toBe('File type is not allowed.');
    expect(validateUpload('text/html', 'page.html', ALLOWED_DOCUMENT_TYPES)).toBe('File type is not allowed.');
  });

  it('rejects dangerous extensions even with a spoofed MIME type', () => {
    expect(validateUpload('image/png', 'virus.svg', ALLOWED_PHOTO_TYPES)).toBe('This file type is not allowed.');
    expect(validateUpload('image/png', 'script.html', ALLOWED_PHOTO_TYPES)).toBe('This file type is not allowed.');
    expect(validateUpload('application/pdf', 'malware.exe', ALLOWED_DOCUMENT_TYPES)).toBe('This file type is not allowed.');
  });

  it('rejects extension/MIME mismatch', () => {
    expect(validateUpload('image/png', 'photo.pdf', ALLOWED_PHOTO_TYPES)).toBe('File extension does not match its type.');
  });

  it('resolves storage extensions from the MIME type', () => {
    expect(resolveUploadExtension('image/png')).toBe('.png');
    expect(resolveUploadExtension('application/pdf')).toBe('.pdf');
  });

  it('rejects SVG with embedded JS via its extension', () => {
    expect(validateUpload('image/svg+xml', 'icon.svg', ALLOWED_PHOTO_TYPES)).toBe('File type is not allowed.');
  });
});
