const { mockProducts } = require('../../data/mock.js');
const app = getApp();

Page({
  data: {
    banner: 'https://picsum.photos/750/300?random=100',
    articles: [],
    hotProducts: [],
    baseUrl: 'http://localhost:3000',
    loading: {
      articles: false,
      products: false
    }
  },

  onLoad() {
    this.fetchArticles();
    this.fetchProducts();
  },

  onShow() {
    const tabBar = typeof this.getTabBar === 'function' ? this.getTabBar() : null;
    if (tabBar) {
      tabBar.setData({ selected: 1 });
    }
    if (app.globalData.uiConfig && app.globalData.uiConfig.banner) {
      this.setData({
        banner: app.globalData.uiConfig.banner
      });
    }
  },

  safeRequest(options) {
    return app.request({
      ...options,
      timeout: options.timeout || 10000,
      retry: options.retry || 1
    });
  },

  showErrorToast(message = '加载失败') {
    wx.showToast({
      title: message,
      icon: 'none',
      duration: 2000
    });
  },

  resolveAssetUrl(path) {
    if (!path) return '';
    return path.startsWith('http') ? path : this.data.baseUrl + path;
  },

  fetchArticles() {
    this.setData({ 'loading.articles': true });
    
    this.safeRequest({
      url: '/api/articles?limit=3',
      timeout: 8000,
      retry: 2
    }).then(res => {
      if (res.success) {
        const articles = res.articles.map(article => ({
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
        this.setData({
          articles: articles
        });
      } else {
        this.showErrorToast(res.message || '获取文章失败');
      }
    }).catch(err => {
      console.error('获取义闻文章失败:', err);
      this.showErrorToast('网络异常，请稍后重试');
    }).finally(() => {
      this.setData({ 'loading.articles': false });
    });
  },

  fetchProducts() {
    this.setData({ 'loading.products': true });
    
    this.safeRequest({
      url: '/api/products?limit=4',
      timeout: 8000,
      retry: 2
    }).then(res => {
      if (res.success && res.products && res.products.length > 0) {
        const products = res.products.map(product => ({
          id: product._id,
          name: product.name,
          cover: this.resolveAssetUrl(product.cover),
          price: product.price,
          originalPrice: product.originalPrice,
          sales: product.sales || 0,
          category: product.category
        }));
        this.setData({
          hotProducts: products
        });
      } else {
        this.setData({
          hotProducts: mockProducts.slice(0, 4)
        });
      }
    }).catch(err => {
      console.error('获取义闻商品失败:', err);
      this.showErrorToast('网络异常，请稍后重试');
      this.setData({
        hotProducts: mockProducts.slice(0, 4)
      });
    }).finally(() => {
      this.setData({ 'loading.products': false });
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

  goToArticle() {
    wx.navigateTo({
      url: '/packageContent/pages/article/article'
    });
  },

  goToShop() {
    wx.switchTab({
      url: '/pages/shop/shop'
    });
  },

  viewArticle(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/packageContent/pages/article/detail?id=${id}`
    });
  },

  viewProduct(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: '/packageShop/pages/product/product?id=' + id
    });
  }
})
