const { showShareToast, buildShareConfig } = require('../../../utils/share.js');
const app = getApp();

Page({
  data: {
    article: null,
    baseUrl: 'http://localhost:3000'
  },

  onLoad(options) {
    const { id } = options;
    if (id) {
      this.fetchArticleDetail(id);
    }
  },

  fetchArticleDetail(id) {
    app.request({
      url: `/api/articles/${id}`
    }).then(res => {
      if (res.success) {
        const article = res.article;
        article.id = article._id;
        article.cover = this.resolveAssetUrl(article.cover);
        article.author = article.author || '管理员';
        article.avatar = article.avatar || 'https://picsum.photos/100/100?random=111';
        article.publishTime = this.formatTime(article.createdAt);
        
        this.setData({
          article: article
        });
      }
    }).catch(err => {
      console.error('获取文章详情失败:', err);
      wx.showToast({
        title: '加载文章失败',
        icon: 'none'
      });
    });
  },

  resolveAssetUrl(path) {
    if (!path) return '';
    return path.startsWith('http') ? path : this.data.baseUrl + path;
  },

  formatTime(timeStr) {
    if (!timeStr) return '';
    const date = new Date(timeStr);
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()} ${date.getHours()}:${date.getMinutes()}`;
  },

  doShare() {
    showShareToast();
  },

  onShareAppMessage() {
    const article = this.data.article;
    return buildShareConfig({
      title: article ? article.title : '精彩文章推荐',
      path: '/packageContent/pages/article/detail?id=' + (article ? article.id : ''),
      imageUrl: article ? article.cover : ''
    });
  },

  onShareTimeline() {
    const article = this.data.article;
    return buildShareConfig({
      title: article ? article.title : '精彩文章推荐',
      query: 'id=' + (article ? article.id : ''),
      imageUrl: article ? article.cover : ''
    });
  }
})
