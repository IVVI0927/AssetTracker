const express = require('express');
const { body } = require('express-validator');
const assetController = require('../controllers/assetController');
const router = express.Router();
const { exportAssets } = require('../controllers/assetController');

// 验证中间件
const assetValidationRules = [
  body('name').notEmpty().withMessage('Name is required'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('date').notEmpty().withMessage('Date is required'),
  body('userId').notEmpty().withMessage('User ID is required')
];

// 创建资产
router.post('/', assetValidationRules, assetController.createAsset);
// 获取全部资产
router.get('/', assetController.getAssets);
// 获取单个资产
router.get('/:id', assetController.getAssetById);
// 更新资产
router.put('/:id', assetController.updateAsset);
// 删除资产
router.delete('/:id', assetController.deleteAsset);
// 导出 CSV
router.get('/export', assetController.exportCSV);
// 导出 JSON
router.get('/export-json', assetController.exportJSON);
//检查用
router.get('/export', assetController.exportAssets);


const verifyToken = require('../middlewares/auth'); // 注意路径和中间件文件名
router.get('/', verifyToken, async (req, res) => {
  // 现在 req.userId 已经是通过 token 验证后的 userId 了
  const userId = req.query.userId;

  if (userId !== req.userId) {
    return res.status(403).json({ message: 'Unauthorized access' });
  }
  // 然后继续查询数据库
});

module.exports = router;