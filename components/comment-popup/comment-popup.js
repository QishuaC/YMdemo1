const app = getApp();
const auth = require('../../utils/auth.js');
const { mockComments } = require('../../data/mock.js');

function formatTime(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;
  const year = 365 * day;
  
  if (diff < minute) {
    return '刚刚';
  } else if (diff < hour) {
    return Math.floor(diff / minute) + '分钟前';
  } else if (diff < day) {
    return Math.floor(diff / hour) + '小时前';
  } else if (diff < week) {
    return Math.floor(diff / day) + '天前';
  } else if (diff < month) {
    return Math.floor(diff / week) + '周前';
  } else if (diff < year) {
    return Math.floor(diff / month) + '个月前';
  } else {
    return Math.floor(diff / year) + '年前';
  }
}

Component({
  properties: {
    show: {
      type: Boolean,
      value: false
    },
    videoId: {
      type: String,
      value: ''
    },
    withTabBar: {
      type: Boolean,
      value: false
    },
    commentCount: {
      type: Number,
      value: 0
    },
    isMember: {
      type: Boolean,
      value: false
    }
  },

  data: {
    showCommentPopup: false,
    comments: [],
    commentText: '',
    canSubmit: false,
    replyTo: '',
    replyToId: '',
    inputFocus: false,
    loading: false,
    loadingMore: false,
    noMore: false,
    page: 1,
    limit: 20,
    useMock: false,
    currentUserId: ''
  },

  observers: {
    'show,videoId': function(show, videoId) {
      this.setData({
        showCommentPopup: show
      });
      if (show && videoId) {
        this.setData({
          comments: [],
          page: 1,
          noMore: false
        });
        this.loadComments(true);
      }
    }
  },

  methods: {
    getCurrentUserId() {
      // 优先使用 auth 工具类获取用户ID，保持逻辑一致
      if (auth && typeof auth.getUserId === 'function') {
        return String(auth.getUserId());
      }
      const storedUserId = wx.getStorageSync('userId');
      if (storedUserId) return String(storedUserId);
      const userInfo = wx.getStorageSync('userInfo') || {};
      return String(userInfo._id || userInfo.openId || 'wx_user_001');
    },

    async loadComments(reset = false) {
      if (this.data.loading) return;

      const page = reset ? 1 : this.data.page;
      const userId = this.getCurrentUserId();
      const isMember = this.data.isMember;

      this.setData({
        loading: true,
        loadingMore: !reset,
        currentUserId: userId
      });

      try {
        const res = await app.request({
          url: `/api/videos/${this.data.videoId}/comments`,
          method: 'GET',
          data: {
            page,
            limit: this.data.limit
          }
        });

        if (res.success) {
          const commentsWithLikeStatus = res.data.map(comment => {
            const liked = comment.likedBy && comment.likedBy.some(id => id.toString() === userId);
            const commentUserId = typeof comment.userId === 'object' ? comment.userId : {
              _id: comment.userId,
              nickname: comment.nickname || '游客',
              avatar: comment.avatar || ''
            };
            const isUserMember = commentUserId.isMember || (isMember && commentUserId._id === userId);
            const canDelete = commentUserId._id === userId;
            
            const replies = comment.replies ? comment.replies.map(reply => {
              const replyLiked = reply.likedBy && reply.likedBy.some(id => id.toString() === userId);
              const replyUserId = typeof reply.userId === 'object' ? reply.userId : {
                _id: reply.userId,
                nickname: reply.nickname || '游客',
                avatar: reply.avatar || ''
              };
              const isReplyUserMember = replyUserId.isMember || (isMember && replyUserId._id === userId);
              const canDeleteReply = replyUserId._id === userId;
              return {
                ...reply,
                userId: replyUserId,
                liked: replyLiked,
                canDelete: canDeleteReply,
                isColorful: isReplyUserMember,
                formattedTime: formatTime(new Date(reply.createdAt).getTime())
              };
            }) : [];
            
            return {
              ...comment,
              userId: commentUserId,
              liked,
              replies,
              canDelete,
              isColorful: isUserMember,
              formattedTime: formatTime(new Date(comment.createdAt).getTime())
            };
          });

          this.setData({
            comments: reset ? commentsWithLikeStatus : [...this.data.comments, ...commentsWithLikeStatus],
            page: page + 1,
            noMore: commentsWithLikeStatus.length < this.data.limit,
            loading: false,
            loadingMore: false,
            useMock: false
          });
          
          // 同步更新评论数
          if (reset) {
            this.triggerEvent('commentcountupdate', {
              count: res.totalComments ?? res.total ?? commentsWithLikeStatus.length
            });
          }
        }
      } catch (error) {
        console.error('加载评论失败，使用mock数据:', error);
        
        const videoComments = mockComments.filter(c => String(c.videoId) === String(this.data.videoId));
        const userId = this.getCurrentUserId();
        const isMember = this.data.isMember;
        const commentsWithLikeStatus = videoComments.map(comment => {
          const liked = comment.likedBy && comment.likedBy.some(id => id.toString() === userId);
          const commentUserId = typeof comment.userId === 'object' ? comment.userId : {
            _id: comment.userId,
            nickname: comment.nickname || '游客',
            avatar: comment.avatar || ''
          };
          const isUserMember = commentUserId.isMember || (isMember && commentUserId._id === userId);
          const canDelete = commentUserId._id === userId;
          
          const replies = comment.replies ? comment.replies.map(reply => {
            const replyLiked = reply.likedBy && reply.likedBy.some(id => id.toString() === userId);
            const replyUserId = typeof reply.userId === 'object' ? reply.userId : {
              _id: reply.userId,
              nickname: reply.nickname || '游客',
              avatar: reply.avatar || ''
            };
            const isReplyUserMember = replyUserId.isMember || (isMember && replyUserId._id === userId);
            const canDeleteReply = replyUserId._id === userId;
            return {
              ...reply,
              userId: replyUserId,
              liked: replyLiked,
              canDelete: canDeleteReply,
              isColorful: isReplyUserMember,
              formattedTime: formatTime(reply.createdAt)
            };
          }) : [];
          
          return {
            ...comment,
            userId: commentUserId,
            liked,
            replies,
            canDelete,
            isColorful: isUserMember,
            formattedTime: formatTime(comment.createdAt)
          };
        });

        this.setData({
          comments: commentsWithLikeStatus,
          page: page + 1,
          noMore: true,
          loading: false,
          loadingMore: false,
          useMock: true
        });
        
        // 同步更新评论数（mock模式）
        if (reset) {
          const totalComments = commentsWithLikeStatus.reduce((sum, comment) => {
            const replyCount = Array.isArray(comment.replies) ? comment.replies.length : 0;
            return sum + 1 + replyCount;
          }, 0);
          this.triggerEvent('commentcountupdate', {
            count: totalComments
          });
        }
      }
    },

    loadMoreComments() {
      if (!this.data.noMore && !this.data.loadingMore) {
        this.loadComments();
      }
    },

    async loadMoreReplies(e) {
      const { commentId, index } = e.currentTarget.dataset;
      const comment = this.data.comments[index];

      try {
        const res = await app.request({
          url: `/api/comments/${commentId}/replies`,
          method: 'GET',
          data: {
            page: 1,
            limit: 100
          }
        });

        if (res.success) {
          const userId = this.getCurrentUserId();
          const isMember = this.data.isMember;
          const repliesWithLikeStatus = res.data.map(reply => {
            const liked = reply.likedBy && reply.likedBy.some(id => id.toString() === userId);
            const replyUserId = typeof reply.userId === 'object' ? reply.userId : {
              _id: reply.userId,
              nickname: reply.nickname || '游客',
              avatar: reply.avatar || ''
            };
            const isReplyUserMember = replyUserId.isMember || (isMember && replyUserId._id === userId);
            return {
              ...reply,
              userId: replyUserId,
              liked,
              canDelete: replyUserId._id === userId,
              isColorful: isReplyUserMember,
              formattedTime: formatTime(new Date(reply.createdAt).getTime())
            };
          });

          const updatedComments = [...this.data.comments];
          updatedComments[index] = {
            ...comment,
            replies: repliesWithLikeStatus,
            replyCount: repliesWithLikeStatus.length
          };

          this.setData({
            comments: updatedComments
          });
        }
      } catch (error) {
        console.error('加载回复失败:', error);
        wx.showToast({
          title: '加载回复失败',
          icon: 'none'
        });
      }
    },

    onCommentInput(e) {
      const commentText = e.detail.value;
      const canSubmit = commentText.trim().length > 0;
      this.setData({
        commentText,
        canSubmit
      });
    },

    async submitComment() {
      const content = this.data.commentText.trim();
      if (!content) {
        wx.showToast({
          title: '请输入评论内容',
          icon: 'none'
        });
        return;
      }

      // Mock 模式下直接处理评论
      if (this.data.useMock) {
        const userInfo = wx.getStorageSync('userInfo') || { nickname: '微信用户', avatar: 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0' };
        const newComment = {
          _id: 'mock_' + Date.now(),
          videoId: this.data.videoId,
          userId: {
            _id: this.getCurrentUserId(),
            nickname: userInfo.nickname,
            avatar: userInfo.avatar
          },
          content: content,
          likes: 0,
          liked: false,
          likedBy: [],
          parentId: this.data.replyToId || null,
          createdAt: Date.now(),
          formattedTime: '刚刚',
          replies: [],
          replyCount: 0,
          canDelete: true
        };

        if (this.data.replyToId) {
          const commentIndex = this.data.comments.findIndex(c => c._id === this.data.replyToId);
          if (commentIndex !== -1) {
            const updatedComments = [...this.data.comments];
            updatedComments[commentIndex] = {
              ...updatedComments[commentIndex],
              replies: [newComment, ...updatedComments[commentIndex].replies],
              replyCount: updatedComments[commentIndex].replyCount + 1
            };
            this.setData({
              comments: updatedComments
            });
          }
        } else {
          this.setData({
            comments: [newComment, ...this.data.comments]
          });
        }

        this.setData({
          commentText: '',
          canSubmit: false,
          replyTo: '',
          replyToId: '',
          inputFocus: false
        });

        wx.showToast({
          title: '评论成功',
          icon: 'success'
        });

        this.triggerEvent('commentadded', {
          count: (this.data.commentCount || 0) + 1
        });
        return;
      }

      try {
        const userInfo = wx.getStorageSync('userInfo') || { nickname: '微信用户', avatar: 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0' };
        const res = await app.request({
          url: `/api/videos/${this.data.videoId}/comments`,
          method: 'POST',
          data: {
            content,
            parentId: this.data.replyToId || null,
            nickname: userInfo.nickname,
            avatar: userInfo.avatar
          }
        });

        if (res.success) {
          wx.showToast({
            title: '评论成功',
            icon: 'success'
          });

          const userId = this.getCurrentUserId();
          const newComment = {
            ...res.data,
            liked: false,
            likes: 0,
            replies: [],
            replyCount: 0,
            formattedTime: '刚刚',
            canDelete: res.data?.userId?._id === userId
          };

          if (this.data.replyToId) {
            const commentIndex = this.data.comments.findIndex(c => c._id === this.data.replyToId);
            if (commentIndex !== -1) {
              const updatedComments = [...this.data.comments];
              updatedComments[commentIndex] = {
                ...updatedComments[commentIndex],
                replies: [newComment, ...updatedComments[commentIndex].replies],
                replyCount: updatedComments[commentIndex].replyCount + 1
              };
              this.setData({
                comments: updatedComments
              });
            }
          } else {
            this.setData({
              comments: [newComment, ...this.data.comments]
            });
          }

          this.setData({
            commentText: '',
            canSubmit: false,
            replyTo: '',
            replyToId: '',
            inputFocus: false
          });

          this.triggerEvent('commentadded', {
            count: (this.data.commentCount || 0) + 1
          });
        } else {
          wx.showToast({
            title: res.message || '操作过于频繁，请稍后再试',
            icon: 'none'
          });
        }
      } catch (error) {
        console.error('发表评论失败:', error);
        wx.showToast({
          title: '发表评论失败',
          icon: 'none'
        });
      }
    },

    replyComment(e) {
      const { commentId, userName } = e.currentTarget.dataset;
      console.log('点击回复按钮:', { commentId, userName });
      this.setData({
        replyTo: userName,
        replyToId: commentId,
        inputFocus: true,
        commentText: ''
      });
    },

    async likeComment(e) {
      const { commentId } = e.currentTarget.dataset;
      const { index, replyIndex } = e.currentTarget.dataset;

      // Mock 模式下直接处理点赞
      if (this.data.useMock) {
        const updatedComments = [...this.data.comments];
        
        if (replyIndex !== undefined) {
          const reply = updatedComments[index].replies[replyIndex];
          reply.liked = !reply.liked;
          reply.likes = reply.liked ? reply.likes + 1 : reply.likes - 1;
        } else {
          const comment = updatedComments[index];
          comment.liked = !comment.liked;
          comment.likes = comment.liked ? comment.likes + 1 : comment.likes - 1;
        }

        this.setData({
          comments: updatedComments
        });
        return;
      }

      try {
        const res = await app.request({
          url: `/api/comments/${commentId}/like`,
          method: 'POST'
        });

        if (res.success) {
          const { liked, likes } = res.data;
          const updatedComments = [...this.data.comments];

          if (replyIndex !== undefined) {
            updatedComments[index].replies[replyIndex].liked = liked;
            updatedComments[index].replies[replyIndex].likes = likes;
          } else {
            updatedComments[index].liked = liked;
            updatedComments[index].likes = likes;
          }

          this.setData({
            comments: updatedComments
          });
        } else {
          wx.showToast({
            title: res.message || '操作过于频繁，请稍后再试',
            icon: 'none'
          });
        }
      } catch (error) {
        console.error('点赞失败:', error);
        wx.showToast({
          title: '点赞失败',
          icon: 'none'
        });
      }
    },

    async deleteComment(e) {
      const { commentId, index, replyIndex } = e.currentTarget.dataset;
      const isReply = replyIndex !== undefined;
      const target = isReply ? this.data.comments[index]?.replies?.[replyIndex] : this.data.comments[index];
      if (!target || !target.canDelete) {
        wx.showToast({
          title: '仅支持删除自己的评论',
          icon: 'none'
        });
        return;
      }
      const modalRes = await new Promise((resolve) => {
        wx.showModal({
          title: '删除评论',
          content: '确认删除这条评论吗？',
          confirmColor: '#ff4d4f',
          success: resolve,
          fail: () => resolve({ confirm: false })
        });
      });
      if (!modalRes.confirm) {
        return;
      }
      if (this.data.useMock) {
        const updatedComments = [...this.data.comments];
        let deletedCount = 1;
        if (isReply) {
          updatedComments[index].replies.splice(replyIndex, 1);
          updatedComments[index].replyCount = Math.max(0, (updatedComments[index].replyCount || 0) - 1);
        } else {
          deletedCount = 1 + (updatedComments[index].replies?.length || 0);
          updatedComments.splice(index, 1);
        }
        this.setData({
          comments: updatedComments
        });
        const nextCount = Math.max(0, (this.data.commentCount || 0) - deletedCount);
        this.triggerEvent('commentcountupdate', {
          count: nextCount
        });
        wx.showToast({
          title: '删除成功',
          icon: 'success'
        });
        return;
      }
      try {
        const res = await app.request({
          url: `/api/comments/${commentId}`,
          method: 'DELETE'
        });
        if (!res.success) {
          wx.showToast({
            title: res.message || '删除失败',
            icon: 'none'
          });
          return;
        }
        const updatedComments = [...this.data.comments];
        let deletedCount = Number(res.deletedCount) || 1;
        if (isReply) {
          updatedComments[index].replies.splice(replyIndex, 1);
          updatedComments[index].replyCount = Math.max(0, (updatedComments[index].replyCount || 0) - 1);
          deletedCount = 1;
        } else {
          updatedComments.splice(index, 1);
        }
        this.setData({
          comments: updatedComments
        });
        const nextCount = Math.max(0, (this.data.commentCount || 0) - deletedCount);
        this.triggerEvent('commentcountupdate', {
          count: nextCount
        });
        wx.showToast({
          title: '删除成功',
          icon: 'success'
        });
      } catch (error) {
        console.error('删除评论失败:', error);
        wx.showToast({
          title: '删除失败',
          icon: 'none'
        });
      }
    },

    closeCommentPopup() {
      this.setData({
        showCommentPopup: false,
        commentText: '',
        canSubmit: false,
        replyTo: '',
        replyToId: '',
        inputFocus: false
      });
      this.triggerEvent('close');
    }
  }
});
