const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'data', 'db.json');
const UPLOAD_DIR = path.join(__dirname, 'uploads');

function createId(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
}

function toInt(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? Math.floor(num) : fallback;
}

const yimenVideos = [
  {
    title: '义门陈：千古第一家的传奇故事',
    cover: 'https://picsum.photos/seed/yimen1/400/500',
    videoUrl: 'https://media.w3.org/2010/05/sintel/trailer.mp4',
    author: '义门陈文化',
    avatar: 'https://picsum.photos/seed/yimen-avatar/100/100',
    likes: 3456,
    comments: 234
  },
  {
    title: '义门陈332年不分家的秘密',
    cover: 'https://picsum.photos/seed/yimen2/400/350',
    videoUrl: 'https://media.w3.org/2010/05/bunny/trailer.mp4',
    author: '义门陈文化',
    avatar: 'https://picsum.photos/seed/yimen-avatar/100/100',
    likes: 4567,
    comments: 345
  },
  {
    title: '义门陈家规家训：百犬同槽的启示',
    cover: 'https://picsum.photos/seed/yimen3/400/450',
    videoUrl: 'https://media.w3.org/2010/05/video/movie_300.mp4',
    author: '义门陈文化',
    avatar: 'https://picsum.photos/seed/yimen-avatar/100/100',
    likes: 5678,
    comments: 456
  },
  {
    title: '探访义门陈故居：感受千年家风',
    cover: 'https://picsum.photos/seed/yimen4/400/400',
    videoUrl: 'https://media.w3.org/2010/05/sintel/trailer.mp4',
    author: '义门陈文化',
    avatar: 'https://picsum.photos/seed/yimen-avatar/100/100',
    likes: 6789,
    comments: 567
  },
  {
    title: '义门陈分庄：天下陈氏出义门',
    cover: 'https://picsum.photos/seed/yimen5/400/380',
    videoUrl: 'https://media.w3.org/2010/05/bunny/trailer.mp4',
    author: '义门陈文化',
    avatar: 'https://picsum.photos/seed/yimen-avatar/100/100',
    likes: 7890,
    comments: 678
  }
];

function uploadVideos() {
  console.log('开始上传义门陈相关视频...');
  
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  let db;
  if (fs.existsSync(DB_FILE)) {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    db = JSON.parse(raw);
  } else {
    db = {
      users: [],
      admins: [],
      products: [],
      articles: [],
      videos: [],
      comments: [],
      orders: []
    };
  }

  const existingVideoIds = new Set();
  db.videos.forEach(v => {
    existingVideoIds.add(v.title);
  });

  const now = new Date().toISOString();
  let addedCount = 0;
  
  yimenVideos.forEach((item) => {
    if (!existingVideoIds.has(item.title)) {
      const video = {
        _id: createId('video'),
        title: item.title,
        cover: item.cover,
        videoUrl: item.videoUrl,
        author: '义门陈文化',
        avatar: '',
        publisherId: 'pub_official_001',
        likes: toInt(item.likes),
        comments: toInt(item.comments),
        likedBy: [],
        createdAt: now,
        updatedAt: now
      };
      db.videos.unshift(video);
      addedCount++;
      console.log(`✓ 添加视频: ${item.title}`);
    } else {
      console.log(`- 跳过已存在视频: ${item.title}`);
    }
  });

  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  
  console.log('\n========================================');
  console.log(`成功上传 ${addedCount} 个义门陈相关视频！`);
  console.log('========================================');
  console.log(`数据库文件已更新: ${DB_FILE}`);
  console.log(`当前视频总数: ${db.videos.length}`);
}

uploadVideos();
