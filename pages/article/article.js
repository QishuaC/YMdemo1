const app = getApp();

Page({
  data: {
    articles: [],
    baseUrl: 'http://localhost:3000'
  },

  onLoad() {
    this.fetchArticles();
  },

  fetchArticles() {
    app.request({
      url: '/api/articles'
    }).then(res => {
      if (res.success) {
        const articles = res.articles.map(article => ({
          id: article._id,
          title: article.title,
          cover: article.cover.startsWith('http') ? article.cover : this.data.baseUrl + article.cover,
          summary: article.summary,
          author: article.author || '管理员',
          avatar: article.avatar || 'https://picsum.photos/100/100?random=111',
          publishTime: this.formatTime(article.createdAt),
          views: article.views || 0,
          likes: article.likes || 0
        }));
        this.setData({
          articles: articles
        });
      }
    }).catch(err => {
      console.error('获取文章失败:', err);
      wx.showToast({
        title: '加载文章失败',
        icon: 'none'
      });
    });
  },

  formatTime(timeStr) {
    if (!timeStr) return '';
    const date = new Date(timeStr);
    const now = new Date();
    const diff = (now - date) / 1000;

    if (diff < 60) return '刚刚';
    if (diff < 3600) return Math.floor(diff / 60) + '分钟前';
    if (diff < 86400) return Math.floor(diff / 3600) + '小时前';
    if (diff < 2592000) return Math.floor(diff / 86400) + '天前';
    
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  },

  viewArticle(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/article/detail?id=${id}`
    });
  }
})
