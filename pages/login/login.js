const auth = require('../../utils/auth');
const app = getApp();

Page({
  data: {
    isLoading: false,
    avatarUrl: '',
    nickName: ''
  },

  onLoad() {
    if (auth.isLoggedIn()) {
      this.navigateBack();
      return;
    }
    
    const userInfo = auth.getUserInfo();
    if (userInfo) {
      this.setData({
        avatarUrl: userInfo.avatarUrl || '',
        nickName: userInfo.nickName || ''
      });
    }
  },

  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    this.setData({ avatarUrl });
  },

  onNickNameInput(e) {
    this.setData({ nickName: e.detail.value });
  },

  onNickNameBlur(e) {
    this.setData({ nickName: e.detail.value });
  },

  async handleLogin() {
    if (this.data.isLoading) return;
    
    this.setData({ isLoading: true });
    
    try {
      // 1. 登录并获取唯一识别码
      const loginRes = await auth.login(this.data.avatarUrl, this.data.nickName);
      const uniqueId = loginRes.user.uniqueId;
      
      console.log('登录成功，获取到唯一识别码:', uniqueId);
      
      const app = getApp();
      
      // 2. 通过唯一识别码获取后端的用户信息
      const res = await app.request({
        url: `/api/user/by-unique-id/${uniqueId}`,
        method: 'GET'
      });
      
      // 3. 刷新前端页面信息
      if (res && res.success && res.user) {
        const userInfo = auth.getUserInfo() || {};
        auth.updateUserInfo({
          ...userInfo,
          _id: res.user._id,
          uniqueId: res.user.uniqueId,
          userNumber: res.user.userNumber,
          nickName: res.user.nickname,
          avatarUrl: res.user.avatar,
          gender: res.user.gender,
          phone: res.user.phone,
          points: res.user.points
        });
        
        if (res.user.addresses) {
          app.globalData.addresses = res.user.addresses;
          wx.setStorageSync('addresses', res.user.addresses);
        }
      }
      
      await app.loadAddresses();
      
      wx.showToast({ title: '登录成功', icon: 'success' });
      setTimeout(() => this.navigateBack(), 1500);
    } catch (error) {
      wx.showToast({ title: error.message || '登录失败', icon: 'none' });
    } finally {
      this.setData({ isLoading: false });
    }
  },

  navigateBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.switchTab({ url: '/pages/member/member' });
    }
  }
});
