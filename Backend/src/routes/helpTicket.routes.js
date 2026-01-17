const express = require('express');
const router = express.Router();
const helpTicketController = require('../controllers/helpTicket.controller');
const { verifyToken } = require('../middlewares/auth.middleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Multer Storage Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// All routes require authentication
router.use(verifyToken);

// Stage 1: Raise Ticket
router.post('/raise', upload.single('image_upload'), helpTicketController.raiseTicket);

// Stage 2: PC Planning
router.put('/pc-planning/:id', helpTicketController.pcPlanning);

// Stage 3: Solver Action
router.put('/solve/:id', upload.single('proof_upload'), helpTicketController.solveTicket);
router.put('/revise/:id', helpTicketController.reviseTicketDate);

// Stage 4: PC Confirmation
router.put('/pc-confirm/:id', helpTicketController.pcConfirmation);

// Stage 5: Closure / Re-raise
router.put('/close/:id', helpTicketController.closeTicket);
router.put('/reraise/:id', helpTicketController.reraiseTicket);

// Queries
router.get('/', helpTicketController.getTickets);
router.get('/:id', helpTicketController.getTicketById);

module.exports = router;
