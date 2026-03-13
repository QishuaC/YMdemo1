const { mockVideos, mockComments } = require('../../data/mock.js');

class VideoDataService {
  constructor(app) {
    this.app = app;
    this.baseUrl = (app.globalData && app.globalData.baseUrl) || 'http://localhost:3000';
  }

  async fetchVideos() {
    try {
      const res = await this.app.request({
        url: '/api/videos',
        method: 'GET'
      });

      if (res.success && res.videos && res.videos.length > 0) {
        return this.transformApiData(res.videos);
      }
      return null;
    } catch (error) {
      console.error('Fetch videos error:', error);
      return null;
    }
  }

  transformApiData(videos) {
    const userId = wx.getStorageSync('userId');
    return videos.map(v => {
      const liked = Array.isArray(v.likedBy) && v.likedBy.some(id => String(id) === String(userId));
      return {
        id: v._id,
        title: v.title,
        cover: this.normalizeAssetUrl(v.cover),
        videoUrl: this.normalizeAssetUrl(v.videoUrl),
        publisherId: v.publisherId,
        author: v.author || '作者',
        avatar: this.normalizeAssetUrl(v.avatar),
        likes: v.likes || 0,
        comments: v.comments || 0,
        liked: liked,
        playing: false,
        createTime: this.toTimestamp(v.createdAt)
      };
    });
  }

  normalizeAssetUrl(url) {
    if (!url) {
      if (this.app.globalData && this.app.globalData.uiConfig && this.app.globalData.uiConfig.defaultAvatar) {
        return this.app.globalData.uiConfig.defaultAvatar;
      }
      return '';
    }
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    if (url.startsWith('/')) {
      return `${this.baseUrl}${url}`;
    }
    return `${this.baseUrl}/${url}`;
  }

  toTimestamp(value) {
    if (!value) {
      return 0;
    }
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? 0 : time;
  }

  getMockData() {
    return mockVideos.map((v, i) => {
      const actualCommentCount = mockComments.filter(
        c => String(c.videoId) === String(v.id)
      ).length;
      return {
        ...v,
        comments: actualCommentCount,
        liked: false,
        playing: false,
        author: v.author || '作者',
        publisherId: v.publisherId,
        createTime: Date.now() - i * 3600000,
        isMock: true
      };
    });
  }

  async toggleLike(videoId, isMock = false) {
    if (isMock) {
      return { success: true, isMock: true };
    }

    try {
      const res = await this.app.request({
        url: `/api/videos/${videoId}/like`,
        method: 'POST'
      });
      return res;
    } catch (error) {
      console.error('Toggle like error:', error);
      return { success: false, error };
    }
  }

  sortVideos(videos, type) {
    let result = [...videos];

    switch (type) {
      case 'recommend':
        for (let i = result.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [result[i], result[j]] = [result[j], result[i]];
        }
        break;
      case 'hot':
        result.sort((a, b) => b.likes - a.likes);
        break;
      case 'new':
        result.sort((a, b) => b.createTime - a.createTime);
        break;
      case 'liked':
        result = result.filter(v => v.liked);
        break;
    }

    return result;
  }
}

function createVideoDataService(app) {
  return new VideoDataService(app);
}

module.exports = {
  VideoDataService,
  createVideoDataService
};
