/* 通用交互组件：Toast / Modal / 二次确认 / 抽屉 / 菜单 / 底部面板 */
(function () {
  const UI = { stack: [] };

  UI.modal = function (opt) {
    opt = opt || {};
    const wrap = document.createElement('div');
    wrap.className = 'modal';
    wrap.innerHTML =
      '<div class="modal-card' + (opt.wide ? ' wide' : '') + '" role="dialog" aria-modal="true">' +
        '<div class="modal-head"><h3>' + U.esc(opt.title || '') + '</h3>' +
          '<button class="icon-btn" data-ui-close aria-label="关闭">✕</button></div>' +
        '<div class="modal-body">' + (opt.body || '') + '</div>' +
        (opt.footer ? '<div class="modal-foot">' + opt.footer + '</div>' : '') +
      '</div>';
    document.body.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('in'));

    function close() {
      wrap.classList.remove('in');
      setTimeout(() => wrap.remove(), 180);
      UI.stack = UI.stack.filter(x => x !== close);
      if (opt.onClose) opt.onClose();
    }
    wrap.addEventListener('click', e => {
      if (e.target === wrap && opt.dismiss !== false) close();
    });
    wrap.querySelectorAll('[data-ui-close]').forEach(b => b.addEventListener('click', close));
    UI.stack.push(close);
    return {
      el: wrap,
      body: wrap.querySelector('.modal-body'),
      foot: wrap.querySelector('.modal-foot'),
      close
    };
  };

  UI.confirm = function (o) {
    o = o || {};
    return new Promise(resolve => {
      let settled = false;
      const need = o.requireText || '';
      const body = '<p class="confirm-msg">' + (o.message || '') + '</p>' +
        (need ? '<div class="field" style="margin-top:14px"><label class="label">请输入 <code>' +
          U.esc(need) + '</code> 确认</label><input class="input" data-req autocomplete="off"></div>' : '');
      const m = UI.modal({
        title: o.title || '确认操作',
        body,
        footer: '<button class="btn" data-no>取消</button>' +
          '<button class="btn ' + (o.danger ? 'btn-danger' : 'btn-primary') + '" data-yes ' +
          (need ? 'disabled' : '') + '>' + U.esc(o.confirmText || '确定') + '</button>'
      });
      const yes = m.foot.querySelector('[data-yes]');
      const req = m.body.querySelector('[data-req]');
      if (req) {
        req.addEventListener('input', () => {
          yes.disabled = req.value.trim() !== need;
        });
        setTimeout(() => req.focus(), 60);
      }
      function done(v) {
        if (settled) return;
        settled = true;
        m.close();
        resolve(v);
      }
      m.foot.querySelector('[data-no]').addEventListener('click', () => done(false));
      yes.addEventListener('click', () => { if (!yes.disabled) done(true); });
      m.el.addEventListener('click', e => { if (e.target === m.el) done(false); });
      m.el.querySelector('[data-ui-close]').addEventListener('click', () => done(false));
    });
  };

  UI.drawer = function (opt) {
    opt = opt || {};
    const wrap = document.createElement('div');
    wrap.className = 'drawer';
    wrap.innerHTML =
      '<div class="drawer-card" role="dialog" aria-modal="true">' +
        '<div class="drawer-head"><div style="flex:1;min-width:0">' +
          '<h3>' + U.esc(opt.title || '') + '</h3>' +
          (opt.sub ? '<div class="sub">' + opt.sub + '</div>' : '') +
        '</div><button class="icon-btn" data-ui-close aria-label="关闭">✕</button></div>' +
        '<div class="drawer-body">' + (opt.body || '') + '</div>' +
        (opt.footer ? '<div class="drawer-foot">' + opt.footer + '</div>' : '') +
      '</div>';
    document.body.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('in'));
    function close() {
      wrap.classList.remove('in');
      setTimeout(() => wrap.remove(), 200);
      UI.stack = UI.stack.filter(x => x !== close);
    }
    wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
    wrap.querySelectorAll('[data-ui-close]').forEach(b => b.addEventListener('click', close));
    UI.stack.push(close);
    return { el: wrap, body: wrap.querySelector('.drawer-body'), close };
  };

  UI.toast = function (msg, opt) {
    opt = opt || {};
    const root = document.getElementById('toast-root');
    const el = document.createElement('div');
    el.className = 'toast' + (opt.type ? ' ' + opt.type : '');
    el.innerHTML = '<span>' + U.esc(msg) + '</span>' +
      (opt.undo ? '<button data-undo>撤销</button>' : '');
    root.appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    let killed = false;
    function kill() {
      if (killed) return;
      killed = true;
      el.classList.remove('in');
      setTimeout(() => el.remove(), 220);
    }
    if (opt.undo) {
      el.querySelector('[data-undo]').addEventListener('click', () => {
        opt.undo();
        kill();
      });
    }
    setTimeout(kill, opt.duration || 3200);
  };

  UI.sheet = function (title, items) {
    const body = items.map(it => {
      const inner = '<span>' + U.esc(it.label) + '</span>' +
        (it.pill ? '<span class="pill ' + (it.pillClass || '') + '">' + U.esc(it.pill) + '</span>' : '');
      return it.href
        ? '<a class="sheet-item" href="' + it.href + '">' + inner + '</a>'
        : '<button class="sheet-item" style="width:100%;background:none;border:0;border-bottom:1px solid var(--c-line-soft);text-align:left;font:inherit" data-sheet="' + U.esc(it.key || '') + '">' + inner + '</button>';
    }).join('');
    const m = UI.modal({
      title: title || '',
      body: '<div style="margin:-6px 0 0">' + body + '</div>',
      footer: '<button class="btn btn-block" data-ui-close>关闭</button>'
    });
    return m;
  };

  UI.menu = function (anchor, items) {
    const old = document.querySelector('.menu');
    if (old) old.remove();
    const el = document.createElement('div');
    el.className = 'menu';
    el.innerHTML = items.map((it, i) =>
      it.sep ? '<hr>' : '<button data-i="' + i + '" class="' + (it.danger ? 'danger' : '') + '">' + U.esc(it.label) + '</button>'
    ).join('');
    document.body.appendChild(el);
    const r = anchor.getBoundingClientRect();
    const mw = el.offsetWidth, mh = el.offsetHeight;
    let left = Math.min(r.right - mw, window.innerWidth - mw - 8);
    let top = r.bottom + 6;
    if (top + mh > window.innerHeight - 8) top = Math.max(8, r.top - mh - 6);
    el.style.left = Math.max(8, left) + 'px';
    el.style.top = top + 'px';
    el.addEventListener('click', e => {
      const b = e.target.closest('button[data-i]');
      if (!b) return;
      const it = items[Number(b.dataset.i)];
      el.remove();
      if (it && it.onClick) it.onClick();
    });
    setTimeout(() => {
      const off = ev => {
        if (!el.contains(ev.target)) {
          el.remove();
          document.removeEventListener('click', off);
        }
      };
      document.addEventListener('click', off);
    }, 0);
    return el;
  };

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && UI.stack.length) {
      const fn = UI.stack[UI.stack.length - 1];
      fn();
    }
  });

  window.UI = UI;
})();
