const app = getApp();
const auth = require('../../../utils/auth');

Page({
  data: {
    orderId: '',
    orderNumber: '',
    totalPrice: '',
    originalTotalPrice: '',
    discountAmount: 0,
    memberDiscountApplied: false,
    createTime: '',
    productTitle: '',
    showSuccess: false,
    earnedPoints: 0,
    address: null,
    addressList: [],
    showAddressSelector: false
  },

  onLoad(options) {
    if (!auth.isLoggedIn()) {
      auth.requireLogin();
      return;
    }
    const { orderId, orderNumber: orderNumberParam, totalPrice: totalPriceParam, createTime: createTimeParam } = options;
    this.loadAddressList();
    if (orderId) {
      this.loadOrder(orderId, orderNumberParam, totalPriceParam, createTimeParam);
      return;
    }
    wx.showToast({
      title: '订单不存在',
      icon: 'none'
    });
    setTimeout(() => {
      wx.navigateBack();
    }, 1500);
  },

  formatAmount(value) {
    const num = Number(value || 0);
    return (Math.round((num + Number.EPSILON) * 10) / 10).toFixed(1);
  },

  loadOrder(orderId, orderNumberParam, totalPriceParam, createTimeParam) {
    const userId = wx.getStorageSync('userId') || '';
    app.request({
      url: `/api/orders?userId=${userId}`
    }).then((res) => {
      if (res.success && Array.isArray(res.orders)) {
        const order = res.orders.find((item) => item._id == orderId);
        if (order) {
          let address = order.address;
          if (!address) {
            address = app.globalData.addresses.find(addr => addr.isDefault) || null;
          }
          const productTitle = this.getProductTitle(order.items);
          this.setData({
            orderId: order._id,
            orderNumber: order.orderNumber,
            totalPrice: this.formatAmount(order.totalPrice),
            originalTotalPrice: this.formatAmount(order.originalTotalPrice || order.totalPrice),
            discountAmount: this.formatAmount(order.discountAmount || 0),
            memberDiscountApplied: Boolean(order.memberDiscountApplied),
            createTime: this.formatTime(order.createdAt),
            productTitle,
            address
          });
          return;
        }
      }
      this.loadOrderFromLocal(orderId, orderNumberParam, totalPriceParam, createTimeParam);
    }).catch(() => {
      this.loadOrderFromLocal(orderId, orderNumberParam, totalPriceParam, createTimeParam);
    });
  },

  loadOrderFromLocal(orderId, orderNumberParam, totalPriceParam, createTimeParam) {
    const localOrder = app.globalData.orders.find(o => o.id == orderId);
    if (localOrder) {
      let address = localOrder.address;
      if (!address) {
        address = app.globalData.addresses.find(addr => addr.isDefault) || null;
      }
      const productTitle = this.getProductTitle(localOrder.items);
      this.setData({
        orderId: localOrder.id,
        orderNumber: localOrder.orderNumber,
        totalPrice: this.formatAmount(localOrder.totalPrice),
        originalTotalPrice: this.formatAmount(localOrder.originalTotalPrice || localOrder.totalPrice),
        discountAmount: this.formatAmount(localOrder.discountAmount || 0),
        memberDiscountApplied: Boolean(localOrder.memberDiscountApplied),
        createTime: this.formatTime(localOrder.createTime),
        productTitle,
        address
      });
      return;
    }
    if (orderNumberParam && totalPriceParam) {
      const defaultAddress = app.globalData.addresses.find(addr => addr.isDefault) || null;
      this.setData({
        orderId: orderId,
        orderNumber: orderNumberParam,
        totalPrice: this.formatAmount(totalPriceParam),
        originalTotalPrice: this.formatAmount(totalPriceParam),
        discountAmount: this.formatAmount(0),
        memberDiscountApplied: false,
        createTime: createTimeParam || this.formatTime(Date.now()),
        address: defaultAddress
      });
      return;
    }
    wx.showToast({
      title: '订单不存在',
      icon: 'none'
    });
    setTimeout(() => {
      wx.navigateBack();
    }, 1500);
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

  getProductTitle(items) {
    if (!items || !Array.isArray(items) || items.length === 0) {
      return '';
    }
    if (items.length === 1) {
      return items[0].name || '';
    }
    return `${items[0].name} 等${items.length}件商品`;
  },

  doPay() {
    if (!auth.isLoggedIn()) {
      auth.requireLogin();
      return;
    }
    if (!this.data.address) {
      wx.showToast({
        title: '请先添加收货地址',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: '支付中...'
    });

    setTimeout(() => {
      app.request({
        url: `/api/orders/${this.data.orderId}/pay`,
        method: 'POST',
        data: {
          address: this.data.address
        }
      }).then((res) => {
        wx.hideLoading();
        if (res.success) {
          const earnedPoints = Number(res.earnedPoints || Math.floor(this.data.totalPrice));
          app.globalData.points = (app.globalData.points || 0) + Number(earnedPoints || 0);
          app.saveMemberData();
          this.setData({
            earnedPoints,
            showSuccess: true
          });
        } else {
          wx.showToast({
            title: '订单更新失败',
            icon: 'none'
          });
        }
      }).catch(() => {
        wx.hideLoading();
        const orders = app.globalData.orders || [];
        const orderIndex = orders.findIndex(o => o.id == this.data.orderId);
        if (orderIndex !== -1) {
          orders[orderIndex].status = 'paid';
          orders[orderIndex].payTime = Date.now();
          orders[orderIndex].address = this.data.address;
          app.globalData.orders = orders;
          app.saveOrders();
          const earnedPoints = Math.floor(this.data.totalPrice);
          app.globalData.points = (app.globalData.points || 0) + earnedPoints;
          app.saveMemberData();
          this.setData({
            earnedPoints,
            showSuccess: true
          });
        } else {
          wx.showToast({
            title: '订单更新失败',
            icon: 'none'
          });
        }
      });
    }, 2000);
  },

  goToOrder() {
    wx.redirectTo({
      url: '/packageShop/pages/order/order'
    });
  },

  goBack() {
    wx.switchTab({
      url: '/pages/shop/shop'
    });
  },

  goToAddAddress() {
    this.closeAddressSelector();
    wx.navigateTo({
      url: '/packageShop/pages/address/address'
    });
  },

  loadAddressList() {
    const addresses = app.globalData.addresses || [];
    const sortedAddresses = [...addresses].sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return 0;
    });
    this.setData({
      addressList: sortedAddresses
    });
  },

  showAddressSelector() {
    this.loadAddressList();
    this.setData({
      showAddressSelector: true
    });
  },

  closeAddressSelector() {
    this.setData({
      showAddressSelector: false
    });
  },

  selectAddress(e) {
    const id = e.currentTarget.dataset.id;
    const selectedAddress = this.data.addressList.find(addr => addr.id === id);
    if (selectedAddress) {
      this.setData({
        address: selectedAddress,
        showAddressSelector: false
      });
      
      app.request({
        url: `/api/orders/${this.data.orderId}`,
        method: 'PUT',
        data: {
          address: selectedAddress
        }
      }).catch(() => {
        const orders = app.globalData.orders || [];
        const orderIndex = orders.findIndex(o => o.id == this.data.orderId);
        if (orderIndex !== -1) {
          orders[orderIndex].address = selectedAddress;
          app.globalData.orders = orders;
          app.saveOrders();
        }
      });
    }
  },

  onShow() {
    if (!auth.isLoggedIn()) {
      auth.requireLogin();
      return;
    }
    this.loadAddressList();
    this.refreshCurrentAddress();
  },

  refreshCurrentAddress() {
    const currentAddress = this.data.address;
    if (!currentAddress) return;
    
    const addressList = app.globalData.addresses || [];
    const updatedAddress = addressList.find(addr => addr.id === currentAddress.id);
    
    if (updatedAddress) {
      if (JSON.stringify(updatedAddress) !== JSON.stringify(currentAddress)) {
        this.setData({
          address: updatedAddress
        });
      }
    } else {
      const defaultAddress = addressList.find(addr => addr.isDefault) || addressList[0] || null;
      this.setData({
        address: defaultAddress
      });
    }
  }
})
