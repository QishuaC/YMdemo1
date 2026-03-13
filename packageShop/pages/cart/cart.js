const app = getApp();
const auth = require('../../../utils/auth');

Page({
  data: {
    cartList: [],
    allSelected: false,
    originalTotalPrice: 0,
    totalPrice: 0,
    selectedCount: 0,
    isMember: false,
    discountRate: 1,
    discountAmount: 0
  },

  onLoad() {
    this.loadCart();
  },

  onShow() {
    this.loadCart();
  },

  toOneDecimal(value) {
    const num = Number(value || 0);
    return Math.round((num + Number.EPSILON) * 10) / 10;
  },

  loadCart() {
    const cartList = app.globalData.cart;
    const isMember = Boolean(app.globalData.isLoggedIn && app.globalData.isMember);
    this.setData({
      cartList,
      isMember,
      discountRate: isMember ? 0.95 : 1
    });
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
    let originalTotalPrice = 0;
    let selectedCount = 0;
    let allSelected = true;

    this.data.cartList.forEach(item => {
      if (item.selected) {
        originalTotalPrice += item.price * item.quantity;
        selectedCount += item.quantity;
      } else {
        allSelected = false;
      }
    });

    if (this.data.cartList.length === 0) {
      allSelected = false;
    }

    originalTotalPrice = this.toOneDecimal(originalTotalPrice);
    const discountRate = this.data.discountRate || 1;
    const totalPrice = this.data.isMember ? this.toOneDecimal(originalTotalPrice * discountRate) : originalTotalPrice;
    const discountAmount = this.toOneDecimal(Math.max(0, originalTotalPrice - totalPrice));
    this.setData({
      originalTotalPrice: originalTotalPrice.toFixed(1),
      totalPrice: totalPrice.toFixed(1),
      discountAmount: discountAmount.toFixed(1),
      selectedCount,
      allSelected
    });
  },

  goToCheckout() {
    auth.requireLogin(() => {
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
                url: '/packageShop/pages/address/address'
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
        userId: wx.getStorageSync('userId') || '',
        userName: '微信用户',
        items: selectedItems,
        totalPrice: parseFloat(totalPrice),
        originalTotalPrice: parseFloat(this.data.originalTotalPrice || totalPrice),
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
            url: `/packageShop/pages/payment/payment?orderId=${res.order._id}`
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
          url: `/packageShop/pages/payment/payment?orderId=${order.id}`
        });
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
