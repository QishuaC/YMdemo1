const app = getApp();
const auth = require('../../utils/auth');

Page({
  data: {
    userInfo: null,
    isLoggedIn: false,
    isMember: false,
    memberExpiry: '',
    memberLevel: {
      name: 'VIP会员',
      icon: '👑',
      price: 99
    },
    monthlyGiftClaimed: false,
    luckyDrawChances: 0,
    points: 0,
    coupons: 5,
    totalCheckIns: 0,
    monthlyCheckInCount: 0,
    hasCheckedIn: false,
    menuList: [
      { icon: '👤', title: '个人信息' },
      { icon: '📦', title: '我的订单' },
      { icon: '📍', title: '收货地址' },
      { icon: '🎁', title: '我的优惠券' },
      { icon: '⭐', title: '我的收藏' }
    ]
  },

  onLoad() {
    this.loadMemberInfo();
  },

  onShow() {
    const tabBar = typeof this.getTabBar === 'function' ? this.getTabBar() : null;
    if (tabBar) {
      tabBar.setData({ selected: 3 });
    }
    this.loadMemberInfo();
    this.loadCheckInStatus();
  },

  normalizeAvatarUrl(url) {
    if (!url || typeof url !== 'string') return '';
    if (/^https?:\/\//.test(url)) return url;
    if (url.startsWith('/uploads/')) {
      return `${app.globalData.baseUrl}${url}?v=${Date.now()}`;
    }
    return url;
  },

  loadMemberInfo() {
    const isLoggedIn = auth.isLoggedIn();
    const userInfo = auth.getUserInfo();
    const normalizedUserInfo = isLoggedIn && userInfo
      ? {
          ...userInfo,
          avatarUrl: this.normalizeAvatarUrl(userInfo.avatarUrl || userInfo.avatar)
        }
      : null;
    
    this.setData({
      isLoggedIn,
      userInfo: normalizedUserInfo,
      isMember: app.globalData.isMember || false,
      memberExpiry: app.globalData.memberExpiry || '',
      monthlyGiftClaimed: app.globalData.monthlyGiftClaimed || false,
      luckyDrawChances: app.globalData.luckyDrawChances || 0,
      points: app.globalData.points || 0
    });
  },

  loadCheckInStatus() {
    if (!this.data.isLoggedIn) {
      this.setData({ hasCheckedIn: false, totalCheckIns: 0, monthlyCheckInCount: 0 });
      return;
    }
    
    const cacheKey = 'checkin_status_cache';
    const cache = wx.getStorageSync(cacheKey);
    const now = Date.now();
    
    if (cache && (now - cache.timestamp < 60000)) {
      this.setData({
        hasCheckedIn: cache.data.hasCheckedIn,
        totalCheckIns: cache.data.totalCheckIns,
        monthlyCheckInCount: cache.data.monthlyCheckInCount || 0,
        points: cache.data.points
      });
      app.globalData.points = Number(cache.data.points || 0);
      app.saveMemberData();
    }
    
    app.request({
      url: '/api/checkin/status',
      method: 'GET',
      timeout: 5000
    }).then((res) => {
      if (res.success) {
        this.setData({
          hasCheckedIn: res.data.hasCheckedIn,
          totalCheckIns: res.data.totalCheckIns,
          monthlyCheckInCount: res.data.monthlyCheckInCount || 0,
          points: res.data.points
        });
        app.globalData.points = res.data.points;
        app.saveMemberData();
        
        wx.setStorageSync(cacheKey, {
          data: res.data,
          timestamp: now
        });
      }
    }).catch((err) => {
      console.error('加载签到状态失败:', err);
      if (cache && cache.data) {
        this.setData({
          hasCheckedIn: cache.data.hasCheckedIn,
          totalCheckIns: cache.data.totalCheckIns,
          monthlyCheckInCount: cache.data.monthlyCheckInCount || 0,
          points: cache.data.points
        });
        app.globalData.points = Number(cache.data.points || 0);
        app.saveMemberData();
      }
    });
  },

  handleCheckIn() {
    if (!this.data.isLoggedIn) {
      auth.requireLogin(() => {
        this.loadMemberInfo();
        this.loadCheckInStatus();
      });
      return;
    }
    
    if (this.data.hasCheckedIn) {
      wx.showToast({ title: '今日已签到', icon: 'none' });
      return;
    }
    
    wx.showLoading({ title: '签到中...' });
    
    app.request({
      url: '/api/checkin',
      method: 'POST'
    }).then((res) => {
      wx.hideLoading();
      if (res.success) {
        wx.showToast({ title: '签到成功！+1积分', icon: 'success' });
        this.setData({
          hasCheckedIn: true,
          totalCheckIns: res.data.totalCheckIns,
          monthlyCheckInCount: res.data.monthlyCheckInCount || this.data.monthlyCheckInCount + 1,
          points: res.data.points
        });
        app.globalData.points = res.data.points;
        app.saveMemberData();
      } else {
        wx.showToast({ title: res.message || '签到失败', icon: 'none' });
      }
    }).catch(() => {
      wx.hideLoading();
      wx.showToast({ title: '网络错误', icon: 'none' });
    });
  },

  handleLogin() {
    if (this.data.isLoggedIn) return;
    wx.navigateTo({ url: '/pages/login/login' });
  },

  handleLogout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      confirmText: '退出',
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          auth.logout();
          this.setData({
            isLoggedIn: false,
            userInfo: null,
            isMember: false
          });
          wx.showToast({ title: '已退出登录', icon: 'success' });
        }
      }
    });
  },

  joinMember() {
    if (!this.data.isLoggedIn) {
      auth.requireLogin(() => this.loadMemberInfo());
      return;
    }

    wx.showLoading({ title: '开通中...' });
    
    setTimeout(() => {
      wx.hideLoading();
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 30);
      
      app.globalData.isMember = true;
      app.globalData.memberExpiry = expiry.toLocaleDateString('zh-CN');
      app.globalData.luckyDrawChances = 3;
      app.saveMemberData();
      
      wx.showToast({ title: '开通成功！', icon: 'success' });
      this.setData({
        isMember: true,
        memberExpiry: app.globalData.memberExpiry,
        luckyDrawChances: 3
      });
    }, 1500);
  },

  claimGift() {
    if (!this.data.isLoggedIn) {
      auth.requireLogin(() => this.loadMemberInfo());
      return;
    }
    if (this.data.monthlyGiftClaimed) {
      wx.showToast({ title: '本月已领取', icon: 'none' });
      return;
    }
    
    wx.showLoading({ title: '领取中...' });
    setTimeout(() => {
      wx.hideLoading();
      app.globalData.monthlyGiftClaimed = true;
      app.saveMemberData();
      wx.showToast({ title: '领取成功！', icon: 'success' });
      this.setData({ monthlyGiftClaimed: true });
    }, 1000);
  },

  goToDraw() {
    if (!this.data.isLoggedIn) {
      auth.requireLogin(() => this.loadMemberInfo());
      return;
    }
    if (!this.data.isMember) {
      wx.showToast({ title: '请先开通会员', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/lucky-draw/lucky-draw' });
  },

  goToPointsExchange() {
    if (!this.data.isLoggedIn) {
      auth.requireLogin(() => {});
      return;
    }
    wx.navigateTo({ url: '/pages/points-exchange/points-exchange' });
  },

  handleMenu(e) {
    const menu = this.data.menuList[e.currentTarget.dataset.index];
    if (!this.data.isLoggedIn) {
      auth.requireLogin(() => {});
      return;
    }
    if (menu.title === '个人信息') {
      wx.navigateTo({ url: '/pages/profile/profile' });
    } else if (menu.title === '我的订单') {
      wx.navigateTo({ url: '/pages/order/order' });
    } else if (menu.title === '收货地址') {
      wx.navigateTo({ url: '/pages/address/address' });
    } else {
      wx.showToast({ title: menu.title, icon: 'none' });
    }
  }
});
