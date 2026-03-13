const app = getApp();

Page({
  data: {
    currentPoints: 0,
    historyList: [],
    page: 1,
    limit: 20,
    loading: false,
    hasMore: true
  },

  onLoad() {
    this.loadPointsHistory();
  },

  onPullDownRefresh() {
    this.setData({ page: 1, historyList: [], hasMore: true });
    this.loadPointsHistory().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadPointsHistory();
    }
  },

  loadPointsHistory() {
    if (this.data.loading) return Promise.resolve();
    if (!this.data.hasMore) return Promise.resolve();

    this.setData({ loading: true });

    return app.request({
      url: '/api/points/history',
      method: 'GET',
      data: {
        page: this.data.page,
        limit: this.data.limit
      }
    }).then((res) => {
      if (res.success) {
        app.globalData.points = Number(res.data.currentPoints || 0);
        app.saveMemberData();
        const newList = this.data.page === 1 
          ? res.data.list 
          : [...this.data.historyList, ...res.data.list];
        
        this.setData({
          currentPoints: res.data.currentPoints,
          historyList: newList,
          hasMore: newList.length < res.data.total,
          page: this.data.page + 1
        });
      }
    }).catch(() => {
      wx.showToast({ title: '加载失败', icon: 'none' });
    }).finally(() => {
      this.setData({ loading: false });
    });
  },

  formatTime(isoString) {
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  }
});
