const { createPlayerManager } = require('../../utils/video/video-player-manager.js');
const { createVideoDataService } = require('../../utils/video/video-data-service.js');
const { createVideoStateManager } = require('../../utils/video/video-state-manager.js');
const { showShareToast, buildShareConfig, showShareMenu } = require('../../utils/share.js');

const app = getApp();

Page({
  data: {
    activeTab: 'recommend',
    currentIdx: 0,
    allVideos: [],
    videos: [],
    showCommentPopup: false,
    currentVideoId: '',
    currentCommentCount: 0
  },

  onLoad() {
    this.playerManager = createPlayerManager(this);
    this.dataService = createVideoDataService(app);
    this.stateManager = createVideoStateManager();
    
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });
    
    this.init();
  },

  async onShow() {
    const tabBar = typeof this.getTabBar === 'function' ? this.getTabBar() : null;
    if (tabBar) {
      tabBar.setData({ selected: 1 });
    }
    try {
      const videos = await this.dataService.fetchVideos();
      if (videos && videos.length > 0) {
        const state = this.stateManager.getState();
        const currentTab = state.activeTab;
        
        this.stateManager.setAllVideos(videos);
        await this.loadVideosByTab(currentTab);
      }
    } catch (error) {
      console.error('刷新数据失败:', error);
    }
  },

  onUnload() {
    if (this.playerManager) {
      this.playerManager.destroy();
    }
    if (this.stateManager) {
      this.stateManager.reset();
    }
  },

  async init() {
    try {
      const videos = await this.dataService.fetchVideos();
      
      if (videos && videos.length > 0) {
        this.stateManager.setAllVideos(videos);
        await this.loadVideosByTab('recommend');
      } else {
        this.useMockData();
      }
    } catch (error) {
      console.error('加载视频失败，使用mock数据:', error);
      this.useMockData();
    }
  },

  useMockData() {
    const mockData = this.dataService.getMockData();
    this.stateManager.setAllVideos(mockData);
    this.loadVideosByTab('hot');
  },

  async loadVideosByTab(type) {
    const state = this.stateManager.getState();
    let sortedVideos = this.dataService.sortVideos(state.allVideos, type);
    
    if (type === 'liked' && sortedVideos.length === 0) {
      wx.showToast({
        title: '还没有喜欢的视频，切换到推荐',
        icon: 'none'
      });
      type = 'recommend';
      sortedVideos = this.dataService.sortVideos(state.allVideos, type);
    }

    const videosWithState = sortedVideos.map(v => {
      const original = state.allVideos.find(av => av.id === v.id);
      return {
        ...v,
        liked: original ? original.liked : false,
        likes: original ? original.likes : v.likes,
        playing: false
      };
    });

    this.stateManager.setActiveTab(type);
    this.stateManager.setVideos(videosWithState);
    
    this.setData({
      videos: [],
      activeTab: type,
      currentIdx: 0
    }, () => {
      this.setData({
        videos: videosWithState
      });
      this.playerManager.clear();
      if (videosWithState.length > 0) {
        this.playVideo(0);
      }
    });
  },

  playVideo(idx) {
    const safeIdx = Number(idx);
    if (!Number.isInteger(safeIdx) || safeIdx < 0) {
      return;
    }

    const video = this.stateManager.getVideoByIndex(safeIdx);
    if (!video) {
      return;
    }

    this.playerManager.play(safeIdx).then(() => {
      const updatedVideos = this.stateManager.updateVideoPlaying(safeIdx);
      this.setData({
        videos: updatedVideos
      });
    }).catch(err => {
      console.error('播放失败:', err);
    });
  },

  pauseVideo(idx) {
    this.playerManager.pause(idx);
    const updatedVideos = this.stateManager.pauseAllVideos();
    this.setData({
      videos: updatedVideos
    });
  },

  pauseAllVideos() {
    const state = this.stateManager.getState();
    this.playerManager.pauseAll(state.videos.length);
  },

  doSwitchTab(e) {
    const type = e.currentTarget.dataset.type;
    this.pauseAllVideos();
    this.loadVideosByTab(type);
  },

  onSwiperChange(e) {
    const idx = e.detail.current;
    const prevIdx = this.stateManager.getState().currentIdx;
    
    this.pauseVideo(prevIdx);
    this.stateManager.setCurrentIndex(idx);
    this.setData({
      currentIdx: idx
    });
    this.playVideo(idx);
  },

  doPlay(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    const video = this.stateManager.getVideoByIndex(idx);
    
    if (!video) {
      return;
    }

    if (video.playing) {
      this.pauseVideo(idx);
    } else {
      this.playVideo(idx);
    }
  },

  onVideoError(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    const errMsg = (e.detail && (e.detail.errMsg || e.detail.errmsg)) || '视频播放失败';
    
    console.error('视频播放错误:', idx, e);
    wx.showToast({
      title: errMsg,
      icon: 'none',
      duration: 2000
    });

    if (Number.isInteger(idx) && idx >= 0) {
      this.pauseVideo(idx);
    }
  },

  async doLike(e) {
    const idx = e.currentTarget.dataset.idx;
    const video = this.stateManager.getVideoByIndex(idx);
    
    if (!video) {
      return;
    }

    const videoId = video.id;
    const previousLiked = video.liked;
    const previousLikes = video.likes;
    
    const newLiked = !previousLiked;
    const newLikes = newLiked ? previousLikes + 1 : previousLikes - 1;
    
    this.stateManager.toggleVideoLike(videoId, newLiked, newLikes);
    const state = this.stateManager.getState();
    
    this.setData({
      videos: state.videos,
      allVideos: state.allVideos
    });

    if (video.isMock) {
      wx.showToast({
        title: newLiked ? '点赞成功' : '取消点赞',
        icon: 'none'
      });
      return;
    }

    try {
      const res = await this.dataService.toggleLike(videoId, false);
      
      if (res.success && res.data) {
        const { liked, likes } = res.data;
        this.stateManager.toggleVideoLike(videoId, liked, likes);
        const updatedState = this.stateManager.getState();
        
        this.setData({
          videos: updatedState.videos,
          allVideos: updatedState.allVideos
        });

        if (this.stateManager.getState().activeTab === 'liked') {
          setTimeout(() => {
            this.loadVideosByTab('liked');
          }, 300);
        }
      } else {
        this.rollbackLike(videoId, previousLiked, previousLikes);
        wx.showToast({
          title: res.message || '点赞失败，请稍后重试',
          icon: 'none',
          duration: 2000
        });
      }
    } catch (error) {
      console.error('点赞请求出错:', error);
      this.rollbackLike(videoId, previousLiked, previousLikes);
      wx.showToast({
        title: '操作出错，请稍后重试',
        icon: 'none',
        duration: 2000
      });
    }
  },

  rollbackLike(videoId, liked, likes) {
    this.stateManager.toggleVideoLike(videoId, liked, likes);
    const state = this.stateManager.getState();
    
    this.setData({
      videos: state.videos,
      allVideos: state.allVideos
    });
  },

  doComment(e) {
    const idx = e.currentTarget.dataset.idx;
    const video = this.stateManager.getVideoByIndex(idx);
    
    if (!video) {
      return;
    }

    this.stateManager.openCommentPopup(video.id, video.comments || 0);
    const state = this.stateManager.getState();
    
    this.setData({
      showCommentPopup: state.showCommentPopup,
      currentVideoId: state.currentVideoId,
      currentCommentCount: state.currentCommentCount
    });
  },

  onCommentClose() {
    this.stateManager.closeCommentPopup();
    const state = this.stateManager.getState();
    
    this.setData({
      showCommentPopup: state.showCommentPopup,
      currentVideoId: state.currentVideoId,
      currentCommentCount: state.currentCommentCount
    });
  },

  onCommentAdded(e) {
    const { count } = e.detail;
    this.updateCommentCount(count);
  },

  onCommentCountUpdate(e) {
    const { count } = e.detail;
    this.updateCommentCount(count);
  },

  updateCommentCount(count) {
    const videoId = this.stateManager.getState().currentVideoId;
    this.stateManager.updateCommentCount(videoId, count);
    const state = this.stateManager.getState();
    
    this.setData({
      videos: state.videos,
      allVideos: state.allVideos,
      currentCommentCount: state.currentCommentCount
    });
  },

  doShare(e) {
    if (e && e.currentTarget && e.currentTarget.dataset) {
      const idx = e.currentTarget.dataset.idx;
      if (idx !== undefined) {
        this.stateManager.setCurrentIndex(Number(idx));
      }
    }
    
    const video = this.stateManager.getCurrentVideo();
    if (!video) {
      return;
    }
    showShareMenu();
  },

  onShareAppMessage() {
    const video = this.stateManager.getCurrentVideo();
    return buildShareConfig({
      title: video ? video.title : '精彩视频推荐',
      path: '/pages/video/video?id=' + (video ? video.id : ''),
      imageUrl: video ? video.cover : ''
    });
  },

  onShareTimeline() {
    const video = this.stateManager.getCurrentVideo();
    return buildShareConfig({
      title: video ? video.title : '精彩视频推荐',
      query: 'id=' + (video ? video.id : ''),
      imageUrl: video ? video.cover : ''
    });
  }
});
