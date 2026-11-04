import express from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import { upload, uploadVideo, uploadProductImage, uploadProductVideo, deleteProductImage, getSignedUploadUrl } from '../controllers/uploadController';

const router = express.Router();
const staffOrAdmin = requireRole(['admin', 'user']);

// GET /api/upload/signed-url?fileName=x.jpg&fileType=image/jpeg&folder=products
// Returns { uploadUrl, objectKey, publicUrl } — client PUTs file directly to R2
router.get('/signed-url', authMiddleware, staffOrAdmin, getSignedUploadUrl);

// POST /api/upload/image — legacy direct multipart upload (kept for backward compat)
router.post('/image', authMiddleware, staffOrAdmin, upload.single('image'), uploadProductImage);
router.post('/video', authMiddleware, staffOrAdmin, uploadVideo.single('video'), uploadProductVideo);

// DELETE /api/upload/image — delete by objectKey
router.delete('/image', authMiddleware, staffOrAdmin, deleteProductImage);

export default router;
