import { Request, Response } from 'express';
import multer from 'multer';
import { storageService } from '../services/storageService';

const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
  'image/gif':  'gif',
};

const ALLOWED_FOLDERS = new Set([
  'products',
  'categories',
  'subcategories',
  'packs',
  'banners',
  'blogs',
  'brand',
  'users',
  'general',
  'videos',
]);

const VIDEO_MIME: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};
const VIDEO_MAX = 30 * 1024 * 1024;

export const uploadVideo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: VIDEO_MAX },
  fileFilter: (_req, file, cb) => {
    if (VIDEO_MIME[file.mimetype]) return cb(null, true);
    cb(new Error('Unsupported video type. Allowed: MP4, WebM'));
  },
});

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME[file.mimetype]) return cb(null, true);
    cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed: JPEG, PNG, WebP, GIF`));
  },
});

export const uploadProductImage = async (req: Request, res: Response): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ success: false, error: 'No file uploaded' });
    return;
  }

  if (!storageService.configured) {
    res.status(503).json({ success: false, error: 'File storage is not configured on this server' });
    return;
  }

  if (req.file.size > MAX_SIZE) {
    res.status(400).json({ success: false, error: `Image too large. Maximum 5MB, received ${(req.file.size / 1024 / 1024).toFixed(1)}MB` });
    return;
  }

  const folder = typeof req.query.folder === 'string' ? req.query.folder : 'products';
  if (!ALLOWED_FOLDERS.has(folder)) {
    res.status(400).json({ success: false, error: `Invalid folder. Allowed: ${[...ALLOWED_FOLDERS].join(', ')}` });
    return;
  }

  try {
    const result = await storageService.upload(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      folder,
    );
    res.status(201).json({ success: true, data: { url: result.url, objectKey: result.objectKey } });
  } catch (err: any) {
    const msg = err?.message || 'Upload failed';
    const status = err?.name === 'NoSuchBucket' ? 503 : 500;
    res.status(status).json({ success: false, error: msg });
  }
};

export const uploadProductVideo = async (req: Request, res: Response): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ success: false, error: 'No file uploaded' });
    return;
  }
  if (!storageService.configured) {
    res.status(503).json({ success: false, error: 'File storage is not configured on this server' });
    return;
  }
  try {
    const result = await storageService.upload(req.file.buffer, req.file.originalname, req.file.mimetype, 'videos');
    res.status(201).json({ success: true, data: { url: result.url, objectKey: result.objectKey } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Upload failed' });
  }
};

export const getSignedUploadUrl = async (req: Request, res: Response): Promise<void> => {
  const { fileName, fileType, folder = 'products' } = req.query as Record<string, string>;

  if (!fileName || !fileType) {
    res.status(400).json({ success: false, error: 'fileName and fileType query params are required' });
    return;
  }

  if (!ALLOWED_MIME[fileType]) {
    res.status(400).json({ success: false, error: `Unsupported file type: ${fileType}. Allowed: ${Object.keys(ALLOWED_MIME).join(', ')}` });
    return;
  }

  if (!ALLOWED_FOLDERS.has(folder)) {
    res.status(400).json({ success: false, error: `Invalid folder. Allowed: ${[...ALLOWED_FOLDERS].join(', ')}` });
    return;
  }

  if (!storageService.configured) {
    res.status(503).json({ success: false, error: 'File storage is not configured on this server' });
    return;
  }

  try {
    const result = await storageService.getSignedUploadUrl(fileName, fileType, folder);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to generate upload URL' });
  }
};

export const deleteProductImage = async (req: Request, res: Response): Promise<void> => {
  const { objectKey, url } = req.body ?? {};
  const key =
    typeof objectKey === 'string' && objectKey
      ? objectKey
      : typeof url === 'string'
        ? storageService.keyFromUrl(url)
        : null;

  if (!key) {
    res.json({ success: true });
    return;
  }

  try {
    await storageService.delete(key);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Delete failed' });
  }
};
