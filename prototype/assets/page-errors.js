/* 错词分析：班级高频 / 学生薄弱 / 错误类型 / 再听写池 */
(function () {
  const P = { title: '错词分析' };
  const TYPE = {
    spelling: { label: '拼写', color: '#D98324' },
    meaning: { label: '词义', color: '#4457C7' },
    sound: { label: '发音混淆', color: '#2F8F5B' },
    blank: { label: '未作答', color: '#9AA3A5' }
  };
  const state = {
    classId: 'all', range: '30', tab: 'class', threshold: 30, minPart: 3,
    sel: new Set(), studentId: ''
  };

  function fromDate() {
    return state.range === 'all' ? '' : U.addDays(U.today(), -Number(state.range));
  }
  function baseRecs() {
    return Store.queryRecords({ classId: state.classId, from: fromDate() });
  }
  function aggList() {
    return Store.aggregate(baseRecs())
      .filter(x => x.rate >= state.threshold && x.total >= state.minPart)
      .sort((a, b) => b.rate - a.rate || b.wrong - a.wrong);
  }
  const rateCls = r => r >= 35 ? 'high' : r >= 15 ? 'mid' : 'low';

  function statsHTML(recs, agg) {
    const correct = recs.filter(r => r.isCorrect).length;
    const students = new Set(recs.map(r => r.studentId)).size;
    return '<div class="stat"><div class="stat-num">' + students + '</div>' +
        '<div class="stat-label">参与学生</div><div class="stat-sub">含 ' + recs.length + ' 条记录</div></div>' +
      '<div class="stat"><div class="stat-num">' + (recs.length ? Math.round(correct / recs.length * 100) : 0) + '%</div>' +
        '<div class="stat-label">平均正确率</div><div class="stat-sub">错 ' + (recs.length - correct) + ' 人次</div></div>' +
      '<div class="stat"><div class="stat-num" id="statCount">' + agg.length + '</div>' +
        '<div class="stat-label">高频错词</div><div class="stat-sub">错误率 ≥ ' + state.threshold + '%</div></div>' +
      '<div class="stat"><div class="stat-num">' + Store.db.pool.length + '</div>' +
        '<div class="stat-label">再听写池</div><div class="stat-sub">待复现的词</div></div>';
  }

  function aggRows(agg) {
    if (!agg.length) {
      return '<div class="empty"><div class="empty-ico"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M9 12h6"/></svg></div>' +
        '<h3>这个范围内没有达标错词</h3><p>最近这批词掌握得不错。把阈值调低一点，或者换个时间范围看看。</p></div>';
    }
    return agg.map((x, i) =>
      '<div class="agg-row">' +
        '<input type="checkbox" data-act="sel" data-id="' + x.entryId + '"' + (state.sel.has(x.entryId) ? ' checked' : '') + ' aria-label="选择 ' + U.esc(x.entry.word) + '">' +
        '<div class="agg-word"><b><button class="btn btn-sm btn-ghost" style="padding:0;height:auto;font-weight:600" data-act="detail" data-id="' + x.entryId + '">' +
          U.esc(x.entry.word) + '</button></b>' +
          '<span>' + U.esc(x.entry.phonetic || '') + '</span></div>' +
        '<div class="agg-bar"><div class="track"><i class="' + rateCls(x.rate) + '" style="width:' + Math.max(x.rate, 3) + '%"></i></div>' +
          '<div class="tiny muted">' + U.esc(x.entry.meaningZh || '') + '</div></div>' +
        '<div class="agg-val small"><b class="rate ' + rateCls(x.rate) + '">' + x.rate + '%</b>' +
          '<div class="tiny muted">' + x.wrong + '/' + x.total + '</div></div>' +
      '</div>').join('');
  }

  function ringHTML(counts) {
    const keys = ['spelling', 'meaning', 'sound', 'blank'];
    const total = keys.reduce((s, k) => s + (counts[k] || 0), 0) || 1;
    let acc = 0;
    const stops = keys.map(k => {
      const from = acc / total * 100;
      acc += counts[k] || 0;
      const to = acc / total * 100;
      return TYPE[k].color + ' ' + from.toFixed(1) + '% ' + to.toFixed(1) + '%';
    });
    return '<div class="ring" style="background:conic-gradient(' + stops.join(',') + ')"></div>';
  }

  function studentPanel(recs) {
    const weak = Store.weakStudents(recs);
    if (!weak.length) return '<div class="empty"><p>这个范围里没有错误记录。</p></div>';
    if (!state.studentId || !weak.some(w => w.studentId === state.studentId)) state.studentId = weak[0].studentId;
    const cur = weak.find(w => w.studentId === state.studentId);
    const words = Object.keys(cur.words).map(id => {
      const e = Store.byId('entries', id);
      return e ? { e, n: cur.words[id] } : null;
    }).filter(Boolean).sort((a, b) => b.n - a.n);

    return '<div class="split"><div class="stu-list">' + weak.map(w =>
        '<button class="stu-item' + (w.studentId === state.studentId ? ' active' : '') + '" data-act="pickStu" data-id="' + w.studentId + '">' +
          '<span class="dot ' + (w.rate > 30 ? 'preparing' : 'todo') + '"></span>' +
          '<span>' + U.esc(w.student.displayName) + '</span><span class="n">错 ' + w.wrong + '</span></button>').join('') +
      '</div><div>' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">' +
          '<b>' + U.esc(cur.student.displayName) + '</b>' +
          '<span class="small muted">错 ' + cur.wrong + ' 次 · 本范围正确率 ' + (100 - cur.rate) + '%</span>' +
          '<button class="btn btn-sm" style="margin-left:auto" data-act="genStu" data-id="' + cur.studentId + '">生成个人再听写词表</button>' +
        '</div>' +
        words.map(w => '<div class="weak-item">' +
          '<b style="width:120px">' + U.esc(w.e.word) + '</b>' +
          '<span class="small muted" style="flex:1">' + U.esc(w.e.meaningZh || '') + '</span>' +
          '<span class="pill pill-danger">错 ' + w.n + ' 次</span></div>').join('') +
      '</div></div>';
  }

  function typePanel(recs) {
    const counts = Store.errorCounts(recs);
    const total = ['spelling', 'meaning', 'sound', 'blank'].reduce((s, k) => s + counts[k], 0);
    if (!total) return '<div class="empty"><p>还没有错误记录，类型分布暂时为空。</p></div>';
    const top = {};
    ['spelling', 'meaning', 'sound', 'blank'].forEach(k => { top[k] = {}; });
    recs.forEach(r => {
      if (r.isCorrect) return;
      const k = r.errorType || 'blank';
      top[k][r.entryId] = (top[k][r.entryId] || 0) + 1;
    });
    const top5 = k => Object.keys(top[k]).sort((a, b) => top[k][b] - top[k][a]).slice(0, 5)
      .map(id => { const e = Store.byId('entries', id); return e ? e.word : ''; }).filter(Boolean);
    const max = Math.max(...['spelling', 'meaning', 'sound', 'blank'].map(k => counts[k]));
    const main = ['spelling', 'meaning', 'sound', 'blank'].sort((a, b) => counts[b] - counts[a])[0];

    return '<div style="display:grid;grid-template-columns:auto 1fr;gap:26px;align-items:center" class="type-wrap">' +
      ringHTML(counts) +
      '<div class="ring-legend">' +
        ['spelling', 'meaning', 'sound', 'blank'].map(k =>
          '<div><i style="background:' + TYPE[k].color + '"></i>' + TYPE[k].label +
          ' <b>' + U.pct(counts[k], total) + '%</b>' +
          '<span class="tiny muted">（' + counts[k] + ' 次）</span>' +
          (top5(k).length ? '<div class="tiny muted" style="margin-left:16px">Top：' + top5(k).map(U.esc).join('、') + '</div>' : '') +
          '</div>').join('') +
      '</div></div>' +
      '<div class="notice" style="margin-top:16px">自动结论（规则式）：<b>' + TYPE[main].label + '</b>类占 ' +
        U.pct(counts[main], total) + '%，是这批听写最主要的失分方式。' +
        (main === 'spelling' ? '建议下节课用 3 分钟做"看音标写词"的小测，重点练词尾与不发音字母。' :
         main === 'meaning' ? '建议补一次"英英释义 + 造句"，确认学生不是只记了中文。' :
         main === 'sound' ? '建议放慢音频、分音节领读，再做一次跟读。' : '建议先查明未作答原因：是听不清还是没时间。') +
      '</div>';
  }

  function poolPanel() {
    if (!Store.db.pool.length) {
      return '<div class="empty"><div class="empty-ico"><svg viewBox="0 0 24 24"><path d="M5 7h14M5 12h14M5 17h8"/></svg></div>' +
        '<h3>再听写池是空的</h3><p>在"班级高频错词"里勾选，或者按阈值自动汇入。</p>' +
        '<div class="empty-actions"><button class="btn btn-primary btn-sm" data-act="autoPool">按阈值汇入</button></div></div>';
    }
    return '<div class="table-wrap"><table class="table"><thead><tr><th>单词</th><th>释义</th><th>来源</th>' +
      '<th class="num">错误率</th><th>加入时间</th><th></th></tr></thead><tbody>' +
      Store.db.pool.map(p => '<tr><td><b>' + U.esc(p.word) + '</b><div class="tiny muted">' + U.esc(p.phonetic || '') + '</div></td>' +
        '<td class="small">' + U.esc(p.meaning || '') + '</td>' +
        '<td><span class="pill">' + ({ manual: '手动', task: '听写结果' }[p.source] || '手动') + '</span></td>' +
        '<td class="num">' + p.rate + '%</td>' +
        '<td class="small muted">' + U.esc(p.addedAt) + '</td>' +
        '<td><button class="btn btn-sm btn-ghost" data-act="rmPool" data-id="' + U.esc(p.entryId) + '">移出</button></td></tr>').join('') +
      '</tbody></table></div>' +
      '<div class="empty-actions" style="justify-content:flex-start;margin-top:12px">' +
        '<button class="btn btn-primary btn-sm" data-act="genPool">用池里的词生成再听写词表</button></div>';
  }

  function tabBody(recs) {
    if (state.tab === 'class') return '<div id="aggList">' + aggRows(aggList()) + '</div>';
    if (state.tab === 'student') return studentPanel(recs);
    if (state.tab === 'type') return typePanel(recs);
    return poolPanel();
  }

  P.render = function () {
    const recs = baseRecs();
    const agg = aggList();
    const classes = Store.db.classes.filter(c => !c.archived);
    const tabs = [['class', '班级高频错词'], ['student', '学生薄弱词'], ['type', '错误类型'], ['pool', '再听写池']];

    return '<section class="page-head"><div><h1>错词分析</h1>' +
        '<p class="sub">按班级、学生、单词、时间聚合；勾选后直接生成下一份词表。</p></div>' +
        '<div class="head-actions"><button class="btn" data-act="import">从外部导入结果</button></div></section>' +
      '<div class="filters">' +
        '<select class="select" data-change="classId"><option value="all">全部班级</option>' +
          classes.map(c => '<option value="' + c.id + '"' + (state.classId === c.id ? ' selected' : '') + '>' + U.esc(c.name) + '</option>').join('') +
        '</select>' +
        '<select class="select" data-change="range">' +
          [['7', '最近 7 天'], ['30', '最近 30 天'], ['90', '本学期'], ['all', '全部时间']].map(r =>
            '<option value="' + r[0] + '"' + (state.range === r[0] ? ' selected' : '') + '>' + r[1] + '</option>').join('') +
        '</select>' +
        '<span class="small muted" style="margin-left:6px">阈值</span>' +
        '<input type="range" min="0" max="80" step="5" value="' + state.threshold + '" data-input="threshold" style="width:120px;accent-color:var(--c-primary)">' +
        '<span class="small" id="thLabel">' + state.threshold + '%</span>' +
      '</div>' +
      '<div class="stats">' + statsHTML(recs, agg) + '</div>' +
      '<div class="tabs">' + tabs.map(t =>
        '<button class="tab-item' + (state.tab === t[0] ? ' active' : '') + '" data-act="tab" data-v="' + t[0] + '">' + t[1] + '</button>').join('') +
      '</div>' +
      '<div class="card">' + tabBody(recs) + '</div>' +
      '<div class="bulkbar" id="bulkbar"><span class="count" id="bulkCount">已选 0 词</span>' +
        '<button class="btn btn-sm btn-primary" data-act="genSel">生成再听写词表</button>' +
        '<button class="btn btn-sm" data-act="poolSel">加入再听写池</button>' +
        '<button class="btn btn-sm" data-act="exportSel">导出</button>' +
        '<button class="btn btn-sm btn-ghost" data-act="clearSel">取消</button></div>';
  };

  P.mount = function () {
    const bar = document.getElementById('bulkbar');
    if (bar) {
      bar.classList.toggle('in', state.sel.size > 0);
      document.getElementById('bulkCount').textContent = '已选 ' + state.sel.size + ' 词';
    }
  };

  P.onInput = function (k, v) {
    if (k !== 'threshold') return;
    state.threshold = Number(v);
    const lb = document.getElementById('thLabel');
    if (lb) lb.textContent = state.threshold + '%';
    const box = document.getElementById('aggList');
    if (box) box.innerHTML = aggRows(aggList());
    const cnt = document.getElementById('statCount');
    if (cnt) cnt.textContent = aggList().length;
  };

  P.onChange = function (k, v) {
    state[k] = v;
    state.sel.clear();
    App.refresh();
  };

  function selectedEntries() {
    return [...state.sel].map(id => Store.byId('entries', id)).filter(Boolean);
  }

  P.actions = {
    tab(el) { state.tab = el.dataset.v; App.refresh(); },

    detail(el) {
      const id = el.dataset.id;
      const recs = baseRecs().filter(r => r.entryId === id);
      const agg = Store.aggregate(recs).find(x => x.entryId === id);
      const e = Store.byId('entries', id);
      if (!e || !agg) return;
      const wrongStudents = [...new Set(recs.filter(r => !r.isCorrect).map(r => r.studentId))]
        .map(sid => Store.byId('students', sid)).filter(Boolean);
      const tasks = [...new Set(recs.map(r => r.taskId))].map(t => Store.byId('tasks', t)).filter(Boolean);
      const types = Object.keys(agg.types).map(k => TYPE[k].label + ' ' + agg.types[k]).join(' · ') || '—';
      UI.drawer({
        title: e.word,
        sub: U.esc(e.phonetic || '') + ' · ' + U.esc(e.meaningZh || ''),
        body: '<div class="stats" style="grid-template-columns:1fr 1fr;margin-bottom:14px">' +
            '<div class="stat"><div class="stat-num">' + agg.rate + '%</div><div class="stat-label">错误率</div></div>' +
            '<div class="stat"><div class="stat-num">' + agg.wrong + '/' + agg.total + '</div><div class="stat-label">错 / 参与</div></div>' +
          '</div>' +
          '<div class="field"><label class="label">错误类型构成</label><div class="small">' + types + '</div></div>' +
          '<div class="field"><label class="label">写错的学生（' + wrongStudents.length + '）</label>' +
            '<div class="tags">' + wrongStudents.map(s => '<span class="tag gray">' + U.esc(s.displayName) + '</span>').join('') + '</div></div>' +
          '<div class="field"><label class="label">出现在这些听写</label>' +
            '<div class="small muted">' + tasks.map(t => U.esc(t.title)).join('<br>') + '</div></div>' +
          (e.example ? '<div class="field"><label class="label">例句</label><div class="small">' + U.esc(e.example) + '</div></div>' : ''),
        footer: '<button class="btn" data-ui-close>关闭</button>' +
          '<button class="btn btn-primary" data-add>' + (state.sel.has(id) ? '已在选择中' : '加入选择') + '</button>'
      }).body.parentNode.querySelector('[data-add]').addEventListener('click', ev => {
        state.sel.add(id);
        App.refresh();
        ev.target.closest('.drawer').remove();
      });
    },

    sel(el) {
      const id = el.dataset.id;
      if (el.checked) state.sel.add(id); else state.sel.delete(id);
      const bar = document.getElementById('bulkbar');
      if (bar) {
        bar.classList.toggle('in', state.sel.size > 0);
        document.getElementById('bulkCount').textContent = '已选 ' + state.sel.size + ' 词';
      }
    },

    clearSel() { state.sel.clear(); App.refresh(); },

    poolSel() {
      const es = selectedEntries();
      if (!es.length) return;
      const n = Store.addToPool(es.map(e => {
        const a = aggList().find(x => x.entryId === e.id);
        return { entryId: e.id, word: e.word, phonetic: e.phonetic, meaning: e.meaningZh, rate: a ? a.rate : 0 };
      }), 'manual');
      UI.toast(n ? '已加入再听写池 ' + n + ' 个' : '已经都在池里了');
      App.refresh();
    },

    autoPool() {
      const agg = aggList();
      if (!agg.length) { UI.toast('没有达标的错词', { type: 'warn' }); return; }
      const n = Store.addToPool(agg.map(x => ({
        entryId: x.entryId, word: x.entry.word, phonetic: x.entry.phonetic,
        meaning: x.entry.meaningZh, rate: x.rate
      })), 'manual');
      UI.toast(n ? '已按 ' + state.threshold + '% 阈值汇入 ' + n + ' 个' : '这些词已在池中');
      App.refresh();
    },

    rmPool(el) {
      const id = el.dataset.id;
      Store.db.pool = Store.db.pool.filter(p => p.entryId !== id);
      Store.save('pool');
      App.refresh();
      UI.toast('已移出');
    },

    genPool() {
      const ids = Store.db.pool.map(p => p.entryId);
      if (!ids.length) return;
      window.openGenerateList(ids, '再听写 · ' + U.fmtShort(U.today()));
    },

    genSel() {
      if (!state.sel.size) return;
      window.openGenerateList([...state.sel], '再听写 · ' + U.fmtShort(U.today()));
    },

    exportSel() {
      const es = selectedEntries();
      if (!es.length) return;
      const agg = aggList();
      const rows = [['word', 'phonetic', 'meaning_zh', 'error_rate', 'wrong', 'total']]
        .concat(es.map(e => {
          const a = agg.find(x => x.entryId === e.id);
          return [e.word, e.phonetic, e.meaningZh, a ? a.rate : 0, a ? a.wrong : 0, a ? a.total : 0];
        }));
      U.download('错词表_' + U.today() + '.csv', '\uFEFF' + U.toCSV(rows), 'text/csv;charset=utf-8');
      UI.toast('已导出 ' + es.length + ' 个词');
    },

    pickStu(el) {
      state.studentId = el.dataset.id;
      App.refresh();
    },

    genStu(el) {
      const recs = baseRecs();
      const weak = Store.weakStudents(recs).find(w => w.studentId === el.dataset.id);
      if (!weak) return;
      const ids = Object.keys(weak.words);
      window.openGenerateList(ids, '个人再听写 · ' + weak.student.displayName + ' · ' + U.fmtShort(U.today()));
    },

    import() {
      importResults();
    }
  };

  /* ---------- 生成词表（听写页也调用） ---------- */
  window.openGenerateList = function (ids, defaultName) {
    const es = ids.map(id => Store.byId('entries', id)).filter(Boolean);
    if (!es.length) { UI.toast('没有可用的词', { type: 'warn' }); return; }
    const m = UI.modal({
      title: '生成再听写词表',
      body: '<p class="small muted" style="margin-bottom:12px">将从原词表复制这 ' + es.length +
          ' 个词的音标、释义与音频地址，生成一份新词表（标签自动带"错词"）。</p>' +
        '<div class="field"><label class="label">词表名称</label>' +
          '<input class="input" data-name value="' + U.esc(defaultName || '再听写') + '"></div>' +
        '<label class="check"><input type="checkbox" data-pub> 同时发布，直接生成一次听写</label>',
      footer: '<button class="btn" data-ui-close>取消</button>' +
        '<button class="btn btn-primary" data-ok>生成</button>'
    });
    m.foot.querySelector('[data-ok]').addEventListener('click', () => {
      const name = m.body.querySelector('[data-name]').value.trim() || '再听写';
      const pub = m.body.querySelector('[data-pub]').checked;
      const l = Store.createListFromEntries(ids, name, { publish: pub });
      m.close();
      location.hash = '#/lists/' + l.id;
      App.refresh();
      UI.toast('已生成词表：' + name);
    });
  };

  /* ---------- 从外部导入结果 ---------- */
  function importResults() {
    const tasks = Store.db.tasks.filter(t => t.status !== 'draft');
    if (!tasks.length) { UI.toast('还没有可导入的听写任务', { type: 'warn' }); return; }
    const m = UI.modal({
      title: '从外部导入听写结果',
      wide: true,
      body: '<p class="small muted" style="margin-bottom:12px">支持任何工具导出的结果，只要四列：' +
          '<code>学生, 单词, 是否正确, 错误类型</code>。是否正确填 true/false 或 1/0；' +
          '错误类型填 spelling / meaning / sound / blank（可留空）。</p>' +
        '<div class="field"><label class="label">导入到哪次听写</label>' +
          '<select class="select" data-task>' + tasks.map(t =>
            '<option value="' + t.id + '">' + U.esc(t.title) + '</option>').join('') + '</select></div>' +
        '<div class="field"><label class="label">粘贴内容</label>' +
          '<textarea class="textarea" data-text style="min-height:150px" placeholder="张同学, affect, false, spelling&#10;李同学, affect, true,"></textarea></div>' +
        '<div id="impPreview" class="small muted"></div>',
      footer: '<button class="btn" data-ui-close>取消</button><button class="btn btn-primary" data-ok>导入</button>'
    });
    const text = m.body.querySelector('[data-text]');
    const pv = m.body.querySelector('#impPreview');
    function parse() {
      const task = Store.byId('tasks', m.body.querySelector('[data-task]').value);
      const students = Store.studentsOf(task.classId);
      const entries = Store.taskEntries(task.id);
      const rows = [];
      const fails = [];
      U.parseCSV(text.value).forEach(r => {
        if (!r[0] || /学生|student/i.test(r[0])) return;
        const stu = students.find(s => s.displayName === r[0] || s.realName === r[0] || s.studentNo === r[0]);
        const ent = entries.find(e => e.word.toLowerCase() === String(r[1] || '').toLowerCase().trim());
        const ok = /^(true|1|对|正确|y|yes)$/i.test(String(r[2] || '').trim());
        if (!stu || !ent) { fails.push(r.join(',')); return; }
        rows.push({
          studentId: stu.id, entryId: ent.id, isCorrect: ok,
          errorType: ok ? '' : (String(r[3] || '').trim() || 'spelling')
        });
      });
      return { task, rows, fails };
    }
    text.addEventListener('input', U.debounce(() => {
      const p = parse();
      pv.innerHTML = text.value.trim() ? '可导入 <b>' + p.rows.length + '</b> 条' +
        (p.fails.length ? ' · <span class="text-warn">' + p.fails.length + ' 条匹配不上（学生或单词找不到）</span>' : '') : '';
    }, 150));
    m.foot.querySelector('[data-ok]').addEventListener('click', () => {
      const p = parse();
      if (!p.rows.length) { UI.toast('没有可导入的记录', { type: 'warn' }); return; }
      const keep = Store.db.records.filter(r => r.taskId !== p.task.id ||
        !p.rows.some(x => x.studentId === r.studentId && x.entryId === r.entryId));
      const now = new Date().toISOString();
      p.rows.forEach(x => keep.push({
        id: U.uid('rc'), taskId: p.task.id, studentId: x.studentId, entryId: x.entryId,
        isCorrect: x.isCorrect, errorType: x.errorType, source: 'csv', createdAt: now
      }));
      Store.db.records = keep;
      Store.save('records');
      m.close();
      App.refresh();
      UI.toast('已导入 ' + p.rows.length + ' 条');
    });
  }

  window.Pages.errors = P;
})();
