const app = getApp();

Page({
  data: {
    cartList: [],
    allSelected: false,
    totalPrice: 0,
    selectedCount: 0
  },

  onLoad() {
    this.loadCart();
  },

  onShow() {
    this.loadCart();
  },

  loadCart() {
    const cartList = app.globalData.cart;
    this.setData({ cartList });
    this.calculateTotal();
  },

  toggleSelect(e) {
    const index = e.currentTarget.dataset.index;
    const cartList = this.data.cartList;
    cartList[index].selected = !cartList[index].selected;
    this.setData({ cartList });
    this.calculateTotal();
    app.saveCart();
  },

  toggleSelectAll() {
    const allSelected = !this.data.allSelected;
    const cartList = this.data.cartList.map(item => ({
      ...item,
      selected: allSelected
    }));
    this.setData({ cartList, allSelected });
    this.calculateTotal();
    app.globalData.cart = cartList;
    app.saveCart();
  },

  changeQuantity(e) {
    const index = e.currentTarget.dataset.index;
    const type = e.currentTarget.dataset.type;
    const cartList = this.data.cartList;
    
    if (type === '+') {
      cartList[index].quantity += 1;
    } else {
      if (cartList[index].quantity > 1) {
        cartList[index].quantity -= 1;
      }
    }
    
    this.setData({ cartList });
    this.calculateTotal();
    app.saveCart();
  },

  deleteItem(e) {
    const index = e.currentTarget.dataset.index;
    wx.showModal({
      title: '提示',
      content: '确定要删除该商品吗？',
      success: (res) => {
        if (res.confirm) {
          const cartList = this.data.cartList;
          cartList.splice(index, 1);
          this.setData({ cartList });
          this.calculateTotal();
          app.globalData.cart = cartList;
          app.saveCart();
        }
      }
    });
  },

  calculateTotal() {
    let totalPrice = 0;
    let selectedCount = 0;
    let allSelected = true;

    this.data.cartList.forEach(item => {
      if (item.selected) {
        totalPrice += item.price * item.quantity;
        selectedCount += item.quantity;
      } else {
        allSelected = false;
      }
    });

    if (this.data.cartList.length === 0) {
      allSelected = false;
    }

    this.setData({
      totalPrice: totalPrice.toFixed(2),
      selectedCount,
      allSelected
    });
  },

  goToCheckout() {
    if (this.data.selectedCount === 0) {
      wx.showToast({
        title: '请选择商品',
        icon: 'none'
      });
      return;
    }

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

    const selectedItems = this.data.cartList.filter(item => item.selected);
    const totalPrice = this.data.totalPrice;
    const totalQuantity = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
    const payload = {
      userId: wx.getStorageSync('userId') || 'wx_user_001',
      userName: '微信用户',
      items: selectedItems,
      totalPrice: parseFloat(totalPrice),
      totalQuantity: totalQuantity,
      address: defaultAddress,
      status: 'pending'
    };

    app.request({
      url: '/api/orders',
      method: 'POST',
      data: payload
    }).then((res) => {
      if (res.success && res.order) {
        app.globalData.cart = app.globalData.cart.filter(item => !item.selected);
        app.saveCart();
        wx.navigateTo({
          url: `/pages/payment/payment?orderId=${res.order._id}`
        });
        return;
      }
      wx.showToast({
        title: '创建订单失败',
        icon: 'none'
      });
    }).catch(() => {
      const order = app.createOrder({
        items: selectedItems,
        totalPrice: parseFloat(totalPrice),
        totalQuantity: totalQuantity,
        address: defaultAddress
      });
      app.globalData.cart = app.globalData.cart.filter(item => !item.selected);
      app.saveCart();
      app.saveOrders();
      wx.navigateTo({
        url: `/pages/payment/payment?orderId=${order.id}`
      });
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

  goToShop() {
    wx.switchTab({
      url: '/pages/shop/shop'
    });
  }
})
