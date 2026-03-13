const app = getApp();

Page({
  data: {
    points: 0,
    exchangeProducts: [],
    loading: false,
    defaultCover: 'https://picsum.photos/320/240?random=901'
  },

  onLoad() {
    this.loadPoints();
    this.loadExchangeProducts();
  },

  onShow() {
    this.loadPoints();
  },

  loadPoints() {
    this.setData({
      points: app.globalData.points || 0
    });
    if (typeof app.syncPointsFromServer === 'function') {
      app.syncPointsFromServer().then((points) => {
        this.setData({ points: Number(points || 0) });
      });
    }
  },

  loadExchangeProducts() {
    this.setData({ loading: true });
    app.request({
      url: '/api/exchange-products',
      method: 'GET'
    }).then((res) => {
      if (res && res.success) {
        const exchangeProducts = res.exchangeProducts.map((product) => ({
          id: product._id,
          name: product.name,
          cover: this.normalizeImageUrl(product.cover),
          pointsRequired: product.pointsRequired,
          originalPrice: product.originalPrice,
          description: product.description,
          isHot: product.isHot
        }));
        this.setData({ exchangeProducts });
      }
    }).catch((error) => {
        console.error('加载兑换商品失败:', error);
        wx.showToast({
          title: '加载失败',
          icon: 'none'
        });
    }).finally(() => {
      this.setData({ loading: false });
    });
  },

  normalizeImageUrl(url) {
    if (!url || typeof url !== 'string') {
      return this.data.defaultCover;
    }

    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    const baseUrl = app.globalData.baseUrl || '';
    if (!baseUrl) {
      return this.data.defaultCover;
    }

    return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
  },

  handleImageError(e) {
    const productId = e.currentTarget.dataset.id;
    const target = this.data.exchangeProducts.find((item) => item.id === productId);
    if (!target) return;
    const src = target.cover;
    if (!src || src === this.data.defaultCover || src.startsWith('wxfile://')) {
      this.replaceProductCover(productId, this.data.defaultCover);
      return;
    }
    if (src.startsWith('http://') || src.startsWith('https://')) {
      wx.downloadFile({
        url: src,
        success: (res) => {
          if (res.statusCode === 200 && res.tempFilePath) {
            this.replaceProductCover(productId, res.tempFilePath);
          } else {
            this.replaceProductCover(productId, this.data.defaultCover);
          }
        },
        fail: () => {
          this.replaceProductCover(productId, this.data.defaultCover);
        }
      });
      return;
    }
    this.replaceProductCover(productId, this.data.defaultCover);
  },

  replaceProductCover(productId, cover) {
    const exchangeProducts = this.data.exchangeProducts.map((item) => {
      if (item.id !== productId) return item;
      return { ...item, cover };
    });
    this.setData({ exchangeProducts });
  },

  handleExchange(e) {
    const product = e.currentTarget.dataset.product;
    
    if (this.data.points < product.pointsRequired) {
      wx.showToast({
        title: '积分不足',
        icon: 'none'
      });
      return;
    }

    wx.showModal({
      title: '确认兑换',
      content: `确定花费 ${product.pointsRequired} 积分兑换「${product.name}」吗？`,
      success: (res) => {
        if (res.confirm) {
          this.doExchange(product);
        }
      }
    });
  },

  doExchange(product) {
    wx.showLoading({
      title: '兑换中...'
    });
    app.request({
      url: '/api/points/redeem',
      method: 'POST',
      data: {
        productId: product.id
      }
    }).then((res) => {
      wx.hideLoading();
      if (!res || !res.success) {
        wx.showToast({
          title: (res && res.message) || '兑换失败',
          icon: 'none'
        });
        return;
      }

      const currentPoints = Number(res.data && res.data.currentPoints);
      app.globalData.points = Number.isNaN(currentPoints) ? app.globalData.points : currentPoints;
      app.saveMemberData();

      this.setData({
        points: app.globalData.points
      });

      wx.showToast({
        title: '兑换成功',
        icon: 'success'
      });
    }).catch((error) => {
      wx.hideLoading();
      wx.showToast({
        title: (error && error.message) || '兑换失败',
        icon: 'none'
      });
    });
  },

  goToPointsHistory() {
    wx.navigateTo({ url: '/pages/points-history/points-history' });
  },

  goBack() {
    wx.navigateBack();
  }
});
