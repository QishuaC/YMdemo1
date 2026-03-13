const auth = require('./utils/auth');
const { mockArticles, mockVideos, mockProducts } = require('./data/mock.js');

App({
  globalData: {
    baseUrl: 'http://localhost:3000',
    userInfo: null,
    cart: [],
    orders: [],
    addresses: [],
    isMember: false,
    memberExpiry: '',
    monthlyGiftClaimed: false,
    luckyDrawChances: 0,
    points: 0,
    selectedTab: 0,
    token: null,
    isLoggedIn: false,
    uiConfig: {
      banner: 'https://picsum.photos/750/300?random=100',
      shopBanners: [
        {
          id: 1,
          image: 'https://picsum.photos/800/300?random=100',
          targetPage: '/pages/product/product?id=1'
        },
        {
          id: 2,
          image: 'https://picsum.photos/800/300?random=101',
          targetPage: '/pages/product/product?id=3'
        }
      ],
      tabBar: [
        { pagePath: '/pages/index/index', text: '义闻', icon: '🏠' },
        { pagePath: '/pages/yixun/yixun', text: '义讯', icon: '📺' },
        { pagePath: '/pages/shop/shop', text: '义商', icon: '🛒' },
        { pagePath: '/pages/member/member', text: '我的', icon: '👤' }
      ],
      defaultAvatar: '/assets/default-avatar.png',
      themeColor: '#07c160'
    }
  },

  onLaunch() {
    this.checkLoginStatus();
    this.loadUiConfig();
    this.loadCart();
    this.loadMemberData();
    this.loadOrders();
    this.initBackendData();
  },

  async checkLoginStatus() {
    const isLoggedIn = auth.isLoggedIn();
    const userInfo = auth.getUserInfo();
    const token = auth.getToken();
    
    this.globalData.isLoggedIn = isLoggedIn;
    this.globalData.userInfo = isLoggedIn ? userInfo : null;
    this.globalData.token = isLoggedIn ? token : null;
    
    if (isLoggedIn) {
      await this.loadAddresses();
    }
  },

  loadUiConfig() {
    const cached = wx.getStorageSync('uiConfig');
    if (cached) {
      this.globalData.uiConfig = { ...this.globalData.uiConfig, ...cached };
    }
    
    // Asynchronous update
    this.request({
      url: '/api/ui-config',
      method: 'GET'
    }).then(res => {
      if (res && res.success && res.config) {
        this.globalData.uiConfig = { ...this.globalData.uiConfig, ...res.config };
        wx.setStorageSync('uiConfig', this.globalData.uiConfig);
        // Notify pages if needed, or rely on pages reading globalData on show
      }
    }).catch(err => {
      console.error('Failed to load UI config:', err);
    });
  },

  request(options) {
    const baseUrl = this.globalData.baseUrl;
    const userId = auth.getUserId();
    const maxRetries = options.retry || 0;
    const timeout = options.timeout || 10000;
    
    const makeRequest = (retryCount = 0) => {
      return new Promise((resolve, reject) => {
        const requestTask = wx.request({
          url: baseUrl + options.url,
          method: options.method || 'GET',
          data: options.data || {},
          header: {
            'Content-Type': 'application/json',
            'Authorization': this.globalData.token ? `Bearer ${this.globalData.token}` : '',
            'x-user-id': userId
          },
          timeout: timeout,
          success: (res) => {
            if (res.statusCode === 401) {
              auth.logout();
              reject(new Error('登录已过期，请重新登录'));
              return;
            }
            resolve(res.data);
          },
          fail: (err) => {
            if (retryCount < maxRetries) {
              console.log(`请求失败，重试 ${retryCount + 1}/${maxRetries}`, err);
              setTimeout(() => {
                makeRequest(retryCount + 1).then(resolve).catch(reject);
              }, 1000 * (retryCount + 1));
            } else {
              reject(err);
            }
          }
        });
      });
    };
    
    return makeRequest();
  },

  initBackendData() {
    const bootstrapped = wx.getStorageSync('backendBootstrapped');
    if (bootstrapped) return;
    const orders = (this.globalData.orders || []).map((order) => ({
      _id: String(order.id || ''),
      orderNumber: order.orderNumber,
      userId: 'wx_user_001',
      userName: '微信用户',
      items: order.items || [],
      totalPrice: order.totalPrice || 0,
      status: order.status || 'pending',
      address: order.address || null,
      createdAt: order.createTime ? new Date(order.createTime).toISOString() : new Date().toISOString()
    }));
    this.request({
      url: '/api/bootstrap',
      method: 'POST',
      data: {
        products: mockProducts,
        articles: mockArticles,
        videos: mockVideos,
        orders,
        force: false
      }
    }).then((res) => {
      if (res && res.success) {
        wx.setStorageSync('backendBootstrapped', true);
      }
    }).catch(() => {});
  },

  loadMemberData() {
    const memberData = wx.getStorageSync('memberData');
    if (memberData) {
      this.globalData.isMember = memberData.isMember || false;
      this.globalData.memberExpiry = memberData.memberExpiry || '';
      this.globalData.monthlyGiftClaimed = memberData.monthlyGiftClaimed || false;
      this.globalData.luckyDrawChances = memberData.luckyDrawChances || 0;
      this.globalData.points = memberData.points || 0;
    }
  },

  saveMemberData() {
    wx.setStorageSync('memberData', {
      isMember: this.globalData.isMember,
      memberExpiry: this.globalData.memberExpiry,
      monthlyGiftClaimed: this.globalData.monthlyGiftClaimed,
      luckyDrawChances: this.globalData.luckyDrawChances,
      points: this.globalData.points
    });
  },

  async syncPointsFromServer() {
    try {
      const res = await this.request({
        url: '/api/points/history',
        method: 'GET',
        data: { page: 1, limit: 1 },
        timeout: 5000
      });
      if (res && res.success && res.data) {
        const currentPoints = Number(res.data.currentPoints);
        if (!Number.isNaN(currentPoints)) {
          this.globalData.points = currentPoints;
          this.saveMemberData();
          return currentPoints;
        }
      }
    } catch (err) {
      console.error('Failed to sync points from backend:', err);
    }
    return Number(this.globalData.points || 0);
  },

  loadCart() {
    const cart = wx.getStorageSync('cart');
    if (cart) this.globalData.cart = cart;
  },

  saveCart() {
    wx.setStorageSync('cart', this.globalData.cart);
  },

  loadOrders() {
    const orders = wx.getStorageSync('orders');
    if (orders) this.globalData.orders = orders;
  },

  saveOrders() {
    wx.setStorageSync('orders', this.globalData.orders);
  },

  async loadAddresses() {
    try {
      const res = await this.request({
        url: '/api/user/addresses',
        method: 'GET'
      });
      if (res && res.success && res.addresses) {
        this.globalData.addresses = res.addresses;
        wx.setStorageSync('addresses', this.globalData.addresses);
      }
    } catch (err) {
      console.error('Failed to load addresses from backend:', err);
      const addresses = wx.getStorageSync('addresses');
      if (addresses) this.globalData.addresses = addresses;
    }
  },

  async saveAddresses() {
    wx.setStorageSync('addresses', this.globalData.addresses);
    try {
      await this.request({
        url: '/api/user/addresses',
        method: 'PUT',
        data: { addresses: this.globalData.addresses }
      });
    } catch (err) {
      console.error('Failed to save addresses to backend:', err);
    }
  },

  addToCart(product) {
    const existingItem = this.globalData.cart.find(item => item.id === product.id);
    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      this.globalData.cart.push({ ...product, quantity: 1, selected: false });
    }
    this.saveCart();
    wx.showToast({ title: '已加入购物车', icon: 'success' });
  },

  createOrder(orderData) {
    const order = {
      id: Date.now(),
      orderNumber: `ORD${Date.now()}${Math.floor(Math.random() * 1000)}`,
      ...orderData,
      status: 'pending',
      createTime: Date.now()
    };
    this.globalData.orders.unshift(order);
    this.saveOrders();
    return order;
  }
})
