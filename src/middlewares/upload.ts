import multer from 'multer';
import { BadRequestError } from '../utils/errors';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.mimetype)) {
      cb(new BadRequestError('Only JPEG, PNG, WEBP, and PDF files are allowed'));
      return;
    }
    cb(null, true);
  },
});

export const uploadSingle = upload.single('file');
