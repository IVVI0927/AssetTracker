import express from 'express';
import { body } from 'express-validator';
import {
  createAsset,
  deleteAsset,
  updateAsset,
  getAssets,
  exportCSV,
  exportJSON,
  getAssetById
} from '../controllers/assetController.js';

const router = express.Router();

// 校验中间件
const assetValidationRules = [
  body('name').notEmpty().withMessage('Name is required'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('date').notEmpty().withMessage('Date is required'),
  body('userId').notEmpty().withMessage('User ID is required')
];

// 创建资产
router.post('/', assetValidationRules, createAsset);

// 获取全部资产
router.get('/', getAssets);

// 获取单个资产
router.get('/:id', getAssetById);

// 更新资产
router.put('/:id', updateAsset);

// 删除资产
router.delete('/:id', deleteAsset);

// 导出 CSV
router.get('/export', exportCSV);

// 导出 JSON
router.get('/export-json', exportJSON);

export default router;