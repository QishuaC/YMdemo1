const app = getApp();

Page({
  data: {
    activeTab: 'cancelled',
    orders: [],
    allOrders: [],
    showEditAddressDialog: false,
    editingOrderId: '',
    editAddress: {
      name: '',
      phone: '',
      province: '',
      city: '',
      district: '',
      detail: ''
    }
  },
  countdownInterval: null,
  refundPollingTimer: null,
  ORDER_EXPIRE_TIME: 30 * 60 * 1000,

  onLoad(options) {
    if (options.tab) {
      this.setData({ activeTab: options.tab === 'all' ? 'cancelled' : options.tab });
    }
    this.loadOrders();
  },

  onShow() {
    this.loadOrders();
    this.startCountdown();
  },

  onHide() {
    this.stopCountdown();
    this.stopRefundPolling();
  },

  onUnload() {
    this.stopCountdown();
    this.stopRefundPolling();
  },

  loadOrders() {
    const userId = wx.getStorageSync('userId') || 'wx_user_001';
    const statusMap = {
      'pending': '待支付',
      'paid': '已支付',
      'cancelled': '已取消',
      'refund_pending': '售后中',
      'refunded': '已退款',
      'delivered': '已完成'
    };

    app.request({
      url: `/api/orders?userId=${userId}`
    }).then((res) => {
      if (res.success && Array.isArray(res.orders)) {
        const orderList = res.orders.map((order) => {
          const statusText = order.status === 'paid' && order.shippingStatus === 'shipped'
            ? (order.trackingNumber || '已发货')
            : (statusMap[order.status] || order.status);
          return {
            ...order,
            id: order._id,
            createTime: this.formatTime(order.createdAt),
            statusText,
            shippingStatusText: order.status === 'refund_pending'
              ? '退款申请中'
              : (order.shippingStatus === 'shipped' ? '已发货' : '未发货'),
            shippedAt: order.shippedAt ? this.formatTime(order.shippedAt) : (order.shippingStatus === 'shipped' && order.updatedAt ? this.formatTime(order.updatedAt) : ''),
            countdownText: order.status === 'pending' ? this.getCountdownText(order.createdAt) : '',
            expireAt: order.status === 'pending' ? (new Date(order.createdAt).getTime() + this.ORDER_EXPIRE_TIME) : null
          };
        });
        this.setData({
          allOrders: orderList,
          orders: orderList
        });
        this.switchTab({ currentTarget: { dataset: { tab: this.data.activeTab } } });
        return;
      }
      this.useLocalOrders(statusMap);
    }).catch(() => {
      this.useLocalOrders(statusMap);
    });
  },

  useLocalOrders(statusMap) {
    const orders = app.globalData.orders || [];
    const orderList = orders.map(order => ({
      ...order,
      id: order.id,
      statusText: order.status === 'paid' && order.shippingStatus === 'shipped'
        ? (order.trackingNumber || '已发货')
        : (statusMap[order.status] || order.status),
      shippingStatusText: order.status === 'refund_pending'
        ? '退款申请中'
        : (order.shippingStatus === 'shipped' ? '已发货' : '未发货'),
      createTime: this.formatTime(order.createTime),
      shippedAt: order.shippedAt ? this.formatTime(order.shippedAt) : (order.shippingStatus === 'shipped' && order.updatedAt ? this.formatTime(order.updatedAt) : ''),
      countdownText: order.status === 'pending' ? this.getCountdownText(order.createdAt || order.createTime) : '',
      expireAt: order.status === 'pending' ? (new Date(order.createdAt || order.createTime).getTime() + this.ORDER_EXPIRE_TIME) : null
    }));
    this.setData({
      allOrders: orderList,
      orders: orderList
    });
    this.switchTab({ currentTarget: { dataset: { tab: this.data.activeTab } } });
  },

  getCountdownText(createdAt) {
    const now = Date.now();
    const createdTime = new Date(createdAt).getTime();
    const remaining = this.ORDER_EXPIRE_TIME - (now - createdTime);
    
    if (remaining <= 0) {
      return '00:00';
    }
    
    const minutes = Math.floor(remaining / (60 * 1000));
    const seconds = Math.floor((remaining % (60 * 1000)) / 1000);
    
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  },

  startCountdown() {
    this.stopCountdown();
    this.countdownInterval = setInterval(() => {
      this.updateCountdowns();
    }, 1000);
  },

  stopCountdown() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  },

  stopRefundPolling() {
    if (this.refundPollingTimer) {
      clearInterval(this.refundPollingTimer);
      this.refundPollingTimer = null;
    }
  },

  updateCountdowns() {
    const updatedOrders = this.data.allOrders.map(order => {
      if (order.status === 'pending' && order.expireAt) {
        const now = Date.now();
        const remaining = order.expireAt - now;
        
        if (remaining <= 0) {
          this.cancelOrderAutomatically(order.id);
          return { ...order, countdownText: '00:00' };
        }
        
        const minutes = Math.floor(remaining / (60 * 1000));
        const seconds = Math.floor((remaining % (60 * 1000)) / 1000);
        const countdownText = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        
        return { ...order, countdownText };
      }
      return order;
    });
    
    this.setData({
      allOrders: updatedOrders,
      orders: this.data.orders
    });
    
    if (this.data.activeTab !== 'cancelled') {
      this.switchTab({ currentTarget: { dataset: { tab: this.data.activeTab } } });
      return;
    }
    this.switchTab({ currentTarget: { dataset: { tab: 'cancelled' } } });
  },

  cancelOrderAutomatically(orderId) {
    app.request({
      url: `/api/orders/${orderId}`,
      method: 'PUT',
      data: {
        status: 'cancelled'
      }
    }).then(() => {
      this.loadOrders();
    }).catch(() => {
      const orders = app.globalData.orders.map(order => {
        if (order.id == orderId) {
          return { ...order, status: 'cancelled', cancelTime: Date.now() };
        }
        return order;
      });
      app.globalData.orders = orders;
      app.saveOrders();
      this.loadOrders();
    });
  },

  formatTime(timestamp) {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}`;
  },

  switchTab(e) {
    const tab = e.currentTarget ? e.currentTarget.dataset.tab : e;
    this.setData({
      activeTab: tab
    });

    if (tab === 'cancelled') {
      const filteredOrders = this.data.allOrders.filter(order => order.status === 'cancelled');
      this.setData({
        orders: filteredOrders
      });
    } else if (tab === 'pending') {
      const filteredOrders = this.data.allOrders.filter(order => order.status === 'pending');
      this.setData({
        orders: filteredOrders
      });
    } else if (tab === 'paid') {
      const filteredOrders = this.data.allOrders.filter(order => order.status === 'paid' && order.shippingStatus !== 'shipped');
      this.setData({
        orders: filteredOrders
      });
    } else if (tab === 'shipped') {
      const filteredOrders = this.data.allOrders.filter(order => order.shippingStatus === 'shipped' && order.status !== 'refunded' && order.status !== 'delivered' && order.status !== 'refund_pending');
      this.setData({
        orders: filteredOrders
      });
    } else if (tab === 'refund') {
      const filteredOrders = this.data.allOrders.filter(order => order.status === 'refund_pending');
      this.setData({
        orders: filteredOrders
      });
    } else if (tab === 'completed') {
      const filteredOrders = this.data.allOrders.filter(order => order.status === 'refunded' || order.status === 'delivered');
      this.setData({
        orders: filteredOrders
      });
    } else {
      const filteredOrders = this.data.allOrders.filter(order => order.status === tab);
      this.setData({
        orders: filteredOrders
      });
    }
  },

  viewOrderDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.showToast({
      title: '查看订单详情',
      icon: 'none'
    });
  },

  cancelOrder(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '提示',
      content: '确定要取消这个订单吗？',
      success: (res) => {
        if (res.confirm) {
          app.request({
            url: `/api/orders/${id}`,
            method: 'PUT',
            data: {
              status: 'cancelled'
            }
          }).then(() => {
            this.loadOrders();
            wx.showToast({
              title: '订单已取消',
              icon: 'success'
            });
          }).catch(() => {
            const orders = app.globalData.orders.map(order => {
              if (order.id == id) {
                return { ...order, status: 'cancelled', cancelTime: Date.now() };
              }
              return order;
            });
            app.globalData.orders = orders;
            app.saveOrders();
            this.loadOrders();
            wx.showToast({
              title: '订单已取消',
              icon: 'success'
            });
          });
        }
      }
    });
  },

  payOrder(e) {
    const id = e.currentTarget.dataset.id;
    const order = this.data.allOrders.find(o => o.id == id);
    
    if (!order) {
      wx.showToast({
        title: '订单不存在',
        icon: 'none'
      });
      return;
    }

    if (!order.address) {
      const defaultAddress = app.globalData.addresses.find(addr => addr.isDefault);
      if (!defaultAddress) {
        wx.showModal({
          title: '提示',
          content: '请先添加收货地址',
          confirmText: '去添加',
          success: (res) => {
            if (res.confirm) {
              wx.navigateTo({
                url: '/pages/address/address'
              });
            }
          }
        });
        return;
      }
    }

    wx.navigateTo({
      url: `/pages/payment/payment?orderId=${id}`
    });
  },

  requestRefund(e) {
    const id = e.currentTarget.dataset.id;
    const orderNumber = e.currentTarget.dataset.orderNumber || '';
    const order = this.data.allOrders.find(o => o.id == id);
    if (!order || order.status !== 'paid') {
      wx.showToast({
        title: '当前订单不可退款',
        icon: 'none'
      });
      return;
    }
    const hasTrackingNumber = String(order.trackingNumber || '').trim().length > 0;
    const shouldAutoRefund = order.shippingStatus === 'unshipped' && !hasTrackingNumber;
    wx.showModal({
      title: '申请退款',
      content: shouldAutoRefund
        ? `确认对订单 ${orderNumber} 发起微信退款？`
        : `确认提交订单 ${orderNumber} 的退款申请？`,
      confirmText: '退款',
      success: (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: shouldAutoRefund ? '退款处理中' : '提交申请中' });
        app.request({
          url: `/api/orders/${id}/refund`,
          method: 'POST',
          data: {
            channel: 'wechat'
          }
        }).then((result) => {
          wx.hideLoading();
          if (result && result.success) {
            wx.showToast({
              title: result.message || (shouldAutoRefund ? '退款处理中' : '已提交退款申请'),
              icon: 'success'
            });
            this.loadOrders();
            if (shouldAutoRefund) {
              this.startRefundPolling(id);
            }
            return;
          }
          wx.showToast({
            title: (result && result.message) || '退款失败',
            icon: 'none'
          });
        }).catch((error) => {
          wx.hideLoading();
          wx.showToast({
            title: (error && error.message) || '退款失败',
            icon: 'none'
          });
        });
      }
    });
  },

  startRefundPolling(orderId) {
    this.stopRefundPolling();
    let pollingCount = 0;
    this.refundPollingTimer = setInterval(() => {
      pollingCount += 1;
      app.request({
        url: `/api/orders/${orderId}`
      }).then((res) => {
        if (!res || !res.success || !res.order) return;
        if (res.order.status === 'refunded') {
          this.stopRefundPolling();
          this.loadOrders();
          return;
        }
        if (res.order.refundStatus === 'failed') {
          this.stopRefundPolling();
          wx.showToast({
            title: res.order.refundFailedReason || '退款失败',
            icon: 'none'
          });
        }
      }).catch(() => {});
      if (pollingCount >= 30) {
        this.stopRefundPolling();
      }
    }, 2000);
  },

  editOrderAddress(e) {
    const id = e.currentTarget.dataset.id;
    const order = this.data.allOrders.find(o => o.id == id);
    if (order && order.address) {
      this.setData({
        showEditAddressDialog: true,
        editingOrderId: id,
        editAddress: { ...order.address }
      });
    }
  },

  closeEditAddressDialog() {
    this.setData({
      showEditAddressDialog: false,
      editingOrderId: '',
      editAddress: {
        name: '',
        phone: '',
        province: '',
        city: '',
        district: '',
        detail: ''
      }
    });
  },

  onAddressInputChange(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({
      [`editAddress.${field}`]: e.detail.value
    });
  },

  saveOrderAddress() {
    const { editAddress, editingOrderId } = this.data;
    
    if (!editAddress.name || !editAddress.phone || !editAddress.province || !editAddress.detail) {
      wx.showToast({
        title: '请填写完整信息',
        icon: 'none'
      });
      return;
    }

    app.request({
      url: `/api/orders/${editingOrderId}`,
      method: 'PUT',
      data: {
        address: editAddress
      }
    }).then(() => {
      this.loadOrders();
      this.closeEditAddressDialog();
      wx.showToast({
        title: '修改成功',
        icon: 'success'
      });
    }).catch(() => {
      const orders = app.globalData.orders.map(order => {
        if (order.id == editingOrderId) {
          return { ...order, address: editAddress };
        }
        return order;
      });
      app.globalData.orders = orders;
      app.saveOrders();
      this.loadOrders();
      this.closeEditAddressDialog();
      wx.showToast({
        title: '修改成功',
        icon: 'success'
      });
    });
  }
})
