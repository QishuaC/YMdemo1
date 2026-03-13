const mockBanners = [
  {
    id: 1,
    title: '义门年货节',
    subtitle: '百年传承·匠心酿造',
    image: 'https://picsum.photos/800/300?random=100',
    productId: 1,
    bgColor: '#8b0000',
    btnText: '立即抢购',
    btnColor: '#ffc107'
  },
  {
    id: 2,
    title: '手工艺品特惠',
    subtitle: '传统工艺·精品之作',
    image: 'https://picsum.photos/800/300?random=101',
    productId: 3,
    bgColor: '#2d5a27',
    btnText: '立即抢购',
    btnColor: '#ffc107'
  },
  {
    id: 3,
    title: '农家特产上新',
    subtitle: '绿色有机·健康生活',
    image: 'https://picsum.photos/800/300?random=102',
    productId: 4,
    bgColor: '#c4a000',
    btnText: '立即抢购',
    btnColor: '#ffc107'
  }
];

const publisher = {
  publisherId: 'pub_001',
  author: '义门陈文化',
  avatar: 'https://picsum.photos/100/100?random=999'
};

const mockVideos = [
  {
    id: 'video_1773346834307_795547',
    title: '测试',
    cover: 'https://picsum.photos/400/300?random=7',
    videoUrl: 'https://media.w3.org/2010/05/sintel/trailer.mp4',
    publisherId: publisher.publisherId,
    author: publisher.author,
    avatar: publisher.avatar,
    likes: 0,
    comments: 0,
    height: 300
  },
  {
    id: 'video_1773345565828_161221',
    title: '义门陈分庄：天下陈氏出义门',
    cover: 'https://picsum.photos/seed/yimen5/400/380',
    videoUrl: 'https://media.w3.org/2010/05/bunny/trailer.mp4',
    publisherId: publisher.publisherId,
    author: publisher.author,
    avatar: publisher.avatar,
    likes: 7890,
    comments: 678,
    height: 380
  },
  {
    id: 'video_1773345565828_980296',
    title: '探访义门陈故居：感受千年家风',
    cover: 'https://picsum.photos/seed/yimen4/400/400',
    videoUrl: 'https://media.w3.org/2010/05/sintel/trailer.mp4',
    publisherId: publisher.publisherId,
    author: publisher.author,
    avatar: publisher.avatar,
    likes: 6789,
    comments: 567,
    height: 400
  },
  {
    id: 'video_1773345565828_374713',
    title: '义门陈家规家训：百犬同槽的启示',
    cover: 'https://picsum.photos/seed/yimen3/400/450',
    videoUrl: 'https://media.w3.org/2010/05/video/movie_300.mp4',
    publisherId: publisher.publisherId,
    author: publisher.author,
    avatar: publisher.avatar,
    likes: 5678,
    comments: 456,
    height: 450
  },
  {
    id: 'video_1773345565828_703877',
    title: '义门陈332年不分家的秘密',
    cover: 'https://picsum.photos/seed/yimen2/400/350',
    videoUrl: 'https://media.w3.org/2010/05/bunny/trailer.mp4',
    publisherId: publisher.publisherId,
    author: publisher.author,
    avatar: publisher.avatar,
    likes: 4567,
    comments: 345,
    height: 350
  },
  {
    id: 'video_1773345565828_257',
    title: '义门陈：千古第一家的传奇故事',
    cover: 'https://picsum.photos/seed/yimen1/400/500',
    videoUrl: 'https://media.w3.org/2010/05/sintel/trailer.mp4',
    publisherId: publisher.publisherId,
    author: publisher.author,
    avatar: publisher.avatar,
    likes: 3456,
    comments: 234,
    height: 500
  }
];

const mockArticles = [
  {
    id: 1,
    title: '2024年最值得去的10个旅行目的地',
    cover: 'https://picsum.photos/700/400?random=11',
    summary: '精选全球最美丽的旅行目的地，让你的2024年充满惊喜和回忆...',
    author: '旅行达人',
    avatar: 'https://picsum.photos/100/100?random=111',
    publishTime: '2小时前',
    views: 12345,
    likes: 890
  },
  {
    id: 2,
    title: '如何养成早起的好习惯？',
    cover: 'https://picsum.photos/700/400?random=12',
    summary: '早起不仅能提高效率，还能让你拥有更多属于自己的时间...',
    author: '生活小百科',
    avatar: 'https://picsum.photos/100/100?random=112',
    publishTime: '5小时前',
    views: 23456,
    likes: 1234
  },
  {
    id: 3,
    title: '居家办公必备好物推荐',
    cover: 'https://picsum.photos/700/400?random=13',
    summary: '提升居家办公效率和舒适度的好物，让工作更轻松...',
    author: '职场达人',
    avatar: 'https://picsum.photos/100/100?random=113',
    publishTime: '1天前',
    views: 34567,
    likes: 2345
  }
];

const mockProducts = [
  {
    id: 1,
    name: '咸宁庄二十年陈酿美酒 传统手工酿造',
    cover: 'https://picsum.photos/400/400?random=21',
    price: 168,
    originalPrice: 299,
    sales: 2341,
    promoTags: [],
    serviceTags: ['7天无理由', '运费险', '正品保障'],
    category: '传统酿造'
  },
  {
    id: 2,
    name: '义门家规家训 丝绸卷轴 文化收藏',
    cover: 'https://picsum.photos/400/400?random=22',
    price: 268,
    originalPrice: 399,
    sales: 892,
    promoTags: [],
    serviceTags: ['7天无理由', '运费险'],
    category: '文创周边'
  },
  {
    id: 3,
    name: '手工竹编茶具套装 传统工艺',
    cover: 'https://picsum.photos/400/400?random=23',
    price: 88,
    originalPrice: 158,
    sales: 1567,
    promoTags: [],
    serviceTags: ['7天无理由', '运费险', '手工制作'],
    category: '手工艺品'
  },
  {
    id: 4,
    name: '农家自产有机大米 5kg装',
    cover: 'https://picsum.photos/400/400?random=24',
    price: 58,
    originalPrice: 88,
    sales: 12000,
    promoTags: ['热销榜第1名'],
    serviceTags: ['7天无理由', '运费险'],
    category: '农家特产'
  },
  {
    id: 5,
    name: '传统手工布鞋 舒适透气',
    cover: 'https://picsum.photos/400/400?random=25',
    price: 128,
    originalPrice: 198,
    sales: 3456,
    promoTags: [],
    serviceTags: ['7天无理由', '运费险', '手工制作'],
    category: '手工艺品'
  },
  {
    id: 6,
    name: '义门陈氏族谱 精装珍藏版',
    cover: 'https://picsum.photos/400/400?random=26',
    price: 398,
    originalPrice: 598,
    sales: 567,
    promoTags: [],
    serviceTags: ['7天无理由', '运费险', '正品保障'],
    category: '文创周边'
  }
];

const mockMemberLevels = [
  {
    level: 1,
    name: '普通会员',
    icon: '🥉',
    discount: 1,
    pointsRate: 1
  },
  {
    level: 2,
    name: '银卡会员',
    icon: '🥈',
    discount: 0.95,
    pointsRate: 1.5
  },
  {
    level: 3,
    name: '金卡会员',
    icon: '🥇',
    discount: 0.9,
    pointsRate: 2
  },
  {
    level: 4,
    name: '钻石会员',
    icon: '💎',
    discount: 0.85,
    pointsRate: 3
  }
];

const generateComments = (videoId) => {
  const users = [
    { _id: 'u1', nickname: '美食爱好者', avatar: 'https://picsum.photos/100/100?random=201' },
    { _id: 'u2', nickname: '摄影小达人', avatar: 'https://picsum.photos/100/100?random=202' },
    { _id: 'u3', nickname: '旅行家小李', avatar: 'https://picsum.photos/100/100?random=203' },
    { _id: 'u4', nickname: '视频创作者', avatar: 'https://picsum.photos/100/100?random=204' },
    { _id: 'u5', nickname: '技术控', avatar: 'https://picsum.photos/100/100?random=205' },
    { _id: 'u6', nickname: '日常分享', avatar: 'https://picsum.photos/100/100?random=206' },
    { _id: 'u7', nickname: '音乐达人', avatar: 'https://picsum.photos/100/100?random=207' },
    { _id: 'u8', nickname: '健身教练', avatar: 'https://picsum.photos/100/100?random=208' }
  ];

  const contents = [
    '这个视频拍得太棒了！画面构图和配乐都很完美，期待更多作品！',
    '请问这是在哪里拍的？风景太美了！',
    '延时摄影的技术含量很高，这个作品很专业！',
    '已经收藏了，准备去打卡！',
    '背景音乐很好听，可以分享一下吗？',
    '这个角度选得真好，学习了！',
    '画质超清晰，用什么设备拍的？',
    '每天必看的视频，太治愈了~',
    '这个转场效果怎么做出来的？求教程！',
    '看得我也想学摄影了！'
  ];

  const comments = [];
  const commentCount = 3 + Math.floor(Math.random() * 5); // 每个视频3-7条评论

  for (let i = 0; i < commentCount; i++) {
    const user = users[i % users.length];
    const hasReplies = Math.random() > 0.5;
    const replies = [];

    if (hasReplies) {
      const replyCount = 1 + Math.floor(Math.random() * 2);
      for (let j = 0; j < replyCount; j++) {
        const replyUser = users[(i + j + 1) % users.length];
        replies.push({
          _id: `r${videoId}_${i}_${j}`,
          videoId: String(videoId),
          userId: replyUser,
          content: ['谢谢支持！', '确实如此！', '感谢认可~', '哈哈是的！'][j % 4],
          likes: Math.floor(Math.random() * 50),
          likedBy: [],
          liked: false,
          parentId: `c${videoId}_${i}`,
          createdAt: Date.now() - Math.random() * 3600000
        });
      }
    }

    comments.push({
      _id: `c${videoId}_${i}`,
      videoId: String(videoId),
      userId: user,
      content: contents[i % contents.length],
      likes: Math.floor(Math.random() * 200) + 10,
      likedBy: [],
      liked: false,
      parentId: null,
      createdAt: Date.now() - i * 3600000 - Math.random() * 1800000,
      replies: replies,
      replyCount: replies.length
    });
  }

  return comments;
};

const mockComments = [
  ...generateComments('video_1773346834307_795547'),
  ...generateComments('video_1773345565828_161221'),
  ...generateComments('video_1773345565828_980296'),
  ...generateComments('video_1773345565828_374713'),
  ...generateComments('video_1773345565828_703877'),
  ...generateComments('video_1773345565828_257')
];

module.exports = {
  mockBanners,
  mockVideos,
  mockArticles,
  mockProducts,
  mockMemberLevels,
  mockComments
};
