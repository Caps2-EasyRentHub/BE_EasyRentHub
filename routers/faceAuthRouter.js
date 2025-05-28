import express from 'express';
import faceAuthController from '../controllers/faceAuthCtrl.js';
import multer from 'multer';
import auth from '../middleware/auth.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/validate', auth, upload.single('image'), faceAuthController.validateFaceImage);

router.post('/register', auth, upload.single('image'), faceAuthController.registerFace);

router.post('/verify', auth, upload.single('image'), faceAuthController.verifyFace);

// Test Face Recognition
router.post('/threshold', auth, faceAuthController.updateThreshold);
router.post('/compare', auth, upload.fields([
    { name: 'source', maxCount: 1 },
    { name: 'target', maxCount: 1 }
]), faceAuthController.compareFaces);

router.get('/registration-status', auth, faceAuthController.checkFaceRegistration);

export default router; 