const app = getApp();

Page({
  data: {
    articles: [],
    baseUrl: 'http://localhost:3000',
    isLoading: true,
    pageSize: 8,
    currentPage: 1,
    hasMore: true,
    isLoadingMore: false
  },

  onLoad() {
    this.articleCacheKey = 'article_list_cache_v1';
    this.isFetching = false;
    this.loadArticlesFromCache();
    this.fetchArticles({ page: 1, append: false });
  },

  fetchArticles({ page = 1, append = false } = {}) {
    if (this.isFetching) return;
    this.isFetching = true;
    if (append) {
      this.setData({ isLoadingMore: true });
    } else {
      this.setData({ isLoading: true });
    }
    app.request({
      url: '/api/articles',
      data: {
        page,
        limit: this.data.pageSize
      }
    }).then((res) => {
      if (!res.success || !Array.isArray(res.articles)) {
        throw new Error('invalid articles response');
      }
      const nextArticles = res.articles.map((article) => ({
        id: article._id,
        title: article.title,
        cover: this.resolveAssetUrl(article.cover),
        summary: article.summary,
        author: article.author || '管理员',
        avatar: article.avatar || 'https://picsum.photos/100/100?random=111',
        publishTime: this.formatTime(article.createdAt),
        views: article.views || 0,
        likes: article.likes || 0
      }));
      const articles = append ? this.data.articles.concat(nextArticles) : nextArticles;
      const total = Number(res.total || 0);
      const hasMore = total > 0 ? articles.length < total : nextArticles.length >= this.data.pageSize;
      if (!append) {
        wx.setStorageSync(this.articleCacheKey, articles);
      }
      this.setData({
        articles,
        currentPage: Number(res.page || page),
        hasMore,
        isLoadingMore: false,
        isLoading: false
      });
    }).catch(() => {
      this.setData({
        isLoadingMore: false,
        isLoading: false
      });
      if (!append) {
        wx.showToast({
          title: '加载文章失败',
          icon: 'none'
        });
      }
    }).finally(() => {
      this.isFetching = false;
    });
  },

  loadArticlesFromCache() {
    const cachedArticles = wx.getStorageSync(this.articleCacheKey);
    if (Array.isArray(cachedArticles) && cachedArticles.length > 0) {
      this.setData({
        articles: cachedArticles,
        currentPage: 1,
        hasMore: true,
        isLoading: false
      });
    }
  },

  resolveAssetUrl(path) {
    if (!path) return '';
    return path.startsWith('http') ? path : this.data.baseUrl + path;
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
  },

  onReachBottom() {
    if (!this.data.hasMore || this.data.isLoadingMore || this.isFetching) return;
    this.fetchArticles({
      page: this.data.currentPage + 1,
      append: true
    });
  }
});
