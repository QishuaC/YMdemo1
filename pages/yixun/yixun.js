const app = getApp();

Page({
  data: {
    statusBarHeight: 20, // Default, updated in onLoad
    currentTab: 'recommend', // recommend, hot, new, liked
    videoList: [],
    currentVideoIndex: 0,
    currentVideoId: '',
    currentVideoCommentCount: 0,
    showCommentPopup: false,
    isPlaying: true,
    page: 1,
    limit: 10,
    hasMore: true,
    loading: false,
    isMember: false
  },

  onLoad(options) {
    const sysInfo = wx.getSystemInfoSync();
    this.setData({
      statusBarHeight: sysInfo.statusBarHeight || 20
    });

    this.fetchVideos();
    
    // If opened with id param (e.g. from share)
    if (options && options.id) {
       // Ideally we should fetch that specific video and put it first
       // For now, just load the list.
    }
  },

  onShow() {
    const tabBar = typeof this.getTabBar === 'function' ? this.getTabBar() : null;
    if (tabBar) {
      tabBar.setData({ selected: 1 });
    }
    this.setData({
      isMember: app.globalData.isMember || false
    });
    // If we have videos and were playing, resume
    if (this.data.videoList.length > 0 && this.data.currentVideoIndex >= 0) {
      const videoContext = wx.createVideoContext(`video-${this.data.currentVideoIndex}`);
      // videoContext.play(); // Auto resume might be annoying if coming back from background
      // keeping isPlaying state as is
    }
  },

  onHide() {
    // Pause current video
    if (this.data.videoList.length > 0 && this.data.currentVideoIndex >= 0) {
      const videoContext = wx.createVideoContext(`video-${this.data.currentVideoIndex}`);
      videoContext.pause();
    }
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === this.data.currentTab) return;
    
    // Reset state
    this.setData({
      currentTab: tab,
      videoList: [],
      page: 1,
      hasMore: true,
      currentVideoIndex: 0,
      loading: false
    }, () => {
      this.fetchVideos();
    });
  },

  async fetchVideos() {
    if (this.data.loading || !this.data.hasMore) return;
    
    this.setData({ loading: true });

    try {
      let limit = this.data.limit;
      if (this.data.currentTab === 'hot' || this.data.currentTab === 'liked') limit = 20; 

      const res = await app.request({
        url: '/api/videos',
        data: {
          page: this.data.page,
          limit: limit
        }
      });

      if (res.success) {
        const normalize = (url) => {
          if (!url) return '';
          if (url.startsWith('http') || url.startsWith('//')) return url;
          return `${app.globalData.baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
        };

        let newVideos = res.videos.map(v => ({
          ...v,
          videoUrl: normalize(v.videoUrl),
          cover: normalize(v.cover),
          avatar: normalize(v.avatar)
        }));
        
        // --- Client-side Logic for Tabs ---
        // Note: In a real app, these should be backend parameters
        
        if (this.data.currentTab === 'hot') {
          // Sort by likes descending
          newVideos.sort((a, b) => b.likes - a.likes);
        } else if (this.data.currentTab === 'liked') {
           const userId = wx.getStorageSync('userId') || 'wx_user_001';
           // Filter videos liked by current user
           newVideos = newVideos.filter(v => v.likedBy && v.likedBy.includes(userId));
           
           // If page 1 is empty, try fetching more pages? 
           // For simplicity in this demo without backend support:
           // If empty, we stop (hasMore = false)
           if (newVideos.length === 0 && this.data.page === 1) {
             this.setData({ hasMore: false });
           }
        } else if (this.data.currentTab === 'new') {
           // Default is by createdAt desc
        } else if (this.data.currentTab === 'recommend') {
           // Shuffle for "recommend" effect
           if (this.data.page === 1) {
             newVideos.sort(() => Math.random() - 0.5);
           }
        }

        // Add isLiked property
        const userId = wx.getStorageSync('userId') || 'wx_user_001';
        newVideos = newVideos.map(v => ({
          ...v,
          isLiked: v.likedBy ? v.likedBy.includes(userId) : false
        }));

        const combinedList = [...this.data.videoList, ...newVideos];
        
        this.setData({
          videoList: combinedList,
          page: this.data.page + 1,
          hasMore: res.videos.length >= limit, // Check original length for pagination
          loading: false
        });
        
        // Init first video ID if just loaded
        if (this.data.videoList.length > 0 && !this.data.currentVideoId) {
           this.setData({ 
             currentVideoId: this.data.videoList[0]._id,
             currentVideoCommentCount: this.data.videoList[0].comments
           });
        }

      } else {
        this.setData({ loading: false });
      }
    } catch (err) {
      console.error(err);
      this.setData({ loading: false });
    }
  },

  onSwiperChange(e) {
    const current = e.detail.current;
    const previousIndex = this.data.currentVideoIndex;
    
    // Pause previous
    if (previousIndex !== current && previousIndex >= 0 && previousIndex < this.data.videoList.length) {
       const prevCtx = wx.createVideoContext(`video-${previousIndex}`);
       prevCtx.pause();
    }

    // Play current
    const video = this.data.videoList[current];
    this.setData({ 
      currentVideoIndex: current,
      currentVideoId: video._id,
      currentVideoCommentCount: video.comments,
      isPlaying: true 
    });
    
    const currCtx = wx.createVideoContext(`video-${current}`);
    currCtx.play();
    
    // Load more if approaching end
    if (current >= this.data.videoList.length - 3) {
      this.fetchVideos();
    }
  },

  togglePlay() {
    const videoContext = wx.createVideoContext(`video-${this.data.currentVideoIndex}`);
    if (this.data.isPlaying) {
      videoContext.pause();
      this.setData({ isPlaying: false });
    } else {
      videoContext.play();
      this.setData({ isPlaying: true });
    }
  },
  
  onVideoError(e) {
    console.error('Video Error:', e);
    console.error('Video detail:', e.detail);
    wx.showToast({
      title: '视频加载失败',
      icon: 'none',
      duration: 2000
    });
  },

  onVideoWaiting(e) {
    console.log('Video waiting:', e);
  },

  onVideoPlay(e) {
    console.log('Video played:', e);
  },

  onVideoPause(e) {
    console.log('Video paused:', e);
  },

  onVideoMetadataLoaded(e) {
    const index = e.currentTarget.dataset.index;
    const { width, height } = e.detail;
    
    console.log(`Video metadata loaded for index ${index}:`, { width, height });
    
    if (!width || !height) return;
    
    const videoFit = 'cover';
    
    const videoList = this.data.videoList;
    if (videoList[index]) {
      const videoFitKey = `videoList[${index}].videoFit`;
      this.setData({
        [videoFitKey]: videoFit
      });
      console.log(`Set video ${index} to ${videoFit} (width: ${width}, height: ${height})`);
    }
  },

  async toggleLike(e) {
    // Prevent bubbling
    const index = e.currentTarget.dataset.index;
    if (typeof index === 'undefined') return;

    const video = this.data.videoList[index];
    if (!video) return;

    // Optimistic update
    const isLiked = !video.isLiked;
    const likes = isLiked ? video.likes + 1 : video.likes - 1;
    
    const upIsLiked = `videoList[${index}].isLiked`;
    const upLikes = `videoList[${index}].likes`;
    
    this.setData({
      [upIsLiked]: isLiked,
      [upLikes]: likes
    });

    try {
      const res = await app.request({
        url: `/api/videos/${video._id}/like`,
        method: 'POST'
      });
      
      if (!res.success) {
        throw new Error('Failed');
      }
    } catch (err) {
      // Revert if failed
      console.error('Like failed', err);
      this.setData({
        [upIsLiked]: !isLiked,
        [upLikes]: video.likes
      });
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      });
    }
  },

  showComments(e) {
    const index = e.currentTarget.dataset.index;
    const video = this.data.videoList[index];
    if (video) {
      this.setData({
        currentVideoId: video._id,
        currentVideoCommentCount: video.comments,
        showCommentPopup: true
      });
    }
  },

  closeCommentPopup() {
    this.setData({ showCommentPopup: false });
  },

  onCommentAdded(e) {
    const count = e.detail.count;
    // Update count in list
    const index = this.data.videoList.findIndex(v => v._id === this.data.currentVideoId);
    if (index !== -1) {
      this.setData({
        [`videoList[${index}].comments`]: count,
        currentVideoCommentCount: count
      });
    }
  },

  onCommentCountUpdate(e) {
    const count = e.detail.count;
    const index = this.data.videoList.findIndex(v => v._id === this.data.currentVideoId);
    if (index !== -1) {
      this.setData({
        [`videoList[${index}].comments`]: count,
        currentVideoCommentCount: count
      });
    }
  },

  onShareAppMessage(res) {
    let video;
    if (res.from === 'button') {
      const index = res.target.dataset.index;
      video = this.data.videoList[index];
    } else {
      video = this.data.videoList[this.data.currentVideoIndex];
    }

    if (video) {
      return {
        title: video.title,
        path: `/pages/yixun/yixun?id=${video._id}`,
        imageUrl: video.cover
      };
    }
    
    return {
      title: '义讯视频',
      path: '/pages/yixun/yixun'
    };
  }
});
