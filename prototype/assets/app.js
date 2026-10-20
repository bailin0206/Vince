/* 应用外壳：路由、导航、投影模式、锁定屏、事件分发 */
(function () {
  const ROUTES = ['today', 'lists', 'dictation', 'errors', 'schedule', 'exams', 'settings'];
  const TITLES = {
    today: '今日', lists: '单词合集', dictation: '听写中心', errors: '错词分析',
    schedule: '课表与备课', exams: '成绩分析', settings: '设置与备份', soon: '建设中'
  };
  const App = { route: { name: 'today', params: [] } };

  function parseHash() {
    const raw = location.hash.replace(/^#\/?/, '');
    const parts = raw.split('/').filter(Boolean);
    const name = parts.length ? parts[0] : 'today';
    return { name: ROUTES.indexOf(name) >= 0 ? name : 'today', params: parts.slice(1) };
  }

  App.locked = function () {
    const pw = Store.settings.passwordHash;
    if (!pw) return false;
    if (sessionStorage.getItem('etw:auth') === '1') return false;
    const until = Number(localStorage.getItem('etw:v1:authUntil') || 0);
    return Date.now() > until;
  };

  App.unlock = function (remember) {
    sessionStorage.setItem('etw:auth', '1');
    if (remember) {
      const days = Number(Store.settings.rememberLoginDays || 30);
      localStorage.setItem('etw:v1:authUntil', String(Date.now() + days * 86400000));
    }
    const box = document.getElementById('lockScreen');
    if (box) box.remove();
    App.render();
  };

  App.logout = function () {
    sessionStorage.removeItem('etw:auth');
    localStorage.removeItem('etw:v1:authUntil');
    location.reload();
  };

  function renderLock() {
    if (document.getElementById('lockScreen')) return;
    const el = document.createElement('div');
    el.id = 'lockScreen';
    el.className = 'lock-screen';
    el.innerHTML =
      '<form class="lock-card" id="lockForm">' +
        '<div class="brand-mark">EN</div>' +
        '<h2>英语教学工作台</h2>' +
        '<p>请输入教师密码继续</p>' +
        '<input class="input" type="password" id="lockPw" autocomplete="current-password" placeholder="密码">' +
        '<label class="check" style="justify-content:center;margin-bottom:14px">' +
          '<input type="checkbox" id="lockRemember" checked> 本机记住 ' + Number(Store.settings.rememberLoginDays || 30) + ' 天' +
        '</label>' +
        '<button class="btn btn-primary btn-block btn-lg" type="submit">进入</button>' +
        '<p class="tiny" style="margin-top:14px">原型阶段密码只存在本机浏览器，仅作门禁，不加密数据。</p>' +
      '</form>';
    document.body.appendChild(el);
    el.querySelector('#lockForm').addEventListener('submit', e => {
      e.preventDefault();
      const v = el.querySelector('#lockPw').value;
      if (v === Store.settings.passwordHash) App.unlock(el.querySelector('#lockRemember').checked);
      else {
        el.querySelector('#lockPw').style.borderColor = 'var(--c-danger)';
        UI.toast('密码不对，再试一次', { type: 'err' });
      }
    });
    setTimeout(() => el.querySelector('#lockPw').focus(), 80);
  }

  function setActiveNav(name) {
    document.querySelectorAll('[data-nav]').forEach(a => {
      a.classList.toggle('active', a.dataset.nav === name);
    });
    document.querySelectorAll('[data-tab]').forEach(a => {
      a.classList.toggle('active', a.dataset.tab === name);
    });
  }

  function paintChrome(name) {
    document.getElementById('pageTitle').textContent = TITLES[name] || '今日';
    setActiveNav(name);
    const chip = document.getElementById('backupChip');
    if (chip) {
      const last = (Store.settings.backup || {}).lastExportAt || '';
      const days = last ? U.daysBetween(last, U.today()) : 99;
      const remind = Number((Store.settings.backup || {}).remindDays || 14);
      chip.textContent = last ? '上次备份：' + U.relDay(last) : '还没有备份过';
      chip.classList.toggle('warn', days > remind);
      chip.title = '点击去备份';
      if (chip.dataset.bound !== '1') {
        chip.dataset.bound = '1';
        chip.addEventListener('click', () => { location.hash = '#/settings'; });
      }
    }
    const proj = !!(Store.settings.ui && Store.settings.ui.projectionMode);
    document.body.classList.toggle('proj', proj);
    const btn = document.getElementById('projBtn');
    if (btn) btn.textContent = proj ? '退出投影' : '投影模式';
  }

  App.render = function () {
    if (App.locked()) { renderLock(); return; }
    const r = parseHash();
    App.route = r;
    const page = window.Pages[r.name] || window.Pages.soon;
    paintChrome(r.name);
    const view = document.getElementById('view');
    try {
      view.innerHTML = page.render(r.params);
    } catch (err) {
      console.error(err);
      view.innerHTML = '<div class="card"><div class="empty"><h3>这个页面出了点问题</h3><p>' +
        U.esc(err.message) + '</p></div></div>';
      return;
    }
    if (page.mount) page.mount(r.params);
    window.scrollTo(0, 0);
  };

  App.refresh = function () { App.render(); };
  App.go = function (hash) { location.hash = hash; };

  function currentPage() {
    return window.Pages[App.route.name] || window.Pages.soon;
  }

  function bindView() {
    const view = document.getElementById('view');

    view.addEventListener('click', e => {
      const el = e.target.closest('[data-act]');
      if (!el) return;
      const page = currentPage();
      const fn = page.actions && page.actions[el.dataset.act];
      if (!fn) return;
      // 复选框靠浏览器原生切换，不能阻止默认行为，否则读到的 checked 是旧值
      if (el.tagName === 'A' || el.tagName === 'BUTTON') e.preventDefault();
      fn(el, e);
    });

    view.addEventListener('input', e => {
      const el = e.target.closest('[data-input]');
      if (!el) return;
      const page = currentPage();
      if (page.onInput) page.onInput(el.dataset.input, el.value, el);
    });

    view.addEventListener('change', e => {
      const el = e.target.closest('[data-change]');
      if (!el) return;
      const page = currentPage();
      if (page.onChange) page.onChange(el.dataset.change, el.value, el);
    });

    view.addEventListener('submit', e => {
      const form = e.target.closest('[data-form]');
      if (!form) return;
      e.preventDefault();
      const page = currentPage();
      if (page.onSubmit) page.onSubmit(form.dataset.form, form);
    });
  }

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-app]');
    if (!el) return;
    const act = el.dataset.app;
    if (act === 'proj') {
      Store.settings.ui = Store.settings.ui || {};
      Store.settings.ui.projectionMode = !Store.settings.ui.projectionMode;
      Store.saveSettings();
      paintChrome(App.route.name);
    }
    if (act === 'more') {
      UI.sheet('更多', [
        { label: '课表与备课', href: '#/schedule' },
        { label: '成绩分析', href: '#/exams', pill: '第三期' },
        { label: '设置与备份', href: '#/settings' },
        { label: '学生听写入口', pill: '第二期' },
        { label: '关于我', pill: '第二期' }
      ]);
    }
  });

  App.init = function () {
    Store.init();
    bindView();
    window.addEventListener('hashchange', App.render);
    App.render();
  };

  window.App = App;
  document.addEventListener('DOMContentLoaded', App.init);
})();
