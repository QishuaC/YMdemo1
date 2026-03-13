const app = getApp();
const auth = require('../../utils/auth');

Page({
  data: {
    userInfo: null,
    isLoggedIn: false,
    isMember: false,
    memberExpiry: '',
    memberPlan: '',
    selectedPlan: 'monthly',
    memberPricing: {
      monthly: 9.9,
      yearly: 99
    },
    memberBenefits: {
      badgeDigitalClaimed: false,
      badgePhysicalEligible: false,
      genealogyDigitalClaimed: false,
      genealogyPhysicalEligible: false
    },
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
      { icon: '💬', title: '义门客服' }
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
    this.syncMemberProfile();
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
      memberPlan: app.globalData.memberPlan || '',
      memberExpiry: app.globalData.memberExpiry || '',
      memberBenefits: app.globalData.memberBenefits || this.data.memberBenefits,
      points: app.globalData.points || 0
    });
  },

  applyMemberProfile(profile) {
    const benefits = profile.memberBenefits || this.data.memberBenefits;
    this.setData({
      isMember: Boolean(profile.isMember),
      memberPlan: profile.memberPlan || '',
      memberExpiry: profile.memberExpiry || '',
      memberBenefits: benefits,
      memberPricing: profile.pricing || this.data.memberPricing
    });
    app.globalData.isMember = Boolean(profile.isMember);
    app.globalData.memberPlan = profile.memberPlan || '';
    app.globalData.memberExpiry = profile.memberExpiry || '';
    app.globalData.memberBenefits = benefits;
    app.saveMemberData();
  },

  syncMemberProfile() {
    if (!this.data.isLoggedIn) {
      return Promise.resolve();
    }
    return app.request({
      url: '/api/member/profile',
      method: 'GET',
      timeout: 5000
    }).then((res) => {
      if (res.success && res.data) {
        this.applyMemberProfile(res.data);
      }
    }).catch(() => {});
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
        const earnedPoints = res.data.earnedPoints || (this.data.isMember ? 20 : 10);
        wx.showToast({ title: `签到成功！+${earnedPoints}积分`, icon: 'success' });
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

    const planType = this.data.selectedPlan === 'yearly' ? 'yearly' : 'monthly';
    wx.showLoading({ title: '开通中...' });
    app.request({
      url: '/api/member/subscribe',
      method: 'POST',
      data: { planType }
    }).then((res) => {
      wx.hideLoading();
      if (res.success && res.data) {
        this.applyMemberProfile(res.data);
        wx.showToast({ title: res.message || '开通成功', icon: 'success' });
        return;
      }
      wx.showToast({ title: res.message || '开通失败', icon: 'none' });
    }).catch(() => {
      wx.hideLoading();
      wx.showToast({ title: '网络错误', icon: 'none' });
    });
  },

  handlePlanSelect(e) {
    const plan = e.currentTarget.dataset.plan;
    if (!plan || (plan !== 'monthly' && plan !== 'yearly')) return;
    this.setData({ selectedPlan: plan });
  },

  claimBenefit(e) {
    if (!this.data.isLoggedIn) {
      auth.requireLogin(() => this.loadMemberInfo());
      return;
    }
    if (!this.data.isMember) {
      wx.showToast({ title: '请先开通会员', icon: 'none' });
      return;
    }
    const benefitType = e.currentTarget.dataset.type;
    if (!benefitType) return;
    const benefits = this.data.memberBenefits || {};
    if (benefitType === 'badge' && benefits.badgeDigitalClaimed) {
      wx.showToast({ title: '编号徽章已领取', icon: 'none' });
      return;
    }
    if (benefitType === 'genealogy' && benefits.genealogyDigitalClaimed) {
      wx.showToast({ title: '电子通谱已领取', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '领取中...' });
    app.request({
      url: '/api/member/claim-benefit',
      method: 'POST',
      data: { benefitType }
    }).then((res) => {
      wx.hideLoading();
      if (res.success && res.data) {
        this.applyMemberProfile(res.data);
        wx.showToast({ title: res.message || '领取成功', icon: 'success' });
        return;
      }
      wx.showToast({ title: res.message || '领取失败', icon: 'none' });
    }).catch(() => {
      wx.hideLoading();
      wx.showToast({ title: '网络错误', icon: 'none' });
    });
  },

  goToPointsExchange() {
    if (!this.data.isLoggedIn) {
      auth.requireLogin(() => {});
      return;
    }
    wx.navigateTo({ url: '/packageActivity/pages/points-exchange/points-exchange' });
  },

  handleMenu(e) {
    const menu = this.data.menuList[e.currentTarget.dataset.index];
    if (!this.data.isLoggedIn) {
      auth.requireLogin(() => {});
      return;
    }
    if (menu.title === '个人信息') {
      wx.navigateTo({ url: '/packageActivity/pages/profile/profile' });
    } else if (menu.title === '我的订单') {
      wx.navigateTo({ url: '/packageShop/pages/order/order' });
    } else if (menu.title === '收货地址') {
      wx.navigateTo({ url: '/packageShop/pages/address/address' });
    } else if (menu.title === '义门客服') {
      wx.navigateTo({ url: '/pages/customer-service/customer-service' });
    } else {
      wx.showToast({ title: menu.title, icon: 'none' });
    }
  }
});
