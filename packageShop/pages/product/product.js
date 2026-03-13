const { mockProducts } = require('../../../data/mock.js');
const { showShareToast, buildShareConfig } = require('../../../utils/share.js');
const auth = require('../../../utils/auth');
const app = getApp();

Page({
  data: {
    productId: null,
    product: {},
    images: [],
    detailImages: [],
    cartCount: 0,
    baseUrl: 'http://localhost:3000',
    isMember: false,
    currentImageIndex: 0
  },

  onLoad(options) {
    const productId = options.id;
    this.loadProduct(productId);
  },

  onShow() {
    this.setData({
      isMember: Boolean(app.globalData.isLoggedIn && app.globalData.isMember)
    });
    this.updateCartCount();
  },

  toOneDecimal(value) {
    const num = Number(value || 0);
    return Math.round((num + Number.EPSILON) * 10) / 10;
  },

  getDisplayPrice(rawPrice) {
    const price = Number(rawPrice || 0);
    if (this.data.isMember) {
      return this.toOneDecimal(price * 0.95);
    }
    return this.toOneDecimal(price);
  },

  loadProduct(productId) {
    app.request({
      url: `/api/products/${productId}`
    }).then((res) => {
      if (res.success && res.product) {
        const item = res.product;
        
        let coverImages = [];
        if (Array.isArray(item.covers) && item.covers.length > 0) {
          coverImages = item.covers.map(img => 
            img.startsWith('http') ? img : this.data.baseUrl + img
          );
        } else if (item.cover) {
          coverImages = [item.cover.startsWith('http') ? item.cover : this.data.baseUrl + item.cover];
        }
        
        const detailImages = Array.isArray(item.detailImages) && item.detailImages.length > 0
          ? item.detailImages.map(img => 
              img.startsWith('http') ? img : this.data.baseUrl + img
            )
          : (item.detailImage
              ? [(item.detailImage.startsWith('http') ? item.detailImage : this.data.baseUrl + item.detailImage)]
              : [
                  'https://picsum.photos/700/600?random=301',
                  'https://picsum.photos/700/600?random=302',
                  'https://picsum.photos/700/600?random=303'
                ]);
        
        const product = {
          id: item._id,
          name: item.name,
          cover: coverImages.length > 0 ? coverImages[0] : '',
          detailImage: detailImages[0] || '',
          basePrice: this.toOneDecimal(item.price),
          price: this.getDisplayPrice(item.price),
          originalPrice: this.data.isMember ? this.toOneDecimal(item.price) : this.toOneDecimal(item.originalPrice || item.price),
          sales: item.sales || 0,
          category: item.category || '默认分类',
          stock: item.stock || 0,
          serviceTags: Array.isArray(item.serviceTags) ? item.serviceTags : [],
          showMemberPrice: Boolean(this.data.isMember)
        };
        const images = coverImages.length > 0 ? coverImages : [
          'https://picsum.photos/750/750?random=401',
          'https://picsum.photos/750/750?random=402',
          'https://picsum.photos/750/750?random=403'
        ];
        this.setData({
          productId: product.id,
          product,
          images,
          detailImages,
          currentImageIndex: 0
        });
        this.preloadAround(0);
      }
    }).catch(() => {
      const fallback = mockProducts.find((p) => String(p.id) === String(productId)) || mockProducts[0];
      const images = [
        fallback.cover,
        'https://picsum.photos/750/750?random=401',
        'https://picsum.photos/750/750?random=402',
        'https://picsum.photos/750/750?random=403'
      ];
      this.setData({
        productId: fallback.id,
        product: {
          ...fallback,
          serviceTags: Array.isArray(fallback.serviceTags) ? fallback.serviceTags : []
        },
        images,
        currentImageIndex: 0,
        detailImages: [
          'https://picsum.photos/700/600?random=301',
          'https://picsum.photos/700/600?random=302',
          'https://picsum.photos/700/600?random=303'
        ]
      });
      this.preloadAround(0);
    });
  },

  onGalleryChange(e) {
    const index = Number(e.detail.current || 0);
    this.setData({
      currentImageIndex: index
    });
    this.preloadAround(index);
  },

  preloadAround(currentIndex) {
    const images = Array.isArray(this.data.images) ? this.data.images : [];
    if (images.length === 0) return;
    const nextIndexes = [
      (currentIndex + 1) % images.length,
      (currentIndex + 2) % images.length
    ];
    nextIndexes.forEach((idx) => {
      this.preloadImage(images[idx]);
    });
    const detailImages = Array.isArray(this.data.detailImages) ? this.data.detailImages : [];
    detailImages.slice(0, 2).forEach((url) => {
      this.preloadImage(url);
    });
  },

  preloadImage(src) {
    if (!src) return;
    wx.getImageInfo({
      src
    });
  },

  updateCartCount() {
    const count = app.globalData.cart.reduce((total, item) => total + item.quantity, 0);
    this.setData({
      cartCount: count
    });
  },

  addToCart() {
    app.addToCart({
      ...this.data.product,
      price: Number(this.data.product.basePrice || this.data.product.price || 0)
    });
    this.updateCartCount();
  },

  buyNow() {
    auth.requireLogin(() => {
      const basePrice = Number(this.data.product.basePrice || this.data.product.price || 0);
      const originalTotalPrice = basePrice;
      const isMember = Boolean(app.globalData.isLoggedIn && app.globalData.isMember);
      const discountRate = isMember ? 0.95 : 1;
      const totalPrice = isMember ? this.toOneDecimal(originalTotalPrice * discountRate) : this.toOneDecimal(originalTotalPrice);
      const orderItem = {
        ...this.data.product,
        price: basePrice,
        quantity: 1
      };
      const payload = {
        userId: wx.getStorageSync('userId') || '',
        userName: '微信用户',
        items: [orderItem],
        originalTotalPrice,
        totalPrice,
        status: 'pending'
      };
      app.request({
        url: '/api/orders',
        method: 'POST',
        data: payload
      }).then((res) => {
        if (!res.success || !res.order) {
          wx.showToast({
            title: '创建订单失败',
            icon: 'none'
          });
          return;
        }
        wx.navigateTo({
          url: `/packageShop/pages/payment/payment?orderId=${res.order._id}`
        });
      }).catch(() => {
        const order = app.createOrder({
          items: [orderItem],
          originalTotalPrice,
          discountAmount: this.toOneDecimal(Math.max(0, originalTotalPrice - totalPrice)),
          memberDiscountApplied: isMember,
          totalPrice
        });
        wx.navigateTo({
          url: `/packageShop/pages/payment/payment?orderId=${order.id}`
        });
      });
    });
  },

  goToHome() {
    wx.switchTab({
      url: '/pages/shop/shop'
    });
  },

  goToCart() {
    wx.switchTab({
      url: '/pages/shop/shop'
    });
    setTimeout(() => {
      wx.navigateTo({
        url: '/packageShop/pages/cart/cart'
      });
    }, 100);
  },

  doShare() {
    showShareToast();
  },

  onShareAppMessage() {
    const product = this.data.product;
    return buildShareConfig({
      title: product ? product.name : '精选好物推荐',
      path: '/packageShop/pages/product/product?id=' + (product ? product.id : ''),
      imageUrl: product ? product.cover : ''
    });
  },

  onShareTimeline() {
    const product = this.data.product;
    return buildShareConfig({
      title: product ? product.name : '精选好物推荐',
      query: 'id=' + (product ? product.id : ''),
      imageUrl: product ? product.cover : ''
    });
  }
})
