Component({
  data: {
    selected: 0,
    list: [
      {
        pagePath: '/pages/index/index',
        text: '义闻',
        icon: '🏠'
      },
      {
        pagePath: '/pages/video/video',
        text: '视频',
        icon: '🎬'
      },
      {
        pagePath: '/pages/shop/shop',
        text: '义商',
        icon: '🛒'
      },
      {
        pagePath: '/pages/member/member',
        text: '我的',
        icon: '👤'
      }
    ]
  },

  methods: {
    switchTab(e) {
      const data = e.currentTarget.dataset;
      const url = data.path;
      wx.switchTab({
        url: url
      });
      this.setData({
        selected: data.index
      });
    }
  }
});
