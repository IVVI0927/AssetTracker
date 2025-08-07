const mongoose = require('mongoose');

const assetSchema = new mongoose.Schema({
  name: {
    type: String, //数据验证
    required: [true, 'Asset name is required'],
    trim: true
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price must be positive']
  },
  date: {
    type: Date,
    required: [true, 'Purchase date is required']
  },
  userId: {
  type: String,
  required: [true, 'User ID is required']
},
  daysUsed: Number, // 计算使用天数
  dailyCost: Number // 计算每日成本
}, {
  timestamps: true  // 自动添加 createdAt 和 updatedAt 字段
});

// ✅ 保存后，自动计算 daysUsed 和 dailyCost
assetSchema.pre('save', function (next) {
  if (this.date && this.price) {
    const now = new Date();
    const start = new Date(this.date);
    const daysUsed = Math.max(1, Math.floor((now - start) / (1000 * 60 * 60 * 24)));
    const dailyCost = this.price / daysUsed;

    this.daysUsed = daysUsed;
    this.dailyCost = dailyCost;
  }
  next();
});

const Asset = mongoose.model('Asset', assetSchema);
module.exports = Asset;