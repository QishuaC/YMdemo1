const app = getApp();

Page({
  data: {
    addressList: [],
    showEditDialog: false,
    isEditing: false,
    editAddress: {
      id: '',
      name: '',
      phone: '',
      province: '',
      city: '',
      district: '',
      detail: '',
      isDefault: false
    }
  },

  onLoad() {
    this.loadAddresses();
  },

  onShow() {
    this.loadAddresses();
  },

  async loadAddresses() {
    await app.loadAddresses();
    const addresses = app.globalData.addresses || [];
    const sortedAddresses = [...addresses].sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return 0;
    });
    this.setData({ addressList: sortedAddresses });
  },

  addAddress() {
    this.setData({
      showEditDialog: true,
      isEditing: false,
      editAddress: {
        id: Date.now(),
        name: '',
        phone: '',
        province: '',
        city: '',
        district: '',
        detail: '',
        isDefault: app.globalData.addresses.length === 0
      }
    });
  },

  editAddress(e) {
    const id = e.currentTarget.dataset.id;
    const address = app.globalData.addresses.find(addr => addr.id === id);
    if (address) {
      this.setData({
        showEditDialog: true,
        isEditing: true,
        editAddress: { ...address }
      });
    }
  },

  deleteAddress(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '提示',
      content: '确定要删除这个收货地址吗？',
      success: (res) => {
        if (res.confirm) {
          const addresses = app.globalData.addresses.filter(addr => addr.id !== id);
          app.globalData.addresses = addresses;
          app.saveAddresses();
          this.loadAddresses();
          wx.showToast({
            title: '删除成功',
            icon: 'success'
          });
        }
      }
    });
  },

  setDefault(e) {
    const id = e.currentTarget.dataset.id;
    const addresses = app.globalData.addresses.map(addr => ({
      ...addr,
      isDefault: addr.id === id
    }));
    app.globalData.addresses = addresses;
    app.saveAddresses();
    this.loadAddresses();
    wx.showToast({
      title: '设置成功',
      icon: 'success'
    });
  },

  onInputChange(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({
      [`editAddress.${field}`]: e.detail.value
    });
  },

  onDefaultToggle() {
    this.setData({
      'editAddress.isDefault': !this.data.editAddress.isDefault
    });
  },

  saveAddress() {
    const { editAddress, isEditing } = this.data;
    
    if (!editAddress.name || !editAddress.phone || !editAddress.province || !editAddress.detail) {
      wx.showToast({
        title: '请填写完整信息',
        icon: 'none'
      });
      return;
    }

    let addresses = app.globalData.addresses || [];
    
    if (editAddress.isDefault) {
      addresses = addresses.map(addr => ({ ...addr, isDefault: false }));
    }

    if (isEditing) {
      addresses = addresses.map(addr => addr.id === editAddress.id ? editAddress : addr);
    } else {
      addresses.push(editAddress);
    }

    app.globalData.addresses = addresses;
    app.saveAddresses();
    this.loadAddresses();
    this.closeDialog();
    wx.showToast({
      title: '保存成功',
      icon: 'success'
    });
  },

  closeDialog() {
    this.setData({
      showEditDialog: false,
      editAddress: {
        id: '',
        name: '',
        phone: '',
        province: '',
        city: '',
        district: '',
        detail: '',
        isDefault: false
      }
    });
  }
});
