const app = getApp();
const auth = require('../../utils/auth');

Page({
  data: {
    profile: {
      uniqueId: '',
      userNumber: '',
      nickname: '',
      avatar: '',
      gender: '',
      phone: ''
    },
    originalProfile: null,
    saving: false
  },

  stripAvatarVersion(url) {
    if (!url || typeof url !== 'string') return '';
    return url.split('?')[0].split('#')[0];
  },

  onLoad() {
    this.loadProfile();
  },

  loadProfile() {
    if (!auth.isLoggedIn()) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }

    wx.showLoading({ title: '加载中...' });

    app.request({
      url: '/api/user/profile',
      method: 'GET'
    }).then((res) => {
      wx.hideLoading();
      if (res.success) {
        const profile = res.data;
        if (profile.avatar && profile.avatar.startsWith('/uploads/')) {
          profile.avatar = `${app.globalData.baseUrl}${profile.avatar}?v=${Date.now()}`;
        }
        this.setData({
          profile: profile,
          originalProfile: { ...profile }
        });
      } else {
        wx.showToast({ title: res.message || '加载失败', icon: 'none' });
      }
    }).catch(() => {
      wx.hideLoading();
      wx.showToast({ title: '网络错误', icon: 'none' });
    });
  },

  onNicknameInput(e) {
    this.setData({
      'profile.nickname': e.detail.value
    });
  },

  onPhoneInput(e) {
    this.setData({
      'profile.phone': e.detail.value
    });
  },

  selectGender(e) {
    const gender = e.currentTarget.dataset.gender;
    this.setData({
      'profile.gender': gender
    });
  },

  chooseAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFile = res.tempFiles[0];
        const tempFilePath = tempFile.tempFilePath;
        const fileSize = tempFile.size;
        
        if (fileSize > 20 * 1024 * 1024) {
          wx.showModal({
            title: '提示',
            content: '图片文件过大，请选择小于20MB的图片',
            showCancel: false,
            confirmText: '知道了'
          });
          return;
        }
        
        wx.showLoading({ title: '处理中...' });
        wx.compressImage({
          src: tempFilePath,
          quality: 80,
          compressedWidth: 512,
          compressedHeight: 512,
          success: (compressRes) => {
            wx.uploadFile({
              url: app.globalData.baseUrl + '/api/upload/user-avatar',
              filePath: compressRes.tempFilePath,
              name: 'file',
              header: {
                'x-user-id': auth.getUserId()
              },
              success: (uploadRes) => {
                wx.hideLoading();
                const data = JSON.parse(uploadRes.data);
                if (data.success) {
                  let avatarUrl = data.url;
                  if (avatarUrl && avatarUrl.startsWith('/uploads/')) {
                    avatarUrl = `${app.globalData.baseUrl}${avatarUrl}?v=${Date.now()}`;
                  }
                  this.setData({
                    'profile.avatar': avatarUrl
                  });
                  wx.showToast({ title: '头像上传成功', icon: 'success' });
                } else {
                  wx.showToast({ title: data.message || '上传失败', icon: 'none' });
                }
              },
              fail: () => {
                wx.hideLoading();
                wx.showToast({ title: '上传失败', icon: 'none' });
              }
            });
          },
          fail: () => {
            wx.hideLoading();
            wx.showToast({ title: '图片处理失败', icon: 'none' });
          }
        });
      }
    });
  },

  saveProfile() {
    const { profile, originalProfile } = this.data;

    if (!profile.nickname || !profile.nickname.trim()) {
      wx.showToast({ title: '请输入昵称', icon: 'none' });
      return;
    }

    if (profile.phone && !/^1[3-9]\d{9}$/.test(profile.phone)) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' });
      return;
    }

    const hasChanged = JSON.stringify(profile) !== JSON.stringify(originalProfile);
    if (!hasChanged) {
      wx.reLaunch({ url: '/pages/member/member' });
      return;
    }

    this.setData({ saving: true });
    wx.showLoading({ title: '保存中...' });

    app.request({
      url: '/api/user/profile',
      method: 'PUT',
      data: {
        nickname: profile.nickname,
        avatar: this.stripAvatarVersion(profile.avatar),
        gender: profile.gender,
        phone: profile.phone
      }
    }).then((res) => {
      wx.hideLoading();
      if (res.success) {
        const userInfo = auth.getUserInfo();
        auth.updateUserInfo({
          ...userInfo,
          nickName: res.data.nickname,
          avatarUrl: res.data.avatar,
          gender: res.data.gender
        });
        
        wx.showToast({ title: '保存成功', icon: 'success' });
        setTimeout(() => {
          wx.reLaunch({ url: '/pages/member/member' });
        }, 1500);
      } else {
        wx.hideLoading();
        this.setData({ saving: false });
        wx.showToast({ title: res.message || '保存失败', icon: 'none' });
      }
    }).catch(() => {
      wx.hideLoading();
      this.setData({ saving: false });
      wx.showToast({ title: '网络错误', icon: 'none' });
    });
  },

  goBack() {
    wx.navigateBack();
  }
});
