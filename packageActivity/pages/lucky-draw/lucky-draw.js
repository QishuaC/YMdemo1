const app = getApp();

Page({
  data: {
    luckyDrawChances: 0,
    isDrawing: false,
    showResult: false,
    currentPrize: null,
    drawHistory: [],
    prizes: [
      { name: '100积分', icon: '💰', type: 'points', value: 100 },
      { name: '200积分', icon: '💎', type: 'points', value: 200 },
      { name: '10元优惠券', icon: '🎫', type: 'coupon', value: 10 },
      { name: '专属礼品', icon: '🎁', type: 'gift', value: 0 },
      { name: '谢谢参与', icon: '😊', type: 'thankyou', value: 0 }
    ]
  },

  onLoad() {
    this.loadData();
  },

  onShow() {
    this.loadData();
  },

  loadData() {
    this.setData({
      luckyDrawChances: app.globalData.luckyDrawChances || 0
    });
    this.loadDrawHistory();
  },

  loadDrawHistory() {
    const history = wx.getStorageSync('drawHistory') || [];
    this.setData({
      drawHistory: history.slice(0, 10)
    });
  },

  doDraw() {
    if (this.data.isDrawing) return;
    
    if (this.data.luckyDrawChances <= 0) {
      wx.showToast({
        title: '抽奖机会不足',
        icon: 'none'
      });
      return;
    }

    this.setData({
      isDrawing: true
    });

    const random = Math.random();
    let selectedPrize;
    
    if (random < 0.3) {
      selectedPrize = this.data.prizes[0];
    } else if (random < 0.5) {
      selectedPrize = this.data.prizes[1];
    } else if (random < 0.7) {
      selectedPrize = this.data.prizes[2];
    } else if (random < 0.8) {
      selectedPrize = this.data.prizes[3];
    } else {
      selectedPrize = this.data.prizes[4];
    }

    setTimeout(() => {
      app.globalData.luckyDrawChances -= 1;
      
      if (selectedPrize.type === 'points') {
        app.globalData.points = (app.globalData.points || 0) + selectedPrize.value;
      }
      
      app.saveMemberData();
      
      const history = wx.getStorageSync('drawHistory') || [];
      history.unshift({
        prize: selectedPrize.name,
        icon: selectedPrize.icon,
        time: new Date().toLocaleString('zh-CN')
      });
      wx.setStorageSync('drawHistory', history.slice(0, 20));

      this.setData({
        isDrawing: false,
        showResult: true,
        currentPrize: selectedPrize,
        luckyDrawChances: app.globalData.luckyDrawChances,
        drawHistory: history.slice(0, 10)
      });
    }, 2000);
  },

  closeResult() {
    this.setData({
      showResult: false,
      currentPrize: null
    });
  },

  goBack() {
    wx.navigateBack();
  }
})
