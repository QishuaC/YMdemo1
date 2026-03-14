Component({
  data: {
    visible: true,
    selected: 0,
    clickedIndex: -1,
    list: [
      { pagePath: '/pages/yixun/yixun', text: '义讯', icon: '📺' },
      { pagePath: '/pages/yiwen/yiwen', text: '义闻', icon: '🏠' },
      { pagePath: '/pages/shop/shop', text: '义商', icon: '🛒' },
      { pagePath: '/pages/member/member', text: '我的', icon: '👤' }
    ]
  },

  attached() {
    this.updateTab();
  },

  pageLifetimes: {
    show() {
      this.updateTab();
    }
  },

  methods: {
    normalizePath(path) {
      if (!path) return '';
      return path.startsWith('/') ? path : `/${path}`;
    },

    getTabIndexByRoute(route) {
      const list = this.data.list;
      const normalizedRoute = this.normalizePath(route);
      for (let i = 0; i < list.length; i++) {
        if (this.normalizePath(list[i].pagePath) === normalizedRoute) {
          return i;
        }
      }

      const subPageMap = {
        '/pages/article/article': '/pages/yiwen/yiwen',
        '/pages/article/detail': '/pages/yiwen/yiwen',
        '/pages/product/product': '/pages/shop/shop',
        '/pages/cart/cart': '/pages/shop/shop',
        '/pages/payment/payment': '/pages/shop/shop',
        '/pages/login/login': '/pages/member/member',
        '/pages/order/order': '/pages/member/member',
        '/pages/address/address': '/pages/member/member',
        '/pages/lucky-draw/lucky-draw': '/pages/member/member'
      };

      const parentPath = subPageMap[normalizedRoute];
      if (!parentPath) return -1;

      for (let i = 0; i < list.length; i++) {
        if (this.normalizePath(list[i].pagePath) === parentPath) {
          return i;
        }
      }
      return -1;
    },

    updateTab() {
      const app = getApp();
      const globalData = app && app.globalData ? app.globalData : null;

      if (globalData && globalData.uiConfig && globalData.uiConfig.tabBar) {
        const currentListStr = JSON.stringify(this.data.list);
        const newListStr = JSON.stringify(globalData.uiConfig.tabBar);
        if (currentListStr !== newListStr) {
          this.setData({ list: globalData.uiConfig.tabBar });
        }
      }

      const pages = getCurrentPages();
      if (!pages || !pages.length) return;
      const route = '/' + pages[pages.length - 1].route;
      
      let selectedIndex = this.getTabIndexByRoute(route);
      if (
        globalData &&
        globalData.selectedTabDirty === true &&
        typeof globalData.selectedTab === 'number'
      ) {
        selectedIndex = globalData.selectedTab;
        globalData.selectedTabDirty = false;
      }
      if (selectedIndex === -1 && globalData && typeof globalData.selectedTab === 'number') {
        selectedIndex = globalData.selectedTab;
      }
      if (selectedIndex === -1) return;

      this.setData({ selected: selectedIndex });
      if (globalData) {
        globalData.selectedTab = selectedIndex;
      }
    },

    switchTab(e) {
      const idx = Number(e.currentTarget.dataset.index);
      const url = e.currentTarget.dataset.path;
      const app = getApp();
      const globalData = app && app.globalData ? app.globalData : null;

      this.setData({ 
        clickedIndex: idx,
        selected: idx 
      });
      
      if (globalData) {
        globalData.selectedTab = idx;
        globalData.selectedTabDirty = true;
      }

      setTimeout(() => {
        this.setData({ clickedIndex: -1 });
      }, 300);

      wx.switchTab({ url: url });
    }
  }
});
