/* 单词合集：列表 / 详情 / 批量粘贴 / CSV / 音频状态 */
(function () {
  const state = { q: '', unit: 'all', tag: 'all', audio: 'all', sort: 'updated', sel: new Set(), listId: '' };

  const P = { title: '单词合集' };

  function listStats(l) {
    const es = Store.entriesOf(l.id);
    return { n: es.length, missing: es.filter(e => e.audioStatus !== 'ready').length };
  }
  function filtered() {
    let ls = Store.db.wordlists.filter(l => !l.archived);
    const q = state.q.trim().toLowerCase();
    if (q) ls = ls.filter(l => (l.name + ' ' + l.textbook + ' ' + l.unit + ' ' + (l.tags || []).join(' ')).toLowerCase().indexOf(q) >= 0);
    if (state.unit !== 'all') ls = ls.filter(l => l.unit === state.unit);
    if (state.tag !== 'all') ls = ls.filter(l => (l.tags || []).indexOf(state.tag) >= 0);
    if (state.audio === 'missing') ls = ls.filter(l => listStats(l).missing > 0);
    if (state.audio === 'ready') ls = ls.filter(l => listStats(l).missing === 0);
    if (state.sort === 'name') ls.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
    else if (state.sort === 'size') ls.sort((a, b) => listStats(b).n - listStats(a).n);
    else ls.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    return ls;
  }

  function card(l) {
    const s = listStats(l);
    return '<article class="card list-card">' +
      '<div class="list-card-head">' +
        '<a class="list-title" href="#/lists/' + l.id + '">' + U.esc(l.name) + '</a>' +
        '<button class="kebab" data-act="menu" data-id="' + l.id + '" aria-label="更多操作">⋯</button>' +
      '</div>' +
      '<p class="tiny muted">' + U.esc(l.textbook || '未填教材') + (l.unit ? ' · ' + U.esc(l.unit) : '') + '</p>' +
      '<div class="tags">' + (l.tags || []).map(t => '<span class="tag">' + U.esc(t) + '</span>').join('') + '</div>' +
      '<div class="list-card-foot">' +
        '<span class="small">' + s.n + ' 词' + (s.missing
          ? ' · <span class="text-warn">缺音频 ' + s.missing + '</span>'
          : ' · <span class="muted">音频齐全</span>') + '</span>' +
        '<span class="pill ' + (l.published ? 'pill-ok' : '') + '">' + (l.published ? '已发布' : '草稿') + '</span>' +
      '</div></article>';
  }

  function gridHTML() {
    const ls = filtered();
    if (!ls.length) {
      const none = !Store.db.wordlists.length;
      return '<div class="card"><div class="empty"><div class="empty-ico">' + ico('book') + '</div>' +
        '<h3>' + (none ? '还没有词表' : '没有符合筛选的词表') + '</h3>' +
        '<p>' + (none ? '先建一个 Unit 4 的词表，把这一单元的词粘进去。' : '换个关键词或清空筛选试试。') + '</p>' +
        '<div class="empty-actions"><button class="btn btn-primary btn-sm" data-act="create">+ 新建词表</button>' +
        (none ? '<button class="btn btn-sm" data-act="quickPaste">粘贴一批单词</button>' : '') +
        '</div></div></div>';
    }
    return '<div class="list-grid">' + ls.map(card).join('') + '</div>';
  }

  function filtersHTML() {
    const units = [...new Set(Store.db.wordlists.map(l => l.unit).filter(Boolean))];
    const tags = [...new Set([].concat(...Store.db.wordlists.map(l => l.tags || [])))];
    return '<div class="filters">' +
      '<input class="input search" data-input="q" value="' + U.esc(state.q) + '" placeholder="搜索词表名称、单元、标签">' +
      '<select class="select" data-change="unit"><option value="all">全部单元</option>' +
        units.map(u => '<option value="' + U.esc(u) + '"' + (state.unit === u ? ' selected' : '') + '>' + U.esc(u) + '</option>').join('') +
      '</select>' +
      '<select class="select" data-change="tag"><option value="all">全部标签</option>' +
        tags.map(t => '<option' + (state.tag === t ? ' selected' : '') + '>' + U.esc(t) + '</option>').join('') +
      '</select>' +
      '<select class="select" data-change="audio">' +
        '<option value="all">音频：全部</option>' +
        '<option value="missing"' + (state.audio === 'missing' ? ' selected' : '') + '>缺音频</option>' +
        '<option value="ready"' + (state.audio === 'ready' ? ' selected' : '') + '>音频齐全</option>' +
      '</select>' +
      '<select class="select" data-change="sort">' +
        '<option value="updated"' + (state.sort === 'updated' ? ' selected' : '') + '>最近更新</option>' +
        '<option value="size"' + (state.sort === 'size' ? ' selected' : '') + '>词数最多</option>' +
        '<option value="name"' + (state.sort === 'name' ? ' selected' : '') + '>名称</option>' +
      '</select>' +
      '<button class="btn btn-primary" data-act="create" style="margin-left:auto">+ 新建词表</button>' +
    '</div>';
  }

  P.render = function (params) {
    if (params && params[0]) return detail(params[0]);
    const all = Store.db.wordlists;
    const total = Store.db.entries.length;
    const missing = Store.db.entries.filter(e => e.audioStatus !== 'ready').length;
    return '<section class="page-head"><div>' +
        '<h1>单词合集</h1>' +
        '<p class="sub">' + all.length + ' 个词表 · ' + total + ' 个词条 · ' +
          (missing ? '<span class="text-warn">' + missing + ' 个缺音频</span>' : '音频齐全') + '</p>' +
      '</div></section>' +
      filtersHTML() + '<div id="listGrid">' + gridHTML() + '</div>';
  };

  P.onInput = function (k, v) {
    if (k === 'q') { state.q = v; document.getElementById('listGrid').innerHTML = gridHTML(); }
  };
  P.onChange = function (k, v) {
    state[k] = v;
    document.getElementById('listGrid').innerHTML = gridHTML();
  };

  /* ---------- 词表详情 ---------- */
  function detail(id) {
    const l = Store.byId('wordlists', id);
    if (!l) return '<div class="card"><div class="empty"><h3>词表不存在</h3>' +
      '<div class="empty-actions"><a class="btn" href="#/lists">返回词库</a></div></div></div>';
    if (state.listId !== id) { state.sel.clear(); state.listId = id; }
    const es = Store.entriesOf(id);
    const missing = es.filter(e => e.audioStatus !== 'ready').length;

    const rows = es.map(e =>
      '<tr>' +
        '<td style="width:34px"><input type="checkbox" data-act="sel" data-id="' + e.id + '"' +
          (state.sel.has(e.id) ? ' checked' : '') + ' aria-label="选择"></td>' +
        '<td><b>' + U.esc(e.word) + '</b>' + (e.note ? '<div class="tiny text-warn">' + U.esc(e.note) + '</div>' : '') + '</td>' +
        '<td class="muted mono small">' + U.esc(e.phonetic || '') + '</td>' +
        '<td class="small muted">' + U.esc(e.pos || '') + '</td>' +
        '<td>' + U.esc(e.meaningZh || '') + '</td>' +
        '<td><button class="audio-chip ' + (e.audioStatus === 'ready' ? 'ready' : 'none') + '" data-act="audio" data-id="' + e.id + '">' +
          (e.audioStatus === 'ready' ? '已生成' : '未生成') + '</button></td>' +
        '<td><span class="mini-bar"><i style="width:' + (e.mastery || 0) + '%"></i></span>' +
          '<span class="tiny muted"> ' + (e.mastery || 0) + '%</span></td>' +
        '<td class="nowrap">' +
          '<button class="btn btn-sm btn-ghost" data-act="editEntry" data-id="' + e.id + '">编辑</button>' +
          '<button class="btn btn-sm btn-ghost" data-act="delEntry" data-id="' + e.id + '">删除</button>' +
        '</td>' +
      '</tr>').join('');

    return '<a class="back" href="#/lists">← 全部词表</a>' +
      '<section class="page-head"><div>' +
        '<h1>' + U.esc(l.name) + '</h1>' +
        '<p class="sub">' + U.esc(l.textbook || '未填教材') + (l.unit ? ' · ' + U.esc(l.unit) : '') +
          ' · ' + es.length + ' 词' + (missing ? ' · <span class="text-warn">缺音频 ' + missing + '</span>' : '') + '</p>' +
      '</div><div class="head-actions">' +
        '<button class="btn btn-primary" data-act="addEntries">+ 添加词条</button>' +
        '<button class="btn" data-act="exportList">导出 CSV</button>' +
        '<button class="btn btn-danger-ghost" data-act="delList">删除</button>' +
      '</div></section>' +
      '<div class="card publish-bar">' +
        '<label class="switch"><input type="checkbox" data-act="togglePublish"' + (l.published ? ' checked' : '') + '><i></i> 发布到学生端</label>' +
        '<span class="small muted">已发布后，学生用班级码能看到词表与释义。学生端在第二期上线，这里先控制可见性。</span>' +
      '</div>' +
      (es.length
        ? '<div class="card" style="padding:8px 12px 12px"><div class="table-wrap"><table class="table"><thead><tr>' +
            '<th><input type="checkbox" data-act="selAll" aria-label="全选"></th><th>单词</th><th>音标</th><th>词性</th>' +
            '<th>释义</th><th>音频</th><th>掌握度</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></div>'
        : '<div class="card"><div class="empty"><div class="empty-ico">' + ico('plus') + '</div>' +
            '<h3>这个词表还是空的</h3><p>最省事的方式是把这一单元的词整批粘进来，一行一个。</p>' +
            '<div class="empty-actions"><button class="btn btn-primary" data-act="addEntries">批量粘贴</button>' +
            '<button class="btn" data-act="addEntries">手动添加</button></div></div></div>') +
      '<div class="bulkbar" id="bulkbar">' +
        '<span class="count" id="bulkCount">已选 0 项</span>' +
        '<button class="btn btn-sm" data-act="bulkPool">加入再听写池</button>' +
        '<button class="btn btn-sm" data-act="bulkExport">导出所选</button>' +
        '<button class="btn btn-sm btn-danger-ghost" data-act="bulkDelete">删除</button>' +
        '<button class="btn btn-sm btn-ghost" data-act="bulkClear">取消</button>' +
      '</div>';
  }

  function syncBulk() {
    const bar = document.getElementById('bulkbar');
    if (!bar) return;
    bar.classList.toggle('in', state.sel.size > 0);
    const c = document.getElementById('bulkCount');
    if (c) c.textContent = '已选 ' + state.sel.size + ' 项';
  }
  P.mount = function () { syncBulk(); };

  /* ---------- 新建词表 ---------- */
  P.openCreate = function () {
    const m = UI.modal({
      title: '新建词表',
      body: '<div class="field"><label class="label">名称</label>' +
          '<input class="input" data-f="name" placeholder="必修一 Unit 4 重点词" autofocus></div>' +
        '<div class="form-grid"><div class="field"><label class="label">教材版本</label>' +
          '<input class="input" data-f="textbook" value="人教版2019"></div>' +
          '<div class="field"><label class="label">单元</label><input class="input" data-f="unit" placeholder="B1U4"></div></div>' +
        '<div class="field"><label class="label">标签（逗号分隔）</label>' +
          '<input class="input" data-f="tags" placeholder="高频词, 听力词"></div>',
      footer: '<button class="btn" data-ui-close>取消</button>' +
        '<button class="btn btn-primary" data-ok>创建</button>'
    });
    const ok = () => {
      const name = m.body.querySelector('[data-f="name"]').value.trim();
      if (!name) { UI.toast('先给它起个名字', { type: 'warn' }); return; }
      const l = Store.addList({
        name,
        textbook: m.body.querySelector('[data-f="textbook"]').value.trim(),
        unit: m.body.querySelector('[data-f="unit"]').value.trim(),
        tags: m.body.querySelector('[data-f="tags"]').value.split(/[,，]/).map(s => s.trim()).filter(Boolean),
        published: false, source: 'manual'
      });
      m.close();
      UI.toast('词表已创建', { undo: () => { Store.db.wordlists = Store.db.wordlists.filter(x => x.id !== l.id); Store.save('wordlists'); App.refresh(); } });
      location.hash = '#/lists/' + l.id;
    };
    m.foot.querySelector('[data-ok]').addEventListener('click', ok);
    m.body.querySelector('[data-f="name"]').addEventListener('keydown', e => { if (e.key === 'Enter') ok(); });
    setTimeout(() => m.body.querySelector('[data-f="name"]').focus(), 80);
  };

  /* ---------- 添加词条 ---------- */
  function parseLines(text) {
    const rows = [], bad = [];
    text.split('\n').forEach(line => {
      if (!line.trim()) return;
      const cells = line.split(/\t|,/).map(s => s.trim());
      if (!cells[0]) return;
      const row = {
        word: cells[0], phonetic: cells[1] || '', pos: cells[2] || '',
        meaningZh: cells[3] || '', example: cells[4] || '', audioUrl: cells[5] || ''
      };
      if (!row.meaningZh) bad.push(line.trim());
      rows.push(row);
    });
    return { rows, bad };
  }

  function entryForm(e) {
    e = e || {};
    return '<div class="form-grid">' +
      '<div class="field"><label class="label">单词 *</label><input class="input" data-f="word" value="' + U.esc(e.word || '') + '"></div>' +
      '<div class="field"><label class="label">音标</label><input class="input" data-f="phonetic" value="' + U.esc(e.phonetic || '') + '" placeholder="/ˈθʌrə/"></div>' +
      '<div class="field"><label class="label">词性</label><input class="input" data-f="pos" value="' + U.esc(e.pos || '') + '" placeholder="adj."></div>' +
      '<div class="field"><label class="label">中文释义 *</label><input class="input" data-f="meaningZh" value="' + U.esc(e.meaningZh || '') + '"></div>' +
      '<div class="field full"><label class="label">例句</label><input class="input" data-f="example" value="' + U.esc(e.example || '') + '"></div>' +
      '<div class="field full"><label class="label">音频地址（可留空，之后补）</label>' +
        '<input class="input" data-f="audioUrl" value="' + U.esc(e.audioUrl || '') + '" placeholder="audio/B1U4/thorough.mp3"></div>' +
      '<div class="field full"><label class="label">备注</label><input class="input" data-f="note" value="' + U.esc(e.note || '') + '" placeholder="易与 through 混"></div>' +
    '</div>';
  }
  function readForm(scope) {
    const g = k => { const el = scope.querySelector('[data-f="' + k + '"]'); return el ? el.value.trim() : ''; };
    return {
      word: g('word'), phonetic: g('phonetic'), pos: g('pos'), meaningZh: g('meaningZh'),
      example: g('example'), audioUrl: g('audioUrl'), note: g('note')
    };
  }

  function openAdd(listId, tab) {
    tab = tab || 'paste';
    const m = UI.modal({
      title: '添加词条',
      wide: true,
      body: '<div class="seg" id="aeTabs" style="margin-bottom:14px">' +
          '<button class="seg-item" data-t="manual">手动添加</button>' +
          '<button class="seg-item" data-t="paste">批量粘贴</button>' +
          '<button class="seg-item" data-t="csv">CSV 导入</button>' +
          '<button class="seg-item" data-t="pool">从再听写池</button>' +
        '</div><div id="aeBody"></div>',
      footer: '<button class="btn" data-ui-close>关闭</button>'
    });
    const body = m.body.querySelector('#aeBody');
    const tabs = m.body.querySelectorAll('[data-t]');

    function renderTab(t) {
      tabs.forEach(b => b.classList.toggle('active', b.dataset.t === t));
      if (t === 'manual') {
        body.innerHTML = entryForm() +
          '<div class="empty-actions" style="justify-content:flex-start;margin-top:4px">' +
          '<button class="btn btn-primary" data-add>保存并继续</button>' +
          '<button class="btn" data-done>保存并关闭</button></div>' +
          '<p class="hint" style="margin-top:10px">按 Enter 会在单词框里跳到下一行，适合连续录入。</p>';
        body.querySelector('[data-add]').addEventListener('click', () => {
          const v = readForm(body);
          if (!v.word) { UI.toast('单词不能为空', { type: 'warn' }); return; }
          Store.addEntries(listId, [v]);
          body.innerHTML = entryForm();
          bindManual();
          UI.toast('已添加，继续下一个');
        });
        body.querySelector('[data-done]').addEventListener('click', () => {
          const v = readForm(body);
          if (v.word) Store.addEntries(listId, [v]);
          m.close(); App.refresh();
        });
        bindManual();
      }
      if (t === 'paste') {
        body.innerHTML =
          '<p class="hint" style="margin-bottom:8px">每行一个词：<code>单词, 音标, 词性, 释义, 例句</code>，逗号或 Tab 分隔，后三项可省略。</p>' +
          '<textarea class="textarea" data-paste style="min-height:150px" placeholder="thorough, /ˈθʌrə/, adj., 彻底的；详尽的&#10;affect, /əˈfekt/, v., 影响"></textarea>' +
          '<div id="pastePreview" class="small muted" style="margin:10px 0"></div>' +
          '<button class="btn btn-primary" data-import>导入</button>';
        const ta = body.querySelector('[data-paste]');
        const pv = body.querySelector('#pastePreview');
        const upd = () => {
          const r = parseLines(ta.value);
          pv.innerHTML = ta.value.trim()
            ? '识别到 <b>' + r.rows.length + '</b> 行' + (r.bad.length ? '，<span class="text-warn">' + r.bad.length + ' 行缺释义（会标为待补充）</span>' : '')
            : '';
        };
        ta.addEventListener('input', U.debounce(upd, 120));
        body.querySelector('[data-import]').addEventListener('click', () => {
          const r = parseLines(ta.value);
          if (!r.rows.length) { UI.toast('还没有内容', { type: 'warn' }); return; }
          const dup = r.rows.filter(x => Store.entriesOf(listId).some(e => e.word.toLowerCase() === x.word.toLowerCase()));
          Store.addEntries(listId, r.rows);
          m.close();
          UI.toast('已导入 ' + r.rows.length + ' 个词条' + (dup.length ? '（其中 ' + dup.length + ' 个重复）' : ''));
          App.refresh();
        });
        setTimeout(() => ta.focus(), 80);
      }
      if (t === 'csv') {
        body.innerHTML =
          '<p class="hint" style="margin-bottom:8px">CSV 表头依次为：<code>word, phonetic, pos, meaning_zh, example, audio_url</code>。可以先下载模板。</p>' +
          '<div class="field"><input type="file" accept=".csv,text/csv" data-file class="input"></div>' +
          '<textarea class="textarea" data-csvtext placeholder="也可以直接粘贴 CSV 内容" style="min-height:120px"></textarea>' +
          '<div id="csvPreview" class="small muted" style="margin:10px 0"></div>' +
          '<div class="empty-actions" style="justify-content:flex-start">' +
          '<button class="btn" data-tpl>下载模板</button>' +
          '<button class="btn btn-primary" data-csvimport>导入</button></div>';
        let parsed = null;
        const pv = body.querySelector('#csvPreview');
        const handle = text => {
          let rows = U.parseCSV(text);
          if (rows.length && /word|单词/i.test(rows[0][0] || '')) rows = rows.slice(1);
          parsed = rows.map(r => ({
            word: r[0] || '', phonetic: r[1] || '', pos: r[2] || '', meaningZh: r[3] || '',
            example: r[4] || '', audioUrl: r[5] || ''
          })).filter(r => r.word);
          pv.innerHTML = '读取 ' + parsed.length + ' 行' +
            (parsed.some(p => !p.meaningZh) ? ' · <span class="text-warn">部分缺释义</span>' : '');
        };
        body.querySelector('[data-file]').addEventListener('change', e => {
          const f = e.target.files[0];
          if (!f) return;
          const rd = new FileReader();
          rd.onload = () => { body.querySelector('[data-csvtext]').value = rd.result; handle(rd.result); };
          rd.readAsText(f, 'utf-8');
        });
        body.querySelector('[data-csvtext]').addEventListener('input', e => handle(e.target.value));
        body.querySelector('[data-tpl]').addEventListener('click', () => {
          U.download('词条导入模板.csv',
            '\uFEFF' + U.toCSV([['word', 'phonetic', 'pos', 'meaning_zh', 'example', 'audio_url'],
              ['thorough', '/ˈθʌrə/', 'adj.', '彻底的；详尽的', 'a thorough check', '']]), 'text/csv;charset=utf-8');
        });
        body.querySelector('[data-csvimport]').addEventListener('click', () => {
          if (!parsed || !parsed.length) { UI.toast('还没有读到内容', { type: 'warn' }); return; }
          Store.addEntries(listId, parsed);
          m.close(); UI.toast('已导入 ' + parsed.length + ' 个词条'); App.refresh();
        });
      }
      if (t === 'pool') {
        const pool = Store.db.pool;
        if (!pool.length) {
          body.innerHTML = '<div class="empty"><p>再听写池还是空的。去错词分析页把高频错词汇入，就能在这里一键建词表。</p>' +
            '<div class="empty-actions"><a class="btn btn-sm" href="#/errors">去错词分析</a></div></div>';
          return;
        }
        body.innerHTML = '<div style="max-height:46vh;overflow:auto">' + pool.map(p =>
          '<label class="pick-card"><input type="checkbox" value="' + p.entryId + '" checked>' +
          '<span class="pick-main"><b>' + U.esc(p.word) + '</b>' +
          '<span class="tiny muted">' + U.esc(p.meaning || '') + ' · 错误率 ' + p.rate + '%</span></span></label>').join('') +
          '</div><button class="btn btn-primary" data-pooladd style="margin-top:10px">加入本词表</button>';
        body.querySelector('[data-pooladd]').addEventListener('click', () => {
          const ids = [...body.querySelectorAll('input[type=checkbox]:checked')].map(c => c.value);
          const rows = ids.map(id => {
            const e = Store.byId('entries', id);
            return e ? { word: e.word, phonetic: e.phonetic, pos: e.pos, meaningZh: e.meaningZh, example: e.example, audioUrl: e.audioUrl, audioStatus: e.audioStatus } : null;
          }).filter(Boolean);
          if (!rows.length) { UI.toast('一个都没选', { type: 'warn' }); return; }
          Store.addEntries(listId, rows);
          m.close(); UI.toast('已加入 ' + rows.length + ' 个词'); App.refresh();
        });
      }
    }

    function bindManual() {
      const inputs = body.querySelectorAll('input[data-f]');
      inputs.forEach((inp, i) => {
        inp.addEventListener('keydown', e => {
          if (e.key === 'Enter') { e.preventDefault(); if (inputs[i + 1]) inputs[i + 1].focus(); }
        });
      });
      const first = body.querySelector('[data-f="word"]');
      if (first) setTimeout(() => first.focus(), 60);
    }

    tabs.forEach(b => b.addEventListener('click', () => renderTab(b.dataset.t)));
    renderTab(tab);
  }

  /* ---------- 操作 ---------- */
  P.actions = {
    create() { P.openCreate(); },

    quickPaste() {
      P.openCreate();
    },

    menu(el) {
      const id = el.dataset.id;
      const l = Store.byId('wordlists', id);
      if (!l) return;
      UI.menu(el, [
        { label: '打开词表', onClick: () => { location.hash = '#/lists/' + id; } },
        { label: '重命名', onClick: () => rename(id) },
        { label: '导出 CSV', onClick: () => exportList(id) },
        { label: l.published ? '取消发布' : '发布到学生端', onClick: () => togglePublish(id) },
        { sep: true },
        { label: '删除词表', danger: true, onClick: () => delList(id) }
      ]);
    },

    open(el) { location.hash = '#/lists/' + el.dataset.id; },

    addEntries() {
      const id = state.listId;
      const l = Store.byId('wordlists', id);
      openAdd(id, l && Store.entriesOf(id).length === 0 ? 'paste' : 'manual');
    },

    exportList() { exportList(state.listId); },

    togglePublish(el) {
      const id = state.listId;
      const l = Store.byId('wordlists', id);
      if (!l) return;
      const want = el.checked;
      const done = () => {
        l.published = want;
        l.updatedAt = new Date().toISOString();
        Store.save('wordlists');
        UI.toast(want ? '已发布到学生端' : '已取消发布');
        App.refresh();
      };
      if (!want) { done(); return; }
      UI.confirm({
        title: '发布到学生端',
        message: '学生用班级码进入后，能看到这个词表的 <b>' + Store.entriesOf(id).length + '</b> 个词、音标与释义。' +
          '<br><span class="small muted">学生端页面在第二期上线，现在发布只是把状态准备好。</span>',
        confirmText: '发布'
      }).then(ok => {
        if (ok) done();
        else { el.checked = false; }
      });
    },

    audio(el) {
      const e = Store.byId('entries', el.dataset.id);
      if (!e) return;
      const m = UI.modal({
        title: '音频 · ' + e.word,
        body: '<div class="field"><label class="label">音频地址</label>' +
            '<input class="input" data-url value="' + U.esc(e.audioUrl || '') + '" placeholder="audio/B1U4/' + U.esc(e.word) + '.mp3"></div>' +
          '<p class="hint">原型阶段只记录地址与状态，不内置音频文件。正式版可直接上传 mp3。</p>',
        footer: '<button class="btn" data-ui-close>取消</button>' +
          '<button class="btn btn-primary" data-ok>保存为已生成</button>'
      });
      m.foot.querySelector('[data-ok]').addEventListener('click', () => {
        e.audioUrl = m.body.querySelector('[data-url]').value.trim();
        e.audioStatus = 'ready';
        Store.save('entries');
        m.close(); App.refresh(); UI.toast('已标记为已生成');
      });
    },

    editEntry(el) {
      const e = Store.byId('entries', el.dataset.id);
      if (!e) return;
      const m = UI.modal({
        title: '编辑词条',
        body: entryForm(e),
        footer: '<button class="btn" data-ui-close>取消</button>' +
          '<button class="btn btn-primary" data-ok>保存</button>'
      });
      m.foot.querySelector('[data-ok]').addEventListener('click', () => {
        const v = readForm(m.body);
        if (!v.word) { UI.toast('单词不能为空', { type: 'warn' }); return; }
        Object.assign(e, v, { audioStatus: v.audioUrl ? 'ready' : 'none' });
        Store.save('entries');
        m.close(); App.refresh(); UI.toast('已保存');
      });
    },

    delEntry(el) {
      const e = Store.byId('entries', el.dataset.id);
      if (!e) return;
      UI.confirm({
        title: '删除词条',
        message: '删除 <b>' + U.esc(e.word) + '</b>？与它相关的听写记录也会一起删除。',
        confirmText: '删除', danger: true
      }).then(ok => {
        if (!ok) return;
        Store.deleteEntry(e.id);
        state.sel.delete(e.id);
        App.refresh(); UI.toast('已删除');
      });
    },

    delList() {
      const id = state.listId;
      if (id) delList(id);
    },

    sel(el) {
      const id = el.dataset.id;
      if (el.checked) state.sel.add(id); else state.sel.delete(id);
      el.closest('tr').style.background = el.checked ? 'var(--c-primary-soft)' : '';
      syncBulk();
    },

    selAll(el) {
      const es = Store.entriesOf(state.listId);
      if (el.checked) es.forEach(e => state.sel.add(e.id));
      else state.sel.clear();
      App.refresh();
    },

    bulkClear() { state.sel.clear(); App.refresh(); },

    bulkExport() {
      const ids = [...state.sel];
      if (!ids.length) return;
      exportEntries(ids, '所选词条');
    },

    bulkDelete() {
      const ids = [...state.sel];
      if (!ids.length) return;
      UI.confirm({
        title: '删除所选词条',
        message: '将删除 <b>' + ids.length + '</b> 个词条，及其相关听写记录。',
        confirmText: '删除', danger: true
      }).then(ok => {
        if (!ok) return;
        ids.forEach(id => Store.deleteEntry(id));
        state.sel.clear();
        App.refresh(); UI.toast('已删除 ' + ids.length + ' 个词条');
      });
    },

    bulkPool() {
      const ids = [...state.sel];
      const items = ids.map(id => {
        const e = Store.byId('entries', id);
        return e ? { entryId: id, word: e.word, phonetic: e.phonetic, meaning: e.meaningZh, rate: 0 } : null;
      }).filter(Boolean);
      const n = Store.addToPool(items, 'manual');
      UI.toast(n ? '已加入再听写池 ' + n + ' 个' : '这些词已经在池里了');
    }
  };

  /* ---------- 复用函数 ---------- */
  function exportEntries(ids, label) {
    const es = ids.map(id => Store.byId('entries', id)).filter(Boolean);
    const rows = [['word', 'phonetic', 'pos', 'meaning_zh', 'example', 'audio_url', 'note']]
      .concat(es.map(e => [e.word, e.phonetic, e.pos, e.meaningZh, e.example, e.audioUrl, e.note]));
    U.download((label || '词条') + '_' + U.today() + '.csv', '\uFEFF' + U.toCSV(rows), 'text/csv;charset=utf-8');
    UI.toast('已导出 ' + es.length + ' 个词条');
  }

  function exportList(id) {
    const l = Store.byId('wordlists', id);
    if (!l) return;
    const es = Store.entriesOf(id);
    if (!es.length) { UI.toast('词表还是空的', { type: 'warn' }); return; }
    exportEntries(es.map(e => e.id), l.name);
  }

  function rename(id) {
    const l = Store.byId('wordlists', id);
    const m = UI.modal({
      title: '重命名词表',
      body: '<div class="field"><label class="label">名称</label><input class="input" data-name value="' + U.esc(l.name) + '"></div>',
      footer: '<button class="btn" data-ui-close>取消</button><button class="btn btn-primary" data-ok>保存</button>'
    });
    m.foot.querySelector('[data-ok]').addEventListener('click', () => {
      const v = m.body.querySelector('[data-name]').value.trim();
      if (!v) return;
      l.name = v; l.updatedAt = new Date().toISOString();
      Store.save('wordlists'); m.close(); App.refresh(); UI.toast('已重命名');
    });
  }

  function togglePublish(id) {
    const l = Store.byId('wordlists', id);
    l.published = !l.published;
    Store.save('wordlists');
    UI.toast(l.published ? '已发布' : '已取消发布');
    App.refresh();
  }

  function delList(id) {
    const l = Store.byId('wordlists', id);
    if (!l) return;
    const n = Store.entriesOf(id).length;
    UI.confirm({
      title: '删除词表',
      message: '删除词表 <b>' + U.esc(l.name) + '</b> 和其中 <b>' + n + '</b> 个词条？' +
        '<br><span class="small">此操作不可撤销，建议先导出 CSV。</span>',
      confirmText: '删除词表', danger: true
    }).then(ok => {
      if (!ok) return;
      const entryIds = Store.entriesOf(id).map(e => e.id);
      Store.db.wordlists = Store.db.wordlists.filter(x => x.id !== id);
      Store.db.entries = Store.db.entries.filter(e => e.listId !== id);
      Store.db.records = Store.db.records.filter(r => entryIds.indexOf(r.entryId) < 0);
      Store.db.tasks = Store.db.tasks.filter(t => t.listId !== id);
      Store.save('wordlists'); Store.save('entries'); Store.save('records'); Store.save('tasks');
      location.hash = '#/lists';
      App.refresh();
      UI.toast('已删除词表');
    });
  }

  function ico(name) {
    const map = {
      book: '<path d="M5 4h10a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2z"/><path d="M17 6h2v14h-2"/>',
      plus: '<path d="M12 5v14M5 12h14"/>'
    };
    return '<svg viewBox="0 0 24 24">' + (map[name] || '') + '</svg>';
  }

  window.Pages.lists = P;
})();
