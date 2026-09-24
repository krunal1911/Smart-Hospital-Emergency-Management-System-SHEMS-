import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Store accident photos under backend/uploads/emergency-cases, served
// statically by server.js at /uploads/emergency-cases/<file>.
const uploadDir = path.join(__dirname, '..', 'uploads', 'emergency-cases');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `case-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, or WEBP images are allowed for accident photos.'), false);
  }
};

export const uploadAccidentPhotos = multer({
  storage,
  fileFilter,
  limits: { fileSize: 8 * 1024 * 1024, files: 5 }, // 8MB per file, max 5 photos
});

export default uploadAccidentPhotos;
