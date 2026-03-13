class VideoPlayerManager {
  constructor(pageContext) {
    this.pageContext = pageContext;
    this.videoContexts = new Map();
  }

  createContext(index) {
    const id = `video-${index}`;
    const ctx = wx.createVideoContext(id, this.pageContext);
    this.videoContexts.set(index, ctx);
    return ctx;
  }

  getContext(index) {
    if (!this.videoContexts.has(index)) {
      return this.createContext(index);
    }
    return this.videoContexts.get(index);
  }

  play(index) {
    const safeIdx = Number(index);
    if (!Number.isInteger(safeIdx) || safeIdx < 0) {
      return false;
    }

    return new Promise((resolve, reject) => {
      wx.nextTick(() => {
        const ctx = this.getContext(safeIdx);
        if (!ctx || typeof ctx.play !== 'function') {
          wx.showToast({
            title: '视频正在加载',
            icon: 'none'
          });
          reject(new Error('Video context not available'));
          return;
        }

        try {
          ctx.play();
          resolve(true);
        } catch (error) {
          console.error('Play video error:', error);
          reject(error);
        }
      });
    });
  }

  pause(index) {
    const safeIdx = Number(index);
    if (!Number.isInteger(safeIdx) || safeIdx < 0) {
      return;
    }
    
    let ctx = this.videoContexts.get(safeIdx);
    if (!ctx) {
      ctx = this.createContext(safeIdx);
    }
    
    if (ctx && typeof ctx.pause === 'function') {
      try {
        ctx.pause();
      } catch (error) {
        console.error('Pause video error:', error);
      }
    }
  }

  pauseAll(currentIndex) {
    if (currentIndex !== undefined && currentIndex !== null) {
      this.pause(currentIndex);
    }
  }

  clear() {
    this.videoContexts.clear();
  }

  destroy() {
    this.clear();
    this.pageContext = null;
  }
}

function createPlayerManager(pageContext) {
  return new VideoPlayerManager(pageContext);
}

module.exports = {
  VideoPlayerManager,
  createPlayerManager
};
