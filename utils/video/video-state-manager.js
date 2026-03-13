class VideoStateManager {
  constructor() {
    this.state = {
      activeTab: 'recommend',
      currentIdx: 0,
      allVideos: [],
      videos: [],
      showCommentPopup: false,
      currentVideoId: '',
      currentCommentCount: 0
    };
  }

  getState() {
    return { ...this.state };
  }

  setState(updates) {
    this.state = { ...this.state, ...updates };
    return this.state;
  }

  setActiveTab(tab) {
    this.state.activeTab = tab;
    this.state.currentIdx = 0;
    return this.state;
  }

  setCurrentIndex(index) {
    this.state.currentIdx = index;
    return this.state;
  }

  setVideos(videos) {
    this.state.videos = videos;
    return this.state;
  }

  setAllVideos(videos) {
    this.state.allVideos = videos;
    return this.state;
  }

  updateVideoPlaying(index) {
    this.state.videos = this.state.videos.map((v, i) => ({
      ...v,
      playing: i === index
    }));
    return this.state.videos;
  }

  pauseAllVideos() {
    this.state.videos = this.state.videos.map(v => ({
      ...v,
      playing: false
    }));
    return this.state.videos;
  }

  toggleVideoLike(videoId, liked, likes) {
    this.state.videos = this.state.videos.map(v => {
      if (v.id === videoId) {
        return { ...v, liked, likes };
      }
      return v;
    });

    this.state.allVideos = this.state.allVideos.map(v => {
      if (v.id === videoId) {
        return { ...v, liked, likes };
      }
      return v;
    });

    return {
      videos: this.state.videos,
      allVideos: this.state.allVideos
    };
  }

  updateCommentCount(videoId, count) {
    this.state.videos = this.state.videos.map(v => {
      if (String(v.id) === String(videoId)) {
        return { ...v, comments: count };
      }
      return v;
    });

    this.state.allVideos = this.state.allVideos.map(v => {
      if (String(v.id) === String(videoId)) {
        return { ...v, comments: count };
      }
      return v;
    });

    this.state.currentCommentCount = count;
    return this.state;
  }

  openCommentPopup(videoId, commentCount) {
    this.state.showCommentPopup = true;
    this.state.currentVideoId = String(videoId);
    this.state.currentCommentCount = commentCount;
    return this.state;
  }

  closeCommentPopup() {
    this.state.showCommentPopup = false;
    this.state.currentVideoId = '';
    this.state.currentCommentCount = 0;
    return this.state;
  }

  getCurrentVideo() {
    return this.state.videos[this.state.currentIdx] || null;
  }

  getVideoByIndex(index) {
    return this.state.videos[index] || null;
  }

  reset() {
    this.state = {
      activeTab: 'recommend',
      currentIdx: 0,
      allVideos: [],
      videos: [],
      showCommentPopup: false,
      currentVideoId: '',
      currentCommentCount: 0
    };
  }
}

function createVideoStateManager() {
  return new VideoStateManager();
}

module.exports = {
  VideoStateManager,
  createVideoStateManager
};
