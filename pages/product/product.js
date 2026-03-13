const { mockProducts } = require('../../data/mock.js');
const { showShareToast, buildShareConfig } = require('../../utils/share.js');
const app = getApp();

Page({
  data: {
    productId: null,
    product: {},
    images: [],
    detailImages: [],
    cartCount: 0,
    baseUrl: 'http://localhost:3000'
  },

  onLoad(options) {
    const productId = options.id;
    this.loadProduct(productId);
  },

  onShow() {
    this.updateCartCount();
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
          price: item.price,
          originalPrice: item.originalPrice,
          sales: item.sales || 0,
          category: item.category || '默认分类',
          stock: item.stock || 0,
          serviceTags: Array.isArray(item.serviceTags) ? item.serviceTags : []
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
          detailImages
        });
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
        detailImages: [
          'https://picsum.photos/700/600?random=301',
          'https://picsum.photos/700/600?random=302',
          'https://picsum.photos/700/600?random=303'
        ]
      });
    });
  },

  updateCartCount() {
    const count = app.globalData.cart.reduce((total, item) => total + item.quantity, 0);
    this.setData({
      cartCount: count
    });
  },

  addToCart() {
    app.addToCart(this.data.product);
    this.updateCartCount();
  },

  buyNow() {
    const payload = {
      userId: wx.getStorageSync('userId') || 'wx_user_001',
      userName: '微信用户',
      items: [{ ...this.data.product, quantity: 1 }],
      totalPrice: this.data.product.price,
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
        url: `/pages/payment/payment?orderId=${res.order._id}`
      });
    }).catch(() => {
      const order = app.createOrder({
        items: [{ ...this.data.product, quantity: 1 }],
        totalPrice: this.data.product.price
      });
      wx.navigateTo({
        url: `/pages/payment/payment?orderId=${order.id}`
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
        url: '/pages/cart/cart'
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
      path: '/pages/product/product?id=' + (product ? product.id : ''),
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
