const Asset = require('../models/Asset');
const logger = require('../logger/logger');
const { validationResult } = require('express-validator');
const { useId } = require('react');
const { Parser } = require('json2csv'); //打印错误日志

const createAsset = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn(`⚠️ Validation failed: ${JSON.stringify(errors.array())}`);
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, price, date, userId } = req.body;
  logger.info(`📝 New asset submitted: ${name} | ¥${price} | ${date}`);
  const newAsset = new Asset({ name, price, date, userId });

  try {
    const saved = await newAsset.save();
    logger.info(`✅ Asset saved: ID=${saved._id}`);
    res.status(201).json(saved);
  } catch (err) {
    logger.error(`❌ Failed to save asset: ${err.message}`);
    res.status(400).json({ message: err.message });
  }
};

const deleteAsset = async (req, res) => {
  logger.info(`🗑️ Delete request: ID=${req.params.id}`);
  try {
    const deleted = await Asset.findByIdAndDelete(req.params.id);
    if (!deleted) {
      logger.warn(`⚠️ Asset not found for delete: ID=${req.params.id}`);
      return res.status(404).json({ message: 'Not found' });
    }
    logger.info(`✅ Deleted asset: ID=${req.params.id}`);
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    logger.error(`❌ Failed to delete asset: ${err.message}`);
    res.status(500).json({ message: err.message });
  }
};

const updateAsset = async (req, res) => {
  const { name, price, date } = req.body;
  logger.info(`✏️ Update request: ID=${req.params.id}`);

  try {
    const updatedAsset = await Asset.findByIdAndUpdate(
      req.params.id,
      { name, price, date },
      { new: true }
    );

    if (!updatedAsset) {
      logger.warn(`⚠️ Asset not found for update: ID=${req.params.id}`);
      return res.status(404).json({ message: 'Asset not found' });
    }

    logger.info(`✅ Updated asset: ID=${updatedAsset._id}`);
    res.json(updatedAsset);
  } catch (err) {
    logger.error(`❌ Failed to update asset: ${err.message}`);
    res.status(400).json({ message: err.message });
  }
};

// const getAssets = async (req, res) => {
//   logger.info(`📥 GET /api/assets requested`);
//   try {
//     const userId = req.query.userId;
//     const assets = userId ? await Asset.find({ userId }) : await Asset.find();
//     res.json(assets);
//   } catch (err) {
//     logger.error(`❌ GET /api/assets failed: ${err.message}`);
//     res.status(500).json({ error: err.message });
//   }
// };

const getAssets = async (req, res) => {
  try {
    const userId = req.query.userId;
    console.log('🧪 userId:', userId);  // ✅ 打印 userId

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const assets = await Asset.find({ userId });
    console.log('📦 assets:', assets);  // ✅ 打印查询结果
    res.json(assets);
  } catch (err) {
    console.error('Error fetching assets:', err);  // ❗ 查看真实报错信息
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

//这个功能先不管，按钮已经删掉了
const exportCSV = async (req, res) => {
  logger.info('📤 Exporting assets data...');
  try {
    const userId = req.query.userId;
    const assets = await Asset.find({ userId });

    const csvHeader = 'Name,Price,Date,DaysUsed,DailyCost\n';
    const csvRows = assets.map((asset) => {
      const dateObj = new Date(asset.date);
      const priceNum = typeof asset.price === 'number' ? asset.price : parseFloat(asset.price);
      const daysUsed = Math.max(1, Math.floor((Date.now() - dateObj) / (1000 * 60 * 60 * 24)));
      const dailyCost = priceNum / daysUsed;
      return `${asset.name},${priceNum},${asset.date},${daysUsed},${dailyCost.toFixed(2)}`;
    });

    const csvContent = csvHeader + csvRows.join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=assets_export.csv');
    res.send(csvContent);
  } catch (err) {
    logger.error(`❌ Failed to export assets: ${err.message}`);
    res.status(500).json({ message: 'Export failed' });
  }
};

const exportJSON = async (req, res) => {
  try {
    const userId = req.query.userId;
    const assets = await Asset.find({ userId });
    res.setHeader('Content-Disposition', 'attachment; filename=assets.json');
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(assets);
  } catch (err) {
    logger.error(`❌ Failed to export JSON: ${err.message}`);
    res.status(500).json({ message: 'Export JSON failed' });
  }
};

const getAssetById = async (req, res) => {
  logger.info(`🔍 GET asset by ID: ${req.params.id}`);
  try {
    const asset = await Asset.findById(req.params.id);
    if (!asset) {
      logger.warn(`⚠️ Asset not found: ID=${req.params.id}`);
      return res.status(404).json({ message: 'Asset not found' });
    }
    res.json(asset);
  } catch (err) {
    logger.error('❌ Failed to fetch asset by ID:', err); //显示堆栈信息
    res.status(500).json({ message: 'Failed to fetch asset' });
  }
};

const exportAssets = async (req, res) => {
  console.log("✅ 导出 CSV 被调用了，收到参数：", req.query);
  try {
    const userId = req.query.userId;
    console.log('EXPORT: userId =', userId); // ✅ 调试用

    const assets = await Asset.find({ userId });
    console.log('EXPORT: assets count =', assets.length); // ✅ 调试用

    if (!assets.length) {
      return res.status(404).json({ message: "No assets found" });
    }

    const fields = ['name', 'price', 'date'];
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(assets);

    res.header('Content-Type', 'text/csv');
    res.attachment('assets.csv');
    res.send(csv);
  } catch (err) {
    console.error('EXPORT error:', err); // ✅ 调试用
    return res.status(500).json({ message: "Failed to fetch asset" });
  }
};


module.exports = {
  createAsset,
  deleteAsset,
  updateAsset,
  getAssets,
  exportCSV,
  exportJSON,
  getAssetById,
  exportAssets
};
