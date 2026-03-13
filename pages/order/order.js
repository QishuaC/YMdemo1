const app = getApp();

Page({
  data: {
    activeTab: 'all',
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
  ORDER_EXPIRE_TIME: 30 * 60 * 1000,

  onLoad() {
    this.loadOrders();
  },

  onShow() {
    this.loadOrders();
    this.startCountdown();
  },

  onHide() {
    this.stopCountdown();
  },

  onUnload() {
    this.stopCountdown();
  },

  loadOrders() {
    const userId = wx.getStorageSync('userId') || 'wx_user_001';
    const statusMap = {
      'pending': '待付款',
      'paid': '待发货',
      'shipping': '待收货',
      'delivered': '已完成',
      'cancelled': '已取消'
    };

    app.request({
      url: `/api/orders?userId=${userId}`
    }).then((res) => {
      if (res.success && Array.isArray(res.orders)) {
        const orderList = res.orders.map((order) => {
          let statusText = statusMap[order.status] || order.status;
          
          if (order.status === 'paid' && order.shippingStatus === 'shipped') {
            statusText = '待收货';
          }
          
          return {
            ...order,
            id: order._id,
            createTime: this.formatTime(order.createdAt),
            statusText: statusText,
            shippingStatusText: order.shippingStatus === 'shipped' ? '已发货' : '未发货',
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
      statusText: statusMap[order.status] || order.status,
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
      orders: this.data.activeTab === 'all' ? updatedOrders : this.data.orders
    });
    
    if (this.data.activeTab !== 'all') {
      this.switchTab({ currentTarget: { dataset: { tab: this.data.activeTab } } });
    }
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
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      activeTab: tab
    });

    if (tab === 'all') {
      this.setData({
        orders: this.data.allOrders
      });
    } else if (tab === 'shipping') {
      const filteredOrders = this.data.allOrders.filter(order => 
        order.status === 'shipping' || 
        (order.status === 'paid' && order.shippingStatus === 'shipped')
      );
      this.setData({
        orders: filteredOrders
      });
    } else if (tab === 'paid') {
      const filteredOrders = this.data.allOrders.filter(order => 
        order.status === 'paid' && order.shippingStatus !== 'shipped'
      );
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

  confirmReceive(e) {
    wx.showModal({
      title: '提示',
      content: '确认已收到商品？',
      success: (res) => {
        if (res.confirm) {
          const id = e.currentTarget.dataset.id;
          app.request({
            url: `/api/orders/${id}`,
            method: 'PUT',
            data: {
              status: 'delivered'
            }
          }).then(() => {
            this.loadOrders();
            wx.showToast({
              title: '确认收货成功',
              icon: 'success'
            });
          }).catch(() => {
            const orders = app.globalData.orders.map(order => {
              if (order.id == id) {
                return { ...order, status: 'delivered', receiveTime: Date.now() };
              }
              return order;
            });
            app.globalData.orders = orders;
            app.saveOrders();
            this.loadOrders();
            wx.showToast({
              title: '确认收货成功',
              icon: 'success'
            });
          });
        }
      }
    });
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
