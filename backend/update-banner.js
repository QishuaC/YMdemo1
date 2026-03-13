const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, '.runtime-data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

console.log('正在读取数据库...');
const raw = fs.readFileSync(DB_FILE, 'utf-8');
const db = JSON.parse(raw);

console.log('当前 shopBanners 配置:');
console.log(db.uiConfig.shopBanners);

console.log('\n正在更新 banner 配置...');

db.uiConfig.shopBanners = [
  {
    id: 1,
    image: '/uploads/userID/微信图片_20260313123251_25_138.jpg',
    targetPage: '',
    title: '限时优惠',
    subtitle: '精选好物等你来',
    btnText: '立即抢购',
    btnColor: '#ffc107'
  },
  {
    id: 2,
    image: '/uploads/1773372985872_34044.jpg',
    targetPage: '',
    title: '',
    subtitle: '',
    btnText: '立即抢购',
    btnColor: '#ffc107'
  }
];

console.log('新的 shopBanners 配置:');
console.log(db.uiConfig.shopBanners);

fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');

console.log('\n数据库更新成功！');
