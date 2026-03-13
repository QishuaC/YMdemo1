Page({
  data: {
    activeTab: 'order',
    qrCodeUrl: '',
    afterSaleServices: [
      { id: 1, icon: '💰', name: '售后订单', desc: '查看售后中的订单' },
      { id: 2, icon: '🔄', name: '退货退款', desc: '商品退回并申请退款' },
      { id: 3, icon: '🔁', name: '申请换货', desc: '商品换货补寄' }
    ],
    orderFaqs: [
      { question: '如何查看订单物流信息？', answer: '您可以在"我的订单"中找到对应订单，点击进入订单详情页即可查看物流信息。', open: false },
      { question: '商品如何退换货？', answer: '收到商品后7天内，如商品完好不影响二次销售，可申请退换货。请在订单详情页点击"申请售后"按钮。', open: false },
      { question: '退款多久到账？', answer: '退款将在审核通过后1-3个工作日内原路退回，具体到账时间以银行或支付平台为准。', open: false },
      { question: '积分如何使用？', answer: '积分可在积分商城兑换商品，也可在下单时抵扣部分现金。100积分=1元。', open: false }
    ],
    bugTypes: ['界面显示异常', '功能无法使用', '性能问题', '其他问题'],
    bugTypeIndex: 0,
    description: '',
    contact: '',
    submitting: false,
    feedbackList: []
  },

  onLoad() {
    this.loadFeedbackList();
    this.loadQrCode();
  },

  loadQrCode() {
    const qrCode = wx.getStorageSync('customerServiceQrCode') || '';
    this.setData({ qrCodeUrl: qrCode });
  },

  loadFeedbackList() {
    const list = wx.getStorageSync('feedbackList') || [];
    this.setData({ feedbackList: list });
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
  },

  handleServiceClick(e) {
    const id = e.currentTarget.dataset.id;
    if (id === 1) {
      wx.navigateTo({
        url: '/pages/order/order?tab=refund'
      });
    } else if (id === 2) {
      wx.navigateTo({
        url: '/pages/order/order?tab=shipped'
      });
    } else if (id === 3) {
      this.setData({
        activeTab: 'contact'
      });
    } else {
      wx.showToast({
        title: '功能开发中',
        icon: 'none'
      });
    }
  },

  toggleFaq(e) {
    const index = e.currentTarget.dataset.index;
    const type = e.currentTarget.dataset.type;
    let faqKey = type === 'order' ? 'orderFaqs' : 'faqs';
    const faqs = this.data[faqKey];
    faqs[index].open = !faqs[index].open;
    this.setData({
      [faqKey]: faqs
    });
  },

  makePhoneCall() {
    wx.makePhoneCall({
      phoneNumber: '400-123-4567'
    });
  },

  onBugTypeChange(e) {
    this.setData({
      bugTypeIndex: parseInt(e.detail.value)
    });
  },

  onDescriptionInput(e) {
    this.setData({
      description: e.detail.value
    });
  },

  onContactInput(e) {
    this.setData({
      contact: e.detail.value
    });
  },

  submitFeedback() {
    const { bugTypes, bugTypeIndex, description, contact } = this.data;

    if (!description.trim()) {
      wx.showToast({
        title: '请描述问题',
        icon: 'none'
      });
      return;
    }

    this.setData({ submitting: true });

    const feedback = {
      id: Date.now(),
      type: bugTypes[bugTypeIndex],
      description: description,
      contact: contact || '未填写',
      time: this.formatTime(new Date()),
      status: 'pending'
    };

    const feedbackList = [feedback, ...this.data.feedbackList];

    setTimeout(() => {
      wx.setStorageSync('feedbackList', feedbackList);
      this.setData({
        feedbackList: feedbackList,
        description: '',
        contact: '',
        bugTypeIndex: 0,
        submitting: false
      });
      wx.showToast({
        title: '提交成功',
        icon: 'success'
      });
    }, 1000);
  },

  formatTime(date) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hour = date.getHours();
    const minute = date.getMinutes();
    return `${year}-${month}-${day} ${hour}:${minute.toString().padStart(2, '0')}`;
  }
})
