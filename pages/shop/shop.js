const { mockProducts, mockBanners } = require('../../data/mock.js');
const app = getApp();

Page({
  data: {
    categories: ['全部', '传统酿造', '手工艺品', '文创周边', '农家特产'],
    currentCategory: 0,
    products: [],
    banners: [],
    cartCount: 0,
    searchKeyword: '',
    baseUrl: 'http://localhost:3000',
    isMember: false,
    pageSize: 8,
    currentPage: 1,
    hasMoreProducts: false,
    isLoadingProducts: true,
    isLoadingMore: false
  },

  onLoad() {
    this.productCacheKey = 'shop_products_cache_v1';
    this.searchTimer = null;
    this.loadBanners();
    this.loadProducts({ reset: true, useCache: true });
  },

  onShow() {
    const tabBar = typeof this.getTabBar === 'function' ? this.getTabBar() : null;
    if (tabBar) {
      tabBar.setData({ selected: 2 });
    }
    this.updateCartCount();
    this.setData({
      isMember: Boolean(app.globalData.isLoggedIn && app.globalData.isMember)
    });
    this.refreshPrices();
  },

  onUnload() {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
  },

  loadBanners() {
    const uiConfig = app.globalData.uiConfig || {};
    const configBanners = Array.isArray(uiConfig.shopBanners) ? uiConfig.shopBanners : [];
    if (configBanners.length > 0) {
      const banners = configBanners
        .filter((item) => item && item.image)
        .map((item, index) => ({
          id: item.id || (index + 1),
          title: item.title || '',
          subtitle: item.subtitle || '',
          btnText: item.btnText || '立即抢购',
          btnColor: item.btnColor || '#ffc107',
          image: this.resolveAssetUrl(item.image),
          targetPage: item.targetPage || '',
          bgColor: item.bgColor || '#ffffff'
        }));
      if (banners.length > 0) {
        this.setData({ banners });
        return;
      }
    }
    this.setData({
      banners: mockBanners
    });
  },
  toOneDecimal(value) {
    const num = Number(value || 0);
    return Math.round((num + Number.EPSILON) * 10) / 10;
  },

  getDisplayPrice(rawPrice) {
    const price = Number(rawPrice || 0);
    if (this.data.isMember) {
      return Math.max(0, this.toOneDecimal(price * 0.95));
    }
    return this.toOneDecimal(price);
  },

  resolveAssetUrl(path) {
    if (!path) return '';
    return path.startsWith('http') ? path : this.data.baseUrl + path;
  },

  mapProduct(item) {
    return {
      id: item._id || item.id,
      name: item.name,
      cover: this.resolveAssetUrl(item.cover),
      basePrice: this.toOneDecimal(item.price),
      originalBasePrice: this.toOneDecimal(item.originalPrice || item.price),
      price: this.getDisplayPrice(item.price),
      originalPrice: this.data.isMember ? this.toOneDecimal(item.price) : this.toOneDecimal(item.originalPrice || item.price),
      showMemberPrice: this.data.isMember,
      sales: item.sales || 0,
      category: item.category || '默认分类',
      stock: item.stock || 0,
      serviceTags: Array.isArray(item.serviceTags) ? item.serviceTags : []
    };
  },

  getCurrentCategoryName(categoryIndex = this.data.currentCategory) {
    return this.data.categories[categoryIndex] || '全部';
  },

  buildProductQuery(page) {
    const query = {
      page,
      limit: this.data.pageSize
    };
    const keyword = String(this.data.searchKeyword || '').trim();
    const categoryName = this.getCurrentCategoryName();
    if (keyword) {
      query.keyword = keyword;
    }
    if (categoryName !== '全部') {
      query.category = categoryName;
    }
    return query;
  },

  loadProducts({ reset = false, useCache = false } = {}) {
    if (reset && useCache) {
      const cachedProducts = wx.getStorageSync(this.productCacheKey);
      if (Array.isArray(cachedProducts) && cachedProducts.length > 0) {
        this.setData({
          products: cachedProducts,
          isLoadingProducts: false
        });
      }
    }
    if (reset) {
      this.setData({
        isLoadingProducts: true,
        isLoadingMore: false
      });
    } else {
      if (!this.data.hasMoreProducts || this.data.isLoadingMore) return;
      this.setData({ isLoadingMore: true });
    }
    const nextPage = reset ? 1 : this.data.currentPage + 1;
    app.request({
      url: '/api/products',
      data: this.buildProductQuery(nextPage)
    }).then((res) => {
      if (!res.success || !Array.isArray(res.products)) {
        throw new Error('invalid products response');
      }
      const incoming = res.products.map((item) => this.mapProduct(item));
      const products = reset ? incoming : this.data.products.concat(incoming);
      const total = Number(res.total || 0);
      const hasMoreProducts = total > 0 ? products.length < total : incoming.length >= this.data.pageSize;
      if (reset && !this.data.searchKeyword && this.getCurrentCategoryName() === '全部') {
        wx.setStorageSync(this.productCacheKey, products);
      }
      this.setData({
        products,
        currentPage: Number(res.page || nextPage),
        hasMoreProducts,
        isLoadingProducts: false,
        isLoadingMore: false
      });
    }).catch(() => {
      if (!reset) {
        this.setData({ isLoadingMore: false });
        return;
      }
      const keyword = String(this.data.searchKeyword || '').trim().toLowerCase();
      const categoryName = this.getCurrentCategoryName();
      const fallbackList = mockProducts
        .map((item) => this.mapProduct(item))
        .filter((item) => {
          const byCategory = categoryName === '全部' || item.category === categoryName;
          if (!byCategory) return false;
          if (!keyword) return true;
          return item.name.toLowerCase().includes(keyword) || String(item.category || '').toLowerCase().includes(keyword);
        });
      const firstPage = fallbackList.slice(0, this.data.pageSize);
      this.setData({
        products: firstPage,
        currentPage: 1,
        hasMoreProducts: fallbackList.length > firstPage.length,
        isLoadingProducts: false,
        isLoadingMore: false
      });
    });
  },

  onBannerClick(e) {
    const bannerId = e.currentTarget.dataset.id;
    const banner = this.data.banners.find(b => String(b.id) === String(bannerId));
    if (!banner) return;
    if (banner.targetPage) {
      if (banner.targetPage === '/pages/yiwen/yiwen' || banner.targetPage === '/pages/yixun/yixun' || banner.targetPage === '/pages/shop/shop' || banner.targetPage === '/pages/member/member') {
        wx.switchTab({ url: banner.targetPage });
      } else {
        wx.navigateTo({ url: banner.targetPage });
      }
      return;
    }
    if (banner.productId) {
      wx.navigateTo({
        url: '/packageShop/pages/product/product?id=' + banner.productId
      });
    }
  },

  onSearchTap() {
    return;
  },

  onSearchInput(e) {
    const keyword = e.detail.value;
    this.setData({
      searchKeyword: keyword
    });
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    this.searchTimer = setTimeout(() => {
      this.loadProducts({ reset: true });
    }, 250);
  },

  onSearchConfirm(e) {
    const keyword = e.detail.value;
    this.setData({
      searchKeyword: keyword
    });
    this.loadProducts({ reset: true });
  },

  onReachBottom() {
    this.loadProducts();
  },

  refreshPrices() {
    if (!Array.isArray(this.data.products) || this.data.products.length === 0) return;
    const refreshed = this.data.products.map((item) => {
      const basePrice = this.toOneDecimal(item.basePrice || item.price || 0);
      const originalBasePrice = this.toOneDecimal(item.originalBasePrice || item.originalPrice || basePrice);
      return {
        ...item,
        basePrice,
        originalBasePrice,
        price: this.getDisplayPrice(basePrice),
        originalPrice: this.data.isMember ? basePrice : originalBasePrice,
        showMemberPrice: this.data.isMember
      };
    });
    this.setData({ products: refreshed });
  },

  updateCartCount() {
    const cart = Array.isArray(app.globalData.cart) ? app.globalData.cart : [];
    const count = cart.reduce((total, item) => total + (Number(item.quantity) || 0), 0);
    this.setData({
      cartCount: count
    });
  },

  switchCategory(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      currentCategory: index,
      searchKeyword: ''
    });
    this.loadProducts({ reset: true });
  },

  goToCart() {
    wx.navigateTo({
      url: '/packageShop/pages/order/order'
    });
  },

  viewProduct(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: '/packageShop/pages/product/product?id=' + id
    });
  },

  addToCart(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) {
      wx.showToast({
        title: '商品信息异常',
        icon: 'none'
      });
      return;
    }
    const product = this.data.products.find(p => String(p.id) === String(id));
    if (!product) return;
    app.addToCart({
      id: product.id,
      name: product.name,
      price: Number(product.basePrice || product.price || 0),
      cover: product.cover
    });
    this.updateCartCount();
  }
})
