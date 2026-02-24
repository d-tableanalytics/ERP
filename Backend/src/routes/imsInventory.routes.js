const express = require("express");
const router = express.Router();

const { verifyToken } = require('../middlewares/auth.middleware');
const multer = require("multer");
const upload = multer();
const {
  createTransaction,
  getAllTransactions,
  editTransaction,
  deleteTransaction,
  getAllMasters
} = require("../controllers/imsInventory.controller");

router.post("/transaction",
  upload.any(),
  verifyToken, createTransaction);
router.put("/transaction/:id", upload.any(), verifyToken, editTransaction);
router.get("/transactions", verifyToken, getAllTransactions);
router.delete("/transaction/:id", verifyToken, deleteTransaction);
router.get("/masters", verifyToken, getAllMasters);

module.exports = router;
