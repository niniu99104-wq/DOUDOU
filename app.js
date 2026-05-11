/* ════════════════════════════════════════
   DouDou 代理管理系統 — app.js
════════════════════════════════════════ */

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyV_39M1osnevt1BY0OrJHIrc4FZpef4NjVZdjpBqcKt6DpIRPLephdr5jc9gMu1B1Iuw/exec';
const ADMIN_USER = 'doudouNi';
const ADMIN_PASS = 'nini99104';

/* ════════════════════════════════════════
   State
════════════════════════════════════════ */
let currentAgent   = null;
let currentBalance = 0;
let isAdmin        = false;
let adminAgentData = [];
let orderRowCount  = 0;

/* ════════════════════════════════════════
   Init（頁面載入執行）
════════════════════════════════════════ */
(function init() {
  // 代理下拉選單 doudou001 ~ doudou030
  const sel = document.getElementById('login-select');
  for (let i = 1; i <= 30; i++) {
    const code = 'doudou' + String(i).padStart(3, '0');
    const opt  = document.createElement('option');
    opt.value = code; opt.textContent = code;
    sel.appendChild(opt);
  }
  // 預設今天日期
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('dep-date').value      = today;
  document.getElementById('ck-date').value       = today;
  document.getElementById('admin-ck-date').value = today;
  // 後台初始一筆空訂單
  addOrderRow();
})();

/* ════════════════════════════════════════
   Utility Helpers
════════════════════════════════════════ */
const $    = id => document.getElementById(id);
const show = id => $(id).style.display = 'block';
const hide = id => $(id).style.display = 'none';

function showLoading() { $('loading-overlay').classList.add('active'); }
function hideLoading() { $('loading-overlay').classList.remove('active'); }

function showAlert(id, msg, type = 'error') {
  const el = $(id);
  el.textContent = msg;
  el.className   = 'alert ' + type + ' show';
}
function clearAlert(id) {
  const el = $(id);
  el.className   = 'alert error';
  el.textContent = '';
}

async function callScript(payload) {
  const res = await fetch(GOOGLE_SCRIPT_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'text/plain' },
    body:    JSON.stringify(payload)
  });
  return res.json();
}

function fmtNum(n) { return Number(n || 0).toLocaleString(); }

/* ════════════════════════════════════════
   登入頁切換
════════════════════════════════════════ */
function showAdminLogin() {
  hide('login-section');
  show('admin-login-section');
}
function showAgentLogin() {
  hide('admin-login-section');
  show('login-section');
}

/* ════════════════════════════════════════
   代理登入 / 登出
════════════════════════════════════════ */
async function doLogin() {
  clearAlert('login-alert');
  const agentCode = $('login-select').value;
  const phone     = $('login-phone').value.trim();
  if (!agentCode) { showAlert('login-alert', '請選擇代理代碼'); return; }
  if (!phone)     { showAlert('login-alert', '請輸入手機號碼'); return; }

  showLoading();
  try {
    const data = await callScript({ action: 'login', agentCode, phone });
    if (data.success) {
      currentAgent   = data.agentCode;
      currentBalance = Number(data.balance);
      renderDashboard(data);
      hide('login-section');
      show('dashboard');
      show('notice-banner');
      show('main-section');
    } else {
      showAlert('login-alert', data.message || '登入失敗，請確認代理代碼與手機號碼');
    }
  } catch {
    showAlert('login-alert', '⚠️ 無法連線至伺服器，請稍後再試');
  } finally {
    hideLoading();
  }
}

function doLogout() {
  currentAgent = null; currentBalance = 0;
  hide('dashboard'); hide('notice-banner');
  hide('main-section'); hide('result-section');
  show('login-section');
  clearAlert('global-alert');
}

/* ════════════════════════════════════════
   管理員登入 / 登出
════════════════════════════════════════ */
function doAdminLogin() {
  clearAlert('admin-login-alert');
  const u = $('admin-username').value.trim();
  const p = $('admin-password').value;
  if (u !== ADMIN_USER || p !== ADMIN_PASS) {
    showAlert('admin-login-alert', '❌ 帳號或密碼錯誤'); return;
  }
  isAdmin = true;
  hide('admin-login-section');
  show('admin-dashboard');
  show('admin-section');
  loadPendingDeposits();
  loadAdminAgents();
}

function doAdminLogout() {
  isAdmin = false;
  hide('admin-dashboard'); hide('admin-section');
  show('login-section');
  clearAlert('admin-global-alert');
}

/* ════════════════════════════════════════
   代理儀表板渲染
════════════════════════════════════════ */
function renderDashboard(data) {
  const label = data.agentName
    ? data.agentCode + '（' + data.agentName + '）'
    : data.agentCode;
  $('dash-name').textContent    = label;
  $('dash-balance').textContent = fmtNum(data.balance);
  renderHistory(data.history || []);
}

function updateBalance(v) {
  currentBalance = Number(v);
  $('dash-balance').textContent = fmtNum(v);
}

function renderHistory(list) {
  const box = $('history-box');
  if (!list.length) {
    box.innerHTML = '<div class="history-empty">尚無交易紀錄</div>';
    return;
  }
  box.innerHTML = list.map(h => `
    <div class="history-row">
      <div class="history-info">
        <div class="history-type">${h.type}</div>
        <div class="history-date">${h.date || ''}</div>
      </div>
      <span class="history-badge">${h.status}</span>
      <span class="history-amt ${h.type === '儲值' ? 'clr-plus' : 'clr-minus'}">
        ${h.type === '儲值' ? '+' : '−'}${fmtNum(h.amount)}
      </span>
    </div>`).join('');
}

/* ════════════════════════════════════════
   代理 Tab 切換
════════════════════════════════════════ */
function switchTab(tab) {
  document.querySelectorAll('#main-section .tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('#main-section .tab-btn').forEach(b => b.classList.remove('active'));
  $('tab-' + tab).classList.add('active');
  $('tab-btn-' + tab).classList.add('active');
  clearAlert('global-alert');
  hide('result-section');
}

/* ════════════════════════════════════════
   代理儲值送出
════════════════════════════════════════ */
async function submitDeposit() {
  clearAlert('global-alert');
  const date   = $('dep-date').value;
  const raw    = $('dep-amount').value;
  const amount = Number(raw);
  const last5  = $('dep-last5').value.trim();
  const chk    = $('dep-confirm').checked;

  if (!date)                  { showAlert('global-alert', '⚠️ 請選擇匯款日期'); return; }
  if (!raw || amount <= 0)    { showAlert('global-alert', '⚠️ 請輸入儲值金額'); return; }
  if (amount < 2000)          { showAlert('global-alert', '⚠️ 儲值金額最低為 NT$ 2,000'); return; }
  if (amount % 1000 !== 0)    { showAlert('global-alert', '⚠️ 儲值金額須為 1,000 的倍數'); return; }
  if (!/^\d{5}$/.test(last5)) { showAlert('global-alert', '⚠️ 請輸入正確的帳號末五碼（5 位數字）'); return; }
  if (!chk)                   { showAlert('global-alert', '⚠️ 請勾選確認已完成匯款'); return; }

  showLoading();
  try {
    const data = await callScript({
      action: 'transaction', type: '儲值',
      agentCode: currentAgent, amount, date,
      note: '帳號末五碼：' + last5
    });
    if (data.success) {
      updateBalance(data.newBalance);
      renderHistory(data.history || []);
      $('dep-amount').value    = '';
      $('dep-last5').value     = '';
      $('dep-confirm').checked = false;
      showResult(makeCopy({ type: '儲值回報', date, amount, note: '帳號末五碼：' + last5, status: '待審核' }));
    } else {
      showAlert('global-alert', '❌ ' + (data.message || '送出失敗'));
    }
  } catch {
    showAlert('global-alert', '⚠️ 網路錯誤，請稍後再試');
  } finally {
    hideLoading();
  }
}

/* ════════════════════════════════════════
   代理結帳送出
════════════════════════════════════════ */
async function submitCheckout() {
  clearAlert('global-alert');
  const date   = $('ck-date').value;
  const amount = Number($('ck-amount').value);
  const note   = $('ck-note').value.trim();

  if (!date)                   { showAlert('global-alert', '⚠️ 請選擇結帳日期'); return; }
  if (!amount || amount <= 0)  { showAlert('global-alert', '⚠️ 請輸入正確的結帳金額'); return; }
  if (!note)                   { showAlert('global-alert', '⚠️ 請填寫訂單項目說明'); return; }
  if (amount > currentBalance) {
    showAlert('global-alert', `❌ 餘額不足！可用餘額 NT$ ${fmtNum(currentBalance)}，結帳金額 NT$ ${fmtNum(amount)} 超出額度。`);
    return;
  }

  showLoading();
  try {
    const data = await callScript({
      action: 'transaction', type: '消費',
      agentCode: currentAgent, amount, date, note
    });
    if (data.success) {
      updateBalance(data.newBalance);
      renderHistory(data.history || []);
      $('ck-amount').value = ''; $('ck-note').value = '';
      $('calc-result').style.display = 'none';
      showResult(makeCopy({ type: '單筆結帳', date, amount, note, status: '已確認' }));
    } else {
      showAlert('global-alert', '❌ ' + (data.message || '送出失敗'));
    }
  } catch {
    showAlert('global-alert', '⚠️ 網路錯誤，請稍後再試');
  } finally {
    hideLoading();
  }
}

/* ════════════════════════════════════════
   KRW Calculator（代理端）
════════════════════════════════════════ */
function addKrwRow() {
  const row = document.createElement('div');
  row.className = 'krw-row';
  row.innerHTML = `
    <input type="number" class="krw-input" placeholder="輸入韓元金額 (KRW)" min="0">
    <button class="btn-rm" onclick="removeKrwRow(this)">✕</button>`;
  $('krw-list').appendChild(row);
}

function removeKrwRow(btn) {
  const rows = document.querySelectorAll('.krw-row');
  if (rows.length <= 1) {
    btn.closest('.krw-row').querySelector('input').value = '';
    return;
  }
  btn.closest('.krw-row').remove();
}

function calcKrw() {
  let total = 0;
  document.querySelectorAll('.krw-input').forEach(i => { total += Number(i.value) || 0; });
  const el = $('calc-result');
  if (total <= 0) { el.style.display = 'none'; return; }
  const twd = Math.ceil(total / 40);
  el.style.display = 'block';
  el.innerHTML = `
    🇰🇷 ${fmtNum(total)} KRW &nbsp;→&nbsp;
    🇹🇼 <span style="color:var(--accent);font-size:15px;font-weight:800;">NT$ ${fmtNum(twd)}</span>
    <button class="btn btn-outline btn-sm" style="margin-left:8px;" onclick="applyKrw(${twd})">帶入總額</button>`;
}

function applyKrw(v) { $('ck-amount').value = v; }

/* ════════════════════════════════════════
   Result 代理端
════════════════════════════════════════ */
function makeCopy({ type, date, amount, note, status }) {
  const now  = new Date().toLocaleString('zh-TW', { hour12: false });
  const icon = type === '儲值回報' ? '💰' : '🛒';
  return [
    `🥜 DouDou 代理${type}單`,
    `────────────────────`,
    `${icon} 類型：${type}`,
    `👤 代理編號：${currentAgent}`,
    `📅 日期：${date}`,
    `💵 金額：NT$ ${fmtNum(amount)}`,
    `📝 備註：${note}`,
    `📋 狀態：${status}`,
    `⏰ 送出時間：${now}`,
    `────────────────────`,
    `感謝您的回報，請等待阿霓確認 🙏`
  ].join('\n');
}

function showResult(text) {
  $('result-text').textContent = text;
  show('result-section');
  setTimeout(() => $('result-section').scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
}

async function copyResult() {
  const btn  = event.currentTarget;
  const text = $('result-text').textContent;
  try {
    await navigator.clipboard.writeText(text);
    const orig = btn.textContent;
    btn.textContent = '✅ 已複製！';
    setTimeout(() => { btn.textContent = orig; }, 2200);
  } catch { alert('請手動選取文字並複製'); }
}

/* ════════════════════════════════════════
   管理員 Tab 切換
════════════════════════════════════════ */
function switchAdminTab(tab) {
  document.querySelectorAll('#admin-section .tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
  $('atab-' + tab).classList.add('active');
  $('atab-btn-' + tab).classList.add('active');
  clearAlert('admin-global-alert');
}

/* ════════════════════════════════════════
   儲值審核
════════════════════════════════════════ */
async function loadPendingDeposits() {
  const el = $('pending-list');
  el.innerHTML = '<div class="pending-empty">⏳ 載入中...</div>';
  showLoading();
  try {
    const data = await callScript({ action: 'getPendingDeposits' });
    if (data.success && data.list.length > 0) {
      el.innerHTML = data.list.map((item, i) => `
        <div class="pending-item" id="pending-${i}">
          <div class="pending-info">
            <div class="pending-agent">👤 ${item.agentCode}${item.agentName ? '（' + item.agentName + '）' : ''}</div>
            <div class="pending-detail">
              📅 ${item.date} ・ 備註：${item.note}<br>
              序號：${item.seq} ・ 送出：${item.time}
            </div>
          </div>
          <div style="text-align:right; flex-shrink:0;">
            <div class="pending-amount">+NT$ ${fmtNum(item.amount)}</div>
            <button class="btn btn-success btn-sm" style="margin-top:6px;"
              onclick="approveDeposit(${item.row}, ${i})">✅ 確認入帳</button>
          </div>
        </div>`).join('');
    } else {
      el.innerHTML = '<div class="pending-empty">✅ 目前沒有待審核的儲值</div>';
    }
  } catch {
    el.innerHTML = '<div class="pending-empty">❌ 載入失敗，請重試</div>';
  } finally {
    hideLoading();
  }
}

async function approveDeposit(rowNum, idx) {
  if (!confirm('確認將此筆儲值標記為「已確認」並入帳？')) return;
  showLoading();
  try {
    const data = await callScript({ action: 'approveDeposit', rowNum });
    if (data.success) {
      const item = $('pending-' + idx);
      if (item) {
        item.classList.add('approved');
        item.querySelector('button').textContent = '✅ 已入帳';
      }
      showAlert('admin-global-alert', '✅ 入帳成功！代理餘額已更新。', 'success');
    } else {
      showAlert('admin-global-alert', '❌ ' + (data.message || '審核失敗'));
    }
  } catch {
    showAlert('admin-global-alert', '⚠️ 網路錯誤');
  } finally {
    hideLoading();
  }
}

/* ════════════════════════════════════════
   載入代理列表
════════════════════════════════════════ */
async function loadAdminAgents() {
  showLoading();
  try {
    const data = await callScript({ action: 'getAgentList' });
    if (data.success) {
      adminAgentData = data.agents;
      // 填入結帳選單
      const sel = $('admin-agent-select');
      sel.innerHTML = '<option value="">請選擇代理</option>';
      data.agents.forEach(a => {
        const opt = document.createElement('option');
        opt.value          = a.code;
        opt.textContent    = a.code + (a.name ? '（' + a.name + '）' : '');
        opt.dataset.balance = a.balance;
        opt.dataset.rate    = a.rate || 40;
        sel.appendChild(opt);
      });
      // 填入設定表格
      renderAgentSettingsTable(data.agents);
    }
  } catch { /* silent */ } finally { hideLoading(); }
}

function onAdminAgentChange() {
  const sel = $('admin-agent-select');
  const opt = sel.options[sel.selectedIndex];
  const balEl = $('admin-agent-balance');
  if (opt && opt.value) {
    const bal  = Number(opt.dataset.balance) || 0;
    const rate = Number(opt.dataset.rate)    || 40;
    balEl.textContent = 'NT$ ' + fmtNum(bal) + '　（匯率 ×' + rate + '）';
    balEl.style.color = bal >= 0 ? 'var(--success)' : 'var(--accent)';
    document.querySelectorAll('.order-rate-display').forEach(el => { el.textContent = rate; });
    recalcAllRows();
  } else {
    balEl.textContent = '－';
    balEl.style.color = 'var(--text-muted)';
  }
}

function getSelectedRate() {
  const sel = $('admin-agent-select');
  const opt = sel.options[sel.selectedIndex];
  return (opt && opt.dataset.rate) ? Number(opt.dataset.rate) : 40;
}
function getSelectedBalance() {
  const sel = $('admin-agent-select');
  const opt = sel.options[sel.selectedIndex];
  return (opt && opt.dataset.balance) ? Number(opt.dataset.balance) : 0;
}

/* ════════════════════════════════════════
   訂單明細列
════════════════════════════════════════ */
function addOrderRow() {
  orderRowCount++;
  const idx  = orderRowCount;
  const rate = getSelectedRate();
  const div  = document.createElement('div');
  div.className = 'order-row';
  div.id        = 'order-row-' + idx;
  div.innerHTML = `
    <div class="order-row-header">
      <span class="order-row-num">品項 #${idx}</span>
      <button class="order-row-del" onclick="removeOrderRow(${idx})">✕ 刪除</button>
    </div>
    <div class="order-field form-row">
      <label>📝 備註</label>
      <input type="text" id="row-note-${idx}" placeholder="例：運動鞋、記事本">
    </div>
    <div class="order-grid-dates">
      <div class="order-field">
        <label>訂購日期</label>
        <input type="date" id="row-order-date-${idx}">
      </div>
      <div class="order-field">
        <label>賣貨便出貨日</label>
        <input type="date" id="row-ship-date-${idx}">
      </div>
    </div>
    <div class="order-grid-dates-3">
      <div class="order-field">
        <label>批網配貨日</label>
        <input type="date" id="row-batch-date-${idx}">
      </div>
      <div class="order-field">
        <label>空運發貨</label>
        <input type="date" id="row-air-date-${idx}">
      </div>
      <div class="order-field">
        <label>斷貨退款日期</label>
        <input type="date" id="row-refund-date-${idx}" onchange="onRefundDateChange(${idx})">
      </div>
    </div>
    <div class="order-grid-nums">
      <div class="order-field">
        <label>數量</label>
        <input type="number" id="row-qty-${idx}" placeholder="1" min="1" value="1" oninput="recalcRow(${idx})">
      </div>
      <div class="order-field">
        <label>韓幣單價</label>
        <input type="number" id="row-krw-${idx}" placeholder="0" min="0" oninput="recalcRow(${idx})">
      </div>
      <div class="order-field">
        <label>台幣單價（×<span class="order-rate-display">${rate}</span>）</label>
        <input type="number" id="row-twd-${idx}" class="auto-field" readonly placeholder="自動換算">
      </div>
      <div class="order-field">
        <label>韓幣總計</label>
        <input type="number" id="row-krw-total-${idx}" class="auto-field" readonly placeholder="自動計算">
      </div>
      <div class="order-field">
        <label>台幣總價</label>
        <input type="number" id="row-twd-total-${idx}" class="auto-field" readonly placeholder="自動計算">
      </div>
    </div>
    <div class="order-row-subtotal" id="row-subtotal-${idx}">
      <span>小計</span><strong>NT$ 0</strong>
    </div>`;
  $('order-rows').appendChild(div);
}

function removeOrderRow(idx) {
  const el = $('order-row-' + idx);
  if (el) el.remove();
  recalcAllRows();
}

function onRefundDateChange(idx) {
  const row = $('order-row-' + idx);
  if (!row) return;
  const hasRefund = !!$('row-refund-date-' + idx).value;
  if (hasRefund) {
    row.classList.add('discontinued');
    row.querySelector('.order-row-num').innerHTML = `品項 #${idx} <span class="disc-badge">斷貨退款</span>`;
  } else {
    row.classList.remove('discontinued');
    row.querySelector('.order-row-num').textContent = '品項 #' + idx;
  }
  recalcRow(idx);
}

function recalcRow(idx) {
  const rate  = getSelectedRate();
  const qty   = Number($('row-qty-' + idx)?.value)  || 0;
  const krw   = Number($('row-krw-' + idx)?.value)  || 0;
  const twdU  = krw ? Math.ceil(krw / rate) : 0;
  const krwT  = qty * krw;
  const twdT  = qty * twdU;

  if ($('row-twd-' + idx))       $('row-twd-' + idx).value       = krw ? twdU : '';
  if ($('row-krw-total-' + idx)) $('row-krw-total-' + idx).value = krwT || '';
  if ($('row-twd-total-' + idx)) $('row-twd-total-' + idx).value = twdT || '';

  const isRefund = !!($('row-refund-date-' + idx)?.value);
  const subEl    = $('row-subtotal-' + idx);
  if (subEl) {
    subEl.innerHTML = isRefund
      ? `<span>退款小計</span><strong style="color:var(--success)">－NT$ ${fmtNum(twdT)}</strong>`
      : `<span>小計</span><strong>NT$ ${fmtNum(twdT)}</strong>`;
  }
}

function recalcAllRows() {
  document.querySelectorAll('.order-row').forEach(row => {
    recalcRow(row.id.replace('order-row-', ''));
  });
}

function calcAdminSummary() {
  let total = 0, refund = 0;
  document.querySelectorAll('.order-row').forEach(row => {
    const idx   = row.id.replace('order-row-', '');
    const twdT  = Number($('row-twd-total-' + idx)?.value) || 0;
    const isRef = !!($('row-refund-date-' + idx)?.value);
    if (isRef) refund += twdT;
    else       total  += twdT;
  });
  const net   = total - refund;
  const after = getSelectedBalance() - net;
  $('sum-total').textContent  = 'NT$ ' + fmtNum(total);
  $('sum-refund').textContent = '－NT$ ' + fmtNum(refund);
  $('sum-net').textContent    = 'NT$ ' + fmtNum(net);
  $('sum-after-balance').textContent = 'NT$ ' + fmtNum(after);
  $('sum-after-balance').style.color = after >= 0 ? 'var(--success)' : 'var(--accent)';
  show('checkout-summary');
}

/* ════════════════════════════════════════
   後台結帳送出
════════════════════════════════════════ */
async function submitAdminCheckout() {
  clearAlert('admin-global-alert');
  const agentCode = $('admin-agent-select').value;
  const date      = $('admin-ck-date').value;
  const batchNote = $('admin-ck-note').value.trim();

  if (!agentCode) { showAlert('admin-global-alert', '⚠️ 請選擇代理'); return; }
  if (!date)      { showAlert('admin-global-alert', '⚠️ 請選擇結帳日期'); return; }

  const orders  = [];
  let hasItem   = false;
  document.querySelectorAll('.order-row').forEach(row => {
    const idx = row.id.replace('order-row-', '');
    const qty = Number($('row-qty-' + idx)?.value) || 0;
    const krw = Number($('row-krw-' + idx)?.value) || 0;
    if (qty <= 0 && krw <= 0) return;
    hasItem = true;
    orders.push({
      note:       $('row-note-' + idx)?.value       || '',
      orderDate:  $('row-order-date-' + idx)?.value || '',
      shipDate:   $('row-ship-date-' + idx)?.value  || '',
      batchDate:  $('row-batch-date-' + idx)?.value || '',
      airDate:    $('row-air-date-' + idx)?.value   || '',
      refundDate: $('row-refund-date-' + idx)?.value|| '',
      qty,
      krwUnit:  krw,
      twdUnit:  Number($('row-twd-' + idx)?.value)       || 0,
      krwTotal: Number($('row-krw-total-' + idx)?.value) || 0,
      twdTotal: Number($('row-twd-total-' + idx)?.value) || 0,
      isRefund: !!($('row-refund-date-' + idx)?.value)
    });
  });

  if (!hasItem) { showAlert('admin-global-alert', '⚠️ 請至少填寫一筆品項'); return; }

  calcAdminSummary();
  const net = orders.reduce((s, o) => o.isRefund ? s - o.twdTotal : s + o.twdTotal, 0);
  const bal = getSelectedBalance();
  if (net > 0 && net > bal) {
    if (!confirm(`⚠️ 代理餘額不足！\n目前餘額：NT$ ${fmtNum(bal)}\n實收金額：NT$ ${fmtNum(net)}\n確定仍要送出？`)) return;
  }

  showLoading();
  try {
    const data = await callScript({ action: 'adminCheckout', agentCode, date, batchNote, orders, netAmount: net });
    if (data.success) {
      // 更新選單餘額快取
      const sel = $('admin-agent-select');
      const opt = sel.options[sel.selectedIndex];
      if (opt) opt.dataset.balance = data.newBalance;
      $('admin-agent-balance').textContent = 'NT$ ' + fmtNum(data.newBalance) + '　（匯率 ×' + getSelectedRate() + '）';
      // 結帳文案
      $('admin-result-text').textContent = buildAdminCopy(agentCode, date, batchNote, orders, net, data.newBalance);
      $('admin-result-section').style.display = 'block';
      $('admin-result-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
      showAlert('admin-global-alert', '✅ 結帳成功！代理餘額已扣除。', 'success');
      // 重置
      $('order-rows').innerHTML = '';
      orderRowCount = 0;
      addOrderRow();
      hide('checkout-summary');
    } else {
      showAlert('admin-global-alert', '❌ ' + (data.message || '送出失敗'));
    }
  } catch {
    showAlert('admin-global-alert', '⚠️ 網路錯誤，請稍後再試');
  } finally {
    hideLoading();
  }
}

function buildAdminCopy(agentCode, date, batchNote, orders, net, newBal) {
  const now = new Date().toLocaleString('zh-TW', { hour12: false });
  let lines = [
    `🥜 DouDou 代理結帳單`,
    `────────────────────`,
    `👤 代理：${agentCode}`,
    `📅 結帳日期：${date}`,
    `📝 批次備註：${batchNote || '無'}`,
    `────────────────────`
  ].join('\n');

  orders.forEach((o, i) => {
    lines += `\n\n【品項 ${i + 1}${o.isRefund ? '（斷貨退款）' : ''}】`;
    if (o.note)       lines += `\n備註：${o.note}`;
    if (o.orderDate)  lines += `\n訂購日期：${o.orderDate}`;
    if (o.batchDate)  lines += `\n批網配貨日：${o.batchDate}`;
    if (o.shipDate)   lines += `\n賣貨便出貨日：${o.shipDate}`;
    if (o.airDate)    lines += `\n空運發貨：${o.airDate}`;
    if (o.refundDate) lines += `\n斷貨退款日期：${o.refundDate}`;
    lines += `\n數量：${o.qty}　韓幣單價：${fmtNum(o.krwUnit)}　台幣單價：${fmtNum(o.twdUnit)}`;
    lines += `\n韓幣總計：${fmtNum(o.krwTotal)}　${o.isRefund ? '退款金額' : '台幣總價'}：${fmtNum(o.twdTotal)}`;
  });

  lines += [
    `\n\n────────────────────`,
    `💵 實收金額：NT$ ${fmtNum(net)}`,
    `💰 結帳後餘額：NT$ ${fmtNum(newBal)}`,
    `⏰ 操作時間：${now}`
  ].join('\n');
  return lines;
}

async function copyAdminResult() {
  const btn  = event.currentTarget;
  const text = $('admin-result-text').textContent;
  try {
    await navigator.clipboard.writeText(text);
    const orig = btn.textContent;
    btn.textContent = '✅ 已複製！';
    setTimeout(() => { btn.textContent = orig; }, 2200);
  } catch { alert('請手動選取文字並複製'); }
}

/* ════════════════════════════════════════
   系統設定 — 代理資料表格
════════════════════════════════════════ */
function renderAgentSettingsTable(agents) {
  const tbody = $('agent-settings-body');
  if (!agents || !agents.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-light);padding:16px;">無代理資料</td></tr>';
    return;
  }
  tbody.innerHTML = agents.map((a, i) => `
    <tr>
      <td><strong>${a.code}</strong></td>
      <td><input type="text"   id="st-name-${i}"  value="${a.name  || ''}" placeholder="名稱"></td>
      <td><input type="text"   id="st-phone-${i}" value="${a.phone || ''}" placeholder="手機號碼" inputmode="tel"></td>
      <td><input type="number" id="st-rate-${i}"  value="${a.rate  || 40}" min="1" max="100" style="width:70px;"></td>
      <td style="font-weight:700; color:var(--primary-dark);">NT$ ${fmtNum(a.balance)}</td>
      <td><button class="btn btn-admin btn-xs" onclick="saveAgentRow('${a.code}', ${i})">儲存</button></td>
    </tr>`).join('');
}

async function saveAgentRow(code, i) {
  const name  = $('st-name-'  + i)?.value.trim() || '';
  const phone = $('st-phone-' + i)?.value.trim() || '';
  const rate  = Number($('st-rate-' + i)?.value) || 40;
  showLoading();
  try {
    const data = await callScript({ action: 'updateAgent', code, name, phone, rate });
    if (data.success) {
      showAlert('admin-global-alert', `✅ ${code} 資料已更新`, 'success');
      const agent = adminAgentData.find(a => a.code === code);
      if (agent) { agent.name = name; agent.phone = phone; agent.rate = rate; }
      // 同步更新結帳選單 rate
      Array.from($('admin-agent-select').options).forEach(opt => {
        if (opt.value === code) opt.dataset.rate = rate;
      });
    } else {
      showAlert('admin-global-alert', '❌ ' + (data.message || '更新失敗'));
    }
  } catch {
    showAlert('admin-global-alert', '⚠️ 網路錯誤');
  } finally {
    hideLoading();
  }
}

/* ════════════════════════════════════════
   系統設定 — 公告日期
════════════════════════════════════════ */
async function saveAnnounceDates() {
  const wed = $('setting-wed-date').value;
  const sun = $('setting-sun-date').value;
  if (!wed && !sun) { showAlert('admin-global-alert', '⚠️ 請至少填寫一個日期'); return; }
  showLoading();
  try {
    const data = await callScript({ action: 'saveSettings', wedDate: wed, sunDate: sun });
    if (data.success) {
      showAlert('admin-global-alert', '✅ 公告日期已儲存', 'success');
      updateMarquee(wed, sun);
    } else {
      showAlert('admin-global-alert', '❌ ' + (data.message || '儲存失敗'));
    }
  } catch {
    showAlert('admin-global-alert', '⚠️ 網路錯誤');
  } finally {
    hideLoading();
  }
}

function updateMarquee(wed, sun) {
  const wedStr = wed ? `週三（${wed}）` : '週三';
  const sunStr = sun ? `週日（${sun}）` : '週日';
  const text   = `📢 儲值入帳時間調整通知 ・ 🗓️ 下次入帳日：${wedStr} & ${sunStr} ・ ⚠️ 週三入帳→請週三前完成匯款 ・ ⚠️ 週日入帳→請週日前完成匯款 ・ 當天匯款將順延至下一個入帳日 ・ 請提前儲值，避免額度不足 🥹 ・ 謝謝大家的配合與理解 ♡`;
  document.querySelectorAll('.marquee-item').forEach(el => { el.textContent = text; });
}
