function showShareToast() {
  wx.showToast({
    title: '请点击右上角分享',
    icon: 'none',
    duration: 2000
  });
}

function copyLink(url) {
  wx.setClipboardData({
    data: url,
    success: () => {
      wx.showToast({
        title: '链接已复制',
        icon: 'success'
      });
    },
    fail: () => {
      wx.showToast({
        title: '复制链接失败',
        icon: 'none'
      });
    }
  });
}

function buildShareConfig(options = {}) {
  const { title, path, imageUrl, query } = options;
  
  const config = {
    title: title || '精彩内容分享',
    imageUrl: imageUrl || ''
  };
  
  if (path) {
    config.path = path;
  }
  
  if (query) {
    config.query = query;
  }
  
  return config;
}

function showShareMenu() {
  wx.showShareMenu({
    withShareTicket: true,
    menus: ['shareAppMessage', 'shareTimeline'],
    success: () => {
      wx.showToast({
        title: '请点击右上角分享',
        icon: 'none',
        duration: 2000
      });
    },
    fail: (err) => {
      console.error('显示分享菜单失败:', err);
      wx.showToast({
        title: '分享功能不可用',
        icon: 'none',
        duration: 2000
      });
    }
  });
}

function showShareMenuForFriend() {
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
}

function showShareMenuForTimeline() {
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
}

function buildVideoShareLink(videoId) {
  return `https://yimen.example.com/video/${videoId}`;
}

function saveImageToAlbum(imageUrl) {
  wx.downloadFile({
    url: imageUrl,
    success: (res) => {
      wx.saveImageToPhotosAlbum({
        filePath: res.tempFilePath,
        success: () => {
          wx.showToast({
            title: '保存成功',
            icon: 'success'
          });
        },
        fail: () => {
          wx.showToast({
            title: '保存失败',
            icon: 'none'
          });
        }
      });
    },
    fail: () => {
      wx.showToast({
        title: '下载失败',
        icon: 'none'
      });
    }
  });
}

module.exports = {
  showShareToast,
  copyLink,
  buildShareConfig,
  showShareMenu,
  showShareMenuForFriend,
  showShareMenuForTimeline,
  buildVideoShareLink,
  saveImageToAlbum
};
