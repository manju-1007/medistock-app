// =========================================================================
    // DIRECT FIREBASE CONFIGURATION (Optional for self-hosting)
    // Paste your Firebase Realtime Database URL below (e.g. "https://your-app-default-rtdb.firebaseio.com")
    // so the app connects directly to Firebase on every device without manual setup.
    // =========================================================================
    const DEFAULT_FIREBASE_URL = 'https://medistock-app-25ec4-default-rtdb.asia-southeast1.firebasedatabase.app';

    const USERS_KEY = 'medistock_users_v1';
    const SESSION_KEY = 'medistock_current_user_v1';
    const CLOUD_URL_KEY = 'medistock_firebase_url_v1';

    const SAMPLE_DATA = [];

    let currentUser = null;
    let inventory = [];
    let state = {
      search: '',
      stockScope: 'all',
      statusFilter: 'all',
      categoryFilter: 'all',
      sortBy: 'updated_desc'
    };
    let confirmCallback = null;

    function getCloudUrl() {
      try {
        const stored = (localStorage.getItem(CLOUD_URL_KEY) || '').trim();
        const url = (stored || DEFAULT_FIREBASE_URL).trim().replace(/\/+$/, '');
        return url.startsWith('https://') ? url : '';
      } catch (e) {
        const url = DEFAULT_FIREBASE_URL.trim().replace(/\/+$/, '');
        return url.startsWith('https://') ? url : '';
      }
    }

    function setCloudStatusBadge(mode) {
      const btn = document.getElementById('btnOpenCloudSync');
      const label = document.getElementById('cloudStatusLabel');
      const footer = document.getElementById('lastSavedLabel');
      if (mode === 'synced') {
        btn.className = 'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100';
        label.textContent = 'Cloud Synced';
        footer.textContent = 'Auto-syncing directly to Firebase Cloud & saved locally.';
      } else if (mode === 'syncing') {
        btn.className = 'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer bg-amber-50 text-amber-700 border-amber-200';
        label.textContent = 'Syncing...';
      } else if (mode === 'error') {
        btn.className = 'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer bg-rose-50 text-rose-700 border-rose-200';
        label.textContent = 'Sync Error';
        footer.textContent = 'Cloud sync failed — saved locally on this device.';
      } else {
        btn.className = 'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200';
        label.textContent = 'Local Only';
        footer.textContent = 'All changes are saved locally. Click "Local Only" above to connect Firebase.';
      }
    }

    async function pushInventoryToCloud(silent = true) {
      const baseUrl = getCloudUrl();
      if (!baseUrl || !currentUser) return false;
      setCloudStatusBadge('syncing');
      try {
        const res = await fetch(`${baseUrl}/medistock/users/${encodeURIComponent(currentUser.username)}/inventory.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(inventory)
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        setCloudStatusBadge('synced');
        if (!silent) showToast('Stock synced to Firebase!');
        return true;
      } catch (err) {
        setCloudStatusBadge('error');
        if (!silent) showToast('Firebase sync failed. Check Database URL & rules.', 'error');
        return false;
      }
    }

    async function pullInventoryFromCloud(silent = true) {
      const baseUrl = getCloudUrl();
      if (!baseUrl || !currentUser) return false;
      setCloudStatusBadge('syncing');
      try {
        const res = await fetch(`${baseUrl}/medistock/users/${encodeURIComponent(currentUser.username)}/inventory.json`);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        if (Array.isArray(data)) {
          inventory = data.map(item => ({ ...item, stockType: item.stockType || 'present' }));
          try { localStorage.setItem(getUserStorageKey(), JSON.stringify(inventory)); } catch (e) {}
          renderAll();
          setCloudStatusBadge('synced');
          if (!silent) showToast('Pulled latest stock from Firebase!');
          return true;
        } else if (data === null) {
          return await pushInventoryToCloud(silent);
        }
        setCloudStatusBadge('synced');
        return true;
      } catch (err) {
        setCloudStatusBadge('error');
        if (!silent) showToast('Could not pull from Firebase. Check URL.', 'error');
        return false;
      }
    }

    function loadUsers() {
      try {
        const raw = localStorage.getItem(USERS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {}
      const defaults = [{ username: 'demo', password: '1234', displayName: 'Demo Store' }];
      try { localStorage.setItem(USERS_KEY, JSON.stringify(defaults)); } catch (e) {}
      return defaults;
    }

    function saveUsers(users) {
      try { localStorage.setItem(USERS_KEY, JSON.stringify(users)); } catch (e) {}
    }

    function getUserStorageKey() {
      const uname = currentUser ? currentUser.username : 'demo';
      return `medistock_inventory_v3_${uname}`;
    }

    function loadInventory() {
      try {
        const raw = localStorage.getItem(getUserStorageKey()) || (currentUser && currentUser.username === 'demo' ? localStorage.getItem('medistock_inventory_v3') : null);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            inventory = parsed.map(item => ({
              ...item,
              stockType: item.stockType || 'present'
            }));
            return;
          }
        }
      } catch (e) {}
      inventory = JSON.parse(JSON.stringify(SAMPLE_DATA));
      try { localStorage.setItem(getUserStorageKey(), JSON.stringify(inventory)); } catch (e) {}
    }

    function saveInventory() {
      try {
        localStorage.setItem(getUserStorageKey(), JSON.stringify(inventory));
      } catch (e) {}
      if (getCloudUrl()) {
        pushInventoryToCloud(true);
      }
    }

    function showAuthScreen() {
      document.getElementById('authScreen').classList.remove('hidden');
      document.getElementById('appScreen').classList.add('hidden');
      if (window.lucide) lucide.createIcons();
    }

    function enterApp(user) {
      currentUser = user;
      try { localStorage.setItem(SESSION_KEY, JSON.stringify(user)); } catch (e) {}
      document.getElementById('userDisplayName').textContent = user.displayName || user.username;
      document.getElementById('authScreen').classList.add('hidden');
      document.getElementById('appScreen').classList.remove('hidden');
      loadInventory();
      renderAll();
      if (getCloudUrl()) {
        pullInventoryFromCloud(true);
      } else {
        setCloudStatusBadge('local');
      }
    }

    function switchAuthTab(mode) {
      const isLogin = mode === 'login';
      document.getElementById('loginForm').classList.toggle('hidden', !isLogin);
      document.getElementById('registerForm').classList.toggle('hidden', isLogin);
      document.getElementById('authErrorBox').classList.add('hidden');
      document.getElementById('regErrorBox').classList.add('hidden');

      document.getElementById('tabLogin').className = isLogin
        ? 'py-2 text-xs font-semibold rounded-lg bg-white text-slate-900 shadow-xs cursor-pointer transition'
        : 'py-2 text-xs font-semibold rounded-lg text-slate-600 hover:text-slate-900 cursor-pointer transition';
      document.getElementById('tabRegister').className = !isLogin
        ? 'py-2 text-xs font-semibold rounded-lg bg-white text-slate-900 shadow-xs cursor-pointer transition'
        : 'py-2 text-xs font-semibold rounded-lg text-slate-600 hover:text-slate-900 cursor-pointer transition';
    }

    function getStatus(item) {
      const qty = Number(item.quantity) || 0;
      const min = Number(item.minStock) || 0;
      if (qty <= 0) return 'out_of_stock';
      if (qty <= min) return 'low_stock';
      return 'in_stock';
    }

    function escapeHtml(str) {
      return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function showToast(message, type = 'success') {
      const container = document.getElementById('toastContainer');
      const toast = document.createElement('div');
      const colors = type === 'error'
        ? 'bg-rose-600 text-white'
        : type === 'info'
          ? 'bg-slate-800 text-white'
          : 'bg-teal-700 text-white';
      toast.className = `toast-enter pointer-events-auto px-4 py-2.5 rounded-xl shadow-lg text-xs sm:text-sm font-medium flex items-center gap-2 ${colors}`;
      toast.textContent = message;
      container.appendChild(toast);
      setTimeout(() => {
        toast.remove();
      }, 2800);
    }

    function matchesScope(item) {
      if (state.stockScope === 'all') return true;
      return (item.stockType || 'present') === state.stockScope;
    }

    function getFilteredItems() {
      const q = state.search.trim().toLowerCase();
      let items = inventory.filter(item => {
        const matchesSearch = !q ||
          item.name.toLowerCase().includes(q) ||
          (item.generic || '').toLowerCase().includes(q) ||
          (item.category || '').toLowerCase().includes(q);
        const st = getStatus(item);
        const matchesStatus = state.statusFilter === 'all' || st === state.statusFilter;
        const matchesCat = state.categoryFilter === 'all' || item.category === state.categoryFilter;
        return matchesScope(item) && matchesSearch && matchesStatus && matchesCat;
      });

      items.sort((a, b) => {
        if (state.sortBy === 'name_asc') return a.name.localeCompare(b.name);
        if (state.sortBy === 'qty_asc') return a.quantity - b.quantity;
        if (state.sortBy === 'qty_desc') return b.quantity - a.quantity;
        return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
      });

      return items;
    }

    function renderStats() {
      const total = inventory.length;
      let totalUnits = 0;
      let inStock = 0;
      let lowStock = 0;
      let outOfStock = 0;
      let presentCount = 0;
      let newCount = 0;

      inventory.forEach(item => {
        totalUnits += Number(item.quantity) || 0;
        if ((item.stockType || 'present') === 'new') newCount++;
        else presentCount++;
        const st = getStatus(item);
        if (st === 'in_stock') inStock++;
        else if (st === 'low_stock') lowStock++;
        else outOfStock++;
      });

      document.getElementById('statTotal').textContent = total;
      document.getElementById('statTotalUnits').textContent = totalUnits;
      document.getElementById('statInStock').textContent = inStock;
      document.getElementById('statPresentCount').textContent = presentCount;
      document.getElementById('statNewCount').textContent = newCount;
      document.getElementById('statLowStock').textContent = lowStock;
      document.getElementById('statOutOfStock').textContent = outOfStock;
    }

    function renderScopeButtons() {
      document.querySelectorAll('.scope-btn').forEach(btn => {
        const active = btn.dataset.scope === state.stockScope;
        btn.className = active
          ? 'scope-btn px-3 py-1.5 text-xs font-semibold rounded-lg bg-white text-slate-900 shadow-xs transition cursor-pointer'
          : 'scope-btn px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-600 hover:text-slate-900 transition cursor-pointer';
      });
    }

    function renderAvailabilityBanner() {
      const q = state.search.trim();
      const banner = document.getElementById('availabilityBanner');
      const clearBtn = document.getElementById('btnClearSearch');
      const iconWrap = document.getElementById('bannerIconWrap');
      const title = document.getElementById('bannerTitle');
      const subtitle = document.getElementById('bannerSubtitle');
      const actionBtn = document.getElementById('btnBannerAction');

      if (!q) {
        banner.classList.add('hidden');
        clearBtn.classList.add('hidden');
        return;
      }

      clearBtn.classList.remove('hidden');
      banner.classList.remove('hidden');

      const ql = q.toLowerCase();
      const scopeLabel = state.stockScope === 'present' ? 'Present Stock' : state.stockScope === 'new' ? 'New Stock' : 'All Stock';

      const matches = inventory.filter(item =>
        matchesScope(item) && (
          item.name.toLowerCase().includes(ql) ||
          (item.generic || '').toLowerCase().includes(ql)
        )
      );

      const available = matches.filter(m => Number(m.quantity) > 0);

      if (available.length > 0) {
        banner.className = 'rounded-xl p-3.5 border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-emerald-50 border-emerald-200';
        iconWrap.className = 'w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-emerald-600 text-white';
        iconWrap.innerHTML = '<i data-lucide="check-circle-2" class="w-5 h-5"></i>';
        title.className = 'text-sm font-semibold text-emerald-900';
        title.textContent = `Available in ${scopeLabel}: ${available.length} matching medicine${available.length > 1 ? 's' : ''}`;
        subtitle.className = 'text-xs mt-0.5 text-emerald-700';
        const preview = available.slice(0, 3).map(m => `${m.name} (${m.quantity} left)`).join(' • ');
        subtitle.textContent = preview + (available.length > 3 ? ` +${available.length - 3} more` : '');
        actionBtn.className = 'px-3.5 py-2 text-xs font-semibold rounded-lg transition shrink-0 cursor-pointer bg-emerald-600 text-white hover:bg-emerald-700';
        actionBtn.textContent = '+ Add Stock to First Match';
        actionBtn.classList.remove('hidden');
        actionBtn.onclick = () => openRestockModal(available[0].id);
      } else if (matches.length > 0) {
        banner.className = 'rounded-xl p-3.5 border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-50 border-amber-200';
        iconWrap.className = 'w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-amber-500 text-white';
        iconWrap.innerHTML = '<i data-lucide="alert-triangle" class="w-5 h-5"></i>';
        title.className = 'text-sm font-semibold text-amber-900';
        title.textContent = `Out of Stock in ${scopeLabel}: "${matches[0].name}" has 0 units left`;
        subtitle.className = 'text-xs mt-0.5 text-amber-700';
        subtitle.textContent = 'This medicine is already in your list with 0 stock. Click to add new stock.';
        actionBtn.className = 'px-3.5 py-2 text-xs font-semibold rounded-lg transition shrink-0 cursor-pointer bg-amber-600 text-white hover:bg-amber-700';
        actionBtn.textContent = '+ Restock Now';
        actionBtn.classList.remove('hidden');
        actionBtn.onclick = () => openRestockModal(matches[0].id);
      } else {
        banner.className = 'rounded-xl p-3.5 border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-rose-50 border-rose-200';
        iconWrap.className = 'w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-rose-600 text-white';
        iconWrap.innerHTML = '<i data-lucide="x-circle" class="w-5 h-5"></i>';
        title.className = 'text-sm font-semibold text-rose-900';
        title.textContent = `Not Found in ${scopeLabel}: "${q}"`;
        subtitle.className = 'text-xs mt-0.5 text-rose-700';
        subtitle.textContent = 'No matching medicine found. You can add it as New Stock right away.';
        actionBtn.className = 'px-3.5 py-2 text-xs font-semibold rounded-lg transition shrink-0 cursor-pointer bg-rose-600 text-white hover:bg-rose-700';
        actionBtn.textContent = `+ Add "${q.slice(0, 18)}"`;
        actionBtn.classList.remove('hidden');
        actionBtn.onclick = () => openAddModal(q);
      }
    }

    function statusBadgeHtml(st) {
      if (st === 'in_stock') {
        return '<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">In Stock</span>';
      }
      if (st === 'low_stock') {
        return '<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">Low Stock</span>';
      }
      return '<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">Out of Stock</span>';
    }

    function stockTypeBadgeHtml(type) {
      if (type === 'new') {
        return '<span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-teal-50 text-teal-700 border border-teal-200">New Stock</span>';
      }
      return '<span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-600">Present</span>';
    }

    function renderFilterPills() {
      document.querySelectorAll('.filter-pill').forEach(btn => {
        const active = btn.dataset.filterPill === state.statusFilter;
        btn.className = active
          ? 'filter-pill px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-600 text-white cursor-pointer'
          : 'filter-pill px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer';
      });
    }

    function renderList() {
      const items = getFilteredItems();
      const tbody = document.getElementById('tableBody');
      const mobile = document.getElementById('mobileCards');
      const empty = document.getElementById('emptyState');

      if (items.length === 0) {
        tbody.innerHTML = '';
        mobile.innerHTML = '';
        empty.classList.remove('hidden');
      } else {
        empty.classList.add('hidden');
        tbody.innerHTML = items.map(item => {
          const st = getStatus(item);
          return `
            <tr class="hover:bg-slate-50/80 transition">
              <td class="py-3.5 px-4">
                <div class="font-semibold text-slate-900">${escapeHtml(item.name)}</div>
                <div class="text-xs text-slate-500">${escapeHtml(item.generic || 'No generic specified')}</div>
              </td>
              <td class="py-3.5 px-4">${stockTypeBadgeHtml(item.stockType || 'present')}</td>
              <td class="py-3.5 px-4">
                <span class="px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700">${escapeHtml(item.category || 'Other')}</span>
              </td>
              <td class="py-3.5 px-4">
                <div class="inline-flex items-center gap-1.5 bg-slate-100 rounded-lg p-1">
                  <button type="button" data-dec-id="${item.id}" class="w-6 h-6 rounded-md bg-white text-slate-700 hover:bg-slate-200 flex items-center justify-center text-sm font-bold shadow-xs cursor-pointer" title="Decrease stock by 1">−</button>
                  <span class="min-w-[2.2rem] text-center font-bold text-slate-900 text-sm">${item.quantity}</span>
                  <button type="button" data-inc-id="${item.id}" class="w-6 h-6 rounded-md bg-white text-slate-700 hover:bg-slate-200 flex items-center justify-center text-sm font-bold shadow-xs cursor-pointer" title="Increase stock by 1">+</button>
                </div>
              </td>
              <td class="py-3.5 px-4">${statusBadgeHtml(st)}</td>
              <td class="py-3.5 px-4 text-right">
                <div class="inline-flex items-center gap-1">
                  <button type="button" data-restock-id="${item.id}" class="px-2.5 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg cursor-pointer" title="Add new stock">+ Stock</button>
                  <button type="button" data-edit-id="${item.id}" class="p-1.5 text-slate-500 hover:text-teal-700 hover:bg-slate-100 rounded-lg cursor-pointer" title="Edit medicine">
                    <i data-lucide="pencil" class="w-4 h-4"></i>
                  </button>
                  <button type="button" data-delete-id="${item.id}" class="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer" title="Delete medicine">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                  </button>
                </div>
              </td>
            </tr>
          `;
        }).join('');

        mobile.innerHTML = items.map(item => {
          const st = getStatus(item);
          return `
            <div class="p-4 space-y-3">
              <div class="flex items-start justify-between gap-2">
                <div>
                  <div class="flex items-center gap-2 flex-wrap">
                    <h4 class="font-semibold text-slate-900 text-sm">${escapeHtml(item.name)}</h4>
                    ${stockTypeBadgeHtml(item.stockType || 'present')}
                  </div>
                  <p class="text-xs text-slate-500 mt-0.5">${escapeHtml(item.generic || 'No generic specified')}</p>
                </div>
                ${statusBadgeHtml(st)}
              </div>
              <div class="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <span class="px-2 py-0.5 rounded bg-slate-100 font-medium">${escapeHtml(item.category || 'Other')}</span>
              </div>
              <div class="flex items-center justify-between pt-1">
                <div class="inline-flex items-center gap-1.5 bg-slate-100 rounded-lg p-1">
                  <button type="button" data-dec-id="${item.id}" class="w-7 h-7 rounded-md bg-white text-slate-700 font-bold cursor-pointer">−</button>
                  <span class="min-w-[2.2rem] text-center font-bold text-slate-900 text-sm">${item.quantity}</span>
                  <button type="button" data-inc-id="${item.id}" class="w-7 h-7 rounded-md bg-white text-slate-700 font-bold cursor-pointer">+</button>
                </div>
                <div class="flex items-center gap-1.5">
                  <button type="button" data-restock-id="${item.id}" class="px-2.5 py-1.5 text-xs font-semibold text-teal-700 bg-teal-50 rounded-lg cursor-pointer">+ Stock</button>
                  <button type="button" data-edit-id="${item.id}" class="p-1.5 text-slate-600 bg-slate-100 rounded-lg cursor-pointer" title="Edit">
                    <i data-lucide="pencil" class="w-4 h-4"></i>
                  </button>
                  <button type="button" data-delete-id="${item.id}" class="p-1.5 text-rose-600 bg-rose-50 rounded-lg cursor-pointer" title="Delete">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                  </button>
                </div>
              </div>
            </div>
          `;
        }).join('');
      }

      if (window.lucide) {
        lucide.createIcons();
      }
    }

    function renderAll() {
      renderStats();
      renderScopeButtons();
      renderAvailabilityBanner();
      renderFilterPills();
      renderList();
    }

    function updatePresentStockCheck() {
      const id = document.getElementById('fieldId').value;
      const box = document.getElementById('presentStockCheckBox');
      const list = document.getElementById('presentStockMatches');
      const query = document.getElementById('fieldName').value.trim().toLowerCase();

      if (id || query.length < 2) {
        box.classList.add('hidden');
        list.innerHTML = '';
        return;
      }

      const matches = inventory.filter(m =>
        m.name.toLowerCase().includes(query) ||
        (m.generic || '').toLowerCase().includes(query)
      ).slice(0, 3);

      if (matches.length === 0) {
        box.classList.add('hidden');
        list.innerHTML = '';
        return;
      }

      box.classList.remove('hidden');
      list.innerHTML = matches.map(m => `
        <div class="flex items-center justify-between gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-amber-200 text-xs">
          <div class="min-w-0">
            <span class="font-semibold text-slate-900">${escapeHtml(m.name)}</span>
            <span class="text-slate-500"> • ${m.quantity} left</span>
          </div>
          <button type="button" data-switch-restock="${m.id}" class="px-2 py-1 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-md shrink-0 cursor-pointer">+ Add Stock</button>
        </div>
      `).join('');

      if (window.lucide) lucide.createIcons();
    }

    function openCloudModal() {
      document.getElementById('cloudUrlInput').value = getCloudUrl();
      document.getElementById('cloudErrorBox').classList.add('hidden');
      document.getElementById('cloudModal').classList.remove('hidden');
      if (window.lucide) lucide.createIcons();
    }

    function closeCloudModal() {
      document.getElementById('cloudModal').classList.add('hidden');
    }

    function openUploadModal() {
      document.getElementById('uploadModal').classList.remove('hidden');
      if (window.lucide) lucide.createIcons();
    }

    function closeUploadModal() {
      document.getElementById('uploadModal').classList.add('hidden');
    }

    function openAddModal(prefillName = '') {
      document.getElementById('modalTitle').textContent = 'Add New Medicine / Stock';
      document.getElementById('fieldId').value = '';
      document.getElementById('fieldName').value = prefillName;
      document.getElementById('fieldGeneric').value = '';
      document.getElementById('fieldStockType').value = 'new';
      document.getElementById('fieldCategory').value = 'Tablets';
      document.getElementById('fieldQty').value = '';
      document.getElementById('fieldMinStock').value = '10';
      document.getElementById('medicineModal').classList.remove('hidden');
      updatePresentStockCheck();
      document.getElementById('fieldName').focus();
    }

    function openEditModal(id) {
      const item = inventory.find(m => m.id === id);
      if (!item) return;
      document.getElementById('modalTitle').textContent = 'Edit Medicine';
      document.getElementById('fieldId').value = item.id;
      document.getElementById('fieldName').value = item.name;
      document.getElementById('fieldGeneric').value = item.generic || '';
      document.getElementById('fieldStockType').value = item.stockType || 'present';
      document.getElementById('fieldCategory').value = item.category || 'Tablets';
      document.getElementById('fieldQty').value = item.quantity;
      document.getElementById('fieldMinStock').value = item.minStock ?? 10;
      document.getElementById('medicineModal').classList.remove('hidden');
      updatePresentStockCheck();
      document.getElementById('fieldName').focus();
    }

    function closeMedicineModal() {
      document.getElementById('medicineModal').classList.add('hidden');
    }

    function openRestockModal(id) {
      const item = inventory.find(m => m.id === id);
      if (!item) return;
      document.getElementById('restockId').value = item.id;
      document.getElementById('restockMedName').textContent = item.name;
      document.getElementById('restockCurrentQty').textContent = `${item.quantity} units`;
      document.getElementById('restockAddQty').value = '10';
      document.getElementById('restockModal').classList.remove('hidden');
      document.getElementById('restockAddQty').focus();
    }

    function closeRestockModal() {
      document.getElementById('restockModal').classList.add('hidden');
    }

    function openConfirmModal(title, message, onConfirm) {
      document.getElementById('confirmTitle').textContent = title;
      document.getElementById('confirmMessage').textContent = message;
      confirmCallback = onConfirm;
      document.getElementById('confirmModal').classList.remove('hidden');
    }

    function closeConfirmModal() {
      document.getElementById('confirmModal').classList.add('hidden');
      confirmCallback = null;
    }

    function adjustQuantity(id, delta) {
      const item = inventory.find(m => m.id === id);
      if (!item) return;
      const next = Math.max(0, (Number(item.quantity) || 0) + delta);
      item.quantity = next;
      item.updatedAt = new Date().toISOString();
      saveInventory();
      renderAll();
    }

    function exportPdf() {
      if (!window.jspdf || !window.jspdf.jsPDF) {
        showToast('PDF library still loading, please try again', 'error');
        return;
      }
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      const storeName = (currentUser && (currentUser.displayName || currentUser.username)) || 'MediStock';
      const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      const itemsToExport = getFilteredItems();

      doc.setFontSize(16);
      doc.setTextColor(13, 148, 136);
      doc.text(`${storeName} — Medicine Stock Report`, 14, 18);

      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(`Generated on: ${dateStr}   |   Showing: ${itemsToExport.length} medicines`, 14, 25);

      const rows = itemsToExport.map((item, index) => {
        const st = getStatus(item);
        const statusLabel = st === 'in_stock' ? 'In Stock' : st === 'low_stock' ? 'Low Stock' : 'Out of Stock';
        const typeLabel = (item.stockType || 'present') === 'new' ? 'New Stock' : 'Present';
        return [
          index + 1,
          item.name,
          item.generic || '-',
          typeLabel,
          item.category || 'Other',
          item.quantity,
          statusLabel
        ];
      });

      doc.autoTable({
        startY: 31,
        head: [['#', 'Medicine Name', 'Generic / Salt', 'Stock Type', 'Category', 'Qty', 'Status']],
        body: rows,
        styles: { fontSize: 9, cellPadding: 2.5 },
        headStyles: { fillColor: [13, 148, 136], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] }
      });

      doc.save(`medistock_${new Date().toISOString().slice(0, 10)}.pdf`);
      showToast('Exported stock as PDF');
    }

    function exportCsv() {
      const headers = ['Name', 'Generic', 'StockType', 'Category', 'Quantity', 'MinStock'];
      const rows = inventory.map(m => [
        m.name, m.generic || '', m.stockType || 'present', m.category || '', m.quantity, m.minStock ?? 10
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
      const csv = [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `medistock_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Stock exported as CSV');
    }

    function downloadSampleCsv() {
      const sample = [
        'Name,Generic,StockType,Category,Quantity,MinStock',
        '"Paracetamol 500mg","Paracetamol","new","Tablets",40,10',
        '"Cetirizine 10mg","Cetirizine","new","Tablets",25,10'
      ].join('\n');
      const blob = new Blob([sample], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'medistock_sample_upload.csv';
      a.click();
      URL.revokeObjectURL(url);
      showToast('Sample CSV downloaded');
    }

    function parseCsvLine(line) {
      const result = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (ch === ',' && !inQuotes) {
          result.push(cur);
          cur = '';
        } else {
          cur += ch;
        }
      }
      result.push(cur);
      return result;
    }

    function applyUploadedItems(itemsToUpload) {
      if (!itemsToUpload.length) {
        showToast('No valid medicine entries found', 'error');
        return;
      }
      const mergeMode = document.getElementById('uploadMergeMode').value;
      const defaultType = document.getElementById('uploadStockType').value;

      if (mergeMode === 'replace') {
        inventory = [];
      }

      let added = 0;
      let merged = 0;

      itemsToUpload.forEach((entry, idx) => {
        const name = (entry.name || '').trim();
        if (!name) return;
        const qty = Math.max(0, parseInt(entry.quantity, 10) || 0);
        const type = entry.stockType || defaultType;

        if (mergeMode === 'merge') {
          const existing = inventory.find(m => m.name.toLowerCase() === name.toLowerCase());
          if (existing) {
            existing.quantity = (Number(existing.quantity) || 0) + qty;
            existing.stockType = type;
            existing.updatedAt = new Date().toISOString();
            merged++;
            return;
          }
        }

        inventory.unshift({
          id: 'm_up_' + Date.now() + '_' + idx,
          name,
          generic: entry.generic || '',
          stockType: type,
          category: entry.category || 'Tablets',
          quantity: qty,
          minStock: Math.max(0, parseInt(entry.minStock, 10) || 10),
          updatedAt: new Date().toISOString()
        });
        added++;
      });

      saveInventory();
      renderAll();
      closeUploadModal();
      showToast(`Uploaded: ${added} added${merged ? `, ${merged} updated` : ''}`);
    }

    function handleUploadedFile(file) {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        const text = String(ev.target.result || '').trim();
        if (!text) {
          showToast('Uploaded file is empty', 'error');
          return;
        }
        if (file.name.toLowerCase().endsWith('.json')) {
          try {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed)) {
              applyUploadedItems(parsed);
              return;
            }
          } catch (err) {
            showToast('Invalid JSON file', 'error');
            return;
          }
        }
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        const firstCols = parseCsvLine(lines[0]).map(c => c.trim().toLowerCase());
        const hasHeader = firstCols[0] === 'name' || firstCols[0] === 'medicine' || firstCols[0] === 'medicine name';
        const startIdx = hasHeader ? 1 : 0;
        const parsedItems = [];
        for (let i = startIdx; i < lines.length; i++) {
          const cols = parseCsvLine(lines[i]);
          const name = (cols[0] || '').trim();
          if (!name) continue;
          if (cols.length <= 2) {
            parsedItems.push({
              name,
              quantity: parseInt(cols[1], 10) || 0
            });
          } else {
            parsedItems.push({
              name,
              generic: (cols[1] || '').trim(),
              stockType: (cols[2] || '').trim() === 'new' ? 'new' : (cols[2] || '').trim() === 'present' ? 'present' : '',
              category: (cols[3] || 'Tablets').trim() || 'Tablets',
              quantity: parseInt(cols[4], 10) || 0,
              minStock: parseInt(cols[5], 10) || 10
            });
          }
        }
        applyUploadedItems(parsedItems);
      };
      reader.readAsText(file);
    }

    // Cloud Sync Event Listeners
    document.getElementById('btnOpenCloudSync').addEventListener('click', openCloudModal);
    document.getElementById('btnCloseCloud').addEventListener('click', closeCloudModal);
    document.getElementById('btnCloseCloudFooter').addEventListener('click', closeCloudModal);

    function validateAndSaveCloudUrl() {
      const raw = document.getElementById('cloudUrlInput').value.trim().replace(/\/+$/, '');
      const errBox = document.getElementById('cloudErrorBox');
      if (!raw.startsWith('https://') || raw.length < 12) {
        errBox.textContent = 'Please enter a valid https:// Firebase Realtime Database URL.';
        errBox.classList.remove('hidden');
        return '';
      }
      errBox.classList.add('hidden');
      try { localStorage.setItem(CLOUD_URL_KEY, raw); } catch (e) {}
      return raw;
    }

    document.getElementById('btnCloudPush').addEventListener('click', async () => {
      if (!validateAndSaveCloudUrl()) return;
      const ok = await pushInventoryToCloud(false);
      if (ok) closeCloudModal();
    });

    document.getElementById('btnCloudPull').addEventListener('click', async () => {
      if (!validateAndSaveCloudUrl()) return;
      const ok = await pullInventoryFromCloud(false);
      if (ok) closeCloudModal();
    });

    document.getElementById('btnCloudDisconnect').addEventListener('click', () => {
      try { localStorage.removeItem(CLOUD_URL_KEY); } catch (e) {}
      setCloudStatusBadge('local');
      closeCloudModal();
      showToast('Disconnected Cloud Sync (using Local Storage)', 'info');
    });

    // Auth Event Listeners
    document.getElementById('tabLogin').addEventListener('click', () => switchAuthTab('login'));
    document.getElementById('tabRegister').addEventListener('click', () => switchAuthTab('register'));

    document.getElementById('loginForm').addEventListener('submit', e => {
      e.preventDefault();
      const uname = document.getElementById('loginUsername').value.trim().toLowerCase();
      const pwd = document.getElementById('loginPassword').value;
      const errBox = document.getElementById('authErrorBox');
      const users = loadUsers();
      const match = users.find(u => u.username.toLowerCase() === uname && u.password === pwd);
      if (!match) {
        errBox.textContent = 'Invalid username or password. Try demo / 1234 or create a new account.';
        errBox.classList.remove('hidden');
        return;
      }
      errBox.classList.add('hidden');
      enterApp(match);
      showToast(`Welcome, ${match.displayName || match.username}`);
    });

    document.getElementById('btnDemoLogin').addEventListener('click', () => {
      const users = loadUsers();
      const demo = users.find(u => u.username === 'demo') || users[0];
      enterApp(demo);
      showToast('Logged in as Demo Store');
    });

    document.getElementById('registerForm').addEventListener('submit', e => {
      e.preventDefault();
      const displayName = document.getElementById('regDisplayName').value.trim();
      const username = document.getElementById('regUsername').value.trim().toLowerCase();
      const password = document.getElementById('regPassword').value;
      const errBox = document.getElementById('regErrorBox');

      if (!username || password.length < 4) {
        errBox.textContent = 'Enter a username and a password of at least 4 characters.';
        errBox.classList.remove('hidden');
        return;
      }

      const users = loadUsers();
      if (users.some(u => u.username.toLowerCase() === username)) {
        errBox.textContent = 'Username already exists. Please login or choose another.';
        errBox.classList.remove('hidden');
        return;
      }

      const newUser = { username, password, displayName: displayName || username };
      users.push(newUser);
      saveUsers(users);
      errBox.classList.add('hidden');
      enterApp(newUser);
      showToast(`Account created! Welcome, ${newUser.displayName}`);
    });

    document.getElementById('btnLogout').addEventListener('click', () => {
      currentUser = null;
      try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
      document.getElementById('loginPassword').value = '';
      showAuthScreen();
      showToast('Logged out', 'info');
    });

    // App Event Listeners
    document.getElementById('searchInput').addEventListener('input', e => {
      state.search = e.target.value;
      renderAvailabilityBanner();
      renderList();
    });

    document.getElementById('btnClearSearch').addEventListener('click', () => {
      state.search = '';
      document.getElementById('searchInput').value = '';
      renderAvailabilityBanner();
      renderList();
    });

    document.querySelectorAll('.scope-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.stockScope = btn.dataset.scope;
        renderScopeButtons();
        renderAvailabilityBanner();
        renderList();
      });
    });

    document.querySelectorAll('.kpi-card').forEach(card => {
      card.addEventListener('click', () => {
        state.statusFilter = card.dataset.statusFilter;
        renderFilterPills();
        renderList();
      });
    });

    document.querySelectorAll('.filter-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        state.statusFilter = pill.dataset.filterPill;
        renderFilterPills();
        renderList();
      });
    });

    document.getElementById('categoryFilter').addEventListener('change', e => {
      state.categoryFilter = e.target.value;
      renderList();
    });

    document.getElementById('sortSelect').addEventListener('change', e => {
      state.sortBy = e.target.value;
      renderList();
    });

    document.getElementById('btnOpenUpload').addEventListener('click', openUploadModal);
    document.getElementById('btnCloseUpload').addEventListener('click', closeUploadModal);
    document.getElementById('btnCancelUpload').addEventListener('click', closeUploadModal);
    document.getElementById('btnDownloadSample').addEventListener('click', downloadSampleCsv);

    const dropZone = document.getElementById('dropZone');
    dropZone.addEventListener('dragover', e => {
      e.preventDefault();
      dropZone.classList.add('border-teal-500', 'bg-teal-50/50');
    });
    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('border-teal-500', 'bg-teal-50/50');
    });
    dropZone.addEventListener('drop', e => {
      e.preventDefault();
      dropZone.classList.remove('border-teal-500', 'bg-teal-50/50');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleUploadedFile(e.dataTransfer.files[0]);
      }
    });

    document.getElementById('inputImportCsv').addEventListener('change', e => {
      const file = e.target.files[0];
      handleUploadedFile(file);
      e.target.value = '';
    });

    document.getElementById('btnBulkUpload').addEventListener('click', () => {
      const raw = document.getElementById('bulkPasteInput').value.trim();
      if (!raw) {
        showToast('Paste at least one medicine line first', 'error');
        return;
      }
      const lines = raw.split(/\r?\n/).filter(l => l.trim());
      const parsed = lines.map(line => {
        const parts = line.split(',').map(p => p.trim());
        return {
          name: parts[0] || '',
          quantity: parseInt(parts[1], 10) || 0
        };
      }).filter(item => item.name);
      document.getElementById('bulkPasteInput').value = '';
      applyUploadedItems(parsed);
    });

    document.getElementById('btnOpenAdd').addEventListener('click', () => openAddModal());
    document.getElementById('btnEmptyAdd').addEventListener('click', () => openAddModal(state.search.trim()));
    document.getElementById('btnCloseModal').addEventListener('click', closeMedicineModal);
    document.getElementById('btnCancelModal').addEventListener('click', closeMedicineModal);
    document.getElementById('fieldName').addEventListener('input', updatePresentStockCheck);

    document.getElementById('presentStockMatches').addEventListener('click', e => {
      const btn = e.target.closest('[data-switch-restock]');
      if (!btn) return;
      const id = btn.dataset.switchRestock;
      closeMedicineModal();
      openRestockModal(id);
    });

    document.getElementById('medicineForm').addEventListener('submit', e => {
      e.preventDefault();
      const id = document.getElementById('fieldId').value;
      const name = document.getElementById('fieldName').value.trim();
      if (!name) return;

      const payload = {
        name,
        generic: document.getElementById('fieldGeneric').value.trim(),
        stockType: document.getElementById('fieldStockType').value,
        category: document.getElementById('fieldCategory').value,
        quantity: Math.max(0, parseInt(document.getElementById('fieldQty').value, 10) || 0),
        minStock: Math.max(0, parseInt(document.getElementById('fieldMinStock').value, 10) || 0),
        updatedAt: new Date().toISOString()
      };

      if (id) {
        const idx = inventory.findIndex(m => m.id === id);
        if (idx !== -1) {
          inventory[idx] = { ...inventory[idx], ...payload };
          showToast(`Updated "${name}"`);
        }
      } else {
        inventory.unshift({ id: 'm_' + Date.now(), ...payload });
        showToast(`Added "${name}" to ${payload.stockType === 'new' ? 'New Stock' : 'Present Stock'}`);
      }

      saveInventory();
      closeMedicineModal();
      renderAll();
    });

    function handleListClick(e) {
      const dec = e.target.closest('[data-dec-id]');
      if (dec) { adjustQuantity(dec.dataset.decId, -1); return; }

      const inc = e.target.closest('[data-inc-id]');
      if (inc) { adjustQuantity(inc.dataset.incId, 1); return; }

      const restock = e.target.closest('[data-restock-id]');
      if (restock) { openRestockModal(restock.dataset.restockId); return; }

      const edit = e.target.closest('[data-edit-id]');
      if (edit) { openEditModal(edit.dataset.editId); return; }

      const del = e.target.closest('[data-delete-id]');
      if (del) {
        const item = inventory.find(m => m.id === del.dataset.deleteId);
        if (!item) return;
        openConfirmModal(
          'Delete Medicine',
          `Remove "${item.name}" from your stock list?`,
          () => {
            inventory = inventory.filter(m => m.id !== item.id);
            saveInventory();
            renderAll();
            showToast(`Deleted "${item.name}"`, 'info');
          }
        );
      }
    }

    document.getElementById('tableBody').addEventListener('click', handleListClick);
    document.getElementById('mobileCards').addEventListener('click', handleListClick);

    document.getElementById('btnCloseRestock').addEventListener('click', closeRestockModal);
    document.getElementById('btnCancelRestock').addEventListener('click', closeRestockModal);
    document.querySelectorAll('.quick-add-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById('restockAddQty').value = btn.dataset.quickAdd;
      });
    });

    document.getElementById('restockForm').addEventListener('submit', e => {
      e.preventDefault();
      const id = document.getElementById('restockId').value;
      const addQty = Math.max(1, parseInt(document.getElementById('restockAddQty').value, 10) || 0);
      const item = inventory.find(m => m.id === id);
      if (item && addQty > 0) {
        item.quantity = (Number(item.quantity) || 0) + addQty;
        item.stockType = 'new';
        item.updatedAt = new Date().toISOString();
        saveInventory();
        renderAll();
        showToast(`Added +${addQty} new stock to "${item.name}"`);
      }
      closeRestockModal();
    });

    document.getElementById('btnConfirmCancel').addEventListener('click', closeConfirmModal);
    document.getElementById('btnConfirmOk').addEventListener('click', () => {
      if (confirmCallback) confirmCallback();
      closeConfirmModal();
    });

    document.getElementById('btnExportPdf').addEventListener('click', exportPdf);
    document.getElementById('btnExportCsv').addEventListener('click', exportCsv);

    document.getElementById('btnResetDemo').addEventListener('click', () => {
      openConfirmModal(
        'Reset Stock List',
        'Replace your current stock list with the sample medicines?',
        () => {
          inventory = JSON.parse(JSON.stringify(SAMPLE_DATA));
          saveInventory();
          renderAll();
          showToast('Reset to sample stock', 'info');
        }
      );
    });

    (function init() {
      loadUsers();
      try {
        const savedSession = localStorage.getItem(SESSION_KEY);
        if (savedSession) {
          const parsedUser = JSON.parse(savedSession);
          if (parsedUser && parsedUser.username) {
            enterApp(parsedUser);
            return;
          }
        }
      } catch (e) {}
      showAuthScreen();
    })();
