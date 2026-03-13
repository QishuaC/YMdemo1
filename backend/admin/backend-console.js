const state = {
  module: 'videos',
  editingModule: '',
  editingId: '',
  rows: {
    videos: [],
    articles: [],
    products: [],
    orders: [],
    users: [],
    comments: [],
    exchangeProducts: []
  },
  videoSort: 'date-desc',
  orderStatusFilter: '',
  orderShippingStatusFilter: '',
  commentVideoFilter: '',
  selectedComments: [],
  selectedOrders: []
};
const loadedModules = new Set();
const moduleLoadingTasks = {};
const SERVICE_TAG_OPTIONS = ['7天无理由', '运费险', '正品保障'];

const ORDER_STATUS_MAP = {
  'pending': '待支付',
  'paid': '已支付',
  'shipping': '配送中',
  'delivered': '已签收',
  'cancelled': '已取消'
};

const SHIPPING_STATUS_MAP = {
  'unshipped': '未发货',
  'shipped': '已发货'
};

const moduleConfig = {
  videos: {
    title: '视频',
    listApi: '/api/videos',
    detailApi: (id) => `/api/videos/${id}`,
    detailKey: 'video',
    createApi: '/api/videos',
    updateApi: (id) => `/api/videos/${id}`,
    deleteApi: (id) => `/api/videos/${id}`,
    fields: [
      { name: 'title', label: '标题', type: 'text', required: true },
      { name: 'author', label: '作者', type: 'select', required: true, options: ['琯溪义门陈', '义门陈文化'] },
      { name: 'cover', label: '封面', type: 'upload', required: true, accept: 'image/*', uploadApi: '/api/upload' },
      { name: 'videoUrl', label: '视频地址', type: 'upload', required: true, accept: 'video/*', uploadApi: '/api/upload/video' }
    ]
  },
  comments: {
    title: '评论',
    listApi: '/api/admin/comments',
    detailApi: null,
    detailKey: null,
    createApi: null,
    updateApi: null,
    deleteApi: (id) => `/api/admin/comments/${id}`,
    fields: []
  },
  articles: {
    title: '文章',
    listApi: '/api/articles',
    detailApi: (id) => `/api/articles/${id}?noView=1`,
    detailKey: 'article',
    createApi: '/api/articles',
    updateApi: (id) => `/api/articles/${id}`,
    deleteApi: (id) => `/api/articles/${id}`,
    fields: [
      { name: 'title', label: '标题', type: 'text', required: true },
      { name: 'author', label: '作者', type: 'text', required: true },
      { name: 'cover', label: '封面', type: 'upload', required: true, accept: 'image/*', uploadApi: '/api/upload' },
      { name: 'summary', label: '摘要', type: 'textarea', required: true },
      { name: 'content', label: '正文', type: 'textarea', required: false }
    ]
  },
  products: {
    title: '商品',
    listApi: '/api/products',
    detailApi: (id) => `/api/products/${id}`,
    detailKey: 'product',
    createApi: '/api/products',
    updateApi: (id) => `/api/products/${id}`,
    deleteApi: (id) => `/api/products/${id}`,
    fields: [
      { name: 'name', label: '商品名', type: 'text', required: true },
      { name: 'price', label: '价格', type: 'number', required: true },
      { name: 'originalPrice', label: '原价', type: 'number', required: true },
      { name: 'stock', label: '库存', type: 'number', required: true },
      { name: 'sales', label: '销量', type: 'number', required: true },
      { name: 'category', label: '分类', type: 'text', required: true },
      { name: 'serviceTags', label: '标签', type: 'checkbox-group', options: SERVICE_TAG_OPTIONS, required: true },
      { name: 'cover', label: '封面', type: 'multi-upload', required: true },
      { name: 'detailImages', label: '详情图', type: 'multi-upload', required: false }
    ]
  },
  orders: {
    title: '订单',
    listApi: '/api/orders',
    detailApi: (id) => `/api/orders/${id}`,
    detailKey: 'order',
    createApi: '/api/orders',
    updateApi: (id) => `/api/orders/${id}`,
    deleteApi: (id) => `/api/orders/${id}`,
    fields: [
      { name: 'userName', label: '用户', type: 'text', required: true },
      { name: 'totalPrice', label: '总金额', type: 'number', required: true },
      { name: 'addressName', label: '收货人', type: 'text', required: false },
      { name: 'addressPhone', label: '收货电话', type: 'text', required: false },
      { name: 'addressProvince', label: '省份', type: 'text', required: false },
      { name: 'addressCity', label: '城市', type: 'text', required: false },
      { name: 'addressDistrict', label: '区县', type: 'text', required: false },
      { name: 'addressDetail', label: '详细地址', type: 'textarea', required: false },
      { name: 'shippingAddress', label: '用户收货地址', type: 'textarea', required: false },
      { name: 'status', label: '状态', type: 'select', options: [
        { value: 'pending', label: '待支付' },
        { value: 'paid', label: '已支付' },
        { value: 'shipping', label: '配送中' },
        { value: 'delivered', label: '已签收' },
        { value: 'cancelled', label: '已取消' }
      ], required: true },
      { name: 'shippingStatus', label: '发货状态', type: 'select', options: [
        { value: 'unshipped', label: '未发货' },
        { value: 'shipped', label: '已发货' }
      ], required: false },
      { name: 'trackingNumber', label: '快递单号', type: 'text', required: false }
    ]
  },
  users: {
    title: '用户',
    listApi: '/api/users',
    detailApi: (id) => `/api/users/${id}`,
    detailKey: 'user',
    updateApi: (id) => `/api/users/${id}`,
    deleteApi: (id) => `/api/users/${id}`,
    fields: [
      { name: 'nickname', label: '用户名称', type: 'text', required: true },
      { name: 'avatar', label: '头像', type: 'upload', required: false, accept: 'image/*', uploadApi: '/api/upload' },
      { name: 'userNumber', label: '用户编号', type: 'text', required: false },
      { name: 'gender', label: '性别', type: 'select', options: [
        { value: '', label: '未设置' },
        { value: 'male', label: '男' },
        { value: 'female', label: '女' }
      ], required: false },
      { name: 'phone', label: '手机号', type: 'text', required: false },
      { name: 'addressName', label: '收货人', type: 'text', required: false },
      { name: 'addressPhone', label: '收货电话', type: 'text', required: false },
      { name: 'addressProvince', label: '省份', type: 'text', required: false },
      { name: 'addressCity', label: '城市', type: 'text', required: false },
      { name: 'addressDistrict', label: '区县', type: 'text', required: false },
      { name: 'addressDetail', label: '详细地址', type: 'textarea', required: false }
    ]
  },
  'exchange-products': {
    title: '积分兑换商品',
    listApi: '/api/exchange-products',
    detailApi: (id) => `/api/exchange-products/${id}`,
    detailKey: 'exchangeProduct',
    createApi: '/api/exchange-products',
    updateApi: (id) => `/api/exchange-products/${id}`,
    deleteApi: (id) => `/api/exchange-products/${id}`,
    fields: [
      { name: 'name', label: '商品名称', type: 'text', required: true },
      { name: 'cover', label: '商品封面', type: 'upload', required: true, accept: 'image/*', uploadApi: '/api/upload' },
      { name: 'pointsRequired', label: '所需积分', type: 'number', required: true },
      { name: 'originalPrice', label: '价值价格', type: 'number', required: true },
      { name: 'description', label: '商品描述', type: 'textarea', required: false },
      { name: 'isHot', label: '热门兑换', type: 'checkbox', required: false },
      { name: 'sort', label: '排序', type: 'number', required: false }
    ]
  }
};

function byId(id) {
  return document.getElementById(id);
}

function formatDate(input) {
  if (!input) return '-';
  const d = new Date(input);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const sec = String(d.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${min}:${sec}`;
}

function formatAddressValue(input) {
  if (!input) return '';
  if (typeof input === 'string') return input;
  if (typeof input === 'object') {
    const parts = [input.province, input.city, input.district, input.detail];
    return parts.filter(Boolean).join(' ');
  }
  return '';
}

async function request(url, options = {}) {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json'
    },
    ...options
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || '请求失败');
  }
  return await res.json();
}

async function parseErrorMessage(res, fallback) {
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await res.json().catch(() => null);
    if (data && data.message) return data.message;
  } else {
    const text = await res.text().catch(() => '');
    if (text) {
      if (text.includes('Cannot POST /api/upload/video')) {
        return '当前后端未部署视频上传接口，请重启后端服务';
      }
      return text;
    }
  }
  return fallback;
}

async function uploadFile(file, uploadApi = '/api/upload') {
  const formData = new FormData();
  formData.append('file', file);
  let res = await fetch(uploadApi, {
    method: 'POST',
    body: formData
  });
  if (!res.ok && uploadApi === '/api/upload/video' && res.status === 404) {
    res = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });
  }
  if (!res.ok) {
    const message = await parseErrorMessage(res, '上传失败');
    throw new Error(message);
  }
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.message || '上传失败');
  }
  return data;
}

function renderTable(moduleName) {
  const tableIdMap = {
    videos: 'videosTable',
    articles: 'articlesTable',
    products: 'productsTable',
    orders: 'ordersTable',
    users: 'usersTable',
    comments: 'commentsTable',
    'exchange-products': 'exchangeProductsTable'
  };
  const tbody = byId(tableIdMap[moduleName]);
  let rows = state.rows[moduleName] || [];
  
  if (moduleName === 'videos') {
    const sortType = state.videoSort || 'date-desc';
    rows = [...rows].sort((a, b) => {
      if (sortType === 'date-desc') return new Date(b.createdAt) - new Date(a.createdAt);
      if (sortType === 'date-asc') return new Date(a.createdAt) - new Date(b.createdAt);
      if (sortType === 'likes-desc') return (b.likes || 0) - (a.likes || 0);
      if (sortType === 'likes-asc') return (a.likes || 0) - (b.likes || 0);
      if (sortType === 'comments-desc') return (b.comments || 0) - (a.comments || 0);
      if (sortType === 'comments-asc') return (a.comments || 0) - (b.comments || 0);
      return 0;
    });
  }
  
  if (moduleName === 'orders') {
    if (state.orderStatusFilter) {
      rows = rows.filter(row => row.status === state.orderStatusFilter);
    }
    if (state.orderShippingStatusFilter) {
      rows = rows.filter(row => row.shippingStatus === state.orderShippingStatusFilter);
    }
  }
  
  if (moduleName === 'comments' && state.commentVideoFilter) {
    rows = rows.filter(row => row.videoId === state.commentVideoFilter);
  }
  
  tbody.innerHTML = rows.map((row) => rowTemplate(moduleName, row)).join('');
  
  if (moduleName === 'comments') {
    updateDeleteSelectedButton();
  }
  if (moduleName === 'orders') {
    updateDeleteSelectedOrdersButton();
  }
}

function rowTemplate(moduleName, row) {
  if (moduleName === 'videos') {
    return `
      <tr>
        <td>${row.title || '-'}</td>
        <td>${row.author || '-'}</td>
        <td>${row.cover ? `<img class="thumb" src="${row.cover}" alt="cover">` : '-'}</td>
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="flex: 1; word-break: break-all;">${row.videoUrl || '-'}</span>
            ${row.videoUrl && row.videoUrl.startsWith('/uploads/') ? 
              `<button class="btn" style="padding: 4px 8px; font-size: 20px;" data-action="open-folder" data-video-id="${row._id}" data-video-url="${row.videoUrl}">打开</button>` : 
              ''}
          </div>
        </td>
        <td>
          <input type="number" class="likes-input" value="${row.likes || 0}" data-id="${row._id}" min="0">
        </td>
        <td>
          <span style="cursor: pointer; color: #07c160;" class="view-comments-link" data-video-id="${row._id}">${row.comments || 0}</span>
        </td>
        <td>${actionButtons(moduleName, row._id)}</td>
      </tr>
    `;
  }
  if (moduleName === 'comments') {
    const video = state.rows.videos.find(v => v._id === row.videoId);
    const videoTitle = video ? video.title : '未知视频';
    const isChecked = state.selectedComments.includes(row._id);
    return `
      <tr>
        <td><input type="checkbox" class="comment-checkbox" data-id="${row._id}" ${isChecked ? 'checked' : ''}></td>
        <td>${row.nickname || '匿名用户'}</td>
        <td>${videoTitle}</td>
        <td>${row.content || '-'}</td>
        <td>${row.likes || 0}</td>
        <td>${formatDate(row.createdAt)}</td>
        <td>
          <button class="btn danger" data-action="delete" data-module="${moduleName}" data-id="${row._id}">删除</button>
        </td>
      </tr>
    `;
  }
  if (moduleName === 'articles') {
    return `
      <tr>
        <td>${row.title || '-'}</td>
        <td>${row.author || '-'}</td>
        <td>${row.cover ? `<img class="thumb" src="${row.cover}" alt="cover">` : '-'}</td>
        <td>${row.views || 0}</td>
        <td>${row.likes || 0}</td>
        <td>${actionButtons(moduleName, row._id)}</td>
      </tr>
    `;
  }
  if (moduleName === 'products') {
    return `
      <tr>
        <td>
          <input type="number" class="sort-input" value="${row.sort || 0}" data-id="${row._id}" min="0">
        </td>
        <td>${row.productNumber || '-'}</td>
        <td>${row.name || '-'}</td>
        <td>¥${Number(row.price || 0).toFixed(2)}</td>
        <td>¥${Number(row.originalPrice || 0).toFixed(2)}</td>
        <td>${row.stock || 0}</td>
        <td>${row.sales || 0}</td>
        <td>${row.category || '-'}</td>
        <td>${Array.isArray(row.serviceTags) && row.serviceTags.length ? row.serviceTags.join('，') : '-'}</td>
        <td>${actionButtons(moduleName, row._id)}</td>
      </tr>
    `;
  }
  if (moduleName === 'orders') {
    const productNames = Array.isArray(row.items) 
      ? row.items.map(item => item.name || '-').join('，') 
      : '-';
    const receiverName = row.address && row.address.name ? row.address.name : '-';
    const receiverPhone = row.address && row.address.phone ? row.address.phone : '-';
    const isChecked = state.selectedOrders.includes(row._id);
    return `
      <tr>
        <td><input type="checkbox" class="order-checkbox" data-id="${row._id}" ${isChecked ? 'checked' : ''}></td>
        <td>${row.orderNumber || '-'}</td>
        <td>${row.userNumber || '-'}</td>
        <td class="user-name-cell">${row.userName || '-'}</td>
        <td class="product-name-cell">${productNames}</td>
        <td>${Array.isArray(row.items) ? row.items.length : 0}</td>
        <td>¥${Number(row.totalPrice || 0).toFixed(2)}</td>
        <td>${receiverName}</td>
        <td>${receiverPhone}</td>
        <td class="address-cell">${row.shippingAddress || formatAddressValue(row.address) || '-'}</td>
        <td>${ORDER_STATUS_MAP[row.status] || row.status || '-'}</td>
        <td>${SHIPPING_STATUS_MAP[row.shippingStatus] || row.shippingStatus || '-'}</td>
        <td>${row.trackingNumber || '-'}</td>
        <td>${formatDate(row.createdAt)}</td>
        <td>${actionButtons(moduleName, row._id)}</td>
      </tr>
    `;
  }
  if (moduleName === 'users') {
    const formatAddress = (addr) => {
      if (!addr) return '-';
      if (typeof addr === 'string') return addr;
      const parts = [addr.province, addr.city, addr.district, addr.detail];
      return parts.filter(Boolean).join(' ');
    };
    
    const getDefaultAddress = (user) => {
      if (user.addresses && Array.isArray(user.addresses) && user.addresses.length > 0) {
        const defaultAddr = user.addresses.find(addr => addr.isDefault);
        return defaultAddr || user.addresses[0];
      }
      return user.address || null;
    };
    
    const defaultAddress = getDefaultAddress(row);
    const receiverName = defaultAddress && defaultAddress.name ? defaultAddress.name : '-';
    const receiverPhone = defaultAddress && defaultAddress.phone ? defaultAddress.phone : '-';
    const genderMap = { 'male': '男', 'female': '女', '': '未设置' };
    
    return `
      <tr>
        <td>${row.avatar ? `<img class="thumb" src="${row.avatar}" alt="avatar">` : '-'}</td>
        <td>${row.nickname || '-'}</td>
        <td>${row.userNumber || '-'}</td>
        <td>${row.uniqueId || '-'}</td>
        <td>${receiverName}</td>
        <td>${receiverPhone}</td>
        <td>${genderMap[row.gender] || '未设置'}</td>
        <td class="address-cell">${formatAddress(defaultAddress)}</td>
        <td>¥${Number(row.totalSpent || 0).toFixed(2)}</td>
        <td>${actionButtons(moduleName, row._id)}</td>
      </tr>
    `;
  }
  if (moduleName === 'exchange-products') {
    return `
      <tr>
        <td>
          <input type="number" class="sort-input" value="${row.sort || 0}" data-id="${row._id}" min="0">
        </td>
        <td>${row.name || '-'}</td>
        <td>${row.cover ? `<img class="thumb" src="${row.cover}" alt="cover">` : '-'}</td>
        <td>${row.pointsRequired || 0} 积分</td>
        <td>¥${Number(row.originalPrice || 0).toFixed(2)}</td>
        <td>${row.isHot ? '是' : '否'}</td>
        <td>${actionButtons(moduleName, row._id)}</td>
      </tr>
    `;
  }
  return '';
}

function actionButtons(moduleName, id) {
  if (moduleName === 'orders') {
    return `
      <div class="cell-actions">
        <button class="btn" data-action="edit" data-module="${moduleName}" data-id="${id}">修改</button>
      </div>
    `;
  }
  return `
    <div class="cell-actions">
      <button class="btn" data-action="edit" data-module="${moduleName}" data-id="${id}">编辑</button>
      <button class="btn danger" data-action="delete" data-module="${moduleName}" data-id="${id}">删除</button>
    </div>
  `;
}

async function fetchModule(moduleName) {
  if (moduleName === 'ui-config') {
    await fetchUiConfig();
    return;
  }
  const config = moduleConfig[moduleName];
  let url = config.listApi;
  if (moduleName === 'comments' && state.commentVideoFilter) {
    url += `?videoId=${state.commentVideoFilter}`;
  }
  const data = await request(url);
  const payloadMap = {
    videos: data.videos || [],
    articles: data.articles || [],
    products: data.products || [],
    orders: data.orders || [],
    users: data.users || [],
    comments: data.comments || [],
    'exchange-products': data.exchangeProducts || []
  };
  state.rows[moduleName] = payloadMap[moduleName];
  renderTable(moduleName);
  
  if (moduleName === 'videos') {
    updateCommentVideoFilterOptions();
  }
}

async function refreshAll() {
  await Promise.all([
    fetchModule('videos'),
    fetchModule('articles'),
    fetchModule('products'),
    fetchModule('orders'),
    fetchModule('users'),
    fetchModule('comments'),
    fetchModule('exchange-products'),
    fetchPointsUsers()
  ]);
  loadedModules.add('videos');
  loadedModules.add('articles');
  loadedModules.add('products');
  loadedModules.add('orders');
  loadedModules.add('users');
  loadedModules.add('comments');
  loadedModules.add('exchange-products');
  loadedModules.add('points');
}

async function ensureModuleData(moduleName, force = false) {
  if (!force && loadedModules.has(moduleName)) {
    return;
  }
  if (!force && moduleLoadingTasks[moduleName]) {
    return moduleLoadingTasks[moduleName];
  }
  const loadTask = (async () => {
    if (moduleName === 'points') {
      await fetchPointsUsers();
    } else {
      await fetchModule(moduleName);
    }
    loadedModules.add(moduleName);
  })();
  moduleLoadingTasks[moduleName] = loadTask;
  try {
    await loadTask;
  } finally {
    delete moduleLoadingTasks[moduleName];
  }
}

function switchModule(moduleName) {
  state.module = moduleName;
  document.querySelectorAll('.menu-item').forEach((node) => {
    node.classList.toggle('active', node.dataset.module === moduleName);
  });
  document.querySelectorAll('.module').forEach((node) => {
    node.classList.toggle('active', node.id === `${moduleName}Module`);
  });
  if (moduleName === 'videos') {
    updateDeleteSelectedButton();
    ensureModuleData('videos').catch((error) => {
      alert(error.message || '加载视频数据失败');
    });
    ensureModuleData('comments').catch((error) => {
      alert(error.message || '加载评论数据失败');
    });
  }
  if (moduleName === 'points') {
    ensureModuleData('points').catch((error) => {
      alert(error.message || '加载积分数据失败');
    });
    return;
  }
  if (moduleName !== 'videos') {
    ensureModuleData(moduleName).catch((error) => {
      alert(error.message || '加载模块数据失败');
    });
  }
}

function createFieldRow(field, value) {
  if (field.type === 'multi-upload') {
    let images = [];
    if (Array.isArray(value) && value.length > 0) {
      images = value;
    } else if (typeof value === 'string' && value) {
      images = [value];
    }
    return `
      <div class="form-row">
        <label>${field.label}</label>
        <div class="multi-upload-wrap" data-field="${field.name}">
          <div class="multi-upload-list">
            ${images.map((img, idx) => `
              <div class="multi-upload-item" draggable="true" data-idx="${idx}">
                <img src="${img}" alt="">
                <div class="drag-handle">⋮⋮</div>
                <button type="button" class="btn danger remove-image-btn" data-idx="${idx}">删除</button>
                <input type="hidden" name="${field.name}" value="${img}">
              </div>
            `).join('')}
          </div>
          <div class="multi-upload-add">
            <input type="file" data-multi-upload-for="${field.name}" multiple accept="image/*">
            <button type="button" class="btn">添加图片</button>
          </div>
        </div>
      </div>
    `;
  }
  if (field.type === 'upload') {
    const uploadApi = field.uploadApi || '/api/upload';
    const accept = field.accept || '*/*';
    return `
      <div class="form-row">
        <label>${field.label}</label>
        <div class="file-row">
          <input type="text" name="${field.name}" value="${value || ''}" placeholder="上传后自动回填，或直接粘贴URL">
          <input type="file" data-upload-for="${field.name}" data-upload-api="${uploadApi}" accept="${accept}">
        </div>
      </div>
    `;
  }
  if (field.type === 'textarea') {
    return `
      <div class="form-row">
        <label>${field.label}</label>
        <textarea name="${field.name}" placeholder="请输入${field.label}">${value || ''}</textarea>
      </div>
    `;
  }
  if (field.type === 'select') {
    return `
      <div class="form-row">
        <label>${field.label}</label>
        <select name="${field.name}">
          ${(field.options || []).map((item) => {
            const optionValue = typeof item === 'object' ? item.value : item;
            const optionLabel = typeof item === 'object' ? item.label : item;
            return `<option value="${optionValue}" ${optionValue === value ? 'selected' : ''}>${optionLabel}</option>`;
          }).join('')}
        </select>
      </div>
    `;
  }
  if (field.type === 'checkbox-group') {
    const selected = Array.isArray(value) && value.length > 0 ? value : (field.options || []);
    return `
      <div class="form-row">
        <label>${field.label}</label>
        <div class="checkbox-group">
          ${(field.options || []).map((option) => `
            <label class="checkbox-item">
              <input type="checkbox" name="${field.name}" value="${option}" ${selected.includes(option) ? 'checked' : ''}>
              <span>${option}</span>
            </label>
          `).join('')}
        </div>
      </div>
    `;
  }
  const inputType = field.type === 'number' ? 'number' : 'text';
  return `
    <div class="form-row">
      <label>${field.label}</label>
      <input type="${inputType}" name="${field.name}" value="${value ?? ''}" placeholder="请输入${field.label}">
    </div>
  `;
}

async function resolveEditRow(moduleName, id = '') {
  if (!id) return {};
  const config = moduleConfig[moduleName];
  if (typeof config.detailApi === 'function' && config.detailKey) {
    const detailData = await request(config.detailApi(id));
    if (detailData && detailData.success && detailData[config.detailKey]) {
      if (moduleName === 'orders') {
        const order = detailData[config.detailKey];
        return {
          ...order,
          shippingAddress: order.shippingAddress || formatAddressValue(order.address)
        };
      }
      return detailData[config.detailKey];
    }
  }
  return state.rows[moduleName].find((item) => item._id === id) || {};
}

async function openEditor(moduleName, id = '') {
  state.editingModule = moduleName;
  state.editingId = id;
  const config = moduleConfig[moduleName];
  const row = await resolveEditRow(moduleName, id);
  
  byId('modalTitle').textContent = `${id ? '编辑' : '新增'}${config.title}`;
  
  let processedRow = { ...row };
  
  if (moduleName === 'videos') {
    if (!id) {
      processedRow.author = '琯溪义门陈';
      processedRow.cover = '0';
    }
  }
  
  if ((moduleName === 'users' || moduleName === 'orders')) {
    let addr = row.address;
    if (moduleName === 'users' && row.addresses && Array.isArray(row.addresses) && row.addresses.length > 0) {
      const defaultAddr = row.addresses.find(a => a.isDefault);
      addr = defaultAddr || row.addresses[0];
    }
    if (addr) {
      processedRow = {
        ...processedRow,
        addressName: addr.name || '',
        addressPhone: addr.phone || '',
        addressProvince: addr.province || '',
        addressCity: addr.city || '',
        addressDistrict: addr.district || '',
        addressDetail: addr.detail || ''
      };
    }
  }
  
  const html = config.fields.map((field) => createFieldRow(field, processedRow[field.name])).join('');
  byId('editForm').innerHTML = html;
  byId('editModal').classList.add('show');
  byId('submitEdit').textContent = id ? '更新' : '创建';

  byId('editForm').querySelectorAll('input[type="file"][data-upload-for]').forEach((input) => {
    input.addEventListener('change', async (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      try {
        const uploadApi = input.dataset.uploadApi || '/api/upload';
        const data = await uploadFile(file, uploadApi);
        const url = data.url;
        const targetName = input.dataset.uploadFor;
        const target = byId('editForm').querySelector(`input[name="${targetName}"]`);
        if (target) target.value = url;
        
        if (data.coverUrl) {
          const coverInput = byId('editForm').querySelector('input[name="cover"]');
          if (coverInput) {
            coverInput.value = data.coverUrl;
          }
        }
      } catch (error) {
        alert(error.message || '上传失败');
      }
    });
  });

  byId('editForm').querySelectorAll('input[type="file"][data-multi-upload-for]').forEach((input) => {
    const addBtn = input.nextElementSibling;
    if (addBtn) {
      addBtn.addEventListener('click', () => input.click());
    }

    input.addEventListener('change', async (event) => {
      const files = event.target.files;
      if (!files || files.length === 0) return;
      
      const fieldName = input.dataset.multiUploadFor;
      const wrap = byId('editForm').querySelector(`[data-field="${fieldName}"]`);
      const list = wrap.querySelector('.multi-upload-list');
      
      try {
        for (const file of files) {
          const data = await uploadFile(file);
          const url = data.url;
          const itemDiv = document.createElement('div');
          itemDiv.className = 'multi-upload-item';
          itemDiv.draggable = true;
          const currentIdx = list.children.length;
          itemDiv.dataset.idx = currentIdx;
          itemDiv.innerHTML = `
            <img src="${url}" alt="">
            <div class="drag-handle">⋮⋮</div>
            <button type="button" class="btn danger remove-image-btn" data-idx="${currentIdx}">删除</button>
            <input type="hidden" name="${fieldName}" value="${url}">
          `;
          list.appendChild(itemDiv);
        }
        bindRemoveImageButtons();
        initDragAndDrop();
      } catch (error) {
        alert(error.message || '上传失败');
      }
      
      event.target.value = '';
    });
  });

  bindRemoveImageButtons();
  initDragAndDrop();
}

function bindRemoveImageButtons() {
  const editForm = byId('editForm');
  if (!editForm) return;
  editForm.querySelectorAll('.remove-image-btn').forEach((btn) => {
    btn.onclick = (e) => {
      const item = e.target.closest('.multi-upload-item');
      if (item) item.remove();
    };
  });
}

let draggedItem = null;

function initDragAndDrop() {
  const editForm = byId('editForm');
  if (!editForm) return;
  
  const items = editForm.querySelectorAll('.multi-upload-item');
  
  items.forEach(item => {
    item.removeEventListener('dragstart', onDragStart);
    item.removeEventListener('dragend', onDragEnd);
    item.removeEventListener('dragover', onDragOver);
    item.removeEventListener('dragenter', onDragEnter);
    item.removeEventListener('dragleave', onDragLeave);
    item.removeEventListener('drop', onDrop);
    
    item.addEventListener('dragstart', onDragStart);
    item.addEventListener('dragend', onDragEnd);
    item.addEventListener('dragover', onDragOver);
    item.addEventListener('dragenter', onDragEnter);
    item.addEventListener('dragleave', onDragLeave);
    item.addEventListener('drop', onDrop);
  });
}

function onDragStart(e) {
  draggedItem = this;
  setTimeout(() => {
    this.style.opacity = '0.5';
  }, 0);
  e.dataTransfer.effectAllowed = 'move';
}

function onDragEnd() {
  this.style.opacity = '1';
  const editForm = byId('editForm');
  if (!editForm) return;
  editForm.querySelectorAll('.multi-upload-item').forEach(item => {
    item.style.border = '';
  });
}

function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function onDragEnter(e) {
  if (this !== draggedItem) {
    this.style.border = '2px dashed #2580ff';
  }
}

function onDragLeave() {
  this.style.border = '';
}

function onDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  
  if (this !== draggedItem) {
    const list = this.parentNode;
    const items = Array.from(list.children);
    const fromIndex = items.indexOf(draggedItem);
    const toIndex = items.indexOf(this);
    
    if (fromIndex < toIndex) {
      list.insertBefore(draggedItem, this.nextSibling);
    } else {
      list.insertBefore(draggedItem, this);
    }
  }
  
  this.style.border = '';
}

function closeEditor() {
  byId('editModal').classList.remove('show');
  byId('editForm').innerHTML = '';
  state.editingModule = '';
  state.editingId = '';
}

function formToPayload(moduleName) {
  const config = moduleConfig[moduleName];
  const form = byId('editForm');
  const payload = {};
  for (const field of config.fields) {
    if (field.type === 'multi-upload') {
      const nodes = form.querySelectorAll(`input[name="${field.name}"]`);
      const values = Array.from(nodes).map((node) => node.value.trim()).filter(Boolean);
      payload[field.name] = values;
      continue;
    }
    const node = form.querySelector(`[name="${field.name}"]`);
    let value = node ? node.value.trim() : '';
    if (field.type === 'checkbox-group') {
      value = Array.from(form.querySelectorAll(`input[name="${field.name}"]:checked`)).map((item) => item.value);
    }
    if (field.required && !value) {
      throw new Error(`请填写${field.label}`);
    }
    if (field.required && field.type === 'checkbox-group' && value.length === 0) {
      throw new Error(`请至少选择一个${field.label}`);
    }
    payload[field.name] = field.type === 'number' ? Number(value || 0) : value;
  }
  if (moduleName === 'orders') {
    payload.shippingAddress = payload.shippingAddress || '';
  }
  if (moduleName === 'users' || moduleName === 'orders') {
    const addressName = payload.addressName;
    const addressPhone = payload.addressPhone;
    const addressProvince = payload.addressProvince;
    const addressCity = payload.addressCity;
    const addressDistrict = payload.addressDistrict;
    const addressDetail = payload.addressDetail;
    
    delete payload.addressName;
    delete payload.addressPhone;
    delete payload.addressProvince;
    delete payload.addressCity;
    delete payload.addressDistrict;
    delete payload.addressDetail;
    
    if (addressName || addressPhone || addressProvince || addressCity || addressDistrict || addressDetail) {
      const newAddress = {
        id: Date.now(),
        name: addressName || '',
        phone: addressPhone || '',
        province: addressProvince || '',
        city: addressCity || '',
        district: addressDistrict || '',
        detail: addressDetail || '',
        isDefault: true
      };
      
      if (moduleName === 'users') {
        const originalRow = state.rows[moduleName].find((item) => item._id === state.editingId) || {};
        let addresses = originalRow.addresses || [];
        addresses = addresses.map(addr => ({ ...addr, isDefault: false }));
        addresses = [newAddress, ...addresses.filter(a => a.id !== newAddress.id)];
        payload.addresses = addresses;
      } else {
        payload.address = newAddress;
      }
    }
  }
  if (moduleName === 'articles' && !payload.content) {
    payload.content = payload.summary;
  }
  if (moduleName === 'videos') {
    payload.likes = 0;
    payload.comments = 0;
  }
  return payload;
}

async function submitEditor() {
  const moduleName = state.editingModule;
  if (!moduleName) return;
  const config = moduleConfig[moduleName];
  const payload = formToPayload(moduleName);
  if (moduleName === 'orders' && !state.editingId) {
    throw new Error('请在订单列表中选择要修改的订单');
  }
  if (state.editingId) {
    await request(config.updateApi(state.editingId), {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  } else {
    await request(config.createApi, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }
  closeEditor();
  await fetchModule(moduleName);
}

async function openMainOrderEditor() {
  if (!state.rows.orders.length) {
    await fetchModule('orders');
  }
  const targetOrder = state.rows.orders[0];
  if (!targetOrder) {
    throw new Error('暂无订单可修改，请先在前端创建订单');
  }
  await openEditor('orders', targetOrder._id);
}

async function exportOrders() {
  const res = await fetch('/api/orders/export');
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || '导出失败');
  }
  const disposition = res.headers.get('content-disposition') || '';
  const match = disposition.match(/filename="?([^"]+)"?/i);
  const filename = match && match[1] ? match[1] : `orders-export-${Date.now()}.xls`;
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

async function importOrders(file) {
  const formData = new FormData();
  formData.append('file', file);
  
  const res = await fetch('/api/orders/import', {
    method: 'POST',
    body: formData
  });
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || '导入失败');
  }
  
  const data = await res.json();
  alert(`导入成功！共处理 ${data.imported} 条，成功更新 ${data.updated} 条，未找到 ${data.notFound} 条`);
  await fetchModule('orders');
}

async function deleteRow(moduleName, id) {
  const config = moduleConfig[moduleName];
  const ok = window.confirm('确认删除该记录？');
  if (!ok) return;
  await request(config.deleteApi(id), { method: 'DELETE' });
  await fetchModule(moduleName);
}

async function deleteSelectedComments() {
  if (state.selectedComments.length === 0) {
    alert('请先选择要删除的评论');
    return;
  }
  const ok = window.confirm(`确认删除选中的 ${state.selectedComments.length} 条评论？`);
  if (!ok) return;
  await request('/api/admin/comments', {
    method: 'DELETE',
    body: JSON.stringify({ ids: state.selectedComments })
  });
  state.selectedComments = [];
  await fetchModule('comments');
  updateDeleteSelectedButton();
}

function updateDeleteSelectedButton() {
  const btn = byId('deleteSelectedCommentsBtn');
  if (btn) {
    btn.style.display = state.selectedComments.length > 0 ? 'inline-block' : 'none';
  }
  const selectAllCheckbox = byId('selectAllComments');
  if (selectAllCheckbox && state.module === 'videos') {
    let rows = state.rows.comments || [];
    if (state.commentVideoFilter) {
      rows = rows.filter(row => row.videoId === state.commentVideoFilter);
    }
    selectAllCheckbox.checked = rows.length > 0 && rows.every(row => state.selectedComments.includes(row._id));
  }
}

function toggleCommentSelection(commentId) {
  const index = state.selectedComments.indexOf(commentId);
  if (index >= 0) {
    state.selectedComments.splice(index, 1);
  } else {
    state.selectedComments.push(commentId);
  }
  updateDeleteSelectedButton();
}

function toggleSelectAllComments() {
  const selectAllCheckbox = byId('selectAllComments');
  let rows = state.rows.comments || [];
  if (state.commentVideoFilter) {
    rows = rows.filter(row => row.videoId === state.commentVideoFilter);
  }
  if (selectAllCheckbox && selectAllCheckbox.checked) {
    state.selectedComments = rows.map(row => row._id);
  } else {
    state.selectedComments = [];
  }
  renderTable('comments');
  updateDeleteSelectedButton();
}

function updateDeleteSelectedOrdersButton() {
  const btn = byId('deleteSelectedOrdersBtn');
  if (btn) {
    btn.style.display = state.selectedOrders.length > 0 ? 'inline-block' : 'none';
  }
  const selectAllCheckbox = byId('selectAllOrders');
  if (selectAllCheckbox && state.module === 'orders') {
    let rows = state.rows.orders || [];
    if (state.orderStatusFilter) {
      rows = rows.filter(row => row.status === state.orderStatusFilter);
    }
    if (state.orderShippingStatusFilter) {
      rows = rows.filter(row => row.shippingStatus === state.orderShippingStatusFilter);
    }
    selectAllCheckbox.checked = rows.length > 0 && rows.every(row => state.selectedOrders.includes(row._id));
  }
}

function toggleOrderSelection(orderId) {
  const index = state.selectedOrders.indexOf(orderId);
  if (index >= 0) {
    state.selectedOrders.splice(index, 1);
  } else {
    state.selectedOrders.push(orderId);
  }
  updateDeleteSelectedOrdersButton();
}

function toggleSelectAllOrders() {
  const selectAllCheckbox = byId('selectAllOrders');
  let rows = state.rows.orders || [];
  if (state.orderStatusFilter) {
    rows = rows.filter(row => row.status === state.orderStatusFilter);
  }
  if (state.orderShippingStatusFilter) {
    rows = rows.filter(row => row.shippingStatus === state.orderShippingStatusFilter);
  }
  if (selectAllCheckbox && selectAllCheckbox.checked) {
    state.selectedOrders = rows.map(row => row._id);
  } else {
    state.selectedOrders = [];
  }
  renderTable('orders');
  updateDeleteSelectedOrdersButton();
}

async function deleteSelectedOrders() {
  if (state.selectedOrders.length === 0) {
    alert('请先选择要删除的订单');
    return;
  }
  const ok = window.confirm(`确认删除选中的 ${state.selectedOrders.length} 条订单？`);
  if (!ok) return;
  await request('/api/orders', {
    method: 'DELETE',
    body: JSON.stringify({ ids: state.selectedOrders })
  });
  state.selectedOrders = [];
  await fetchModule('orders');
  updateDeleteSelectedOrdersButton();
}

async function syncFrontendData() {
  const data = await request('/data/mock.js', { headers: {} }).catch(() => null);
  if (!data) {
    const bootstrapPayload = {
      products: [],
      articles: [],
      videos: [],
      orders: [],
      force: false
    };
    await request('/api/bootstrap', {
      method: 'POST',
      body: JSON.stringify(bootstrapPayload)
    });
    return;
  }
}


async function fetchUiConfig() {
  const res = await request('/api/ui-config');
  if (res.success && res.config) {
    const shopBanners = Array.isArray(res.config.shopBanners) ? res.config.shopBanners : [];
    const banner1 = shopBanners[0] || {};
    const banner2 = shopBanners[1] || {};

    byId('uiShopBanner1ImageInput').value = banner1.image || '';
    byId('uiShopBanner1TargetInput').value = banner1.targetPage || '';
    byId('uiShopBanner1TitleInput').value = banner1.title || '';
    byId('uiShopBanner1SubtitleInput').value = banner1.subtitle || '';
    byId('uiShopBanner1BtnTextInput').value = banner1.btnText || '立即抢购';
    byId('uiShopBanner1BtnColorInput').value = banner1.btnColor || '#ffc107';
    if (banner1.image) {
      byId('uiShopBanner1Preview').src = banner1.image;
      byId('uiShopBanner1Preview').style.display = 'block';
    } else {
      byId('uiShopBanner1Preview').style.display = 'none';
    }

    byId('uiShopBanner2ImageInput').value = banner2.image || '';
    byId('uiShopBanner2TargetInput').value = banner2.targetPage || '';
    byId('uiShopBanner2TitleInput').value = banner2.title || '';
    byId('uiShopBanner2SubtitleInput').value = banner2.subtitle || '';
    byId('uiShopBanner2BtnTextInput').value = banner2.btnText || '立即抢购';
    byId('uiShopBanner2BtnColorInput').value = banner2.btnColor || '#ffc107';
    if (banner2.image) {
      byId('uiShopBanner2Preview').src = banner2.image;
      byId('uiShopBanner2Preview').style.display = 'block';
    } else {
      byId('uiShopBanner2Preview').style.display = 'none';
    }

    byId('uiAvatarInput').value = res.config.defaultAvatar || '';
    if (res.config.defaultAvatar) {
      byId('uiAvatarPreview').src = res.config.defaultAvatar;
      byId('uiAvatarPreview').style.display = 'block';
    } else {
      byId('uiAvatarPreview').style.display = 'none';
    }

    byId('uiPublisherAvatarInput').value = res.config.publisherAvatar || '';
    if (res.config.publisherAvatar) {
      byId('uiPublisherAvatarPreview').src = res.config.publisherAvatar;
      byId('uiPublisherAvatarPreview').style.display = 'block';
    } else {
      byId('uiPublisherAvatarPreview').style.display = 'none';
    }

    byId('uiThemeColorInput').value = res.config.themeColor || '#07c160';
    byId('uiTabBarInput').value = JSON.stringify(res.config.tabBar || [], null, 2);
  }
}

async function saveUiConfig() {
  const shopBanner1Image = byId('uiShopBanner1ImageInput').value.trim();
  const shopBanner1TargetPage = byId('uiShopBanner1TargetInput').value.trim();
  const shopBanner1Title = byId('uiShopBanner1TitleInput').value.trim();
  const shopBanner1Subtitle = byId('uiShopBanner1SubtitleInput').value.trim();
  const shopBanner1BtnText = byId('uiShopBanner1BtnTextInput').value.trim() || '立即抢购';
  const shopBanner1BtnColor = byId('uiShopBanner1BtnColorInput').value || '#ffc107';
  
  const shopBanner2Image = byId('uiShopBanner2ImageInput').value.trim();
  const shopBanner2TargetPage = byId('uiShopBanner2TargetInput').value.trim();
  const shopBanner2Title = byId('uiShopBanner2TitleInput').value.trim();
  const shopBanner2Subtitle = byId('uiShopBanner2SubtitleInput').value.trim();
  const shopBanner2BtnText = byId('uiShopBanner2BtnTextInput').value.trim() || '立即抢购';
  const shopBanner2BtnColor = byId('uiShopBanner2BtnColorInput').value || '#ffc107';
  
  const defaultAvatar = byId('uiAvatarInput').value.trim();
  const publisherAvatar = byId('uiPublisherAvatarInput').value.trim();
  const themeColor = byId('uiThemeColorInput').value;
  
  let tabBar;
  const tabBarText = byId('uiTabBarInput').value.trim();
  
  try {
    if (tabBarText) {
      tabBar = JSON.parse(tabBarText);
    } else {
      const res = await request('/api/ui-config');
      tabBar = res.config?.tabBar || [];
    }
  } catch (e) {
    const res = await request('/api/ui-config');
    tabBar = res.config?.tabBar || [];
  }

  const payload = {
    shopBanners: [
      { 
        id: 1, 
        image: shopBanner1Image, 
        targetPage: shopBanner1TargetPage,
        title: shopBanner1Title,
        subtitle: shopBanner1Subtitle,
        btnText: shopBanner1BtnText,
        btnColor: shopBanner1BtnColor
      },
      { 
        id: 2, 
        image: shopBanner2Image, 
        targetPage: shopBanner2TargetPage,
        title: shopBanner2Title,
        subtitle: shopBanner2Subtitle,
        btnText: shopBanner2BtnText,
        btnColor: shopBanner2BtnColor
      }
    ],
    defaultAvatar,
    publisherAvatar,
    themeColor,
    tabBar
  };

  await request('/api/ui-config', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  alert('UI 配置已保存');
}

function bindUiEvents() {
  byId('saveUiConfigBtn').addEventListener('click', async () => {
    try {
      await saveUiConfig();
    } catch (e) {
      alert(e.message || '保存失败');
    }
  });

  const setupFileUpload = (fileInputId, textInputId, previewId) => {
    byId(fileInputId).addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        const data = await uploadFile(file);
        const url = data.url;
        byId(textInputId).value = url;
        const preview = byId(previewId);
        if (preview) {
          preview.src = url;
          preview.style.display = 'block';
        }
      } catch (error) {
        alert(error.message || '上传失败');
      }
    });
  };

  setupFileUpload('uiShopBanner1File', 'uiShopBanner1ImageInput', 'uiShopBanner1Preview');
  setupFileUpload('uiShopBanner2File', 'uiShopBanner2ImageInput', 'uiShopBanner2Preview');
  setupFileUpload('uiAvatarFile', 'uiAvatarInput', 'uiAvatarPreview');
  setupFileUpload('uiPublisherAvatarFile', 'uiPublisherAvatarInput', 'uiPublisherAvatarPreview');
}

function updateCommentVideoFilterOptions() {
  const select = byId('commentVideoFilter');
  if (!select) return;
  const currentValue = select.value;
  select.innerHTML = '<option value="">全部</option>';
  state.rows.videos.forEach((video) => {
    const option = document.createElement('option');
    option.value = video._id;
    option.textContent = video.title;
    select.appendChild(option);
  });
  select.value = currentValue;
}

function bindEvents() {
  bindUiEvents();
  
  const videoSortSelect = byId('videoSortSelect');
  if (videoSortSelect) {
    videoSortSelect.addEventListener('change', (event) => {
      state.videoSort = event.target.value;
      renderTable('videos');
    });
  }
  const orderStatusFilter = byId('orderStatusFilter');
  if (orderStatusFilter) {
    orderStatusFilter.addEventListener('change', (event) => {
      state.orderStatusFilter = event.target.value;
      renderTable('orders');
    });
  }
  
  const orderShippingStatusFilter = byId('orderShippingStatusFilter');
  if (orderShippingStatusFilter) {
    orderShippingStatusFilter.addEventListener('change', (event) => {
      state.orderShippingStatusFilter = event.target.value;
      renderTable('orders');
    });
  }
  
  const commentVideoFilter = byId('commentVideoFilter');
  if (commentVideoFilter) {
    commentVideoFilter.addEventListener('change', async (event) => {
      state.commentVideoFilter = event.target.value;
      state.selectedComments = [];
      await fetchModule('comments');
      updateDeleteSelectedButton();
    });
  }

  const selectAllCommentsCheckbox = byId('selectAllComments');
  if (selectAllCommentsCheckbox) {
    selectAllCommentsCheckbox.addEventListener('change', toggleSelectAllComments);
  }

  const deleteSelectedCommentsBtn = byId('deleteSelectedCommentsBtn');
  if (deleteSelectedCommentsBtn) {
    deleteSelectedCommentsBtn.addEventListener('click', async () => {
      try {
        await deleteSelectedComments();
      } catch (error) {
        alert(error.message || '批量删除失败');
      }
    });
  }

  const selectAllOrdersCheckbox = byId('selectAllOrders');
  if (selectAllOrdersCheckbox) {
    selectAllOrdersCheckbox.addEventListener('change', toggleSelectAllOrders);
  }

  const deleteSelectedOrdersBtn = byId('deleteSelectedOrdersBtn');
  if (deleteSelectedOrdersBtn) {
    deleteSelectedOrdersBtn.addEventListener('click', async () => {
      try {
        await deleteSelectedOrders();
      } catch (error) {
        alert(error.message || '批量删除失败');
      }
    });
  }

  document.body.addEventListener('change', (event) => {
    const target = event.target;
    if (target.classList.contains('comment-checkbox')) {
      const commentId = target.dataset.id;
      toggleCommentSelection(commentId);
      const selectAllCheckbox = byId('selectAllComments');
      let rows = state.rows.comments || [];
      if (state.commentVideoFilter) {
        rows = rows.filter(row => row.videoId === state.commentVideoFilter);
      }
      if (selectAllCheckbox) {
        selectAllCheckbox.checked = rows.length > 0 && rows.every(row => state.selectedComments.includes(row._id));
      }
    }
    if (target.classList.contains('order-checkbox')) {
      const orderId = target.dataset.id;
      toggleOrderSelection(orderId);
      const selectAllCheckbox = byId('selectAllOrders');
      let rows = state.rows.orders || [];
      if (state.orderStatusFilter) {
        rows = rows.filter(row => row.status === state.orderStatusFilter);
      }
      if (state.orderShippingStatusFilter) {
        rows = rows.filter(row => row.shippingStatus === state.orderShippingStatusFilter);
      }
      if (selectAllCheckbox) {
        selectAllCheckbox.checked = rows.length > 0 && rows.every(row => state.selectedOrders.includes(row._id));
      }
    }
  }, true);
  
  document.body.addEventListener('click', async (event) => {
    const target = event.target;
    if (target.classList.contains('view-comments-link')) {
      const videoId = target.dataset.videoId;
      state.commentVideoFilter = videoId;
      state.selectedComments = [];
      await switchModule('videos');
      const select = byId('commentVideoFilter');
      if (select) {
        select.value = videoId;
      }
      await fetchModule('comments');
      updateDeleteSelectedButton();
      const panel = byId('videoCommentsPanel');
      if (panel) {
        panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, true);

  document.querySelectorAll('.menu-item').forEach((node) => {
    node.addEventListener('click', () => switchModule(node.dataset.module));
  });

  document.querySelectorAll('[data-action="create"]').forEach((node) => {
    node.addEventListener('click', async () => {
      try {
        await openEditor(node.dataset.module);
      } catch (error) {
        alert(error.message || '打开编辑器失败');
      }
    });
  });

  document.querySelectorAll('[data-action="edit-main"]').forEach((node) => {
    node.addEventListener('click', async () => {
      if (node.dataset.module !== 'orders') return;
      try {
        await openMainOrderEditor();
      } catch (error) {
        alert(error.message || '打开订单失败');
      }
    });
  });

  document.body.addEventListener('blur', async (event) => {
    const target = event.target;
    if (target.classList.contains('sort-input')) {
      const id = target.dataset.id;
      const sortValue = parseInt(target.value, 10);
      if (isNaN(sortValue) || sortValue < 0) {
        alert('请输入有效的排序数字（大于等于0）');
        return;
      }
      try {
        const module = state.module;
        const apiPath = module === 'products' ? `/api/products/${id}` : `/api/exchange-products/${id}`;
        await request(apiPath, {
          method: 'PUT',
          body: JSON.stringify({ sort: sortValue })
        });
        await fetchModule(module);
      } catch (error) {
        alert(error.message || '排序保存失败');
      }
    }
    if (target.classList.contains('likes-input')) {
      const videoId = target.dataset.id;
      const likesValue = parseInt(target.value, 10);
      if (isNaN(likesValue) || likesValue < 0) {
        alert('请输入有效的点赞数量（大于等于0）');
        return;
      }
      try {
        await request(`/api/videos/${videoId}`, {
          method: 'PUT',
          body: JSON.stringify({ likes: likesValue })
        });
        await fetchModule('videos');
      } catch (error) {
        alert(error.message || '点赞数量保存失败');
      }
    }
  }, true);

  document.body.addEventListener('click', async (event) => {
    const target = event.target;
    const action = target.dataset.action;
    const moduleName = target.dataset.module;
    const id = target.dataset.id;
    
    if (action === 'open-folder') {
      const videoUrl = target.dataset.videoUrl;
      try {
        await request('/api/videos/open-folder', {
          method: 'POST',
          body: JSON.stringify({ videoUrl })
        });
      } catch (error) {
        alert(error.message || '打开文件夹失败');
      }
      return;
    }
    
    if (action === 'adjust-points') {
      const userId = target.dataset.userId;
      const userName = target.dataset.userName;
      const currentPoints = target.dataset.currentPoints;
      openPointsAdjustModal(userId, userName, currentPoints);
      return;
    }
    
    if (action === 'view-consume-history') {
      const userId = target.dataset.userId;
      const userName = target.dataset.userName;
      openPointsConsumeHistoryModal(userId, userName);
      return;
    }
    

    
    if (!action || !moduleName) return;
    if (action === 'edit') {
      try {
        await openEditor(moduleName, id);
      } catch (error) {
        alert(error.message || '打开编辑器失败');
      }
      return;
    }
    if (action === 'delete') {
      try {
        await deleteRow(moduleName, id);
      } catch (error) {
        alert(error.message || '删除失败');
      }
      return;
    }
    
    if (action === 'adjust-points') {
      const userId = target.dataset.userId;
      const userName = target.dataset.userName;
      const currentPoints = target.dataset.currentPoints;
      openPointsAdjustModal(userId, userName, currentPoints);
      return;
    }
  });

  byId('cancelEdit').addEventListener('click', (event) => {
    event.preventDefault();
    closeEditor();
  });
  
  const closeEditBtn = byId('closeEdit');
  if (closeEditBtn) {
    closeEditBtn.addEventListener('click', () => {
      closeEditor();
    });
  }

  const cancelPointsAdjustBtn = byId('cancelPointsAdjust');
  if (cancelPointsAdjustBtn) {
    cancelPointsAdjustBtn.addEventListener('click', () => {
      closePointsAdjustModal();
    });
  }

  const closePointsAdjustBtn = byId('closePointsAdjust');
  if (closePointsAdjustBtn) {
    closePointsAdjustBtn.addEventListener('click', () => {
      closePointsAdjustModal();
    });
  }

  const submitPointsAdjustBtn = byId('submitPointsAdjust');
  if (submitPointsAdjustBtn) {
    submitPointsAdjustBtn.addEventListener('click', async () => {
      await submitPointsAdjust();
    });
  }

  const cancelPointsConsumeHistoryBtn = byId('cancelPointsConsumeHistory');
  if (cancelPointsConsumeHistoryBtn) {
    cancelPointsConsumeHistoryBtn.addEventListener('click', () => {
      closePointsConsumeHistoryModal();
    });
  }

  const closePointsConsumeHistoryBtn = byId('closePointsConsumeHistory');
  if (closePointsConsumeHistoryBtn) {
    closePointsConsumeHistoryBtn.addEventListener('click', () => {
      closePointsConsumeHistoryModal();
    });
  }



  document.querySelectorAll('.points-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      switchPointsTab(btn.dataset.tab);
    });
  });

  byId('submitEdit').addEventListener('click', async (event) => {
    event.preventDefault();
    try {
      await submitEditor();
    } catch (error) {
      alert(error.message || '保存失败');
    }
  });

  byId('refreshBtn').addEventListener('click', async () => {
    try {
      await refreshAll();
      alert('刷新完成');
    } catch (error) {
      alert(error.message || '刷新失败');
    }
  });

  byId('syncBtn').addEventListener('click', async () => {
    try {
      await request('/api/bootstrap', {
        method: 'POST',
        body: JSON.stringify({ force: false })
      });
      await refreshAll();
      alert('已完成前端数据导入');
    } catch (error) {
      alert(error.message || '同步失败');
    }
  });

  byId('exportOrdersBtn').addEventListener('click', async () => {
    try {
      await exportOrders();
    } catch (error) {
      alert(error.message || '导出失败');
    }
  });

  byId('importOrdersBtn').addEventListener('click', () => {
    byId('ordersImportInput').click();
  });

  byId('ordersImportInput').addEventListener('change', async (event) => {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (!file) return;
    try {
      await importOrders(file);
      alert('订单导入成功');
    } catch (error) {
      alert(error.message || '导入失败');
    }
  });
  
  const uploadVideoByUrlBtn = byId('uploadVideoByUrlBtn');
  if (uploadVideoByUrlBtn) {
    uploadVideoByUrlBtn.addEventListener('click', () => {
      byId('urlUploadModal').classList.add('show');
      byId('videoUrlsInput').value = '';
      byId('urlUploadProgress').style.display = 'none';
    });
  }
  
  const cancelUrlUploadBtn = byId('cancelUrlUpload');
  if (cancelUrlUploadBtn) {
    cancelUrlUploadBtn.addEventListener('click', () => {
      byId('urlUploadModal').classList.remove('show');
    });
  }
  
  const closeUrlUploadBtn = byId('closeUrlUpload');
  if (closeUrlUploadBtn) {
    closeUrlUploadBtn.addEventListener('click', () => {
      byId('urlUploadModal').classList.remove('show');
    });
  }
  
  const submitUrlUploadBtn = byId('submitUrlUpload');
  if (submitUrlUploadBtn) {
    submitUrlUploadBtn.addEventListener('click', async () => {
      const inputText = byId('videoUrlsInput').value.trim();
      const author = byId('authorSelect').value;
      if (!inputText) {
        alert('请输入视频URL或抖音分享链接');
        return;
      }
      
      try {
        byId('urlUploadProgress').style.display = 'block';
        byId('urlUploadProgressFill').style.width = '0%';
        byId('urlUploadProgressText').textContent = '正在处理...';
        
        const hasDouyinLink = inputText.includes('douyin.com') || inputText.includes('v.douyin');
        let result;
        
        if (hasDouyinLink || inputText.includes('http')) {
          result = await request('/api/videos/parse-douyin', {
            method: 'POST',
            body: JSON.stringify({ text: inputText, author: author })
          });
        } else {
          const urls = inputText.split('\n').filter(url => url.trim());
          result = await request('/api/videos/upload-by-url', {
            method: 'POST',
            body: JSON.stringify({ urls, author: author })
          });
        }
        
        byId('urlUploadProgressFill').style.width = '100%';
        byId('urlUploadProgressText').textContent = result.message;
        
        setTimeout(async () => {
          byId('urlUploadModal').classList.remove('show');
          await fetchModule('videos');
          if (result.errors && result.errors.length > 0) {
            alert(`${result.message}\n\n有 ${result.errors.length} 个视频导入失败`);
          } else {
            alert(result.message);
          }
        }, 1000);
      } catch (error) {
        byId('urlUploadProgress').style.display = 'none';
        alert(error.message || '导入失败');
      }
    });
  }
}

let currentPointsAdjustUserId = null;
let currentPointsConsumeHistoryUserId = null;

async function fetchPointsUsers() {
  const data = await request('/api/points/users');
  if (data && data.success) {
    state.rows.points = data.users;
    renderPointsTable();
  }
}

function renderPointsTable() {
  const tbody = byId('pointsTable');
  if (!tbody) return;
  
  const rows = state.rows.points || [];
  tbody.innerHTML = rows.map((row) => `
    <tr>
      <td>
        <div style="display: flex; align-items: center; gap: 10px;">
          ${row.avatar ? `<img class="thumb" src="${row.avatar}" alt="avatar">` : ''}
          <div>
            <div>${row.nickname || '-'}</div>
            <div style="font-size: 12px; color: #999;">${row.userNumber || '-'}</div>
          </div>
        </div>
      </td>
      <td style="font-size: 24px; font-weight: bold; color: ${(row.points || 0) >= 0 ? '#07c160' : '#ff4d4f'};">
        ${row.points || 0}
      </td>
      <td>
        <button class="btn" data-action="view-consume-history" data-user-id="${row._id}" data-user-name="${row.nickname || ''}">积分消耗</button>
      </td>
      <td>
        <div class="cell-actions">
          <button class="btn" data-action="adjust-points" data-user-id="${row._id}" data-user-name="${row.nickname || ''}" data-current-points="${row.points || 0}">调整积分</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function openPointsAdjustModal(userId, userName, currentPoints) {
  currentPointsAdjustUserId = userId;
  byId('pointsAdjustUserName').value = userName || '';
  byId('pointsAdjustCurrentPoints').value = currentPoints || 0;
  byId('pointsAdjustType').value = 'earn';
  byId('pointsAdjustAmount').value = '';
  byId('pointsAdjustDescription').value = '';
  byId('pointsAdjustModal').classList.add('show');
}

function closePointsAdjustModal() {
  byId('pointsAdjustModal').classList.remove('show');
  currentPointsAdjustUserId = null;
}

function renderPointsConsumeHistoryTable(rows) {
  const tbody = byId('pointsConsumeHistoryTable');
  if (!tbody) return;
  if (!rows || rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #999;">暂无积分消费记录</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map((row) => `
    <tr>
      <td style="color: #ff4d4f; font-weight: bold;">-${row.amount || 0}</td>
      <td>${row.description || '-'}</td>
      <td>${formatDate(row.createdAt)}</td>
    </tr>
  `).join('');
}

function openPointsConsumeHistoryModal(userId, userName) {
  currentPointsConsumeHistoryUserId = userId;
  const userNameNode = byId('pointsConsumeHistoryUserName');
  if (userNameNode) {
    userNameNode.textContent = userName || '-';
  }
  renderPointsConsumeHistoryTable([]);
  byId('pointsConsumeHistoryModal').classList.add('show');
  fetchPointsConsumeHistory(userId);
}

function closePointsConsumeHistoryModal() {
  byId('pointsConsumeHistoryModal').classList.remove('show');
  currentPointsConsumeHistoryUserId = null;
}

async function fetchPointsConsumeHistory(userId) {
  if (!userId) return;
  try {
    const data = await request(`/api/points/user/${userId}/history`);
    const rows = (data.history || []).filter(item => item.type === 'consume');
    renderPointsConsumeHistoryTable(rows);
  } catch (error) {
    alert(error.message || '获取积分消费记录失败');
    const tbody = byId('pointsConsumeHistoryTable');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #ff4d4f;">获取记录失败</td></tr>';
    }
  }
}

async function submitPointsAdjust() {
  if (!currentPointsAdjustUserId) {
    alert('请选择要调整积分的用户');
    return;
  }

  const type = byId('pointsAdjustType').value;
  const amount = byId('pointsAdjustAmount').value;
  const description = byId('pointsAdjustDescription').value;

  if (!amount || Number(amount) <= 0) {
    alert('请输入有效的积分数量');
    return;
  }

  try {
    await request(`/api/points/user/${currentPointsAdjustUserId}/adjust`, {
      method: 'POST',
      body: JSON.stringify({ type, amount, description })
    });
    
    closePointsAdjustModal();
    await fetchPointsUsers();
    alert('积分调整成功');
  } catch (error) {
    alert(error.message || '积分调整失败');
  }
}



let currentPointsTab = 'users';

function switchPointsTab(tab) {
  currentPointsTab = tab;
  
  document.querySelectorAll('.points-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  
  document.querySelectorAll('.points-content').forEach(content => {
    content.style.display = 'none';
  });
  
  const contentId = tab === 'users' ? 'pointsUsersContent' : 'pointsRedemptionsContent';
  const content = byId(contentId);
  if (content) {
    content.style.display = 'block';
  }
  
  if (tab === 'redemptions') {
    fetchPointsRedemptions();
  }
}

async function fetchPointsRedemptions() {
  const data = await request('/api/points/redemptions');
  if (data && data.success) {
    state.rows.pointsRedemptions = data.redemptions;
    renderPointsRedemptionsTable();
  }
}

function getStatusLabel(status) {
  const statusMap = {
    'pending': { text: '待处理', color: '#faad14' },
    'processing': { text: '处理中', color: '#1890ff' },
    'completed': { text: '已完成', color: '#07c160' },
    'cancelled': { text: '已取消', color: '#ff4d4f' }
  };
  return statusMap[status] || { text: status || '未知', color: '#999' };
}

function renderPointsRedemptionsTable() {
  const tbody = byId('pointsRedemptionsTable');
  if (!tbody) return;
  
  const rows = state.rows.pointsRedemptions || [];
  tbody.innerHTML = rows.map((row) => {
    const status = getStatusLabel(row.status);
    return `
      <tr>
        <td>
          <div style="display: flex; align-items: center; gap: 10px;">
            ${row.userAvatar ? `<img class="thumb" src="${row.userAvatar}" alt="avatar">` : ''}
            <div>
              <div>${row.userName || '-'}</div>
            </div>
          </div>
        </td>
        <td>${row.itemName || '-'}</td>
        <td style="color: #ff4d4f; font-weight: bold;">${row.pointsSpent || 0}</td>
        <td>${formatDate(row.createdAt)}</td>
        <td>
          <span style="
            display: inline-block;
            padding: 4px 12px;
            border-radius: 4px;
            font-size: 14px;
            background: ${status.color}15;
            color: ${status.color};
          ">${status.text}</span>
        </td>
      </tr>
    `;
  }).join('');
}

async function init() {
  bindEvents();
  switchModule('videos');
  try {
    await ensureModuleData('videos');
    await ensureModuleData('comments');
  } catch (error) {
    alert(error.message || '初始化失败');
  }
}

init();
