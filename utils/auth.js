const TOKEN_KEY = 'token';
const USER_INFO_KEY = 'userInfo';
const USERS_DB_KEY = 'users_db';

const TOKEN_EXPIRY_KEY = 'token_expiry';
const TOKEN_EXPIRY_DAYS = 7;

const auth = {
  getToken() {
    const token = wx.getStorageSync(TOKEN_KEY) || null;
    const expiry = wx.getStorageSync(TOKEN_EXPIRY_KEY);
    
    if (token && expiry) {
      const expiryDate = new Date(expiry);
      if (expiryDate < new Date()) {
        this.logout();
        return null;
      }
    }
    
    return token;
  },

  setToken(token) {
    wx.setStorageSync(TOKEN_KEY, token);
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + TOKEN_EXPIRY_DAYS);
    wx.setStorageSync(TOKEN_EXPIRY_KEY, expiry.toISOString());
  },

  removeToken() {
    wx.removeStorageSync(TOKEN_KEY);
    wx.removeStorageSync(TOKEN_EXPIRY_KEY);
  },

  getUserInfo() {
    return wx.getStorageSync(USER_INFO_KEY) || null;
  },

  setUserInfo(userInfo) {
    wx.setStorageSync(USER_INFO_KEY, userInfo);
  },

  removeUserInfo() {
    wx.removeStorageSync(USER_INFO_KEY);
  },

  updateUserInfo(userInfo) {
    this.setUserInfo(userInfo);
    const app = getApp();
    if (app) {
      app.globalData.userInfo = userInfo;
    }
  },

  getUserId() {
    const userInfo = this.getUserInfo();
    return userInfo ? (userInfo._id || userInfo.openId || 'wx_user_001') : 'wx_user_001';
  },

  getUsersDb() {
    return wx.getStorageSync(USERS_DB_KEY) || {};
  },

  setUsersDb(db) {
    wx.setStorageSync(USERS_DB_KEY, db);
  },

  isLoggedIn() {
    return this.getToken() && this.getUserInfo();
  },

  logout() {
    this.removeToken();
    this.removeUserInfo();
    const app = getApp();
    if (app) {
      app.globalData.userInfo = null;
      app.globalData.token = null;
      app.globalData.isLoggedIn = false;
    }
  },

  generateNickName() {
    const adjectives = ['可爱的', '快乐的', '聪明的', '勇敢的', '温柔的', '活泼的', '机智的', '帅气的', '美丽的', '善良的'];
    const animals = ['小猫', '小狗', '小兔', '小熊', '小鸟', '小鱼', '小猴', '小虎', '小龙', '小猪'];
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const animal = animals[Math.floor(Math.random() * animals.length)];
    const num = Math.floor(Math.random() * 1000);
    return `${adj}${animal}${num}`;
  },

  generateUserNumber(usersDb) {
    const users = Object.values(usersDb || {});
    const existingNumbers = users
      .map(user => user.userNumber)
      .filter(number => number && number.startsWith('C'))
      .map(number => parseInt(number.substring(1), 10))
      .filter(num => !isNaN(num));
    
    const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
    return 'C' + String(nextNumber).padStart(5, '0');
  },

  generateUniqueId() {
    return 'UID_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9).toUpperCase();
  },

  async login(userAvatar, userNickName) {
    return new Promise((resolve, reject) => {
      wx.showLoading({ title: '登录中...', mask: true });
      
      wx.login({
        success: async (res) => {
          if (res.code) {
            try {
              const app = getApp();
              
              // 调用后端登录接口
              wx.request({
                url: `${app.globalData.baseUrl}/api/auth/login`,
                method: 'POST',
                data: {
                  code: res.code,
                  userInfo: {
                    avatarUrl: userAvatar,
                    nickName: userNickName
                  }
                },
                success: (loginRes) => {
                  if (loginRes.statusCode === 200 && loginRes.data.success) {
                    const { token, user } = loginRes.data;
                    
                    this.setToken(token);
                    this.setUserInfo(user);
                    
                    // 确保保存 userId 到 storage，以便 app.js 的 request 使用
                    // 虽然 request 应该改为使用 auth.getUserId()，但为了兼容性先存一下
                    wx.setStorageSync('userId', user._id);
                    
                    app.globalData.userInfo = user;
                    app.globalData.token = token;
                    app.globalData.isLoggedIn = true;
                    
                    wx.hideLoading();
                    resolve(loginRes.data);
                  } else {
                    wx.hideLoading();
                    reject(new Error(loginRes.data.message || '登录失败'));
                  }
                },
                fail: (err) => {
                  wx.hideLoading();
                  reject(err);
                }
              });
              
            } catch (err) {
              wx.hideLoading();
              reject(err);
            }
          } else {
            wx.hideLoading();
            reject(new Error('获取登录凭证失败'));
          }
        },
        fail: (err) => {
          wx.hideLoading();
          reject(err);
        }
      });
    });
  },

  requireLogin(callback) {
    if (this.isLoggedIn()) {
      callback && callback();
    } else {
      wx.showModal({
        title: '提示',
        content: '该功能需要登录后使用，是否立即登录？',
        confirmText: '去登录',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/login/login' });
          }
        }
      });
    }
  }
};

module.exports = auth;
