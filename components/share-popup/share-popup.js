Component({
  properties: {
    show: {
      type: Boolean,
      value: false
    },
    videoData: {
      type: Object,
      value: {}
    }
  },

  data: {
    shareOptions: [
      {
        id: 'friend',
        name: '发送给朋友',
        icon: '💬',
        type: 'appMessage'
      },
      {
        id: 'timeline',
        name: '分享到朋友圈',
        icon: '⭕',
        type: 'timeline'
      },
      {
        id: 'copy',
        name: '复制链接',
        icon: '📋',
        type: 'copy'
      },
      {
        id: 'poster',
        name: '生成海报',
        icon: '🖼️',
        type: 'poster'
      }
    ]
  },

  methods: {
    onClose() {
      this.triggerEvent('close');
    },

    onShareOptionTap(e) {
      const { type } = e.currentTarget.dataset;
      const video = this.properties.videoData;
      
      switch (type) {
        case 'appMessage':
          this.shareToFriend(video);
          break;
        case 'timeline':
          this.shareToTimeline(video);
          break;
        case 'copy':
          this.copyLink(video);
          break;
        case 'poster':
          this.generatePoster(video);
          break;
      }
    },

    shareToFriend(video) {
      wx.showShareMenu({
        withShareTicket: true,
        menus: ['shareAppMessage'],
        success: () => {
          wx.showToast({
            title: '请点击右上角分享给朋友',
            icon: 'none',
            duration: 2000
          });
        }
      });
    },

    shareToTimeline(video) {
      wx.showShareMenu({
        withShareTicket: true,
        menus: ['shareTimeline'],
        success: () => {
          wx.showToast({
            title: '请点击右上角分享到朋友圈',
            icon: 'none',
            duration: 2000
          });
        }
      });
    },

    copyLink(video) {
      const link = `https://yimen.example.com/video/${video.id}`;
      wx.setClipboardData({
        data: link,
        success: () => {
          wx.showToast({
            title: '链接已复制',
            icon: 'success'
          });
          this.onClose();
        },
        fail: () => {
          wx.showToast({
            title: '复制失败',
            icon: 'none'
          });
        }
      });
    },

    generatePoster(video) {
      wx.showToast({
        title: '海报生成中...',
        icon: 'loading',
        duration: 2000
      });
      
      setTimeout(() => {
        wx.showToast({
          title: '海报功能开发中',
          icon: 'none'
        });
      }, 2000);
    },

    stopPropagation() {
    }
  }
});
