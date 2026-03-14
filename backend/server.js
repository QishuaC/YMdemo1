﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
ffmpeg.setFfmpegPath(ffmpegPath);
const XLSX = require('xlsx');
const cheerio = require('cheerio');
const axios = require('axios');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const { mockArticles, mockVideos, mockProducts, mockComments } = require('../data/mock.js');

const RATE_LIMIT_WINDOW = 60000;
const RATE_LIMIT_MAX = 100;
const rateLimitStore = new Map();
const behaviorLimitStore = new Map();

function rateLimitMiddleware(req, res, next) {
  const clientId = req.ip || 'anonymous';
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW;
  
  let requests = rateLimitStore.get(clientId) || [];
  requests = requests.filter(time => time > windowStart);
  
  if (requests.length >= RATE_LIMIT_MAX) {
    res.status(429).json({
      success: false,
      message: '请求过于频繁，请稍后再试'
    });
    return;
  }
  
  requests.push(now);
  rateLimitStore.set(clientId, requests);
  next();
}

function getDefaultSecurityPolicy() {
  return {
    monitorWindowMinutes: 10,
    behaviors: {
      comment: {
        enabled: true,
        windowMinutes: 10,
        maxRequests: 20,
        blockMinutes: 10,
        message: '评论过于频繁，请稍后再试',
        autoDeleteComments: true
      },
      video_like: {
        enabled: true,
        windowMinutes: 5,
        maxRequests: 80,
        blockMinutes: 5,
        message: '点赞操作过于频繁，请稍后再试'
      },
      comment_like: {
        enabled: true,
        windowMinutes: 5,
        maxRequests: 80,
        blockMinutes: 5,
        message: '点赞操作过于频繁，请稍后再试'
      },
      order_submit: {
        enabled: true,
        windowMinutes: 10,
        maxRequests: 10,
        blockMinutes: 15,
        message: '订单提交过于频繁，请稍后再试'
      },
      forward: {
        enabled: true,
        windowMinutes: 5,
        maxRequests: 120,
        blockMinutes: 3,
        message: '转发操作过于频繁，请稍后再试'
      }
    }
  };
}

function ensureSecurityPolicy(db) {
  const defaultPolicy = getDefaultSecurityPolicy();
  const current = db.securityPolicy || {};
  const nextPolicy = {
    monitorWindowMinutes: toInt(current.monitorWindowMinutes, defaultPolicy.monitorWindowMinutes),
    behaviors: {}
  };
  Object.keys(defaultPolicy.behaviors).forEach((actionKey) => {
    const currentBehavior = current.behaviors?.[actionKey] || {};
    const defaultBehavior = defaultPolicy.behaviors[actionKey];
    nextPolicy.behaviors[actionKey] = {
      ...defaultBehavior,
      ...currentBehavior,
      enabled: currentBehavior.enabled === undefined ? defaultBehavior.enabled : Boolean(currentBehavior.enabled),
      windowMinutes: Math.max(1, toInt(currentBehavior.windowMinutes, defaultBehavior.windowMinutes)),
      maxRequests: Math.max(1, toInt(currentBehavior.maxRequests, defaultBehavior.maxRequests)),
      blockMinutes: Math.max(0, toInt(currentBehavior.blockMinutes, defaultBehavior.blockMinutes)),
      message: sanitizeString(currentBehavior.message || defaultBehavior.message, 120)
    };
  });
  db.securityPolicy = nextPolicy;
  if (!Array.isArray(db.securityAnomalies)) {
    db.securityAnomalies = [];
  }
  return nextPolicy;
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const first = String(forwarded).split(',')[0].trim();
    if (first) return first;
  }
  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return String(realIp).trim();
  }
  return String(req.ip || req.connection?.remoteAddress || 'unknown').replace('::ffff:', '');
}

function resolveActorId(req) {
  const headerUserId = req.header('x-user-id');
  const bodyUserId = req.body?.userId;
  return String(headerUserId || bodyUserId || 'anonymous');
}

function deleteRecentCommentsForActor(db, actorId, ip, windowStartTs) {
  const initialLength = db.comments.length;
  const affectedVideoIds = new Set();
  db.comments = db.comments.filter((comment) => {
    const createdAtTs = new Date(comment.createdAt).getTime();
    const inWindow = Number.isFinite(createdAtTs) && createdAtTs >= windowStartTs;
    const sameActor = String(comment.userId || '') === String(actorId);
    const sameIp = ip && comment.sourceIp && comment.sourceIp === ip;
    const shouldDelete = inWindow && (sameActor || sameIp);
    if (shouldDelete) {
      affectedVideoIds.add(comment.videoId);
      return false;
    }
    return true;
  });
  affectedVideoIds.forEach((videoId) => refreshVideoCommentCount(db, videoId));
  return initialLength - db.comments.length;
}

function enforceBehaviorSecurity(req, res, db, actionKey, options = {}) {
  const policy = ensureSecurityPolicy(db);
  const behaviorPolicy = policy.behaviors[actionKey];
  if (!behaviorPolicy || !behaviorPolicy.enabled) {
    return { blocked: false };
  }
  const actorId = String(options.userId || resolveActorId(req));
  const ip = getClientIp(req);
  const now = Date.now();
  const windowMs = Math.max(1, toInt(behaviorPolicy.windowMinutes, 1)) * 60 * 1000;
  const blockMs = Math.max(0, toInt(behaviorPolicy.blockMinutes, 0)) * 60 * 1000;
  const maxRequests = Math.max(1, toInt(behaviorPolicy.maxRequests, 1));
  const key = `${actionKey}:${actorId}:${ip}`;
  const record = behaviorLimitStore.get(key) || { timestamps: [], blockedUntil: 0 };
  record.timestamps = record.timestamps.filter((ts) => ts > now - windowMs);
  if (record.blockedUntil > now) {
    const remainingSeconds = Math.ceil((record.blockedUntil - now) / 1000);
    res.status(429).json({
      success: false,
      message: `${behaviorPolicy.message}（请在 ${remainingSeconds} 秒后重试）`
    });
    return { blocked: true };
  }
  if (record.timestamps.length >= maxRequests) {
    let deletedCount = 0;
    const windowStartTs = now - windowMs;
    if (actionKey === 'comment' && behaviorPolicy.autoDeleteComments) {
      deletedCount = deleteRecentCommentsForActor(db, actorId, ip, windowStartTs);
    }
    if (blockMs > 0) {
      record.blockedUntil = now + blockMs;
    }
    behaviorLimitStore.set(key, record);
    const anomaly = {
      _id: createId('security_anomaly'),
      action: actionKey,
      userId: actorId,
      ip,
      detectedAt: new Date(now).toISOString(),
      windowMinutes: Math.max(1, toInt(behaviorPolicy.windowMinutes, 1)),
      maxRequests,
      currentRequests: record.timestamps.length + 1,
      disposition: deletedCount > 0 ? `已拦截并删除${deletedCount}条评论` : '已拦截并记录'
    };
    db.securityAnomalies.unshift(anomaly);
    if (db.securityAnomalies.length > 2000) {
      db.securityAnomalies = db.securityAnomalies.slice(0, 2000);
    }
    writeDb(db);
    res.status(429).json({
      success: false,
      message: behaviorPolicy.message,
      anomaly
    });
    return { blocked: true };
  }
  record.timestamps.push(now);
  behaviorLimitStore.set(key, record);
  return { blocked: false };
}

function validateRequiredFields(fields) {
  return (req, res, next) => {
    const missing = [];
    for (const field of fields) {
      if (req.body[field] === undefined || req.body[field] === null || req.body[field] === '') {
        missing.push(field);
      }
    }
    if (missing.length > 0) {
      res.status(400).json({
        success: false,
        message: `缺少必填字段: ${missing.join(', ')}`
      });
      return;
    }
    next();
  };
}

function sanitizeString(str, maxLength = 1000) {
  if (!str) return '';
  return String(str).trim().substring(0, maxLength);
}

function sanitizeNumber(num, min = 0, max = Infinity) {
  const n = Number(num);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

const app = express();
const PORT = process.env.PORT || 3000;
app.disable('etag');

app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

const logger = {
  info: (message, data = {}) => console.log(`[${new Date().toISOString()}] INFO:`, message, data),
  error: (message, error = {}) => console.error(`[${new Date().toISOString()}] ERROR:`, message, error),
  warn: (message, data = {}) => console.warn(`[${new Date().toISOString()}] WARN:`, message, data)
};
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = process.env.DEMO_DATA_DIR || path.join(ROOT_DIR, '.runtime-data');
const LEGACY_DATA_DIR = path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const ADMIN_DIR = path.join(__dirname, 'admin');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const PRODUCT_SERVICE_TAGS = ['7天无理由', '运费险', '正品保障'];
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.avi', '.wmv', '.mkv', '.webm', '.m4v']);
const MEMBER_PLAN_PRICING = {
  monthly: 9.9,
  yearly: 99
};
const MEMBER_DISCOUNT_RATE = 0.95;

const OFFICIAL_PUBLISHER = {
  id: 'pub_official_001',
  name: '琯溪义门陈',
  avatar: ''
};
const FALLBACK_PUBLISHER_AVATAR = 'https://picsum.photos/seed/yimen-publisher/200/200';
const PUBLISHER_AVATAR_FOLDER = 'userID';
const PUBLISHER_AVATAR_ALIAS = 'publisher-avatar';
const PUBLISHER_AVATAR_ALIAS_URL = `/uploads/${PUBLISHER_AVATAR_FOLDER}/${PUBLISHER_AVATAR_ALIAS}`;
const USER_AVATAR_FOLDER = 'UserProducts';
const USER_AVATAR_PREFIX = 'P';
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function moveFileToFolder(sourcePath, targetFolder) {
  if (!sourcePath) return sourcePath;
  
  // Handle full URL or relative path
  let relativePath = sourcePath;
  if (sourcePath.startsWith('http')) {
    try {
      const urlObj = new URL(sourcePath);
      relativePath = urlObj.pathname;
    } catch (e) {
      return sourcePath;
    }
  }
  
  // Normalize path separators
  relativePath = relativePath.replace(/\\/g, '/');
  
  // Check if it's in uploads directory
  if (!relativePath.includes('/uploads/')) {
    return sourcePath;
  }
  
  const fileName = path.basename(relativePath);
  const sourceFile = path.join(UPLOAD_DIR, fileName);
  const targetDir = path.join(UPLOAD_DIR, targetFolder);
  const targetFile = path.join(targetDir, fileName);
  
  // If source doesn't exist or already in target, return
  if (!fs.existsSync(sourceFile)) {
    // Check if it's already in the target folder (maybe partially processed)
    if (fs.existsSync(targetFile)) {
      return `/uploads/${targetFolder}/${fileName}`;
    }
    return sourcePath;
  }
  
  try {
    ensureDir(targetDir);
    fs.renameSync(sourceFile, targetFile);
    return `/uploads/${targetFolder}/${fileName}`;
  } catch (error) {
    logger.error('Failed to move file', { source: sourceFile, target: targetFile, error: error.message });
    return sourcePath;
  }
}

function deleteFolder(folderPath) {
  const targetDir = path.join(UPLOAD_DIR, folderPath);
  if (fs.existsSync(targetDir)) {
    try {
      fs.rmSync(targetDir, { recursive: true, force: true });
      logger.info('Deleted folder', { folder: targetDir });
    } catch (error) {
      logger.error('Failed to delete folder', { folder: targetDir, error: error.message });
    }
  }
}

async function openFileInSystem(filePath) {
  const normalizedPath = path.normalize(filePath);
  const folderPath = path.dirname(normalizedPath);
  if (process.platform === 'win32') {
    try {
      await execAsync(`cmd.exe /c start "" explorer.exe /select,"${normalizedPath}"`);
      return;
    } catch (error) {
      logger.warn('Windows select file failed', { filePath: normalizedPath, error: error.message });
    }
    await execAsync(`cmd.exe /c start "" explorer.exe "${folderPath}"`);
    return;
  }
  if (process.platform === 'darwin') {
    await execAsync(`open -R "${normalizedPath}"`);
    return;
  }
  await execAsync(`xdg-open "${folderPath}"`);
}

ensureDir(DATA_DIR);
ensureDir(UPLOAD_DIR);
ensureDir(path.join(UPLOAD_DIR, USER_AVATAR_FOLDER));
ensureDir(ADMIN_DIR);

const LEGACY_DB_FILE = path.join(LEGACY_DATA_DIR, 'db.json');
if (!fs.existsSync(DB_FILE) && fs.existsSync(LEGACY_DB_FILE)) {
  fs.copyFileSync(LEGACY_DB_FILE, DB_FILE);
}
if (fs.existsSync(DB_FILE) && fs.existsSync(LEGACY_DB_FILE)) {
  try {
    const currentDb = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    const legacyDb = JSON.parse(fs.readFileSync(LEGACY_DB_FILE, 'utf-8'));
    const currentPublisherAvatar = String(currentDb.uiConfig?.publisherAvatar || '').trim();
    const legacyPublisherAvatar = String(legacyDb.uiConfig?.publisherAvatar || '').trim();
    if (!currentPublisherAvatar && legacyPublisherAvatar) {
      const currentUiConfig = currentDb.uiConfig || {};
      const legacyUiConfig = legacyDb.uiConfig || {};
      currentDb.uiConfig = {
        ...currentUiConfig,
        publisherAvatar: legacyPublisherAvatar
      };
      if (!currentUiConfig.defaultAvatar && legacyUiConfig.defaultAvatar) {
        currentDb.uiConfig.defaultAvatar = legacyUiConfig.defaultAvatar;
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(currentDb, null, 2), 'utf-8');
    }
  } catch (error) {
    logger.warn('Failed to merge legacy ui config', { error: error.message });
  }
}

function createId(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
}

function toPrice(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function toPriceOneDecimal(value) {
  const num = toPrice(value);
  return Math.round((num + Number.EPSILON) * 10) / 10;
}

function toInt(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? Math.floor(num) : fallback;
}

function applyDiscountPrice(subtotal, discountRate) {
  const base = toPrice(subtotal);
  const rate = toPrice(discountRate);
  if (rate >= 1) return toPriceOneDecimal(base);
  return Math.max(0, toPriceOneDecimal(base * rate));
}

function buildDefaultMemberBenefits() {
  return {
    badgeDigitalClaimed: false,
    badgePhysicalEligible: false,
    genealogyDigitalClaimed: false,
    genealogyPhysicalEligible: false
  };
}

function formatDateYmd(input) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function ensureUserMembershipFields(user) {
  if (!user || typeof user !== 'object') return;
  if (user.isMember === undefined) user.isMember = false;
  if (!user.memberPlan) user.memberPlan = '';
  if (!user.memberExpiry) user.memberExpiry = '';
  if (!user.memberStartedAt) user.memberStartedAt = '';
  if (!user.memberBenefits || typeof user.memberBenefits !== 'object') {
    user.memberBenefits = buildDefaultMemberBenefits();
  } else {
    user.memberBenefits = {
      ...buildDefaultMemberBenefits(),
      ...user.memberBenefits
    };
  }
}

function getUserMemberStatus(user) {
  ensureUserMembershipFields(user);
  const now = Date.now();
  const expiryTs = user.memberExpiry ? new Date(user.memberExpiry).getTime() : 0;
  const hasValidExpiry = Number.isFinite(expiryTs) && expiryTs > now;
  const planType = user.memberPlan === 'yearly' ? 'yearly' : (user.memberPlan === 'monthly' ? 'monthly' : '');
  const isMember = Boolean(user.isMember && hasValidExpiry && planType);
  return {
    isMember,
    memberPlan: isMember ? planType : '',
    memberExpiry: isMember ? formatDateYmd(user.memberExpiry) : '',
    memberExpiryRaw: isMember ? user.memberExpiry : '',
    memberBenefits: user.memberBenefits || buildDefaultMemberBenefits(),
    discountRate: isMember ? MEMBER_DISCOUNT_RATE : 1
  };
}

function getOrCreateUser(db, userId, fallbackNickname = '微信用户') {
  let user = db.users.find((item) => item._id === userId);
  if (!user) {
    user = {
      _id: userId,
      uniqueId: generateUniqueId(),
      userNumber: generateUserNumber(db.users),
      nickname: fallbackNickname,
      avatar: 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0',
      gender: '',
      phone: '',
      points: 0,
      checkIns: [],
      pointsHistory: [],
      addresses: [],
      openId: 'mock_openid_the code is a mock one',
      nicknameColor: '',
      isMember: false,
      memberPlan: '',
      memberExpiry: '',
      memberStartedAt: '',
      memberBenefits: buildDefaultMemberBenefits(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.users.push(user);
  }
  if (!user.uniqueId) user.uniqueId = generateUniqueId();
  if (!user.userNumber) user.userNumber = generateUserNumber(db.users);
  if (!Array.isArray(user.checkIns)) user.checkIns = [];
  if (user.points === undefined) user.points = 0;
  if (!Array.isArray(user.pointsHistory)) user.pointsHistory = [];
  if (!Array.isArray(user.addresses)) user.addresses = [];
  ensureUserMembershipFields(user);
  return user;
}

function generateUserNumber(users) {
  const existingNumbers = users
    .map(user => user.userNumber)
    .filter(number => number && number.startsWith('C'))
    .map(number => parseInt(number.substring(1), 10))
    .filter(num => !isNaN(num));
  
  const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
  return 'C' + String(nextNumber).padStart(5, '0');
}

function generateProductNumber(products) {
  const existingNumbers = products
    .map(product => product.productNumber)
    .filter(number => number && number.startsWith('P'))
    .map(number => parseInt(number.substring(1), 10))
    .filter(num => !isNaN(num));
  
  const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
  return 'P' + String(nextNumber).padStart(6, '0');
}

function generateUniqueId() {
  return 'UID_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9).toUpperCase();
}

function normalizeServiceTags(input) {
  const source = Array.isArray(input)
    ? input
    : String(input || '')
      .split(/[,、\s]+/)
      .filter(Boolean);
  const selected = PRODUCT_SERVICE_TAGS.filter((tag) => source.includes(tag));
  return selected.length > 0 ? selected : [...PRODUCT_SERVICE_TAGS];
}

function normalizeProductOutput(product) {
  const serviceTags = normalizeServiceTags(product.serviceTags || product.tags);
  let coverImages = [];
  if (product.cover) {
    coverImages = Array.isArray(product.cover) 
      ? product.cover.map(normalizeAsset) 
      : [normalizeAsset(product.cover)];
  }
  let detailImages = [];
  if (product.detailImages) {
    detailImages = Array.isArray(product.detailImages) 
      ? product.detailImages.map(normalizeAsset) 
      : [normalizeAsset(product.detailImages)];
  } else if (product.detailImage) {
    detailImages = [normalizeAsset(product.detailImage)];
  }
  return {
    ...product,
    cover: coverImages.length > 0 ? coverImages[0] : '',
    covers: coverImages,
    detailImages,
    detailImage: detailImages.length > 0 ? detailImages[0] : '',
    serviceTags,
    tags: serviceTags.join('、')
  };
}

function normalizeShippingAddress(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object') {
    const parts = [value.province, value.city, value.district, value.detail];
    return parts.filter(Boolean).join(' ').trim();
  }
  return '';
}

function getProductSortValue(product, fallback = 999999) {
  const value = Number(product?.sort);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function sortProductsBySort(products = []) {
  return [...products].sort((a, b) => {
    const diff = getProductSortValue(a) - getProductSortValue(b);
    if (diff !== 0) return diff;
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });
}

function normalizeProductSortSequence(products = []) {
  const ordered = sortProductsBySort(products);
  let changed = false;
  ordered.forEach((item, index) => {
    const nextSort = index + 1;
    if (item.sort !== nextSort) {
      item.sort = nextSort;
      changed = true;
    }
  });
  return changed;
}

function moveProductToSortPosition(products = [], productId, targetSort) {
  const ordered = sortProductsBySort(products);
  const currentIndex = ordered.findIndex((item) => item._id === productId);
  if (currentIndex < 0) return;
  const [moving] = ordered.splice(currentIndex, 1);
  const maxIndex = ordered.length;
  const insertIndex = Math.min(Math.max(0, toInt(targetSort, 1) - 1), maxIndex);
  ordered.splice(insertIndex, 0, moving);
  ordered.forEach((item, index) => {
    item.sort = index + 1;
  });
}

function createInitialDb() {
  const now = new Date().toISOString();
  const products = mockProducts.map((item, index) => ({
    _id: createId('product'),
    productNumber: 'P' + String(index + 1).padStart(6, '0'),
    name: item.name,
    cover: item.cover ? [item.cover] : [],
    detailImages: item.detailImage ? [item.detailImage] : (item.cover ? [item.cover] : []),
    price: toPrice(item.price),
    originalPrice: toPrice(item.originalPrice),
    sales: toInt(item.sales),
    stock: 999,
    category: item.category || '默认分类',
    serviceTags: normalizeServiceTags(item.serviceTags),
    sort: index + 1,
    createdAt: now,
    updatedAt: now
  }));

  const articles = mockArticles.map((item) => ({
    _id: createId('article'),
    title: item.title,
    summary: item.summary || '',
    content: item.summary || '',
    cover: item.cover,
    author: item.author || '自动管理员',
    avatar: item.avatar || '',
    views: toInt(item.views),
    likes: toInt(item.likes),
    createdAt: now,
    updatedAt: now
  }));

  const videos = mockVideos.map((item) => ({
    _id: createId('video'),
    title: item.title,
    cover: item.cover,
    videoUrl: item.videoUrl,
    author: OFFICIAL_PUBLISHER.name,
    avatar: OFFICIAL_PUBLISHER.avatar,
    publisherId: OFFICIAL_PUBLISHER.id,
    likes: toInt(item.likes),
    comments: toInt(item.comments),
    likedBy: [],
    createdAt: now,
    updatedAt: now
  }));

  const videoIdMap = {};
  videos.forEach((video, index) => {
    videoIdMap[String(index + 1)] = video._id;
  });

  const comments = mockComments.map((item) => ({
    _id: createId('comment'),
    videoId: videoIdMap[String(item.videoId)] || videos[0]?._id,
    parentId: null,
    rootId: null,
    userId: item.userId?._id || createId('user'),
    nickname: item.userId?.nickname || '游客',
    avatar: item.userId?.avatar || '',
    content: item.content || '',
    likes: toInt(item.likes),
    likedBy: [],
    createdAt: new Date(item.createdAt || Date.now()).toISOString(),
    updatedAt: now
  }));

  return {
    users: [
      {
        _id: 'wx_user_001',
        uniqueId: generateUniqueId(),
        userNumber: 'C00001',
        nickname: '微信用户',
        avatar: 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0',
        points: 0,
        checkIns: [],
        pointsHistory: [],
        nicknameColor: '',
        isMember: false,
        memberPlan: '',
        memberExpiry: '',
        memberStartedAt: '',
        memberBenefits: buildDefaultMemberBenefits()
      }
    ],
    admins: [
      {
        username: 'admin',
        password: 'admin123',
        nickname: '自动管理员'
      }
    ],
    products,
    articles,
    videos,
    comments,
    orders: [],
    exchangeProducts: [],
    redemptions: [],
    securityPolicy: getDefaultSecurityPolicy(),
    securityAnomalies: [],
    uiConfig: {
      banner: 'https://picsum.photos/750/300?random=100',
      tabBar: [
        { pagePath: '/pages/yiwen/yiwen', text: '首页', icon: '🏠' },
        { pagePath: '/pages/yixun/yixun', text: '义讯', icon: '📺' },
        { pagePath: '/pages/shop/shop', text: '商城', icon: '🛒' },
        { pagePath: '/pages/member/member', text: '我的', icon: '👤' }
      ],
      defaultAvatar: '',
      themeColor: '#07c160'
    }
  };
}

function readDb() {
  if (!fs.existsSync(DB_FILE)) {
    const initData = createInitialDb();
    fs.writeFileSync(DB_FILE, JSON.stringify(initData, null, 2), 'utf-8');
    return initData;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    logger.error('Failed to read database file', { error: error.message });
    const backupDir = path.join(DATA_DIR, 'backups');
    if (fs.existsSync(backupDir)) {
      try {
        const backupFiles = fs.readdirSync(backupDir)
          .filter(file => file.startsWith('db_backup_') && file.endsWith('.json'))
          .sort((a, b) => fs.statSync(path.join(backupDir, b)).mtimeMs - fs.statSync(path.join(backupDir, a)).mtimeMs);
        for (const file of backupFiles) {
          const backupPath = path.join(backupDir, file);
          try {
            const backupRaw = fs.readFileSync(backupPath, 'utf-8');
            const backupData = JSON.parse(backupRaw);
            fs.writeFileSync(DB_FILE, JSON.stringify(backupData, null, 2), 'utf-8');
            logger.warn('Database recovered from backup', { backup: file });
            return backupData;
          } catch (parseError) {
            continue;
          }
        }
      } catch (backupError) {
        logger.warn('Failed to recover from backup', { error: backupError.message });
      }
    }
    if (fs.existsSync(LEGACY_DB_FILE)) {
      try {
        const legacyRaw = fs.readFileSync(LEGACY_DB_FILE, 'utf-8');
        const legacyData = JSON.parse(legacyRaw);
        fs.writeFileSync(DB_FILE, JSON.stringify(legacyData, null, 2), 'utf-8');
        logger.warn('Database recovered from legacy file', {});
        return legacyData;
      } catch (legacyError) {
        logger.warn('Failed to recover from legacy file', { error: legacyError.message });
      }
    }
    const initData = createInitialDb();
    fs.writeFileSync(DB_FILE, JSON.stringify(initData, null, 2), 'utf-8');
    return initData;
  }
}

let dbCache = null;
let dbCacheTime = 0;
const DB_CACHE_TTL = 5000;

function readDbWithCache() {
  const now = Date.now();
  if (dbCache && (now - dbCacheTime < DB_CACHE_TTL)) {
    return dbCache;
  }
  
  dbCache = readDb();
  dbCacheTime = now;
  return dbCache;
}

const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const MAX_BACKUPS = 10;

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function createBackup() {
  ensureBackupDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(BACKUP_DIR, `db_backup_${timestamp}.json`);
  
  try {
    if (fs.existsSync(DB_FILE)) {
      fs.copyFileSync(DB_FILE, backupFile);
      logger.info('Database backup created', { file: backupFile });
      cleanupOldBackups();
    }
  } catch (error) {
    logger.error('Failed to create backup', { error: error.message });
  }
}

function cleanupOldBackups() {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(file => file.startsWith('db_backup_') && file.endsWith('.json'))
      .map(file => ({
        name: file,
        path: path.join(BACKUP_DIR, file),
        time: fs.statSync(path.join(BACKUP_DIR, file)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time);
    
    while (files.length > MAX_BACKUPS) {
      const oldBackup = files.pop();
      fs.unlinkSync(oldBackup.path);
      logger.info('Old backup deleted', { file: oldBackup.name });
    }
  } catch (error) {
    logger.error('Failed to cleanup backups', { error: error.message });
  }
}

function writeDb(data) {
  createBackup();
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  dbCache = data;
  dbCacheTime = Date.now();
}

app.get('/api/admin/backups', (req, res) => {
  ensureBackupDir();
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(file => file.startsWith('db_backup_') && file.endsWith('.json'))
      .map(file => {
        const stats = fs.statSync(path.join(BACKUP_DIR, file));
        return {
          name: file,
          size: stats.size,
          createdAt: stats.mtime.toISOString()
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json({ success: true, backups: files });
  } catch (error) {
    logger.error('Failed to list backups', { error: error.message });
    res.status(500).json({ success: false, message: '获取备份列表失败' });
  }
});

app.post('/api/admin/backups', (req, res) => {
  createBackup();
  res.json({ success: true, message: '备份创建成功' });
});

app.post('/api/admin/backups/restore', validateRequiredFields(['backupName']), (req, res) => {
  const backupName = sanitizeString(req.body.backupName, 100);
  const backupPath = path.join(BACKUP_DIR, backupName);
  
  if (!fs.existsSync(backupPath)) {
    res.status(404).json({ success: false, message: '备份文件不存在' });
    return;
  }
  
  try {
    createBackup();
    fs.copyFileSync(backupPath, DB_FILE);
    dbCache = null;
    logger.info('Database restored from backup', { backup: backupName });
    res.json({ success: true, message: '恢复成功' });
  } catch (error) {
    logger.error('Failed to restore backup', { error: error.message });
    res.status(500).json({ success: false, message: '恢复失败' });
  }
});

function pagination(items, page = 1, limit = 20) {
  const p = Math.max(1, toInt(page, 1));
  const l = Math.max(1, Math.min(200, toInt(limit, 20)));
  const start = (p - 1) * l;
  const end = start + l;
  return {
    list: items.slice(start, end),
    total: items.length,
    page: p,
    limit: l
  };
}

function normalizeAsset(assetPath) {
  if (!assetPath) return '';
  if (assetPath.startsWith('http://') || assetPath.startsWith('https://')) return assetPath;
  if (assetPath.startsWith('/uploads/')) return assetPath;
  return `/uploads/${assetPath.replace(/^\/+/, '')}`;
}

function findPublisherAvatarFile() {
  const targetDir = path.join(UPLOAD_DIR, PUBLISHER_AVATAR_FOLDER);
  if (!fs.existsSync(targetDir)) {
    return '';
  }
  const candidates = fs.readdirSync(targetDir)
    .filter((name) => {
      const ext = path.extname(name).toLowerCase();
      if (!IMAGE_EXTENSIONS.has(ext)) return false;
      const baseName = path.basename(name, ext);
      return baseName === PUBLISHER_AVATAR_ALIAS;
    })
    .sort((a, b) => fs.statSync(path.join(targetDir, b)).mtimeMs - fs.statSync(path.join(targetDir, a)).mtimeMs);
  return candidates[0] || '';
}

function resolveValidAvatar(avatarPath, fallback = '') {
  const normalized = normalizeAsset(avatarPath);
  if (!normalized) return fallback;
  if (normalized === PUBLISHER_AVATAR_ALIAS_URL) {
    const aliasFile = findPublisherAvatarFile();
    if (!aliasFile) {
      return fallback;
    }
    return normalized;
  }
  if (normalized.startsWith('/uploads/')) {
    const relativePath = normalized.slice('/uploads/'.length);
    const uploadPath = path.join(UPLOAD_DIR, relativePath);
    if (!fs.existsSync(uploadPath)) {
      return fallback;
    }
  }
  return normalized;
}

function buildCommentTree(db, videoId) {
  const comments = db.comments.filter((item) => item.videoId === videoId);
  const topLevel = comments.filter((item) => !item.parentId);
  
  const getUserInfo = (userId, fallbackNickname, fallbackAvatar) => {
    const user = db.users.find((u) => u._id === userId);
    return {
      _id: userId,
      nickname: user?.nickname || fallbackNickname || '微信用户',
      avatar: user?.avatar || fallbackAvatar || 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0',
      nicknameColor: user?.nicknameColor || '',
      isMember: user?.isMember || false
    };
  };
  
  const result = topLevel
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((item) => {
      const replies = comments
        .filter((reply) => reply.parentId === item._id)
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
        .map((reply) => ({
          _id: reply._id,
          videoId: reply.videoId,
          parentId: reply.parentId,
          rootId: reply.rootId,
          content: reply.content,
          likes: reply.likes || 0,
          likedBy: reply.likedBy || [],
          createdAt: reply.createdAt,
          userId: getUserInfo(reply.userId, reply.nickname, reply.avatar)
        }));
      return {
        _id: item._id,
        videoId: item.videoId,
        parentId: null,
        content: item.content,
        likes: item.likes || 0,
        likedBy: item.likedBy || [],
        createdAt: item.createdAt,
        userId: getUserInfo(item.userId, item.nickname, item.avatar),
        replies,
        replyCount: replies.length
      };
    });
  return result;
}

function countVideoComments(db, videoId) {
  return db.comments.filter((item) => item.videoId === videoId).length;
}

function refreshVideoCommentCount(db, videoId) {
  const commentCount = countVideoComments(db, videoId);
  const video = db.videos.find((item) => item._id === videoId);
  if (video) {
    video.comments = commentCount;
    video.updatedAt = new Date().toISOString();
  }
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/api', rateLimitMiddleware);

app.get(PUBLISHER_AVATAR_ALIAS_URL, (req, res) => {
  const fileName = findPublisherAvatarFile();
  if (!fileName) {
    res.status(404).json({ success: false, message: '发布者头像不存在' });
    return;
  }
  const filePath = path.join(UPLOAD_DIR, PUBLISHER_AVATAR_FOLDER, fileName);
  res.sendFile(filePath);
});

// 为上传的文件设置正确的MIME类型
app.use('/uploads', (req, res, next) => {
  const ext = path.extname(req.url).toLowerCase();
  if (ext === '.mp4') {
    res.setHeader('Content-Type', 'video/mp4');
  } else if (ext === '.jpg' || ext === '.jpeg') {
    res.setHeader('Content-Type', 'image/jpeg');
  } else if (ext === '.png') {
    res.setHeader('Content-Type', 'image/png');
  }
  next();
}, express.static(UPLOAD_DIR));

app.use(express.static(ROOT_DIR));
app.use(express.static(ADMIN_DIR));

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.url}`, { 
      status: res.statusCode, 
      duration: `${duration}ms`,
      userId: req.header('x-user-id') || 'anonymous'
    });
  });
  next();
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '');
    cb(null, `${Date.now()}_${Math.floor(Math.random() * 100000)}${ext}`);
  }
});

function createUploadMiddleware({ maxSize, allowedMimePattern, allowedExtensions, allowOctetStreamByExtension = false }) {
  return multer({
    storage,
    limits: {
      fileSize: maxSize
    },
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      const mimeType = String(file.mimetype || '').toLowerCase();
      const mimeOk = !allowedMimePattern || allowedMimePattern.test(mimeType);
      const extOk = !allowedExtensions || allowedExtensions.has(ext);
      const fallbackByExt = allowOctetStreamByExtension && extOk && (mimeType === '' || mimeType === 'application/octet-stream');
      const accepted = mimeOk && extOk || fallbackByExt;
      if (!accepted) {
        const error = new Error('文件类型不支持');
        error.code = 'INVALID_FILE_TYPE';
        cb(error);
        return;
      }
      cb(null, true);
    }
  });
}

const uploadImage = createUploadMiddleware({
  maxSize: 20 * 1024 * 1024,
  allowedMimePattern: /^image\//i
});

const uploadAvatar = createUploadMiddleware({
  maxSize: 5 * 1024 * 1024,
  allowedMimePattern: /^image\//i
});
const uploadVideo = createUploadMiddleware({
  maxSize: 500 * 1024 * 1024,
  allowedMimePattern: /^video\//i,
  allowedExtensions: VIDEO_EXTENSIONS,
  allowOctetStreamByExtension: true
});

app.get('/api/health', (req, res) => {
  res.json({ success: true, service: 'backend', time: new Date().toISOString() });
});

function getMonthKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

app.get('/api/checkin/status', (req, res) => {
  const db = readDbWithCache();
  const userId = req.header('x-user-id') || 'wx_user_001';
  const today = new Date().toISOString().split('T')[0];
  const currentMonth = getMonthKey(today);
  const user = getOrCreateUser(db, userId);
  
  const todayCheckIn = user.checkIns.find((item) => item.date === today);
  const hasCheckedIn = !!todayCheckIn;
  const monthlyCheckIns = user.checkIns.filter((item) => getMonthKey(item.date) === currentMonth);
  const monthlyCheckInCount = monthlyCheckIns.length;
  const totalCheckIns = user.checkIns.length;
  
  res.json({
    success: true,
    data: {
      hasCheckedIn,
      totalCheckIns,
      monthlyCheckInCount,
      monthlyCheckIns: monthlyCheckIns.map(item => item.date),
      points: user.points,
      lastCheckIn: user.checkIns.length > 0 ? user.checkIns[user.checkIns.length - 1].date : null,
      currentMonth
    }
  });
});

app.post('/api/checkin', (req, res) => {
  const db = readDbWithCache();
  const userId = req.header('x-user-id') || 'wx_user_001';
  const today = new Date().toISOString().split('T')[0];
  const currentMonth = getMonthKey(today);
  const now = new Date().toISOString();
  const user = getOrCreateUser(db, userId);
  const memberStatus = getUserMemberStatus(user);
  
  const todayCheckIn = user.checkIns.find((item) => item.date === today);
  if (todayCheckIn) {
    const monthlyCheckIns = user.checkIns.filter((item) => getMonthKey(item.date) === currentMonth);
    res.status(400).json({
      success: false,
      message: '今日已签到',
      data: {
        hasCheckedIn: true,
        points: user.points,
        monthlyCheckInCount: monthlyCheckIns.length
      }
    });
    return;
  }
  
  const basePoints = 10;
  const earnedPoints = memberStatus.isMember ? basePoints * 2 : basePoints;
  const description = memberStatus.isMember ? '每日签到（会员双倍）' : '每日签到';
  
  user.checkIns.push({
    date: today,
    points: earnedPoints,
    createdAt: now
  });
  user.points += earnedPoints;
  user.pointsHistory.unshift({
    _id: createId('point'),
    type: 'earn',
    amount: earnedPoints,
    description: description,
    createdAt: now
  });
  
  writeDb(db);
  
  const monthlyCheckIns = user.checkIns.filter((item) => getMonthKey(item.date) === currentMonth);
  
  res.json({
    success: true,
    message: `签到成功，获得${earnedPoints}积分`,
    data: {
      hasCheckedIn: true,
      points: user.points,
      totalCheckIns: user.checkIns.length,
      monthlyCheckInCount: monthlyCheckIns.length,
      earnedPoints: earnedPoints
    }
  });
});

app.get('/api/member/profile', (req, res) => {
  const db = readDbWithCache();
  const userId = req.header('x-user-id') || 'wx_user_001';
  const user = getOrCreateUser(db, userId);
  const memberStatus = getUserMemberStatus(user);
  writeDb(db);
  res.json({
    success: true,
    data: {
      ...memberStatus,
      pricing: MEMBER_PLAN_PRICING
    }
  });
});

app.post('/api/member/subscribe', (req, res) => {
  const db = readDbWithCache();
  const userId = req.header('x-user-id') || 'wx_user_001';
  const planType = req.body?.planType === 'yearly' ? 'yearly' : (req.body?.planType === 'monthly' ? 'monthly' : '');
  if (!planType) {
    res.status(400).json({ success: false, message: '会员套餐无效' });
    return;
  }
  const user = getOrCreateUser(db, userId);
  const now = new Date();
  const currentStatus = getUserMemberStatus(user);
  const baseDate = currentStatus.isMember && currentStatus.memberExpiryRaw ? new Date(currentStatus.memberExpiryRaw) : now;
  if (Number.isNaN(baseDate.getTime())) {
    baseDate.setTime(now.getTime());
  }
  if (planType === 'yearly') {
    baseDate.setFullYear(baseDate.getFullYear() + 1);
  } else {
    baseDate.setMonth(baseDate.getMonth() + 1);
  }
  user.isMember = true;
  user.memberPlan = planType;
  user.memberStartedAt = now.toISOString();
  user.memberExpiry = baseDate.toISOString();
  user.memberBenefits = {
    ...buildDefaultMemberBenefits(),
    ...user.memberBenefits,
    badgePhysicalEligible: planType === 'yearly' ? true : Boolean(user.memberBenefits?.badgePhysicalEligible),
    genealogyPhysicalEligible: planType === 'yearly' ? true : Boolean(user.memberBenefits?.genealogyPhysicalEligible)
  };
  user.updatedAt = new Date().toISOString();
  writeDb(db);
  const memberStatus = getUserMemberStatus(user);
  res.json({
    success: true,
    message: planType === 'yearly' ? '年卡开通成功' : '月卡开通成功',
    data: {
      ...memberStatus,
      pricing: MEMBER_PLAN_PRICING
    }
  });
});

app.post('/api/member/claim-benefit', (req, res) => {
  const db = readDbWithCache();
  const userId = req.header('x-user-id') || 'wx_user_001';
  const benefitType = req.body?.benefitType === 'badge' ? 'badge' : (req.body?.benefitType === 'genealogy' ? 'genealogy' : '');
  if (!benefitType) {
    res.status(400).json({ success: false, message: '权益类型无效' });
    return;
  }
  const user = getOrCreateUser(db, userId);
  const memberStatus = getUserMemberStatus(user);
  if (!memberStatus.isMember) {
    res.status(403).json({ success: false, message: '请先开通会员' });
    return;
  }
  if (benefitType === 'badge') {
    user.memberBenefits.badgeDigitalClaimed = true;
  } else {
    user.memberBenefits.genealogyDigitalClaimed = true;
  }
  user.updatedAt = new Date().toISOString();
  writeDb(db);
  res.json({
    success: true,
    message: benefitType === 'badge' ? '义门编号徽章已领取' : '陈氏通谱电子版已领取',
    data: {
      ...getUserMemberStatus(user),
      pricing: MEMBER_PLAN_PRICING
    }
  });
});

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body || {};
  const db = readDbWithCache();
  const admin = db.admins.find((item) => item.username === username && item.password === password);
  if (!admin) {
    res.status(401).json({ success: false, message: '账号或密码错误' });
    return;
  }
  res.json({
    success: true,
    token: `admin_token_${Date.now()}`,
    user: {
      username: admin.username,
      nickname: admin.nickname
    }
  });
});

app.post('/api/auth/login', (req, res) => {
  const { code, userInfo } = req.body || {};
  if (!code) {
    res.status(400).json({ success: false, message: '缺少登录凭证' });
    return;
  }
  const db = readDbWithCache();
  const fallbackUserId = 'wx_user_001';
  const user = getOrCreateUser(db, fallbackUserId);
  if (userInfo && typeof userInfo === 'object') {
    const isNewUser = user.nickname === '微信用户' || !user.nickname;
    if (isNewUser && typeof userInfo.nickName === 'string' && userInfo.nickName.trim()) {
      user.nickname = userInfo.nickName.trim();
    }
    if (isNewUser && typeof userInfo.avatarUrl === 'string' && userInfo.avatarUrl.trim()) {
      user.avatar = userInfo.avatarUrl.trim();
    }
  }
  user.openId = user.openId || 'mock_openid_the code is a mock one';
  user.updatedAt = new Date().toISOString();
  const memberStatus = getUserMemberStatus(user);
  writeDb(db);
  res.json({
    success: true,
    token: `wx_token_${Date.now()}`,
    user: {
      _id: user._id,
      uniqueId: user.uniqueId,
      userNumber: user.userNumber,
      nickName: user.nickname,
      avatarUrl: user.avatar,
      gender: user.gender || '',
      phone: user.phone || '',
      points: Number(user.points || 0),
      nicknameColor: user.nicknameColor || '',
      isMember: memberStatus.isMember,
      memberPlan: memberStatus.memberPlan,
      memberExpiry: memberStatus.memberExpiry,
      memberBenefits: memberStatus.memberBenefits
    }
  });
});

app.post('/api/upload', uploadImage.single('file'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ success: false, message: '缺少上传文件' });
    return;
  }
  res.json({
    success: true,
    url: `/uploads/${req.file.filename}`,
    filename: req.file.filename
  });
});

app.post('/api/upload/user-avatar', uploadAvatar.single('file'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ success: false, message: '缺少上传文件' });
    return;
  }
  try {
    const db = readDbWithCache();
    const userId = req.header('x-user-id') || 'wx_user_001';
    let user = db.users.find((item) => item._id === userId);
    if (!user) {
      user = {
        _id: userId,
        uniqueId: generateUniqueId(),
        userNumber: generateUserNumber(db.users),
        nickname: '微信用户',
        avatar: '',
        gender: '',
        phone: '',
        points: 0,
        checkIns: [],
        pointsHistory: [],
        addresses: [],
        openId: 'mock_openid_the code is a mock one'
      };
      db.users.push(user);
    }
    if (!user.uniqueId) {
      user.uniqueId = generateUniqueId();
    }
    const avatarDir = path.join(UPLOAD_DIR, USER_AVATAR_FOLDER);
    ensureDir(avatarDir);
    const uploadExt = path.extname(req.file.originalname || req.file.filename || '').toLowerCase();
    const safeExt = IMAGE_EXTENSIONS.has(uploadExt) ? uploadExt : '.jpg';
    const safeUniqueId = String(user.uniqueId).replace(/[^a-zA-Z0-9_-]/g, '');
    const baseName = `${USER_AVATAR_PREFIX}${safeUniqueId || user._id}`;
    const existedImages = fs.readdirSync(avatarDir).filter((name) => {
      const ext = path.extname(name).toLowerCase();
      if (!IMAGE_EXTENSIONS.has(ext)) return false;
      return path.basename(name, ext) === baseName;
    });
    existedImages.forEach((name) => {
      const filePath = path.join(avatarDir, name);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });
    const targetFileName = `${baseName}${safeExt}`;
    const targetPath = path.join(avatarDir, targetFileName);
    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
    }
    fs.renameSync(req.file.path, targetPath);
    const avatarUrl = `/uploads/${USER_AVATAR_FOLDER}/${targetFileName}`;
    user.avatar = avatarUrl;
    user.updatedAt = new Date().toISOString();
    writeDb(db);
    res.json({
      success: true,
      url: avatarUrl,
      filename: targetFileName
    });
  } catch (error) {
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    logger.error('用户头像上传失败', { error: error.message });
    res.status(500).json({ success: false, message: '头像上传失败' });
  }
});

app.post('/api/upload/publisher-avatar', uploadImage.single('file'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ success: false, message: '缺少上传文件' });
    return;
  }
  const db = readDbWithCache();
  const targetDir = path.join(UPLOAD_DIR, PUBLISHER_AVATAR_FOLDER);
  ensureDir(targetDir);
  const existedImages = fs.readdirSync(targetDir).filter((name) => {
    const ext = path.extname(name).toLowerCase();
    return IMAGE_EXTENSIONS.has(ext);
  });
  existedImages.forEach((name) => {
    const filePath = path.join(targetDir, name);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  });
  const uploadExt = path.extname(req.file.originalname || req.file.filename || '').toLowerCase();
  const safeExt = IMAGE_EXTENSIONS.has(uploadExt) ? uploadExt : '.jpg';
  const targetFileName = `${PUBLISHER_AVATAR_ALIAS}${safeExt}`;
  const targetPath = path.join(targetDir, targetFileName);
  if (fs.existsSync(targetPath)) {
    fs.unlinkSync(targetPath);
  }
  fs.renameSync(req.file.path, targetPath);
  const avatarUrl = PUBLISHER_AVATAR_ALIAS_URL;
  db.uiConfig = {
    ...(db.uiConfig || {}),
    publisherAvatar: avatarUrl
  };
  writeDb(db);
  res.json({
    success: true,
    url: avatarUrl,
    filename: targetFileName
  });
});

app.post('/api/upload/video', uploadVideo.single('file'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ success: false, message: '缺少上传文件' });
    return;
  }

  const videoPath = req.file.path;
  const videoFilename = req.file.filename;
  const coverFilename = videoFilename.replace(path.extname(videoFilename), '.jpg');
  
  // Create cover image
  ffmpeg(videoPath)
    .on('end', () => {
      res.json({
        success: true,
        url: `/uploads/${videoFilename}`,
        filename: videoFilename,
        coverUrl: `/uploads/${coverFilename}`
      });
    })
    .on('error', (err) => {
      logger.error('Failed to generate cover', { error: err.message });
      // Return success even if cover generation fails
      res.json({
        success: true,
        url: `/uploads/${videoFilename}`,
        filename: videoFilename
      });
    })
    .screenshots({
      count: 1,
      folder: UPLOAD_DIR,
      filename: coverFilename,
      // size: '320x?' // Optional: resize if needed
    });
});

app.post('/api/upload/multiple', uploadImage.array('files', 20), (req, res) => {
  if (!req.files || req.files.length === 0) {
    res.status(400).json({ success: false, message: '缺少上传文件' });
    return;
  }
  const urls = req.files.map(file => `/uploads/${file.filename}`);
  res.json({
    success: true,
    urls,
    files: req.files.map(file => ({ filename: file.filename, originalname: file.originalname }))
  });
});

app.post('/api/bootstrap', (req, res) => {
  const db = readDbWithCache();
  const { products, articles, videos, orders, force } = req.body || {};
  const now = new Date().toISOString();

  if (Array.isArray(products) && (force || db.products.length === 0)) {
    db.products = products.map((item, index) => {
      let coverImages = [];
      if (item.cover) {
        coverImages = Array.isArray(item.cover) ? item.cover : [item.cover];
      } else if (item.covers) {
        coverImages = Array.isArray(item.covers) ? item.covers : [item.covers];
      }
      let detailImages = [];
      if (item.detailImages) {
        detailImages = Array.isArray(item.detailImages) ? item.detailImages : [item.detailImages];
      } else if (item.detailImage) {
        detailImages = [item.detailImage];
      }
      const product = {
        _id: item._id || createId('product'),
        productNumber: item.productNumber || 'P' + String(index + 1).padStart(6, '0'),
        name: item.name || '未命名商品',
        cover: coverImages,
        detailImages,
        price: toPrice(item.price),
        originalPrice: toPrice(item.originalPrice),
        sales: toInt(item.sales),
        stock: toInt(item.stock, 999),
        category: item.category || '默认分类',
        serviceTags: normalizeServiceTags(item.serviceTags || item.tags),
        sort: item.sort !== undefined ? toInt(item.sort) : index + 1,
        createdAt: item.createdAt || now,
        updatedAt: now
      };
      
      // Move files to product folder
      const productFolder = `products/${product._id}`;
      if (product.cover && product.cover.length > 0) {
        product.cover = product.cover.map(img => moveFileToFolder(img, productFolder));
      }
      if (product.detailImages && product.detailImages.length > 0) {
        product.detailImages = product.detailImages.map(img => moveFileToFolder(img, productFolder));
      }
      
      return product;
    });
  }

  if (Array.isArray(articles) && (force || db.articles.length === 0)) {
    db.articles = articles.map((item) => ({
      _id: item._id || createId('article'),
      title: item.title || '未命名文章',
      summary: item.summary || '',
      content: item.content || item.summary || '',
      cover: item.cover || '',
      author: item.author || '自动管理员',
      avatar: item.avatar || '',
      views: toInt(item.views),
      likes: toInt(item.likes),
      createdAt: item.createdAt || now,
      updatedAt: now
    }));
  }

  if (Array.isArray(videos) && (force || db.videos.length === 0)) {
    db.videos = videos.map((item) => {
      const video = {
        _id: item._id || createId('video'),
        title: item.title || '未命名视频',
        cover: item.cover || '',
        videoUrl: item.videoUrl || '',
        author: OFFICIAL_PUBLISHER.name,
        avatar: OFFICIAL_PUBLISHER.avatar,
        publisherId: OFFICIAL_PUBLISHER.id,
        likes: toInt(item.likes),
        comments: toInt(item.comments),
        likedBy: Array.isArray(item.likedBy) ? item.likedBy : [],
        createdAt: item.createdAt || now,
        updatedAt: now
      };
      
      // Move files to video folder
      const videoFolder = `videos/${video._id}`;
      if (video.cover) {
        video.cover = moveFileToFolder(video.cover, videoFolder);
      }
      if (video.videoUrl) {
        video.videoUrl = moveFileToFolder(video.videoUrl, videoFolder);
      }
      
      return video;
    });
  }

  if (Array.isArray(orders) && orders.length > 0) {
    const orderMap = new Map(db.orders.map((item) => [item._id, item]));
    orders.forEach((item) => {
      const orderId = item._id || item.id || createId('order');
      if (!orderMap.has(orderId)) {
        db.orders.push({
          _id: orderId,
          orderNumber: item.orderNumber || `ORD${Date.now()}${Math.floor(Math.random() * 1000)}`,
          userId: item.userId || 'wx_user_001',
          userName: item.userName || '微信用户',
          items: Array.isArray(item.items) ? item.items : [],
          totalPrice: toPrice(item.totalPrice),
          status: item.status || 'pending',
          address: item.address || null,
          shippingAddress: item.shippingAddress || normalizeShippingAddress(item.address),
          shippingStatus: item.shippingStatus || 'unshipped',
          trackingNumber: item.trackingNumber || '',
          createdAt: item.createdAt || now,
          updatedAt: now,
          payTime: item.payTime || null
        });
      }
    });
  }

  writeDb(db);
  res.json({
    success: true,
    message: '数据导入完成',
    summary: {
      products: db.products.length,
      articles: db.articles.length,
      videos: db.videos.length,
      orders: db.orders.length
    }
  });
});

app.get('/api/security-policy', (req, res) => {
  const db = readDbWithCache();
  const policy = ensureSecurityPolicy(db);
  res.json({ success: true, policy });
});

app.post('/api/security-policy', (req, res) => {
  const db = readDbWithCache();
  const payload = req.body || {};
  ensureSecurityPolicy(db);
  const defaultPolicy = getDefaultSecurityPolicy();
  const monitorWindowMinutes = Math.max(1, toInt(payload.monitorWindowMinutes, db.securityPolicy.monitorWindowMinutes || defaultPolicy.monitorWindowMinutes));
  const nextBehaviors = {};
  Object.keys(defaultPolicy.behaviors).forEach((actionKey) => {
    const currentBehavior = db.securityPolicy.behaviors?.[actionKey] || defaultPolicy.behaviors[actionKey];
    const inputBehavior = payload.behaviors?.[actionKey] || {};
    nextBehaviors[actionKey] = {
      ...currentBehavior,
      enabled: inputBehavior.enabled === undefined ? currentBehavior.enabled : Boolean(inputBehavior.enabled),
      windowMinutes: Math.max(1, toInt(inputBehavior.windowMinutes, currentBehavior.windowMinutes)),
      maxRequests: Math.max(1, toInt(inputBehavior.maxRequests, currentBehavior.maxRequests)),
      blockMinutes: Math.max(0, toInt(inputBehavior.blockMinutes, currentBehavior.blockMinutes)),
      message: sanitizeString(inputBehavior.message || currentBehavior.message, 120),
      autoDeleteComments: currentBehavior.autoDeleteComments
    };
  });
  db.securityPolicy = {
    monitorWindowMinutes,
    behaviors: nextBehaviors
  };
  writeDb(db);
  res.json({ success: true, policy: db.securityPolicy });
});

app.get('/api/security-anomalies', (req, res) => {
  const db = readDbWithCache();
  const policy = ensureSecurityPolicy(db);
  const minutes = Math.max(1, toInt(req.query.minutes, policy.monitorWindowMinutes || 10));
  const limit = Math.max(1, Math.min(500, toInt(req.query.limit, 200)));
  const now = Date.now();
  const startTs = now - minutes * 60 * 1000;
  const anomalies = (db.securityAnomalies || [])
    .filter((item) => {
      const ts = new Date(item.detectedAt).getTime();
      return Number.isFinite(ts) && ts >= startTs;
    })
    .sort((a, b) => new Date(b.detectedAt) - new Date(a.detectedAt))
    .slice(0, limit);
  res.json({ success: true, anomalies, minutes, total: anomalies.length });
});

app.get('/api/ui-config', (req, res) => {
  const db = readDbWithCache();
  if (!db.uiConfig) {
    db.uiConfig = {
      banner: 'https://picsum.photos/750/300?random=100',
      shopBanners: [
        {
          id: 1,
          image: 'https://picsum.photos/800/300?random=100',
          targetPage: '/packageShop/pages/product/product?id=1'
        },
        {
          id: 2,
          image: 'https://picsum.photos/800/300?random=101',
          targetPage: '/packageShop/pages/product/product?id=3'
        }
      ],
      tabBar: [
        { pagePath: '/pages/yiwen/yiwen', text: '首页', icon: '🏠' },
        { pagePath: '/pages/yixun/yixun', text: '义讯', icon: '📺' },
        { pagePath: '/pages/shop/shop', text: '商城', icon: '🛒' },
        { pagePath: '/pages/member/member', text: '我的', icon: '👤' }
      ],
      defaultAvatar: '',
      publisherAvatar: '',
      themeColor: '#07c160'
    };
    writeDb(db);
  } else if (!Array.isArray(db.uiConfig.shopBanners)) {
    db.uiConfig.shopBanners = [
      {
        id: 1,
        image: 'https://picsum.photos/800/300?random=100',
        targetPage: '/packageShop/pages/product/product?id=1'
      },
      {
        id: 2,
        image: 'https://picsum.photos/800/300?random=101',
        targetPage: '/packageShop/pages/product/product?id=3'
      }
    ];
    writeDb(db);
  }
  res.json({ success: true, config: db.uiConfig });
});

app.post('/api/ui-config', (req, res) => {
  const db = readDbWithCache();
  const newConfig = req.body;
  if (!newConfig) {
    res.status(400).json({ success: false, message: '配置不能为空' });
    return;
  }
  db.uiConfig = { ...db.uiConfig, ...newConfig };
  writeDb(db);
  res.json({ success: true, config: db.uiConfig });
});

app.get('/api/articles', (req, res) => {
  const db = readDbWithCache();
  const { limit, page, keyword } = req.query;
  let items = [...db.articles].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (keyword) {
    const kw = String(keyword).toLowerCase();
    items = items.filter((item) => item.title.toLowerCase().includes(kw) || item.summary.toLowerCase().includes(kw));
  }
  const { list, total, limit: realLimit, page: realPage } = pagination(items, page, limit || items.length);
  res.json({ success: true, articles: list, total, page: realPage, limit: realLimit });
});

app.get('/api/articles/:id', (req, res) => {
  const db = readDbWithCache();
  const article = db.articles.find((item) => item._id === req.params.id);
  if (!article) {
    res.status(404).json({ success: false, message: '文章不存在' });
    return;
  }
  const shouldIncreaseViews = req.query.noView !== '1';
  if (shouldIncreaseViews) {
    article.views = toInt(article.views) + 1;
    article.updatedAt = new Date().toISOString();
    writeDb(db);
  }
  res.json({ success: true, article });
});

app.post('/api/articles', (req, res) => {
  const db = readDbWithCache();
  const now = new Date().toISOString();
  const article = {
    _id: createId('article'),
    title: req.body.title || '未命名文章',
    summary: req.body.summary || '',
    content: req.body.content || '',
    cover: req.body.cover || '',
    author: req.body.author || '自动管理员',
    avatar: req.body.avatar || '',
    views: toInt(req.body.views),
    likes: toInt(req.body.likes),
    createdAt: now,
    updatedAt: now
  };
  db.articles.unshift(article);
  writeDb(db);
  res.json({ success: true, article });
});

app.put('/api/articles/:id', (req, res) => {
  const db = readDbWithCache();
  const article = db.articles.find((item) => item._id === req.params.id);
  if (!article) {
    res.status(404).json({ success: false, message: '文章不存在' });
    return;
  }
  article.title = req.body.title ?? article.title;
  article.summary = req.body.summary ?? article.summary;
  article.content = req.body.content ?? article.content;
  article.cover = req.body.cover ?? article.cover;
  article.author = req.body.author ?? article.author;
  article.avatar = req.body.avatar ?? article.avatar;
  article.likes = req.body.likes !== undefined ? toInt(req.body.likes) : article.likes;
  article.views = req.body.views !== undefined ? toInt(req.body.views) : article.views;
  article.updatedAt = new Date().toISOString();
  writeDb(db);
  res.json({ success: true, article });
});

app.delete('/api/articles/:id', (req, res) => {
  const db = readDbWithCache();
  const index = db.articles.findIndex((item) => item._id === req.params.id);
  if (index < 0) {
    res.status(404).json({ success: false, message: '文章不存在' });
    return;
  }
  db.articles.splice(index, 1);
  writeDb(db);
  res.json({ success: true });
});

app.delete('/api/articles', (req, res) => {
  const db = readDbWithCache();
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ success: false, message: '请选择要删除的文章' });
    return;
  }
  const idsToDelete = new Set(ids);
  let deletedCount = 0;
  
  db.articles = db.articles.filter((article) => {
    if (idsToDelete.has(article._id)) {
      deletedCount++;
      return false;
    }
    return true;
  });
  
  writeDb(db);
  res.json({ success: true, deletedCount });
});

app.get('/api/exchange-products', (req, res) => {
  const db = readDbWithCache();
  const { limit, page, keyword } = req.query;
  let items = [...(db.exchangeProducts || [])].sort((a, b) => (a.sort || 0) - (b.sort || 0));
  if (keyword) {
    const kw = String(keyword).toLowerCase();
    items = items.filter((item) => item.name.toLowerCase().includes(kw));
  }
  const { list, total, page: realPage, limit: realLimit } = pagination(items, page, limit || items.length);
  res.json({ success: true, exchangeProducts: list, total, page: realPage, limit: realLimit });
});

app.get('/api/exchange-products/:id', (req, res) => {
  const db = readDbWithCache();
  const product = (db.exchangeProducts || []).find((item) => item._id === req.params.id);
  if (!product) {
    res.status(404).json({ success: false, message: '兑换商品不存在' });
    return;
  }
  res.json({ success: true, exchangeProduct: product });
});

app.post('/api/exchange-products', (req, res) => {
  const db = readDbWithCache();
  if (!db.exchangeProducts) db.exchangeProducts = [];
  const now = new Date().toISOString();
  
  const product = {
    _id: createId('exchange'),
    name: req.body.name || '未命名商品',
    cover: req.body.cover || '',
    pointsRequired: toInt(req.body.pointsRequired),
    originalPrice: toPrice(req.body.originalPrice),
    description: req.body.description || '',
    isHot: !!req.body.isHot,
    sort: toInt(req.body.sort, db.exchangeProducts.length + 1),
    createdAt: now,
    updatedAt: now
  };
  
  db.exchangeProducts.push(product);
  writeDb(db);
  res.json({ success: true, exchangeProduct: product });
});

app.put('/api/exchange-products/:id', (req, res) => {
  const db = readDbWithCache();
  if (!db.exchangeProducts) db.exchangeProducts = [];
  const product = db.exchangeProducts.find((item) => item._id === req.params.id);
  if (!product) {
    res.status(404).json({ success: false, message: '兑换商品不存在' });
    return;
  }
  
  if (req.body.name !== undefined) product.name = req.body.name;
  if (req.body.cover !== undefined) product.cover = req.body.cover;
  if (req.body.pointsRequired !== undefined) product.pointsRequired = toInt(req.body.pointsRequired);
  if (req.body.originalPrice !== undefined) product.originalPrice = toPrice(req.body.originalPrice);
  if (req.body.description !== undefined) product.description = req.body.description;
  if (req.body.isHot !== undefined) product.isHot = !!req.body.isHot;
  if (req.body.sort !== undefined) product.sort = toInt(req.body.sort);
  
  product.updatedAt = new Date().toISOString();
  writeDb(db);
  res.json({ success: true, exchangeProduct: product });
});

app.delete('/api/exchange-products/:id', (req, res) => {
  const db = readDbWithCache();
  if (!db.exchangeProducts) db.exchangeProducts = [];
  const index = db.exchangeProducts.findIndex((item) => item._id === req.params.id);
  if (index < 0) {
    res.status(404).json({ success: false, message: '兑换商品不存在' });
    return;
  }
  db.exchangeProducts.splice(index, 1);
  writeDb(db);
  res.json({ success: true });
});

app.get('/api/videos', (req, res) => {
  const db = readDbWithCache();
  const { limit, page, keyword } = req.query;
  let items = [...db.videos].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (keyword) {
    const kw = String(keyword).toLowerCase();
    items = items.filter((item) => item.title.toLowerCase().includes(kw) || item.author.toLowerCase().includes(kw));
  }
  
  const defaultAvatar = resolveValidAvatar(db.uiConfig?.defaultAvatar, FALLBACK_PUBLISHER_AVATAR);
  const publisherAvatar = resolveValidAvatar(db.uiConfig?.publisherAvatar, defaultAvatar);
  
  // 重新计算每个视频的真实评论数量，并使用配置的发布者头像
  const itemsWithRealCommentCount = items.map(video => {
    const realCommentCount = countVideoComments(db, video._id);
    return {
      ...video,
      comments: realCommentCount,
      avatar: resolveValidAvatar(video.avatar, publisherAvatar)
    };
  });
  
  const { list, total, page: realPage, limit: realLimit } = pagination(itemsWithRealCommentCount, page, limit || itemsWithRealCommentCount.length);
  res.json({ success: true, videos: list, total, page: realPage, limit: realLimit });
});

app.get('/api/videos/:id', (req, res) => {
  const db = readDbWithCache();
  const video = db.videos.find((item) => item._id === req.params.id);
  if (!video) {
    res.status(404).json({ success: false, message: '视频不存在' });
    return;
  }
  
  const defaultAvatar = resolveValidAvatar(db.uiConfig?.defaultAvatar, FALLBACK_PUBLISHER_AVATAR);
  const publisherAvatar = resolveValidAvatar(db.uiConfig?.publisherAvatar, defaultAvatar);
  
  // 重新计算真实评论数量，并使用配置的发布者头像
  const realCommentCount = countVideoComments(db, video._id);
  const videoWithRealCommentCount = {
    ...video,
    comments: realCommentCount,
    avatar: resolveValidAvatar(video.avatar, publisherAvatar)
  };
  
  res.json({ success: true, video: videoWithRealCommentCount });
});

app.post('/api/videos', (req, res) => {
  const db = readDbWithCache();
  const now = new Date().toISOString();
  const video = {
    _id: createId('video'),
    title: req.body.title || '未命名视频',
    cover: req.body.cover || '',
    videoUrl: req.body.videoUrl || '',
    author: req.body.author || OFFICIAL_PUBLISHER.name,
    avatar: OFFICIAL_PUBLISHER.avatar,
    publisherId: OFFICIAL_PUBLISHER.id,
    likes: toInt(req.body.likes),
    comments: toInt(req.body.comments),
    likedBy: [],
    createdAt: now,
    updatedAt: now
  };
  
  // Move files to video folder
  const videoFolder = `videos/${video._id}`;
  if (video.cover) {
    video.cover = moveFileToFolder(video.cover, videoFolder);
  }
  if (video.videoUrl) {
    video.videoUrl = moveFileToFolder(video.videoUrl, videoFolder);
  }
  
  db.videos.unshift(video);
  writeDb(db);
  res.json({ success: true, video });
});

app.put('/api/videos/:id', (req, res) => {
  const db = readDbWithCache();
  const video = db.videos.find((item) => item._id === req.params.id);
  if (!video) {
    res.status(404).json({ success: false, message: '视频不存在' });
    return;
  }
  
  const videoFolder = `videos/${video._id}`;
  
  if (req.body.title !== undefined) video.title = req.body.title;
  if (req.body.cover !== undefined) {
    video.cover = moveFileToFolder(req.body.cover || '', videoFolder);
  }
  if (req.body.videoUrl !== undefined) {
    video.videoUrl = moveFileToFolder(req.body.videoUrl || '', videoFolder);
  }
  if (req.body.author !== undefined) video.author = req.body.author;
  if (req.body.avatar !== undefined) video.avatar = req.body.avatar;
  if (req.body.publisherId !== undefined) video.publisherId = req.body.publisherId;
  if (req.body.likes !== undefined) video.likes = toInt(req.body.likes);
  if (req.body.comments !== undefined) video.comments = toInt(req.body.comments);
  video.updatedAt = new Date().toISOString();
  writeDb(db);
  res.json({ success: true, video });
});

app.delete('/api/videos/:id', (req, res) => {
  const db = readDbWithCache();
  const index = db.videos.findIndex((item) => item._id === req.params.id);
  if (index < 0) {
    res.status(404).json({ success: false, message: '视频不存在' });
    return;
  }
  const removed = db.videos[index];

  // Delete video folder
  const videoFolder = `videos/${req.params.id}`;
  deleteFolder(videoFolder);

  db.videos.splice(index, 1);
  db.comments = db.comments.filter((item) => item.videoId !== removed._id);
  writeDb(db);
  res.json({ success: true });
});

app.delete('/api/videos', (req, res) => {
  const db = readDbWithCache();
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ success: false, message: '请选择要删除的视频' });
    return;
  }
  const idsToDelete = new Set(ids);
  let deletedCount = 0;
  const deletedVideoIds = [];
  
  db.videos = db.videos.filter((video) => {
    if (idsToDelete.has(video._id)) {
      deletedCount++;
      deletedVideoIds.push(video._id);
      // Delete video folder
      const videoFolder = `videos/${video._id}`;
      deleteFolder(videoFolder);
      return false;
    }
    return true;
  });
  
  // Delete related comments
  db.comments = db.comments.filter((item) => !deletedVideoIds.includes(item.videoId));
  
  writeDb(db);
  res.json({ success: true, deletedCount });
});

app.post('/api/videos/:id/like', (req, res) => {
  const db = readDbWithCache();
  const video = db.videos.find((item) => item._id === req.params.id);
  if (!video) {
    res.status(404).json({ success: false, message: '视频不存在' });
    return;
  }
  const userId = req.header('x-user-id') || 'wx_user_001';
  const securityResult = enforceBehaviorSecurity(req, res, db, 'video_like', { userId });
  if (securityResult.blocked) {
    return;
  }
  const likedBy = Array.isArray(video.likedBy) ? video.likedBy : [];
  const idx = likedBy.indexOf(userId);
  let liked = false;
  if (idx >= 0) {
    likedBy.splice(idx, 1);
    video.likes = Math.max(0, toInt(video.likes) - 1);
    liked = false;
  } else {
    likedBy.push(userId);
    video.likes = toInt(video.likes) + 1;
    liked = true;
  }
  video.likedBy = likedBy;
  video.updatedAt = new Date().toISOString();
  writeDb(db);
  res.json({ success: true, data: { liked, likes: video.likes } });
});

app.get('/api/videos/:id/comments', (req, res) => {
  const db = readDbWithCache();
  const video = db.videos.find((item) => item._id === req.params.id);
  if (!video) {
    res.status(404).json({ success: false, message: '视频不存在' });
    return;
  }
  const tree = buildCommentTree(db, video._id);
  const totalComments = countVideoComments(db, video._id);
  const { list, total, page, limit } = pagination(tree, req.query.page, req.query.limit);
  res.json({ success: true, data: list, total, totalComments, page, limit });
});

app.post('/api/videos/:id/comments', (req, res) => {
  const db = readDbWithCache();
  const video = db.videos.find((item) => item._id === req.params.id);
  if (!video) {
    res.status(404).json({ success: false, message: '视频不存在' });
    return;
  }
  const content = String(req.body.content || '').trim();
  if (!content) {
    res.status(400).json({ success: false, message: '评论内容不能为空' });
    return;
  }
  const parentId = req.body.parentId || null;
  const userId = req.body.userId || req.header('x-user-id') || 'wx_user_001';
  const securityResult = enforceBehaviorSecurity(req, res, db, 'comment', { userId });
  if (securityResult.blocked) {
    return;
  }
  
  let user = db.users.find((item) => item._id === userId);
  let nickname = req.body.nickname || '微信用户';
  let avatar = req.body.avatar || '';
  
  if (user) {
    nickname = user.nickname || nickname;
    avatar = user.avatar || avatar;
  }
  
  const now = new Date().toISOString();
  const comment = {
    _id: createId('comment'),
    videoId: video._id,
    parentId,
    rootId: parentId || null,
    userId,
    nickname,
    avatar,
    content,
    likes: 0,
    likedBy: [],
    sourceIp: getClientIp(req),
    createdAt: now,
    updatedAt: now
  };
  db.comments.unshift(comment);
  refreshVideoCommentCount(db, video._id);
  writeDb(db);
  res.json({
    success: true,
    data: {
      _id: comment._id,
      videoId: comment.videoId,
      parentId: comment.parentId,
      rootId: comment.rootId,
      content: comment.content,
      likes: comment.likes,
      likedBy: comment.likedBy,
      createdAt: comment.createdAt,
      userId: {
        _id: comment.userId,
        nickname: comment.nickname,
        avatar: comment.avatar
      }
    }
  });
});

app.delete('/api/comments/:commentId', (req, res) => {
  const db = readDbWithCache();
  const normalizeUserId = (value) => {
    if (!value) return '';
    if (typeof value === 'object') {
      const objectId = value._id || value.id || value.userId;
      return objectId ? String(objectId) : '';
    }
    return String(value);
  };
  const userId = normalizeUserId(req.header('x-user-id') || req.body?.userId || 'wx_user_001');
  const targetComment = db.comments.find((item) => item._id === req.params.commentId);
  if (!targetComment) {
    res.status(404).json({ success: false, message: '评论不存在' });
    return;
  }
  const commentOwnerId = normalizeUserId(targetComment.userId);
  if (!commentOwnerId || commentOwnerId !== userId) {
    res.status(403).json({ success: false, message: '仅支持删除自己发布的评论' });
    return;
  }
  const idsToDelete = new Set([targetComment._id]);
  let changed = true;
  while (changed) {
    changed = false;
    db.comments.forEach((item) => {
      if (idsToDelete.has(item._id)) return;
      if (idsToDelete.has(item.parentId)) {
        idsToDelete.add(item._id);
        changed = true;
      }
    });
  }
  const videoIdsToRefresh = new Set();
  db.comments.forEach((item) => {
    if (idsToDelete.has(item._id)) {
      videoIdsToRefresh.add(item.videoId);
    }
  });
  db.comments = db.comments.filter((item) => !idsToDelete.has(item._id));
  videoIdsToRefresh.forEach((videoId) => {
    refreshVideoCommentCount(db, videoId);
  });
  writeDb(db);
  res.json({ success: true, deletedCount: idsToDelete.size });
});

app.get('/api/comments/:commentId/replies', (req, res) => {
  const db = readDbWithCache();
  
  const getUserInfo = (userId, fallbackNickname, fallbackAvatar) => {
    const user = db.users.find((u) => u._id === userId);
    return {
      _id: userId,
      nickname: user?.nickname || fallbackNickname || '微信用户',
      avatar: user?.avatar || fallbackAvatar || 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0',
      isMember: user?.isMember || false
    };
  };
  
  const replies = db.comments
    .filter((item) => item.parentId === req.params.commentId)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .map((item) => ({
      _id: item._id,
      videoId: item.videoId,
      parentId: item.parentId,
      rootId: item.rootId,
      content: item.content,
      likes: item.likes || 0,
      likedBy: item.likedBy || [],
      createdAt: item.createdAt,
      userId: getUserInfo(item.userId, item.nickname, item.avatar)
    }));
  const { list, total, page, limit } = pagination(replies, req.query.page, req.query.limit);
  res.json({ success: true, data: list, total, page, limit });
});

app.post('/api/comments/:commentId/like', (req, res) => {
  const db = readDbWithCache();
  const comment = db.comments.find((item) => item._id === req.params.commentId);
  if (!comment) {
    res.status(404).json({ success: false, message: '评论不存在' });
    return;
  }
  const userId = req.body.userId || req.header('x-user-id') || 'wx_user_001';
  const securityResult = enforceBehaviorSecurity(req, res, db, 'comment_like', { userId });
  if (securityResult.blocked) {
    return;
  }
  const likedBy = Array.isArray(comment.likedBy) ? comment.likedBy : [];
  const idx = likedBy.indexOf(userId);
  let liked = false;
  if (idx >= 0) {
    likedBy.splice(idx, 1);
    comment.likes = Math.max(0, toInt(comment.likes) - 1);
    liked = false;
  } else {
    likedBy.push(userId);
    comment.likes = toInt(comment.likes) + 1;
    liked = true;
  }
  comment.likedBy = likedBy;
  comment.updatedAt = new Date().toISOString();
  writeDb(db);
  res.json({ success: true, data: { liked, likes: comment.likes } });
});

app.get('/api/admin/comments', (req, res) => {
  const db = readDbWithCache();
  const { videoId, limit, page } = req.query;
  let comments = [...db.comments].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (videoId) {
    comments = comments.filter((item) => item.videoId === videoId);
  }
  
  const getUserInfo = (userId, fallbackNickname) => {
    const user = db.users.find((u) => u._id === userId);
    return user?.nickname || fallbackNickname || '微信用户';
  };
  
  const listWithUpdatedNicknames = comments.map(comment => ({
    ...comment,
    nickname: getUserInfo(comment.userId, comment.nickname)
  }));
  
  const { list, total, page: realPage, limit: realLimit } = pagination(listWithUpdatedNicknames, page, limit);
  res.json({ success: true, comments: list, total, page: realPage, limit: realLimit });
});

app.delete('/api/admin/comments/:commentId', (req, res) => {
  const db = readDbWithCache();
  const index = db.comments.findIndex((item) => item._id === req.params.commentId);
  if (index < 0) {
    res.status(404).json({ success: false, message: '评论不存在' });
    return;
  }
  const removedComment = db.comments[index];
  const videoId = removedComment.videoId;
  db.comments.splice(index, 1);
  db.comments = db.comments.filter((item) => item.parentId !== removedComment._id);
  refreshVideoCommentCount(db, videoId);
  writeDb(db);
  res.json({ success: true });
});

app.delete('/api/admin/comments', (req, res) => {
  const db = readDbWithCache();
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ success: false, message: '请选择要删除的评论' });
    return;
  }
  const videoIdsToRefresh = new Set();
  const idsToDelete = new Set(ids);
  let deletedCount = 0;
  db.comments = db.comments.filter((comment) => {
    if (idsToDelete.has(comment._id)) {
      videoIdsToRefresh.add(comment.videoId);
      deletedCount++;
      return false;
    }
    if (idsToDelete.has(comment.parentId)) {
      videoIdsToRefresh.add(comment.videoId);
      deletedCount++;
      return false;
    }
    return true;
  });
  videoIdsToRefresh.forEach((videoId) => {
    refreshVideoCommentCount(db, videoId);
  });
  writeDb(db);
  res.json({ success: true, deletedCount });
});

app.get('/api/products', (req, res) => {
  const db = readDbWithCache();
  const { limit, page, keyword, category } = req.query;
  const sortChanged = normalizeProductSortSequence(db.products);
  
  let dbChanged = sortChanged;
  db.products.forEach((product) => {
    if (!product.productNumber) {
      product.productNumber = generateProductNumber(db.products);
      dbChanged = true;
    }
  });
  
  if (dbChanged) {
    writeDb(db);
  }
  let items = sortProductsBySort(db.products);
  if (keyword) {
    const kw = String(keyword).toLowerCase();
    items = items.filter((item) => item.name.toLowerCase().includes(kw) || item.category.toLowerCase().includes(kw));
  }
  if (category && category !== '全部') {
    items = items.filter((item) => item.category === category);
  }
  const { list, total, page: realPage, limit: realLimit } = pagination(items, page, limit || items.length);
  res.json({ success: true, products: list.map(normalizeProductOutput), total, page: realPage, limit: realLimit });
});

app.get('/api/products/:id', (req, res) => {
  const db = readDbWithCache();
  const product = db.products.find((item) => item._id === req.params.id);
  if (!product) {
    res.status(404).json({ success: false, message: '商品不存在' });
    return;
  }
  res.json({ success: true, product: normalizeProductOutput(product) });
});

app.post('/api/products', (req, res) => {
  const db = readDbWithCache();
  const now = new Date().toISOString();
  let coverImages = [];
  if (req.body.cover) {
    coverImages = Array.isArray(req.body.cover) ? req.body.cover : [req.body.cover];
  }
  let detailImages = [];
  if (req.body.detailImages) {
    detailImages = Array.isArray(req.body.detailImages) ? req.body.detailImages : [req.body.detailImages];
  } else if (req.body.detailImage) {
    detailImages = [req.body.detailImage];
  }
  const product = {
    _id: createId('product'),
    productNumber: generateProductNumber(db.products),
    name: req.body.name || '未命名商品',
    cover: coverImages,
    detailImages,
    price: toPrice(req.body.price),
    originalPrice: toPrice(req.body.originalPrice),
    sales: toInt(req.body.sales),
    stock: toInt(req.body.stock, 0),
    category: req.body.category || '默认分类',
    serviceTags: normalizeServiceTags(req.body.serviceTags || req.body.tags),
    sort: db.products.length + 1,
    createdAt: now,
    updatedAt: now
  };
  
  // Move files to product folder
  const productFolder = `products/${product._id}`;
  if (product.cover && product.cover.length > 0) {
    product.cover = product.cover.map(img => moveFileToFolder(img, productFolder));
  }
  if (product.detailImages && product.detailImages.length > 0) {
    product.detailImages = product.detailImages.map(img => moveFileToFolder(img, productFolder));
  }
  
  db.products.push(product);
  if (req.body.sort !== undefined) {
    moveProductToSortPosition(db.products, product._id, req.body.sort);
  } else {
    normalizeProductSortSequence(db.products);
  }
  writeDb(db);
  res.json({ success: true, product: normalizeProductOutput(product) });
});

app.put('/api/products/:id', (req, res) => {
  const db = readDbWithCache();
  const product = db.products.find((item) => item._id === req.params.id);
  if (!product) {
    res.status(404).json({ success: false, message: '商品不存在' });
    return;
  }
  
  if (!product.productNumber) {
    product.productNumber = generateProductNumber(db.products);
  }
  
  product.name = req.body.name ?? product.name;
  const productFolder = `products/${product._id}`;

  if (req.body.cover !== undefined) {
    let newCovers = Array.isArray(req.body.cover) ? req.body.cover : (req.body.cover ? [req.body.cover] : []);
    product.cover = newCovers.map(img => moveFileToFolder(img, productFolder));
  }
  if (req.body.detailImages !== undefined) {
    let newDetails = Array.isArray(req.body.detailImages) ? req.body.detailImages : (req.body.detailImages ? [req.body.detailImages] : []);
    product.detailImages = newDetails.map(img => moveFileToFolder(img, productFolder));
  } else if (req.body.detailImage !== undefined) {
    let newDetails = req.body.detailImage ? [req.body.detailImage] : [];
    product.detailImages = newDetails.map(img => moveFileToFolder(img, productFolder));
  }
  product.price = req.body.price !== undefined ? toPrice(req.body.price) : product.price;
  product.originalPrice = req.body.originalPrice !== undefined ? toPrice(req.body.originalPrice) : product.originalPrice;
  product.sales = req.body.sales !== undefined ? toInt(req.body.sales) : product.sales;
  product.stock = req.body.stock !== undefined ? toInt(req.body.stock) : product.stock;
  product.category = req.body.category ?? product.category;
  if (req.body.serviceTags !== undefined || req.body.tags !== undefined) {
    product.serviceTags = normalizeServiceTags(req.body.serviceTags || req.body.tags);
  } else {
    product.serviceTags = normalizeServiceTags(product.serviceTags || product.tags);
  }
  if (req.body.sort !== undefined) {
    moveProductToSortPosition(db.products, product._id, req.body.sort);
  }
  normalizeProductSortSequence(db.products);
  product.updatedAt = new Date().toISOString();
  writeDb(db);
  res.json({ success: true, product: normalizeProductOutput(product) });
});

app.delete('/api/products/:id', (req, res) => {
  const db = readDbWithCache();
  const index = db.products.findIndex((item) => item._id === req.params.id);
  if (index < 0) {
    res.status(404).json({ success: false, message: '商品不存在' });
    return;
  }
  
  // Delete product folder
  const productFolder = `products/${req.params.id}`;
  deleteFolder(productFolder);
  
  db.products.splice(index, 1);
  writeDb(db);
  res.json({ success: true });
});



app.get('/api/orders', (req, res) => {
  const db = readDbWithCache();
  const { limit, page, userId, status } = req.query;
  let items = [...db.orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (userId) {
    items = items.filter((item) => item.userId === userId);
  }
  if (status && status !== 'all') {
    items = items.filter((item) => item.status === status);
  }
  const { list, total, page: realPage, limit: realLimit } = pagination(items, page, limit || items.length);
  const orders = list.map((item) => {
    const user = db.users.find(u => u._id === item.userId);
    return {
      ...item,
      shippingAddress: item.shippingAddress || normalizeShippingAddress(item.address),
      userNumber: user ? user.userNumber : '',
      userName: user ? user.nickname : item.userName
    };
  });
  res.json({ success: true, orders, total, page: realPage, limit: realLimit });
});

app.get('/api/orders/export', (req, res) => {
  const db = readDbWithCache();
  const statusMap = {
    pending: '待支付',
    paid: '已支付',
    cancelled: '已取消',
    refund_pending: '售后中',
    refunded: '已退款'
  };
  const shippingStatusMap = {
    unshipped: '未发货',
    shipped: '已发货'
  };
  
  const formatDateTime = (input) => {
    if (!input) return '-';
    try {
      const d = new Date(input);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const h = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      const sec = String(d.getSeconds()).padStart(2, '0');
      return `${y}-${m}-${day} ${h}:${min}:${sec}`;
    } catch {
      return String(input);
    }
  };
  
  const formatItemNames = (items) => {
    if (!Array.isArray(items) || items.length === 0) return '-';
    return items.map((item) => item.name || '-').join('; ');
  };
  
  const formatItemCount = (items) => {
    if (!Array.isArray(items) || items.length === 0) return 0;
    return items.reduce((total, item) => total + (item.quantity || 1), 0);
  };
  
  const data = [];
  
  data.push([
    '订单号',
    '用户编号',
    '用户名',
    '商品名称',
    '商品数量',
    '总金额',
    '收货地址',
    '状态',
    '发货状态',
    '快递单号',
    '创建时间'
  ]);
  
  db.orders.forEach((item) => {
    const user = db.users.find(u => u._id === item.userId);
    const shippingAddress = item.shippingAddress || normalizeShippingAddress(item.address);
    const totalPrice = Number(item.totalPrice || 0).toFixed(2);
    const statusText = statusMap[item.status] || item.status || '-';
    const shippingStatusText = shippingStatusMap[item.shippingStatus] || item.shippingStatus || '-';
    
    const userNumber = user?.userNumber || '-';
    const itemNames = formatItemNames(item.items);
    const itemCount = formatItemCount(item.items);
    const createTime = formatDateTime(item.createdAt);
    
    data.push([
      item.orderNumber || '-',
      userNumber,
      item.userName || '-',
      itemNames,
      itemCount,
      totalPrice,
      shippingAddress || '-',
      statusText,
      shippingStatusText,
      item.trackingNumber || '',
      createTime
    ]);
  });
  
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '订单');
  
  const filename = `orders-export-${Date.now()}.xlsx`;
  const tempPath = path.join(__dirname, 'temp', filename);
  
  if (!fs.existsSync(path.dirname(tempPath))) {
    fs.mkdirSync(path.dirname(tempPath), { recursive: true });
  }
  
  XLSX.writeFile(workbook, tempPath);
  
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  
  const fileStream = fs.createReadStream(tempPath);
  fileStream.pipe(res);
  
  fileStream.on('end', () => {
    fs.unlink(tempPath, (err) => {
      if (err) logger.error('删除临时文件失败', { err });
    });
  });
});

const uploadExcel = createUploadMiddleware({
  maxSize: 10 * 1024 * 1024,
  allowedMimePattern: /^application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet$|^application\/vnd\.ms-excel$|^application\/excel$|^application\/octet-stream$/,
  allowedExtensions: new Set(['.xlsx', '.xls', '.csv'])
});

app.post('/api/orders/import', uploadExcel.single('file'), (req, res) => {
  const db = readDbWithCache();
  let input = [];
  
  if (req.file) {
    try {
      logger.info('开始解析文件', { 
        filename: req.file.originalname, 
        path: req.file.path,
        size: req.file.size
      });
      
      let data = [];
      
      try {
        logger.info('尝试用xlsx库解析');
        const workbook = XLSX.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        logger.info('找到工作表', { sheetName, sheetCount: workbook.SheetNames.length });
        
        const worksheet = workbook.Sheets[sheetName];
        data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        
        logger.info('Excel解析完成', { totalRows: data.length });
      } catch (xlsxError) {
        logger.info('xlsx解析失败，尝试HTML解析', { error: xlsxError.message });
        
        const fileContent = fs.readFileSync(req.file.path, 'utf8').replace(/\uFEFF/g, '');
        
        if (fileContent.includes('<table') && fileContent.includes('<tr')) {
          const $ = cheerio.load(fileContent);
          const table = $('table').first();
          const rows = table.find('tr');
          
          logger.info('找到HTML表格', { rowCount: rows.length });
          
          rows.each((index, row) => {
            const cells = $(row).find('th, td');
            const rowData = [];
            cells.each((i, cell) => {
              let text = $(cell).text().trim().replace(/\uFEFF/g, '');
              rowData.push(text);
            });
            if (rowData.length > 0) {
              data.push(rowData);
            }
          });
          
          logger.info('HTML表格解析完成', { totalRows: data.length });
        } else {
          throw new Error('文件格式不支持，请使用Excel文件');
        }
      }
      
      if (data.length > 0) {
        const headers = data[0];
        logger.info('表头信息', { headers, headerCount: headers.length });
        
        const findColumnIndex = (name) => {
          const nameTrimmed = name.trim();
          return headers.findIndex((h, idx) => {
            const headerStr = String(h || '').trim();
            const found = headerStr === nameTrimmed || headerStr.includes(nameTrimmed);
            if (found) {
              logger.info(`找到列 "${name}"`, { index: idx, header: headerStr });
            }
            return found;
          });
        };
        
        const orderNumberIndex = findColumnIndex('订单号');
        const trackingNumberIndex = findColumnIndex('快递单号');
        
        logger.info('列索引', { orderNumberIndex, trackingNumberIndex });
        
        if (orderNumberIndex === -1) {
          fs.unlinkSync(req.file.path);
          res.status(400).json({ 
            success: false, 
            message: '文件必须包含"订单号"列，当前表头: ' + JSON.stringify(headers) 
          });
          return;
        }
        
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          if (!row || row.length === 0) continue;
          
          const orderNumber = row[orderNumberIndex];
          
          if (orderNumber && String(orderNumber).trim()) {
            const cleanOrderNumber = String(orderNumber).trim().replace(/\uFEFF/g, '').replace(/^-+$/, '');
            if (cleanOrderNumber) {
              const trackingNumber = trackingNumberIndex !== -1 ? row[trackingNumberIndex] : '';
              const cleanTrackingNumber = trackingNumber ? String(trackingNumber).trim().replace(/\uFEFF/g, '').replace(/^-+$/, '') : '';
              
              input.push({
                orderNumber: cleanOrderNumber,
                trackingNumber: cleanTrackingNumber
              });
            }
          }
        }
        
        logger.info('解析到有效数据', { count: input.length, data: input.slice(0, 5) });
      }
      
      fs.unlinkSync(req.file.path);
    } catch (error) {
      logger.error('文件解析出错', { error: error.message, stack: error.stack });
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(400).json({ success: false, message: '文件解析失败: ' + error.message });
      return;
    }
  } else {
    input = Array.isArray(req.body?.orders) ? req.body.orders : (Array.isArray(req.body) ? req.body : []);
  }
  
  if (input.length === 0) {
    res.status(400).json({ success: false, message: '导入数据为空，请检查文件内容' });
    return;
  }
  
  const mode = req.body?.mode === 'replace' ? 'replace' : 'merge';
  const now = new Date().toISOString();
  let updatedCount = 0;
  let notFoundCount = 0;
  
  logger.info('开始匹配订单', { inputCount: input.length });
  
  input.forEach((item, idx) => {
    if (!item.orderNumber) return;
    
    const existingOrder = db.orders.find((order) => order.orderNumber === item.orderNumber);
    if (existingOrder) {
      existingOrder.trackingNumber = item.trackingNumber || existingOrder.trackingNumber;
      if (item.trackingNumber) {
        existingOrder.shippingStatus = 'shipped';
      }
      existingOrder.updatedAt = now;
      updatedCount++;
      logger.info(`更新订单 ${idx}`, { orderNumber: item.orderNumber, trackingNumber: item.trackingNumber });
    } else {
      notFoundCount++;
      logger.warn('未找到订单', { orderNumber: item.orderNumber, index: idx });
    }
  });
  
  writeDb(db);
  logger.info('导入完成', { imported: input.length, updated: updatedCount, notFound: notFoundCount });
  res.json({ 
    success: true, 
    imported: input.length, 
    updated: updatedCount,
    notFound: notFoundCount,
    total: db.orders.length 
  });
});

app.get('/api/orders/:id', (req, res) => {
  const db = readDbWithCache();
  const order = db.orders.find((item) => item._id === req.params.id);
  if (!order) {
    res.status(404).json({ success: false, message: '订单不存在' });
    return;
  }
  const user = db.users.find(u => u._id === order.userId);
  res.json({
    success: true,
    order: {
      ...order,
      shippingAddress: order.shippingAddress || normalizeShippingAddress(order.address),
      userNumber: user ? user.userNumber : '',
      userName: user ? user.nickname : order.userName
    }
  });
});

app.post('/api/orders', (req, res) => {
  const db = readDbWithCache();
  const userId = req.body.userId || req.header('x-user-id') || 'wx_user_001';
  const user = getOrCreateUser(db, userId, req.body.userName || '微信用户');
  const memberStatus = getUserMemberStatus(user);
  const securityResult = enforceBehaviorSecurity(req, res, db, 'order_submit', { userId });
  if (securityResult.blocked) {
    return;
  }
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  const now = new Date().toISOString();
  const subtotalPrice = items.length > 0
    ? items.reduce((sum, item) => sum + toPrice(item.price) * toInt(item.quantity, 1), 0)
    : toPrice(req.body.totalPrice);
  const discountRate = memberStatus.isMember ? MEMBER_DISCOUNT_RATE : 1;
  const totalPrice = applyDiscountPrice(subtotalPrice, discountRate);
  const discountAmount = toPriceOneDecimal(subtotalPrice - totalPrice);

  const order = {
    _id: createId('order'),
    orderNumber: `ORD${Date.now()}${Math.floor(Math.random() * 1000)}`,
    userId,
    userName: req.body.userName || user.nickname || '微信用户',
    items,
    originalTotalPrice: toPriceOneDecimal(subtotalPrice),
    discountRate,
    discountAmount,
    memberDiscountApplied: memberStatus.isMember,
    totalPrice,
    status: req.body.status || 'pending',
    address: req.body.address || null,
    shippingAddress: req.body.shippingAddress || normalizeShippingAddress(req.body.address),
    shippingStatus: req.body.shippingStatus || 'unshipped',
    trackingNumber: req.body.trackingNumber || '',
    createdAt: now,
    updatedAt: now,
    payTime: null
  };
  db.orders.unshift(order);
  writeDb(db);
  res.json({ success: true, order });
});

app.post('/api/forward-track', (req, res) => {
  const db = readDbWithCache();
  const userId = req.body.userId || req.header('x-user-id') || 'wx_user_001';
  const securityResult = enforceBehaviorSecurity(req, res, db, 'forward', { userId });
  if (securityResult.blocked) {
    return;
  }
  res.json({ success: true, message: '转发记录成功' });
});

app.put('/api/orders/:id', (req, res) => {
  const db = readDbWithCache();
  const order = db.orders.find((item) => item._id === req.params.id);
  if (!order) {
    res.status(404).json({ success: false, message: '订单不存在' });
    return;
  }
  const previousStatus = order.status;
  const nextStatus = req.body.status ?? order.status;
  if (req.body.status !== undefined && nextStatus === 'refunded' && order.status !== 'refund_pending') {
    res.status(400).json({ success: false, message: '仅退款申请中的订单可改为已退款' });
    return;
  }
  order.userId = req.body.userId ?? order.userId;
  order.status = nextStatus;
  order.address = req.body.address ?? order.address;
  order.shippingAddress = req.body.shippingAddress ?? order.shippingAddress ?? normalizeShippingAddress(order.address);
  order.items = Array.isArray(req.body.items) ? req.body.items : order.items;
  order.totalPrice = req.body.totalPrice !== undefined ? toPrice(req.body.totalPrice) : order.totalPrice;
  if (req.body.payTime !== undefined) {
    order.payTime = req.body.payTime;
  }
  if (req.body.shippingStatus !== undefined) {
    order.shippingStatus = req.body.shippingStatus;
  }
  if (req.body.trackingNumber !== undefined) {
    if (req.body.trackingNumber && !order.trackingNumber) {
      order.shippedAt = new Date().toISOString();
    }
    order.trackingNumber = req.body.trackingNumber;
  }
  if (previousStatus === 'refund_pending' && nextStatus === 'refunded') {
    rollbackOrderEarnedPoints(db, order);
  }
  order.updatedAt = new Date().toISOString();
  writeDb(db);
  res.json({ success: true, order });
});

app.post('/api/orders/:id/pay', (req, res) => {
  const db = readDbWithCache();
  const order = db.orders.find((item) => item._id === req.params.id);
  if (!order) {
    res.status(404).json({ success: false, message: '订单不存在' });
    return;
  }
  order.status = 'paid';
  order.payTime = new Date().toISOString();
  if (req.body.address) {
    order.address = req.body.address;
  }
  order.shippingAddress = req.body.shippingAddress ?? order.shippingAddress ?? normalizeShippingAddress(order.address);
  order.updatedAt = new Date().toISOString();
  
  const user = getOrCreateUser(db, order.userId, order.userName || '微信用户');
  
  const earnedPoints = Math.floor(order.totalPrice);
  user.points += earnedPoints;
  user.pointsHistory.unshift({
    _id: createId('point'),
    type: 'earn',
    amount: earnedPoints,
    description: '购物奖励',
    createdAt: new Date().toISOString()
  });
  
  writeDb(db);
  res.json({ success: true, order, earnedPoints });
});

async function startWechatRefundProgram(order) {
  const refundNumber = `RFD${Date.now()}${Math.floor(Math.random() * 1000)}`;
  await new Promise((resolve) => setTimeout(resolve, 500));
  return {
    success: true,
    channel: 'wechat',
    refundNumber,
    completedAt: new Date().toISOString()
  };
}

function rollbackOrderEarnedPoints(db, order) {
  const user = db.users.find((item) => item._id === order.userId);
  if (!user) return;
  if (user.points === undefined) user.points = 0;
  if (!user.pointsHistory) user.pointsHistory = [];
  const earnedPoints = Math.floor(Number(order.totalPrice || 0));
  if (earnedPoints <= 0) return;
  user.points = Math.max(0, user.points - earnedPoints);
  user.pointsHistory.unshift({
    _id: createId('point'),
    type: 'refund',
    amount: earnedPoints,
    description: `订单退款回退积分：${order.orderNumber || ''}`,
    createdAt: new Date().toISOString()
  });
}

function processOrderRefundAsync(orderId) {
  (async () => {
    const db = readDbWithCache();
    const order = db.orders.find((item) => item._id === orderId);
    if (!order || order.status !== 'refund_pending') {
      return;
    }
    const hasTrackingNumber = String(order.trackingNumber || '').trim().length > 0;
    const isUnshippedOrder = order.shippingStatus === 'unshipped';
    if (!isUnshippedOrder || hasTrackingNumber) {
      order.refundStatus = 'pending';
      order.updatedAt = new Date().toISOString();
      writeDb(db);
      return;
    }
    try {
      const result = await startWechatRefundProgram(order);
      order.status = 'refunded';
      order.refundStatus = 'success';
      order.refundChannel = result.channel;
      order.refundNumber = result.refundNumber;
      order.refundCompletedAt = result.completedAt;
      order.updatedAt = new Date().toISOString();
      rollbackOrderEarnedPoints(db, order);
      writeDb(db);
    } catch (error) {
      order.status = 'paid';
      order.refundStatus = 'failed';
      order.refundFailedReason = error.message || '退款失败';
      order.updatedAt = new Date().toISOString();
      writeDb(db);
    }
  })();
}

app.post('/api/orders/:id/refund', (req, res) => {
  const db = readDbWithCache();
  const order = db.orders.find((item) => item._id === req.params.id);
  if (!order) {
    res.status(404).json({ success: false, message: '订单不存在' });
    return;
  }
  if (order.status === 'refunded') {
    res.json({ success: true, message: '订单已退款', order });
    return;
  }
  if (order.status === 'refund_pending') {
    res.json({ success: true, message: '退款申请处理中', order });
    return;
  }
  if (order.status !== 'paid') {
    res.status(400).json({ success: false, message: '当前订单不可退款' });
    return;
  }
  const now = new Date().toISOString();
  const hasTrackingNumber = String(order.trackingNumber || '').trim().length > 0;
  const isUnshippedOrder = order.shippingStatus === 'unshipped';
  const shouldAutoRefund = isUnshippedOrder && !hasTrackingNumber;
  order.status = 'refund_pending';
  order.refundStatus = shouldAutoRefund ? 'processing' : 'pending';
  order.refundRequestedAt = now;
  order.updatedAt = now;
  writeDb(db);
  if (shouldAutoRefund) {
    processOrderRefundAsync(order._id);
  }
  res.json({
    success: true,
    message: shouldAutoRefund ? '退款处理中' : '已提交退款申请',
    order
  });
});

app.get('/api/points/history', (req, res) => {
  const db = readDbWithCache();
  const userId = req.header('x-user-id') || 'wx_user_001';
  
  let user = db.users.find((item) => item._id === userId);
  if (!user) {
    user = {
      _id: userId,
      uniqueId: generateUniqueId(),
      userNumber: generateUserNumber(db.users),
      nickname: '微信用户',
      avatar: 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0',
      points: 0,
      checkIns: [],
      pointsHistory: []
    };
    db.users.push(user);
    writeDb(db);
  }
  
  if (!user.pointsHistory) {
    user.pointsHistory = [];
  }
  
  const { page = 1, limit = 20 } = req.query;
  const start = (Math.max(1, toInt(page, 1)) - 1) * Math.max(1, Math.min(100, toInt(limit, 20)));
  const end = start + Math.max(1, Math.min(100, toInt(limit, 20)));
  
  res.json({
    success: true,
    data: {
      list: user.pointsHistory.slice(start, end),
      total: user.pointsHistory.length,
      page: Math.max(1, toInt(page, 1)),
      limit: Math.max(1, Math.min(100, toInt(limit, 20))),
      currentPoints: user.points
    }
  });
});

app.post('/api/points/redeem', (req, res) => {
  const db = readDbWithCache();
  const userId = req.header('x-user-id') || 'wx_user_001';
  const { productId } = req.body || {};

  if (!productId) {
    res.status(400).json({ success: false, message: '缺少兑换商品ID' });
    return;
  }

  let user = db.users.find((item) => item._id === userId);
  if (!user) {
    user = {
      _id: userId,
      uniqueId: generateUniqueId(),
      userNumber: generateUserNumber(db.users),
      nickname: '微信用户',
      avatar: 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0',
      points: 0,
      checkIns: [],
      pointsHistory: []
    };
    db.users.push(user);
  }

  const product = (db.exchangeProducts || []).find((item) => item._id === productId);
  if (!product) {
    res.status(404).json({ success: false, message: '兑换商品不存在' });
    return;
  }

  const pointsRequired = toInt(product.pointsRequired);
  if (!pointsRequired || pointsRequired <= 0) {
    res.status(400).json({ success: false, message: '兑换商品积分配置无效' });
    return;
  }

  if (user.points === undefined) user.points = 0;
  if (!user.pointsHistory) user.pointsHistory = [];
  if (!db.redemptions) db.redemptions = [];

  if (user.points < pointsRequired) {
    res.status(400).json({ success: false, message: '积分不足' });
    return;
  }

  const now = new Date().toISOString();
  user.points -= pointsRequired;
  user.pointsHistory.unshift({
    _id: createId('point'),
    type: 'consume',
    amount: pointsRequired,
    description: `积分兑换：${product.name || '商品'}`,
    createdAt: now
  });

  const redemption = {
    _id: createId('redeem'),
    userId: user._id,
    itemId: product._id,
    itemName: product.name || '未命名商品',
    pointsSpent: pointsRequired,
    status: 'pending',
    createdAt: now,
    updatedAt: now
  };
  db.redemptions.unshift(redemption);

  writeDb(db);
  res.json({
    success: true,
    data: {
      currentPoints: user.points,
      redemption
    }
  });
});

app.delete('/api/orders/:id', (req, res) => {
  const db = readDbWithCache();
  const index = db.orders.findIndex((item) => item._id === req.params.id);
  if (index < 0) {
    res.status(404).json({ success: false, message: '订单不存在' });
    return;
  }
  db.orders.splice(index, 1);
  writeDb(db);
  res.json({ success: true });
});

app.delete('/api/orders', (req, res) => {
  const db = readDbWithCache();
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ success: false, message: '请选择要删除的订单' });
    return;
  }
  const idsToDelete = new Set(ids);
  let deletedCount = 0;
  db.orders = db.orders.filter((order) => {
    if (idsToDelete.has(order._id)) {
      deletedCount++;
      return false;
    }
    return true;
  });
  writeDb(db);
  res.json({ success: true, deletedCount });
});

app.get('/api/orders/:id/logs', (req, res) => {
  const db = readDbWithCache();
  const orderId = req.params.id;
  let logs = db.orderLogs || [];
  if (orderId && orderId !== 'all') {
    logs = logs.filter(log => log.orderId === orderId);
  }
  logs = [...logs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const logsWithOrderNumber = logs.map(log => {
    const order = db.orders.find(o => o._id === log.orderId);
    return {
      ...log,
      orderNumber: order ? order.orderNumber : '未知订单'
    };
  });
  const { list, total, page, limit } = pagination(logsWithOrderNumber, req.query.page, req.query.limit || 50);
  res.json({ success: true, logs: list, total, page, limit });
});

app.get('/api/orders/all/logs', (req, res) => {
  const db = readDbWithCache();
  let logs = db.orderLogs || [];
  logs = [...logs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const logsWithOrderNumber = logs.map(log => {
    const order = db.orders.find(o => o._id === log.orderId);
    return {
      ...log,
      orderNumber: order ? order.orderNumber : '未知订单'
    };
  });
  const { list, total, page, limit } = pagination(logsWithOrderNumber, req.query.page, req.query.limit || 100);
  res.json({ success: true, logs: list, total, page, limit });
});

app.get('/api/users', (req, res) => {
  const db = readDbWithCache();
  const { limit, page, keyword } = req.query;
  let items = [...db.users].sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
  
  if (keyword) {
    const kw = String(keyword).toLowerCase();
    items = items.filter((item) => 
      (item.nickname && item.nickname.toLowerCase().includes(kw)) ||
      (item.userNumber && item.userNumber.toLowerCase().includes(kw)) ||
      (item.uniqueId && item.uniqueId.toLowerCase().includes(kw))
    );
  }
  
  const { list, total, page: realPage, limit: realLimit } = pagination(items, page, limit || items.length);
  
  const users = list.map((user) => {
    const totalSpent = db.orders
      .filter(order => order.userId === user._id && order.status === 'paid')
      .reduce((sum, order) => sum + toPrice(order.totalPrice), 0);
    
    return {
      ...user,
      totalSpent
    };
  });
  
  res.json({ success: true, users, total, page: realPage, limit: realLimit });
});

app.get('/api/members', (req, res) => {
  const db = readDbWithCache();
  const { limit, page, keyword } = req.query;
  let items = [...db.users].sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));

  if (keyword) {
    const kw = String(keyword).toLowerCase();
    items = items.filter((item) =>
      (item.nickname && item.nickname.toLowerCase().includes(kw)) ||
      (item.userNumber && item.userNumber.toLowerCase().includes(kw)) ||
      (item.uniqueId && item.uniqueId.toLowerCase().includes(kw))
    );
  }

  const rows = items.map((user) => {
    const memberStatus = getUserMemberStatus(user);
    return {
      ...user,
      ...memberStatus
    };
  });

  const { list, total, page: realPage, limit: realLimit } = pagination(rows, page, limit || rows.length);
  writeDb(db);
  res.json({ success: true, members: list, total, page: realPage, limit: realLimit });
});

app.get('/api/users/:id', (req, res) => {
  const db = readDbWithCache();
  const user = db.users.find((item) => item._id === req.params.id);
  if (!user) {
    res.status(404).json({ success: false, message: '用户不存在' });
    return;
  }
  
  const totalSpent = db.orders
    .filter(order => order.userId === user._id && order.status === 'paid')
    .reduce((sum, order) => sum + toPrice(order.totalPrice), 0);
  
  res.json({ success: true, user: { ...user, totalSpent } });
});

app.post('/api/members/:id/activate', (req, res) => {
  const db = readDbWithCache();
  const user = db.users.find((item) => item._id === req.params.id);
  if (!user) {
    res.status(404).json({ success: false, message: '用户不存在' });
    return;
  }
  const planType = req.body?.planType === 'yearly' ? 'yearly' : (req.body?.planType === 'monthly' ? 'monthly' : '');
  if (!planType) {
    res.status(400).json({ success: false, message: '会员套餐无效' });
    return;
  }
  ensureUserMembershipFields(user);
  const now = new Date();
  const currentStatus = getUserMemberStatus(user);
  const baseDate = currentStatus.isMember && currentStatus.memberExpiryRaw ? new Date(currentStatus.memberExpiryRaw) : now;
  if (Number.isNaN(baseDate.getTime())) {
    baseDate.setTime(now.getTime());
  }
  if (planType === 'yearly') {
    baseDate.setFullYear(baseDate.getFullYear() + 1);
  } else {
    baseDate.setMonth(baseDate.getMonth() + 1);
  }
  user.isMember = true;
  user.memberPlan = planType;
  user.memberStartedAt = now.toISOString();
  user.memberExpiry = baseDate.toISOString();
  user.memberBenefits = {
    ...buildDefaultMemberBenefits(),
    ...user.memberBenefits,
    badgePhysicalEligible: planType === 'yearly' ? true : Boolean(user.memberBenefits?.badgePhysicalEligible),
    genealogyPhysicalEligible: planType === 'yearly' ? true : Boolean(user.memberBenefits?.genealogyPhysicalEligible)
  };
  user.updatedAt = now.toISOString();
  writeDb(db);
  res.json({
    success: true,
    message: planType === 'yearly' ? '已开通年卡会员' : '已开通月卡会员',
    member: {
      ...user,
      ...getUserMemberStatus(user)
    }
  });
});

app.post('/api/members/:id/deactivate', (req, res) => {
  const db = readDbWithCache();
  const user = db.users.find((item) => item._id === req.params.id);
  if (!user) {
    res.status(404).json({ success: false, message: '用户不存在' });
    return;
  }
  user.isMember = false;
  user.memberPlan = '';
  user.memberExpiry = '';
  user.memberStartedAt = '';
  user.memberBenefits = buildDefaultMemberBenefits();
  user.updatedAt = new Date().toISOString();
  writeDb(db);
  res.json({
    success: true,
    message: '已取消会员资格',
    member: {
      ...user,
      ...getUserMemberStatus(user)
    }
  });
});

app.put('/api/users/:id', (req, res) => {
  const db = readDbWithCache();
  const user = db.users.find((item) => item._id === req.params.id);
  if (!user) {
    res.status(404).json({ success: false, message: '用户不存在' });
    return;
  }
  
  if (req.body.nickname !== undefined) user.nickname = req.body.nickname;
  if (req.body.avatar !== undefined) user.avatar = req.body.avatar;
  if (req.body.gender !== undefined) user.gender = req.body.gender;
  if (req.body.phone !== undefined) user.phone = req.body.phone;
  if (req.body.userNumber !== undefined) user.userNumber = req.body.userNumber;
  if (req.body.address !== undefined) user.address = req.body.address;
  if (req.body.nicknameColor !== undefined) user.nicknameColor = req.body.nicknameColor;
  
  user.updatedAt = new Date().toISOString();
  writeDb(db);
  
  const totalSpent = db.orders
    .filter(order => order.userId === user._id && order.status === 'paid')
    .reduce((sum, order) => sum + toPrice(order.totalPrice), 0);
  
  res.json({ success: true, user: { ...user, totalSpent } });
});

app.delete('/api/users/:id', (req, res) => {
  const db = readDbWithCache();
  const index = db.users.findIndex((item) => item._id === req.params.id);
  if (index < 0) {
    res.status(404).json({ success: false, message: '用户不存在' });
    return;
  }
  db.users.splice(index, 1);
  writeDb(db);
  res.json({ success: true });
});

app.get('/api/export', (req, res) => {
  const db = readDbWithCache();
  const orders = db.orders.map((item) => ({
    ...item,
    shippingAddress: item.shippingAddress || normalizeShippingAddress(item.address)
  }));
  res.json({
    success: true,
    data: {
      products: db.products,
      articles: db.articles,
      videos: db.videos,
      orders
    }
  });
});


app.get('/api/points/users', (req, res) => {
  const db = readDbWithCache();
  const { limit, page } = req.query;
  // Filter only users who have points or check-ins or are just regular users
  const users = db.users.map(u => ({
    _id: u._id,
    nickname: u.nickname,
    avatar: u.avatar,
    userNumber: u.userNumber,
    points: u.points || 0,
    checkInsCount: (u.checkIns || []).length
  })).sort((a, b) => (b.points || 0) - (a.points || 0));
  
  const { list, total, page: realPage, limit: realLimit } = pagination(users, page, limit || users.length);
  res.json({ success: true, users: list, total, page: realPage, limit: realLimit });
});

app.post('/api/points/user/:id/adjust', (req, res) => {
  const db = readDbWithCache();
  const userId = req.params.id;
  const { type, amount, description } = req.body;
  
  const user = db.users.find(u => u._id === userId);
  if (!user) {
    return res.status(404).json({ success: false, message: '用户不存在' });
  }
  
  const numAmount = Number(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ success: false, message: '积分数量必须为正数' });
  }
  
  if (!user.pointsHistory) user.pointsHistory = [];
  if (user.points === undefined) user.points = 0;
  
  if (type === 'earn') {
    user.points += numAmount;
  } else if (type === 'consume') {
    user.points -= numAmount;
    if (user.points < 0) user.points = 0; // Prevent negative points
  } else {
    return res.status(400).json({ success: false, message: '无效的调整类型' });
  }
  
  user.pointsHistory.unshift({
    _id: createId('point'),
    type: type, // 'earn' or 'consume'
    amount: numAmount,
    description: description || '管理员调整',
    createdAt: new Date().toISOString()
  });
  
  writeDb(db);
  res.json({ success: true, points: user.points });
});

app.get('/api/points/user/:id/history', (req, res) => {
  const db = readDbWithCache();
  const userId = req.params.id;
  
  const user = db.users.find(u => u._id === userId);
  if (!user) {
    return res.status(404).json({ success: false, message: '用户不存在' });
  }
  
  res.json({ success: true, history: user.pointsHistory || [] });
});

app.get('/api/points/redemptions', (req, res) => {
  const db = readDbWithCache();
  const { limit, page } = req.query;
  if (!db.redemptions) db.redemptions = [];
  
  // Enrich redemption data with user info
  const redemptions = db.redemptions.map(r => {
    const user = db.users.find(u => u._id === r.userId);
    return {
      ...r,
      userName: user ? user.nickname : '未知用户',
      userAvatar: user ? user.avatar : ''
    };
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  const { list, total, page: realPage, limit: realLimit } = pagination(redemptions, page, limit || redemptions.length);
  res.json({ success: true, redemptions: list, total, page: realPage, limit: realLimit });
});

app.get('/backend-console.html', (req, res) => {
  res.sendFile(path.join(ADMIN_DIR, 'backend-console.html'));
});

app.get('/api/user/by-unique-id/:uniqueId', (req, res) => {
  const db = readDbWithCache();
  const uniqueId = String(req.params.uniqueId || '').trim();
  if (!uniqueId) {
    res.status(400).json({ success: false, message: '缺少唯一标识' });
    return;
  }
  const user = db.users.find((item) => item.uniqueId === uniqueId);
  if (!user) {
    res.status(404).json({ success: false, message: '用户不存在' });
    return;
  }
  res.json({
    success: true,
    user: {
      _id: user._id,
      uniqueId: user.uniqueId,
      userNumber: user.userNumber,
      nickname: user.nickname,
      avatar: user.avatar,
      gender: user.gender || '',
      phone: user.phone || '',
      points: Number(user.points || 0),
      addresses: Array.isArray(user.addresses) ? user.addresses : []
    }
  });
});

app.get('/api/user/profile', (req, res) => {
  const db = readDbWithCache();
  const userId = req.header('x-user-id') || 'wx_user_001';
  
  let user = db.users.find((item) => item._id === userId);
  if (!user) {
    user = {
      _id: userId,
      uniqueId: generateUniqueId(),
      userNumber: generateUserNumber(db.users),
      nickname: '微信用户',
      avatar: 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0',
      gender: '',
      phone: '',
      points: 0,
      checkIns: [],
      pointsHistory: [],
      addresses: []
    };
    db.users.push(user);
    writeDb(db);
  }
  
  res.json({
    success: true,
    data: {
      _id: user._id,
      uniqueId: user.uniqueId,
      userNumber: user.userNumber,
      nickname: user.nickname,
      avatar: user.avatar,
      gender: user.gender || '',
      phone: user.phone || '',
      addresses: user.addresses || []
    }
  });
});

app.put('/api/user/profile', (req, res) => {
  const db = readDbWithCache();
  const userId = req.header('x-user-id') || 'wx_user_001';
  const { nickname, avatar, gender, phone } = req.body;
  
  let user = db.users.find((item) => item._id === userId);
  if (!user) {
    user = {
      _id: userId,
      uniqueId: generateUniqueId(),
      userNumber: generateUserNumber(db.users),
      nickname: '微信用户',
      avatar: 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0',
      gender: '',
      phone: '',
      points: 0,
      checkIns: [],
      pointsHistory: [],
      addresses: []
    };
    db.users.push(user);
  }
  
  if (nickname !== undefined) user.nickname = nickname;
  if (avatar !== undefined) user.avatar = avatar;
  if (gender !== undefined) user.gender = gender;
  if (phone !== undefined) user.phone = phone;
  
  user.updatedAt = new Date().toISOString();
  
  writeDb(db);
  
  res.json({
    success: true,
    message: '更新成功',
    data: {
      _id: user._id,
      uniqueId: user.uniqueId,
      userNumber: user.userNumber,
      nickname: user.nickname,
      avatar: user.avatar,
      gender: user.gender,
      phone: user.phone,
      addresses: user.addresses || []
    }
  });
});

app.get('/api/user/addresses', (req, res) => {
  const db = readDbWithCache();
  const userId = req.header('x-user-id') || 'wx_user_001';
  
  let user = db.users.find((item) => item._id === userId);
  if (!user) {
    res.json({ success: true, addresses: [] });
    return;
  }
  
  res.json({ success: true, addresses: user.addresses || [] });
});

app.put('/api/user/addresses', (req, res) => {
  const db = readDbWithCache();
  const userId = req.header('x-user-id') || 'wx_user_001';
  const { addresses } = req.body;
  
  let user = db.users.find((item) => item._id === userId);
  if (!user) {
    user = {
      _id: userId,
      uniqueId: generateUniqueId(),
      userNumber: generateUserNumber(db.users),
      nickname: '微信用户',
      avatar: 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0',
      gender: '',
      phone: '',
      points: 0,
      checkIns: [],
      pointsHistory: [],
      addresses: []
    };
    db.users.push(user);
  }
  
  user.addresses = addresses || [];
  user.updatedAt = new Date().toISOString();
  
  writeDb(db);
  
  res.json({ success: true, addresses: user.addresses });
});

app.post('/api/videos/upload-by-url', async (req, res) => {
  const db = readDbWithCache();
  const { urls, author } = req.body;
  
  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ success: false, message: '请提供视频URL' });
  }
  
  const now = new Date().toISOString();
  const results = [];
  const errors = [];
  
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i].trim();
    if (!url) continue;
    
    try {
      const video = {
        _id: createId('video'),
        title: `视频 ${i + 1}`,
        cover: '',
        videoUrl: url,
        author: author || OFFICIAL_PUBLISHER.name,
        avatar: OFFICIAL_PUBLISHER.avatar,
        publisherId: OFFICIAL_PUBLISHER.id,
        likes: 0,
        comments: 0,
        createdAt: now,
        updatedAt: now
      };
      
      db.videos.unshift(video);
      results.push(video);
    } catch (error) {
      errors.push({ url, error: error.message });
    }
  }
  
  writeDb(db);
  
  res.json({
    success: true,
    message: `成功导入 ${results.length} 个视频`,
    videos: results,
    errors: errors.length > 0 ? errors : undefined
  });
});

async function downloadVideo(url, filename) {
  try {
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream',
      timeout: 60000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
        // 'Referer': 'https://www.douyin.com/' // 某些视频链接加了Referer反而会403
      }
    });
    
    const contentType = response.headers['content-type'] || '';
    if (contentType.includes('text/html') || contentType.includes('application/json')) {
        throw new Error(`URL返回的是 ${contentType}，不是视频文件`);
    }

    const filePath = path.join(UPLOAD_DIR, filename);
    ensureDir(path.dirname(filePath));
    const writer = fs.createWriteStream(filePath);
    
    return new Promise((resolve, reject) => {
      response.data.pipe(writer);
      writer.on('finish', () => {
        writer.close();
        // Check file size to ensure it's not an error page
        fs.stat(filePath, (err, stats) => {
            if (err) {
                // 如果获取文件信息失败，通常意味着文件不存在或权限问题
                fs.unlink(filePath, () => {}); // 尝试清理
                reject(new Error('无法验证下载文件完整性'));
                return;
            }
            if (stats.size < 100 * 1024) { // Less than 100KB is suspicious for a video
                const msg = `下载的文件过小 (${(stats.size / 1024).toFixed(2)}KB)，可能是错误页面或无效视频`;
                logger.warn(msg, { size: stats.size, url });
                fs.unlink(filePath, () => {}); // 删除无效文件
                reject(new Error(msg));
                return;
            }
            resolve(filePath);
        });
      });
      writer.on('error', (err) => {
        fs.unlink(filePath, () => {});
        reject(err);
      });
    });
  } catch (error) {
    logger.error('下载视频失败', { url, error: error.message });
    // 如果下载过程中出错，尝试清理可能产生的垃圾文件
    const filePath = path.join(UPLOAD_DIR, filename);
    if (fs.existsSync(filePath)) {
        fs.unlink(filePath, () => {});
    }
    throw error;
  }
}

function generateVideoCover(videoPath, videoFilename) {
  return new Promise((resolve) => {
    const coverFilename = videoFilename.replace(path.extname(videoFilename), '.jpg');
    const coverRelativeDir = path.dirname(path.relative(UPLOAD_DIR, videoPath));
    const coverOutputDir = coverRelativeDir && coverRelativeDir !== '.' ? path.join(UPLOAD_DIR, coverRelativeDir) : UPLOAD_DIR;
    ensureDir(coverOutputDir);
    
    ffmpeg(videoPath)
      .on('end', () => {
        if (coverRelativeDir && coverRelativeDir !== '.') {
          resolve(`/uploads/${coverRelativeDir.replace(/\\/g, '/')}/${coverFilename}`);
          return;
        }
        resolve(`/uploads/${coverFilename}`);
      })
      .on('error', (err) => {
        logger.error('Failed to generate cover', { error: err.message, videoPath });
        resolve('');
      })
      .screenshots({
        count: 1,
        folder: coverOutputDir,
        filename: coverFilename,
      });
  });
}

async function parseDouyinUrl(url) {
  try {
    logger.info('开始解析抖音链接', { url });
    
    // 1. 获取重定向后的最终URL
    const redirectResponse = await axios({
      method: 'GET',
      url: url,
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 400, // 允许重定向状态码
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
      }
    });
    
    // axios会自动跟随重定向，所以redirectResponse.request.res.responseUrl (Node环境) 或者 redirectResponse.config.url 是最终URL
    // 但是axios在Node中跟随重定向后，最终URL通常在 response.request.res.responseUrl
    let finalUrl = redirectResponse.request?.res?.responseUrl || url;
    logger.info('获取到最终URL', { finalUrl });

    // 2. 请求最终页面内容
    // 抖音有时候需要Cookie才能返回正确内容，尝试带上一些基础Cookie
    const response = await axios({
      method: 'GET',
      url: finalUrl,
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
        'Cookie': 's_v_web_id=verify_layvwj4d_FDwQCpXg_2J0X_4tS8_8j8E_0f0f0f0f0f0f;', // 尝试模拟一个简单的cookie
        'Referer': 'https://www.douyin.com/'
      }
    });
    
    const html = response.data;
    const $ = cheerio.load(html);
    
    let videoUrl = '';
    let title = '抖音视频';
    let cover = '';
    
    // 3. 尝试多种方式提取视频链接
    
    // 方式A: 查找 JSON 数据 (RENDER_DATA)
    try {
      const renderDataScript = $('script#RENDER_DATA').html();
      if (renderDataScript) {
        const renderData = JSON.parse(decodeURIComponent(renderDataScript));
        // 路径可能变化，尝试深度搜索
        // 通常在 app.videoDetail.video.playAddr
        // 或者类似结构
        
        // 简单的深度查找函数
        const findPlayAddr = (obj) => {
            if (!obj) return null;
            if (obj.playAddr && Array.isArray(obj.playAddr)) {
                return obj.playAddr[0]?.src;
            }
            if (obj.play_addr && obj.play_addr.url_list) {
                return obj.play_addr.url_list[0];
            }
            if (typeof obj === 'object') {
                for (const key in obj) {
                    const result = findPlayAddr(obj[key]);
                    if (result) return result;
                }
            }
            return null;
        };
        
        const foundUrl = findPlayAddr(renderData);
        if (foundUrl) {
            videoUrl = foundUrl.replace('playwm', 'play'); // 尝试去水印
            logger.info('通过 RENDER_DATA 找到视频链接', { videoUrl });
        }
      }
    } catch (e) {
      logger.warn('解析 RENDER_DATA 失败', { error: e.message });
    }

    // 方式B: 查找 window._ROUTER_DATA
    if (!videoUrl) {
        const scriptTags = $('script');
        for (let i = 0; i < scriptTags.length; i++) {
            const scriptContent = $(scriptTags[i]).html();
            if (scriptContent && scriptContent.includes('_ROUTER_DATA')) {
                 try {
                     // 尝试更宽松的提取方式，寻找第一个 { 和最后一个 }
                     let jsonStart = scriptContent.indexOf('{');
                     let jsonEnd = scriptContent.lastIndexOf('}');
                     
                     if (jsonStart !== -1 && jsonEnd !== -1) {
                         const jsonStr = scriptContent.substring(jsonStart, jsonEnd + 1);
                         const routerData = JSON.parse(jsonStr);
                         
                         // 深度查找函数
                          const findUrlList = (obj, depth = 0) => {
                            if (!obj || depth > 10) return null;
                            // 优先找 video_addr / play_addr
                            if (obj.play_addr && obj.play_addr.url_list) {
                                return obj.play_addr.url_list[0];
                            }
                            // 有时候直接在 url_list 里
                            if (obj.url_list && Array.isArray(obj.url_list) && obj.url_list.length > 0 && typeof obj.url_list[0] === 'string' && obj.url_list[0].includes('video')) {
                                return obj.url_list[0];
                            }
                            
                            if (Array.isArray(obj)) {
                                for (let item of obj) {
                                    const result = findUrlList(item, depth + 1);
                                    if (result) return result;
                                }
                            }
                            
                            if (typeof obj === 'object') {
                                for (const key in obj) {
                                    // 避免遍历过深或无关的大对象
                                    if (key === 'video_layout' || key === 'render_data') continue; 
                                    const result = findUrlList(obj[key], depth + 1);
                                    if (result) return result;
                                }
                            }
                            return null;
                        };
                        
                        // 从 loaderData 开始找
                        if (routerData.loaderData) {
                            const foundUrl = findUrlList(routerData.loaderData);
                            if (foundUrl) {
                                videoUrl = foundUrl;
                                logger.info('通过 _ROUTER_DATA 找到视频链接', { videoUrl });
                            }
                        }
                     }
                 } catch (e) {
                     logger.warn('解析 _ROUTER_DATA 失败', { error: e.message });
                 }
            }
        }
    }

    // 方式C: 正则暴力匹配 (原有的方法)
    if (!videoUrl) {
        const scriptTags = $('script');
        for (let i = 0; i < scriptTags.length; i++) {
            const scriptContent = $(scriptTags[i]).html();
            if (scriptContent && scriptContent.includes('playAddr')) {
                const playAddrMatch = scriptContent.match(/"playAddr":"([^"]+)"/);
                if (playAddrMatch) {
                    videoUrl = playAddrMatch[1].replace(/\\u002F/g, '/').replace('playwm', 'play');
                     logger.info('通过正则 playAddr 找到视频链接', { videoUrl });
                }
                
                const titleMatch = scriptContent.match(/"desc":"([^"]+)"/);
                if (titleMatch) {
                    title = titleMatch[1];
                }
            }
        }
    }
    
    // 方式D: 查找 <video> 标签
    if (!videoUrl) {
      const videoTag = $('video');
      if (videoTag.length > 0) {
        const src = videoTag.attr('src');
        if (src) {
             videoUrl = src;
             if (src.startsWith('//')) {
                 videoUrl = 'https:' + src;
             }
             logger.info('通过 video 标签找到视频链接', { videoUrl });
        }
      }
    }

    const coverCandidates = [
      $('meta[property="og:image"]').attr('content'),
      $('meta[name="og:image"]').attr('content'),
      $('meta[name="twitter:image"]').attr('content'),
      $('meta[property="twitter:image"]').attr('content')
    ];
    for (const candidate of coverCandidates) {
      if (!candidate) continue;
      const value = String(candidate).trim();
      if (!value) continue;
      if (value.startsWith('//')) {
        cover = `https:${value}`;
      } else if (value.startsWith('http://')) {
        cover = value.replace('http://', 'https://');
      } else {
        cover = value;
      }
      if (cover) break;
    }

    // 尝试提取标题
    if (title === '抖音视频') {
        const titleTag = $('title').text();
        if (titleTag) {
            title = titleTag.split('-')[0].trim();
        }
    }
    
    // 4. 如果找到了 playwm (带水印) 的链接，尝试替换为 play (无水印)
    // 注意：有些链接直接替换可能无效，但通常值得一试
    if (videoUrl && videoUrl.includes('playwm')) {
        videoUrl = videoUrl.replace('playwm', 'play');
    }
    
    // 5. 确保 URL 是 HTTPS
    if (videoUrl && videoUrl.startsWith('http://')) {
        videoUrl = videoUrl.replace('http://', 'https://');
    }
    
    logger.info('抖音链接解析完成', { url, videoUrl: videoUrl ? '已找到' : '未找到', title, cover: cover ? '已找到' : '未找到' });
    
    if (!videoUrl) {
        // 如果实在找不到，可能是因为反爬虫，记录一段 HTML 以便调试 (生产环境可去掉)
        logger.warn('未找到视频链接，页面可能需要验证码或登录', { htmlPreview: html.substring(0, 500) });
    }

    return { videoUrl, title, cover };
  } catch (error) {
    logger.error('解析抖音链接失败', { url, error: error.message });
    throw error;
  }
}

app.post('/api/videos/parse-douyin', async (req, res) => {
  const db = readDbWithCache();
  const { text, author } = req.body;
  
  if (!text) {
    return res.status(400).json({ success: false, message: '请提供文本内容' });
  }
  
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const matches = text.match(urlRegex);
  
  if (!matches || matches.length === 0) {
    return res.status(400).json({ success: false, message: '未找到视频链接' });
  }
  
  const now = new Date().toISOString();
  const results = [];
  const errors = [];
  
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  for (const url of matches) {
    try {
      let title = '抖音视频';
      let videoUrlToDownload = url;
      let fallbackCover = '';
      
      const isDouyinUrl = url.includes('douyin.com') || url.includes('v.douyin');
      
      if (isDouyinUrl) {
        // Add delay to avoid rate limiting
        await sleep(1000);
        
        try {
          const parsed = await parseDouyinUrl(url);
          if (parsed.videoUrl) {
            videoUrlToDownload = parsed.videoUrl;
            if (parsed.title && parsed.title !== '抖音视频') {
              title = parsed.title;
            }
            if (parsed.cover) {
              fallbackCover = parsed.cover;
            }
          } else {
            // If parsing fails but no error thrown (should not happen with current logic), fallback
            throw new Error('未找到有效视频链接');
          }
        } catch (parseError) {
          logger.warn('解析抖音链接失败', { url, error: parseError.message });
          // If it's a Douyin URL and parsing failed, do not try to download the original URL
          // because it's likely a page, not a video.
          throw new Error(`解析失败: ${parseError.message}`);
        }
      } else {
        const titleMatch = text.match(/([^\n]+?)\s*https?:\/\//);
        if (titleMatch && titleMatch[1]) {
          title = titleMatch[1].trim();
        }
      }
      
      const videoId = createId('video');
      const videoFolder = `videos/${videoId}`;
      const filename = `${videoId}.mp4`;
      const relativeVideoPath = `${videoFolder}/${filename}`;
      let localVideoUrl = videoUrlToDownload;
      let coverUrl = fallbackCover;
      
      try {
        ensureDir(path.join(UPLOAD_DIR, videoFolder));
        logger.info('开始下载视频', { url: videoUrlToDownload, filename: relativeVideoPath });
        await downloadVideo(videoUrlToDownload, relativeVideoPath);
        localVideoUrl = `/uploads/${relativeVideoPath}`;
        logger.info('视频下载完成', { url: videoUrlToDownload, localPath: localVideoUrl });
        
        const videoPath = path.join(UPLOAD_DIR, relativeVideoPath);
        try {
          const generatedCover = await generateVideoCover(videoPath, filename);
          if (generatedCover) {
            coverUrl = generatedCover;
          }
        } catch (coverError) {
          logger.warn('生成封面失败', { error: coverError.message });
        }
      } catch (downloadError) {
        logger.warn('视频下载失败', { url: videoUrlToDownload, error: downloadError.message });
        throw downloadError; // Re-throw to be caught by outer catch
      }
      
      const video = {
        _id: videoId,
        title: title,
        cover: coverUrl,
        videoUrl: localVideoUrl,
        author: author || OFFICIAL_PUBLISHER.name,
        avatar: OFFICIAL_PUBLISHER.avatar,
        publisherId: OFFICIAL_PUBLISHER.id,
        likes: 0,
        comments: 0,
        createdAt: now,
        updatedAt: now
      };
      
      db.videos.unshift(video);
      results.push(video);
    } catch (error) {
      errors.push({ url, error: error.message });
    }
  }
  
  writeDb(db);
  
  res.json({
    success: true,
    message: `成功解析 ${results.length} 个视频`,
    videos: results,
    errors: errors.length > 0 ? errors : undefined
  });
});

app.post('/api/videos/open-folder', async (req, res) => {
  const { videoUrl } = req.body;

  if (!videoUrl) {
    return res.status(400).json({ success: false, message: '无效的视频路径' });
  }

  let uploadPath = String(videoUrl).trim();
  if (/^https?:\/\//i.test(uploadPath)) {
    try {
      uploadPath = new URL(uploadPath).pathname;
    } catch (error) {
      return res.status(400).json({ success: false, message: '无效的视频路径' });
    }
  }

  try {
    uploadPath = decodeURIComponent(uploadPath);
  } catch (error) {
    return res.status(400).json({ success: false, message: '无效的视频路径' });
  }

  uploadPath = uploadPath.split('?')[0].split('#')[0].replace(/\\/g, '/');
  if (!uploadPath.startsWith('/uploads/')) {
    return res.status(400).json({ success: false, message: '无效的视频路径' });
  }

  try {
    const relativePath = uploadPath.slice('/uploads/'.length);
    const normalizedRelativePath = path.normalize(relativePath).replace(/\\/g, '/');
    if (!normalizedRelativePath || normalizedRelativePath.startsWith('..') || path.isAbsolute(normalizedRelativePath)) {
      return res.status(400).json({ success: false, message: '无效的视频路径' });
    }

    const filePath = path.join(UPLOAD_DIR, normalizedRelativePath);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: '视频文件不存在' });
    }

    await openFileInSystem(filePath);

    res.json({ success: true, message: '已打开文件夹' });
  } catch (error) {
    logger.error('打开文件夹失败', { videoUrl, error: error.message });
    res.status(500).json({ success: false, message: '打开文件夹失败', error: error.message });
  }
});

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'backend service running',
    adminConsole: 'http://localhost:3000/backend-console.html'
  });
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    let message = '上传失败';
    if (err.code === 'LIMIT_FILE_SIZE') {
      if (req.path === '/api/upload/user-avatar' || req.path === '/api/upload/publisher-avatar') {
        message = '头像文件过大，请选择小于5MB的图片';
      } else if (req.path.includes('/upload/video')) {
        message = '视频文件过大，请选择小于500MB的视频';
      } else {
        message = '上传文件过大';
      }
    }
    res.status(400).json({
      success: false,
      message
    });
    return;
  }
  if (err && err.code === 'INVALID_FILE_TYPE') {
    res.status(400).json({
      success: false,
      message: err.message || '文件类型不支持'
    });
    return;
  }
  logger.error('Unhandled error', { 
    error: err.message, 
    stack: err.stack,
    url: req.url,
    method: req.method
  });
  res.status(500).json({ 
    success: false, 
    message: '服务器内部错误',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.listen(PORT, () => {
  logger.info(`Backend server started`, { 
    port: PORT,
    adminConsole: `http://localhost:${PORT}/backend-console.html`
  });
});

