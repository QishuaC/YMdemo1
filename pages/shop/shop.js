const { mockProducts, mockBanners } = require('../../data/mock.js');
const app = getApp();

Page({
  data: {
    categories: ['全部', '传统酿造', '手工艺品', '文创周边', '农家特产'],
    currentCategory: 0,
    products: [],
    allProducts: [],
    banners: [],
    cartCount: 0,
    searchKeyword: '',
    baseUrl: 'http://localhost:3000'
  },

  onLoad() {
    this.loadBanners();
    this.loadProducts();
  },

  onShow() {
    const tabBar = typeof this.getTabBar === 'function' ? this.getTabBar() : null;
    if (tabBar) {
      tabBar.setData({ selected: 2 });
    }
    this.updateCartCount();
    this.setData({
      searchKeyword: ''
    });
    this.loadBanners();
    this.loadProducts();
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
          image: item.image.startsWith('http') ? item.image : this.data.baseUrl + item.image,
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

  loadProducts() {
    app.request({
      url: '/api/products'
    }).then((res) => {
      if (res.success && Array.isArray(res.products) && res.products.length > 0) {
        const products = res.products.map((item) => ({
          id: item._id || item.id,
          name: item.name,
          cover: item.cover && item.cover.startsWith('http') ? item.cover : this.data.baseUrl + item.cover,
          price: item.price,
          originalPrice: item.originalPrice,
          sales: item.sales || 0,
          category: item.category || '默认分类',
          stock: item.stock || 0,
          serviceTags: Array.isArray(item.serviceTags) ? item.serviceTags : []
        }));
        this.setData({
          allProducts: products,
          products
        });
      } else {
        this.setData({
          allProducts: mockProducts,
          products: mockProducts
        });
      }
    }).catch(() => {
      this.setData({
        allProducts: mockProducts,
        products: mockProducts
      });
    });
  },

  onBannerClick(e) {
    const bannerId = e.currentTarget.dataset.id;
    const banner = this.data.banners.find(b => String(b.id) === String(bannerId));
    if (!banner) return;
    if (banner.targetPage) {
      if (banner.targetPage === '/pages/index/index' || banner.targetPage === '/pages/yixun/yixun' || banner.targetPage === '/pages/shop/shop' || banner.targetPage === '/pages/member/member') {
        wx.switchTab({ url: banner.targetPage });
      } else {
        wx.navigateTo({ url: banner.targetPage });
      }
      return;
    }
    if (banner.productId) {
      wx.navigateTo({
        url: '/pages/product/product?id=' + banner.productId
      });
    }
  },

  onSearchTap() {
    console.log('搜索框被点击');
  },

  onSearchInput(e) {
    const keyword = e.detail.value;
    this.setData({
      searchKeyword: keyword
    });
    this.filterProducts(keyword, this.data.currentCategory);
  },

  onSearchConfirm(e) {
    const keyword = e.detail.value;
    this.setData({
      searchKeyword: keyword
    });
    this.filterProducts(keyword, this.data.currentCategory);
    
    setTimeout(() => {
      this.setData({
        searchKeyword: ''
      });
      this.filterProducts('', this.data.currentCategory);
    }, 2000);
  },

  filterProducts(keyword, categoryIndex) {
    let filteredProducts = this.data.allProducts;
    const categoryName = this.data.categories[categoryIndex];

    if (categoryName !== '全部') {
      filteredProducts = filteredProducts.filter(product => {
        return product.category === categoryName;
      });
    }

    if (keyword && keyword.trim()) {
      const searchKey = keyword.trim().toLowerCase();
      filteredProducts = filteredProducts.filter(product => {
        return product.name.toLowerCase().includes(searchKey) ||
               (product.category && product.category.toLowerCase().includes(searchKey));
      });
    }

    this.setData({
      products: filteredProducts
    });
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
    this.filterProducts('', index);
  },

  goToCart() {
    wx.navigateTo({
      url: '/pages/cart/cart'
    });
  },

  viewProduct(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: '/pages/product/product?id=' + id
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
      price: product.price,
      cover: product.cover
    });
    this.updateCartCount();
  }
})
