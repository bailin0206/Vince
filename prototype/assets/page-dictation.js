/* 听写中心：任务列表 / 3 步向导 / 结果录入 / 本次错词 */
(function () {
  const P = { title: '听写中心' };
  const state = { status: 'all' };
  const MODE = { listen_word: '听音写词', meaning_word: '看义写词', spell_check: '拼写自检' };
  const ETYPE = { spelling: '拼写', meaning: '词义', sound: '发音混淆', blank: '未作答' };
  const CYCLE = [null, 'ok', 'spelling', 'meaning', 'sound', 'blank'];

  const wiz = {
    step: 1, listId: '', entryIds: [], classId: '', mode: 'listen_word',
    interval: 5, repeat: 2, shuffle: true, allowReplay: true, title: '', due: ''
  };
  let draft = { taskId: '', map: {} };
  let mobileStu = '';

  function resetWiz() {
    Object.assign(wiz, {
      step: 1, listId: '', entryIds: [], classId: '', mode: 'listen_word',
      interval: 5, repeat: 2, shuffle: true, allowReplay: true, title: '', due: ''
    });
  }

  function classSize(cid) {
    return Store.studentsOf(cid).length;
  }
  function taskProgress(t) {
    const st = Store.taskStats(t.id);
    return { done: st.participants, total: classSize(t.classId), avg: st.avg, wrong: st.wrongWords };
  }

  /* ---------------- 列表 ---------------- */
  function taskCard(t) {
    const cls = Store.byId('classes', t.classId) || { name: '班级' };
    const list = Store.byId('wordlists', t.listId) || { name: '词表' };
    const p = taskProgress(t);
    const pct = p.total ? Math.round(p.done / p.total * 100) : 0;
    const stPill = t.status === 'draft' ? '<span class="pill">草稿</span>'
      : t.status === 'closed' ? '<span class="pill">已结束</span>'
        : p.done >= p.total ? '<span class="pill pill-ok">已完成</span>'
          : '<span class="pill pill-warn">进行中</span>';
    const actions = [];
    if (t.status === 'draft') {
      actions.push('<button class="btn btn-sm btn-primary" data-act="publishTask" data-id="' + t.id + '">发布</button>');
    } else {
      actions.push('<button class="btn btn-sm btn-primary" data-act="results" data-id="' + t.id + '">录入结果</button>');
      actions.push('<button class="btn btn-sm" data-act="wrong" data-id="' + t.id + '">本次错词</button>');
    }
    if (t.status !== 'closed') actions.push('<button class="btn btn-sm btn-ghost" data-act="closeTask" data-id="' + t.id + '">结束</button>');
    actions.push('<button class="btn btn-sm btn-ghost" data-act="delTask" data-id="' + t.id + '">删除</button>');

    return '<div class="card task-card">' +
      '<div class="task-head"><h3>' + U.esc(t.title) + '</h3>' + stPill +
        '<span class="pill">' + MODE[t.mode] + '</span></div>' +
      '<div class="task-meta"><span>' + U.esc(cls.name) + '</span><span>' + U.esc(list.name) + '</span>' +
        '<span>' + t.entryCount + ' 词</span><span>间隔 ' + t.intervalSec + ' 秒</span>' +
        '<span>重复 ' + t.repeatTimes + ' 遍</span><span>' + (t.shuffle ? '乱序' : '顺序') + '</span>' +
        (t.publishedAt ? '<span>发布于 ' + U.fmtShort(t.publishedAt) + '</span>' : '') + '</div>' +
      (t.status !== 'draft'
        ? '<div class="progress"><i style="width:' + pct + '%"></i></div>' +
          '<div class="small muted">已录 ' + p.done + ' / ' + p.total + ' 人' +
          (p.done ? ' · 平均正确率 ' + p.avg + '% · 错词 ' + p.wrong + ' 个' : ' · 还没有结果') + '</div>'
        : '<div class="small muted">还没发布。发布后学生就能用手机做这次听写。</div>') +
      '<div class="task-foot">' + actions.join('') +
        '<span class="right"><button class="btn btn-sm btn-ghost" data-act="copyLink" data-id="' + t.id + '">复制学生链接</button></span>' +
      '</div></div>';
  }

  function listView() {
    const all = Store.db.tasks;
    const filters = [
      ['all', '全部'], ['draft', '草稿'], ['active', '进行中'], ['done', '已完成']
    ];
    let ts = all.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    if (state.status !== 'all') {
      ts = ts.filter(t => {
        const p = taskProgress(t);
        if (state.status === 'draft') return t.status === 'draft';
        if (state.status === 'active') return t.status === 'published' && p.done < p.total;
        return t.status === 'closed' || (t.status === 'published' && p.done >= p.total);
      });
    }
    const cards = ts.length ? ts.map(taskCard).join('') :
      '<div class="card"><div class="empty"><div class="empty-ico"><svg viewBox="0 0 24 24"><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><path d="M4 14h3v5H5.5A1.5 1.5 0 0 1 4 17.5z"/><path d="M20 14h-3v5h1.5a1.5 1.5 0 0 0 1.5-1.5z"/></svg></div>' +
        '<h3>还没有听写任务</h3><p>选一个已有词表，3 步就能发。</p>' +
        '<div class="empty-actions"><a class="btn btn-primary" href="#/dictation/new">+ 新建听写</a></div></div></div>';

    const drafts = all.filter(t => t.status === 'draft').length;
    return '<section class="page-head"><div><h1>听写中心</h1>' +
        '<p class="sub">' + all.length + ' 次任务 · ' + drafts + ' 个草稿 · ' +
        '音频第一版用你上传的文件</p></div>' +
        '<div class="head-actions"><a class="btn btn-primary" href="#/dictation/new">+ 新建听写</a></div></section>' +
      '<div class="seg" style="margin-bottom:16px">' + filters.map(f =>
        '<button class="seg-item' + (state.status === f[0] ? ' active' : '') + '" data-act="filter" data-v="' + f[0] + '">' + f[1] + '</button>'
      ).join('') + '</div>' + cards;
  }

  /* ---------------- 向导 ---------------- */
  function stepBar() {
    const steps = ['选词表', '选班级与模式', '确认发布'];
    return '<div class="stepbar">' + steps.map((s, i) => {
      const n = i + 1;
      const cls = wiz.step === n ? 'active' : wiz.step > n ? 'done' : '';
      return '<div class="step ' + cls + '"><b>' + (wiz.step > n ? '✓' : n) + '</b>' + s + '</div>' +
        (n < 3 ? '<span class="step-line"></span>' : '');
    }).join('') + '</div>';
  }

  function step1() {
    const ls = Store.db.wordlists;
    const picked = wiz.listId ? Store.byId('wordlists', wiz.listId) : null;
    const cards = ls.map(l => {
      const es = Store.entriesOf(l.id);
      const missing = es.filter(e => e.audioStatus !== 'ready').length;
      return '<label class="pick-card' + (wiz.listId === l.id ? ' sel' : '') + '">' +
        '<input type="radio" name="wl" data-act="pickList" data-id="' + l.id + '"' + (wiz.listId === l.id ? ' checked' : '') + '>' +
        '<span class="pick-main"><b>' + U.esc(l.name) + '</b>' +
        '<span class="tiny muted">' + U.esc(l.textbook || '') + (l.unit ? ' · ' + U.esc(l.unit) : '') + ' · ' + es.length + ' 词' +
        (missing ? ' · <span class="text-warn">缺音频 ' + missing + '</span>' : ' · 音频齐全') + '</span></span>' +
        '</label>';
    }).join('');
    const entries = picked ? Store.entriesOf(picked.id) : [];
    const entryList = entries.map(e =>
      '<label class="pick-card" style="padding:9px 12px"><input type="checkbox" data-act="toggleEntry" data-id="' + e.id + '"' +
      (wiz.entryIds.indexOf(e.id) >= 0 ? ' checked' : '') + '>' +
      '<span class="pick-main"><b style="font-weight:500">' + U.esc(e.word) + '</b>' +
      '<span class="tiny muted">' + U.esc(e.meaningZh || '') + '</span></span>' +
      (e.audioStatus === 'ready' ? '' : '<span class="pill pill-warn">无音频</span>') +
      '</label>').join('');

    return '<div class="card"><div class="card-head"><h2>第 1 步 · 选词表</h2>' +
        (picked ? '<span class="small muted">已选 ' + wiz.entryIds.length + ' / ' + entries.length + ' 词</span>' : '') +
      '</div>' + cards +
      (picked && entries.length
        ? '<div style="margin-top:14px"><div class="label" style="margin-bottom:6px">这一课要听写的词（可只选一部分）</div>' +
          '<div style="max-height:300px;overflow:auto">' + entryList + '</div></div>'
        : '') +
      '</div>' +
      '<div class="empty-actions" style="justify-content:flex-end;margin-top:14px">' +
        '<a class="btn btn-ghost" href="#/dictation">取消</a>' +
        '<button class="btn btn-primary" data-act="next">下一步</button></div>';
  }

  function step2() {
    const classes = Store.db.classes.filter(c => !c.archived);
    return '<div class="card"><div class="card-head"><h2>第 2 步 · 班级与模式</h2></div>' +
      '<div class="label" style="margin-bottom:6px">发到哪个班</div>' +
      classes.map(c =>
        '<label class="pick-card' + (wiz.classId === c.id ? ' sel' : '') + '">' +
        '<input type="radio" name="cls" data-act="pickClass" data-id="' + c.id + '"' + (wiz.classId === c.id ? ' checked' : '') + '>' +
        '<span class="pick-main"><b>' + U.esc(c.name) + '</b>' +
        '<span class="tiny muted">' + classSize(c.id) + ' 人 · 访问码 ' + U.esc(c.accessCode) + '</span></span></label>').join('') +
      '<div class="label" style="margin:16px 0 6px">听写模式</div>' +
      '<div class="mode-grid">' +
        [['listen_word', '听音写词', '播音频，学生写单词'],
         ['meaning_word', '看义写词', '显示中文，学生写单词'],
         ['spell_check', '拼写自检', '显示单词，学生自评对错']].map(m =>
          '<div class="mode-card' + (wiz.mode === m[0] ? ' sel' : '') + '" data-act="pickMode" data-v="' + m[0] + '">' +
          '<b>' + m[1] + '</b><span>' + m[2] + '</span></div>').join('') +
      '</div>' +
      '<div class="form-grid" style="margin-top:16px">' +
        '<div class="field"><label class="label">播放间隔</label>' +
          '<select class="select" data-change="interval">' +
            [3, 5, 8, 10].map(v => '<option value="' + v + '"' + (Number(wiz.interval) === v ? ' selected' : '') + '>' + v + ' 秒</option>').join('') +
          '</select></div>' +
        '<div class="field"><label class="label">重复遍数</label>' +
          '<select class="select" data-change="repeat">' +
            [1, 2].map(v => '<option value="' + v + '"' + (Number(wiz.repeat) === v ? ' selected' : '') + '>' + v + ' 遍</option>').join('') +
          '</select></div>' +
      '</div>' +
      '<label class="check" style="margin-bottom:10px"><input type="checkbox" data-change="shuffle"' + (wiz.shuffle ? ' checked' : '') + '> 打乱顺序</label><br>' +
      '<label class="check"><input type="checkbox" data-change="replay"' + (wiz.allowReplay ? ' checked' : '') + '> 允许回听上一题</label>' +
      '<div class="notice" style="margin-top:14px">音频来源：<b>上传的音频文件</b>（第一版默认）。' +
        '想用语音复刻接口批量生成，等第二期在设置里启用语音服务。</div>' +
      '</div>' +
      '<div class="empty-actions" style="justify-content:flex-end;margin-top:14px">' +
        '<button class="btn btn-ghost" data-act="prev">上一步</button>' +
        '<button class="btn btn-primary" data-act="next">下一步</button></div>';
  }

  function step3() {
    const l = Store.byId('wordlists', wiz.listId) || { name: '' };
    const c = Store.byId('classes', wiz.classId) || { name: '' };
    const title = wiz.title || (l.name.split(' ').slice(-1)[0] + ' 听写 · ' + c.name + ' · ' + U.fmtShort(U.addDays(U.today(), 1)));
    wiz.title = title;
    return '<div class="card"><div class="card-head"><h2>第 3 步 · 确认</h2></div>' +
      '<div class="field"><label class="label">任务名称</label>' +
        '<input class="input" data-input="title" value="' + U.esc(title) + '"></div>' +
      '<div class="form-grid">' +
        '<div class="field"><label class="label">截止时间</label>' +
          '<input class="input" type="date" data-input="due" value="' + (wiz.due || U.addDays(U.today(), 2)) + '"></div>' +
        '<div class="field"><label class="label">词数</label><input class="input" value="' + wiz.entryIds.length + ' 个词" disabled></div>' +
      '</div>' +
      '<div class="notice" style="margin-top:6px">' +
        '<b>' + U.esc(c.name) + '</b> · ' + MODE[wiz.mode] + ' · 间隔 ' + wiz.interval + ' 秒 · 重复 ' + wiz.repeat +
        ' 遍 · ' + (wiz.shuffle ? '乱序' : '顺序') + '<br>' +
        '发布后学生用班级码进入即可作答。第一版先支持"你录入结果"，学生在线提交在第二期开放。' +
      '</div></div>' +
      '<div class="empty-actions" style="justify-content:flex-end;margin-top:14px">' +
        '<button class="btn btn-ghost" data-act="prev">上一步</button>' +
        '<button class="btn" data-act="saveDraft">存为草稿</button>' +
        '<button class="btn btn-primary" data-act="publish">发布</button></div>';
  }

  function wizard() {
    if (wiz.step === 1 && !Store.db.wordlists.length) {
      return '<div class="wiz"><div class="card"><div class="empty"><div class="empty-ico"><svg viewBox="0 0 24 24"><path d="M5 4h11l3 3v13H5z"/><path d="M8 9h8M8 13h8"/></svg></div>' +
        '<h3>先得有个词表</h3><p>听写是按词表发布的。去词库粘贴一批单词，回来再发听写。</p>' +
        '<div class="empty-actions"><a class="btn btn-primary" href="#/lists">去建词表</a></div></div></div></div>';
    }
    return '<div class="wiz">' + stepBar() +
      (wiz.step === 1 ? step1() : wiz.step === 2 ? step2() : step3()) + '</div>';
  }

  /* ---------------- 结果录入 ---------------- */
  function draftFor(taskId) {
    if (draft.taskId === taskId) return draft;
    const map = {};
    Store.db.records.filter(r => r.taskId === taskId).forEach(r => {
      map[r.studentId + '|' + r.entryId] = r.isCorrect ? 'ok' : (r.errorType || 'spelling');
    });
    draft = { taskId, map };
    mobileStu = '';
    return draft;
  }
  function cellState(stu, ent) { return draft.map[stu + '|' + ent] || null; }
  function cellLabel(s) { return s === 'ok' ? '✓' : s === null ? '' : ETYPE[s].slice(0, 1); }
  function cellClass(s) { return s === 'ok' ? 'ok' : s ? 'bad' : ''; }

  /* 手机端：一次一个学生，大字按钮 */
  function mobileResults(students, entries) {
    if (!students.length) return '<div class="empty"><p>这个班还没有学生。</p></div>';
    if (!mobileStu || !students.some(s => s.id === mobileStu)) mobileStu = students[0].id;
    const chips = students.map(s => {
      const n = entries.filter(e => draft.map[s.id + '|' + e.id]).length;
      return '<button class="stu-chip' + (s.id === mobileStu ? ' active' : '') + '" data-act="pickStu" data-id="' + s.id + '">' +
        U.esc(s.displayName) + '<i>' + n + '/' + entries.length + '</i></button>';
    }).join('');
    const rows = entries.map(e => {
      const st = cellState(mobileStu, e.id);
      return '<div class="m-row"><div class="m-word"><b>' + U.esc(e.word) + '</b>' +
        '<span>' + U.esc(e.phonetic || '') + (e.meaningZh ? ' · ' + U.esc(e.meaningZh) : '') + '</span></div>' +
        '<button class="m-btn ' + (st === 'ok' ? 'ok' : st ? 'bad' : '') + '" data-act="cellM" data-stu="' + mobileStu +
        '" data-ent="' + e.id + '">' + (st === 'ok' ? '✓ 正确' : st ? ETYPE[st] : '未填') + '</button></div>';
    }).join('');
    return '<div class="stu-chips">' + chips + '</div>' +
      '<div class="card" style="margin-top:10px;padding:4px 14px">' + rows + '</div>' +
      '<div class="empty-actions" style="justify-content:space-between;margin-top:12px">' +
        '<button class="btn" data-act="prevStu">← 上一个</button>' +
        '<button class="btn btn-primary" data-act="nextStu">下一个学生 →</button></div>';
  }

  function resultsView(taskId) {
    const t = Store.byId('tasks', taskId);
    if (!t) return notFound();
    draftFor(taskId);
    const mobile = window.matchMedia('(max-width: 767px)').matches;
    const students = Store.studentsOf(t.classId);
    const entries = Store.taskEntries(taskId);
    const head = entries.map(e => '<th class="rot" title="' + U.esc(e.word) + '"><span>' + U.esc(e.word) + '</span></th>').join('');
    const body = students.map(s => {
      const cells = entries.map(e => {
        const st = cellState(s.id, e.id);
        return '<td><button class="cell ' + cellClass(st) + '" data-act="cell" data-stu="' + s.id +
          '" data-ent="' + e.id + '" aria-label="' + U.esc(s.displayName + ' ' + e.word) + '">' + cellLabel(st) + '</button></td>';
      }).join('');
      return '<tr><td class="stu">' + U.esc(s.displayName) + '</td>' + cells + '</tr>';
    }).join('');

    return '<a class="back" href="#/dictation">← 听写中心</a>' +
      '<section class="page-head"><div><h1>' + U.esc(t.title) + '</h1>' +
        '<p class="sub">' + U.esc((Store.byId('classes', t.classId) || {}).name || '') + ' · ' +
        entries.length + ' 词 · ' + students.length + ' 人 · ' + MODE[t.mode] + '</p></div>' +
        '<div class="head-actions"><button class="btn" data-act="allCorrect">全部标对</button>' +
        '<button class="btn btn-primary" data-act="saveResults" data-id="' + t.id + '">保存结果</button></div></section>' +
      (mobile
        ? '<p class="small muted" style="margin:-6px 0 10px">逐个学生录：点右侧按钮循环切换 正确 → 拼写 → 词义 → 发音 → 未答。</p>' +
          mobileResults(students, entries)
        : '<div class="legend"><span><i style="background:var(--c-ok-soft);border:1px solid #D3E8DB"></i>✓ 正确</span>' +
          '<span><i style="background:var(--c-danger-soft);border:1px solid #EBCFCB"></i>拼 / 义 / 音 / 未 = 错误类型</span>' +
          '<span>点单元格循环：空 → 对 → 拼写 → 词义 → 音近 → 未答</span></div>' +
          '<div class="matrix-wrap"><table class="matrix"><thead><tr><th class="stu">学生</th>' + head + '</tr></thead>' +
          '<tbody>' + body + '</tbody></table></div>') +
      '<div class="sum-bar" id="sumBar">' + summaryHTML() + '</div>' +
      '<div class="empty-actions" style="justify-content:flex-start;margin-top:12px">' +
        '<button class="btn btn-sm" data-act="wrong" data-id="' + t.id + '">查看本次错词清单 →</button></div>';
  }

  function summaryHTML() {
    const students = {};
    const per = {};
    let correct = 0, total = 0;
    Object.keys(draft.map).forEach(k => {
      const [stu, ent] = k.split('|');
      students[stu] = 1;
      per[ent] = per[ent] || { wrong: 0, total: 0 };
      per[ent].total++;
      if (draft.map[k] === 'ok') { correct++; } else { per[ent].wrong++; }
      total++;
    });
    const wrongWords = Object.keys(per).filter(k => per[k].wrong > 0).length;
    return '<span class="small muted">已录</span> <b>' + Object.keys(students).length + '</b> <span class="small muted">人</span>' +
      '<span><span class="small muted">已填</span> <b>' + total + '</b> <span class="small muted">格</span></span>' +
      '<span><span class="small muted">平均正确率</span> <b>' + (total ? Math.round(correct / total * 100) : 0) + '%</b></span>' +
      '<span><span class="small muted">错词</span> <b>' + wrongWords + '</b> <span class="small muted">个</span></span>';
  }

  function syncChip(stu) {
    const chip = document.querySelector('.stu-chips [data-act="pickStu"][data-id="' + stu + '"] i');
    if (!chip) return;
    const t = Store.byId('tasks', draft.taskId);
    if (!t) return;
    const entries = Store.taskEntries(t.id);
    const n = entries.filter(e => draft.map[stu + '|' + e.id]).length;
    chip.textContent = n + '/' + entries.length;
  }

  function moveStu(dir) {
    const t = Store.byId('tasks', draft.taskId);
    if (!t) return;
    const list = Store.studentsOf(t.classId);
    const i = list.findIndex(s => s.id === mobileStu);
    if (i < 0) return;
    mobileStu = list[(i + dir + list.length) % list.length].id;
    App.render();
    window.scrollTo(0, 0);
  }

  /* ---------------- 本次错词 ---------------- */
  function wrongView(taskId) {
    const t = Store.byId('tasks', taskId);
    if (!t) return notFound();
    const rows = Store.topWrong(taskId, 999).filter(x => x.rate > 0);
    const list = rows.length ? rows.map((x, i) =>
      '<div class="agg-row">' +
        '<div class="agg-word"><b>' + U.esc(x.entry.word) + '</b>' +
          '<span>' + U.esc(x.entry.phonetic || '') + ' · ' + U.esc(x.entry.meaningZh || '') + '</span></div>' +
        '<div class="agg-bar"><div class="track"><i class="' + (x.rate >= 35 ? 'high' : x.rate >= 15 ? 'mid' : 'low') +
          '" style="width:' + Math.max(x.rate, 3) + '%"></i></div></div>' +
        '<div class="agg-val small"><b>' + x.rate + '%</b><br><span class="tiny muted">' + x.wrong + '/' + x.total + '</span></div>' +
      '</div>').join('') :
      '<div class="empty"><h3>这次没有错词</h3><p>全对，不用再听写了。</p></div>';

    return '<a class="back" href="#/dictation">← 听写中心</a>' +
      '<section class="page-head"><div><h1>本次错词 · ' + U.esc(t.title) + '</h1>' +
        '<p class="sub">' + rows.length + ' 个词有错 · 从高到低排序</p></div>' +
        '<div class="head-actions">' +
          '<button class="btn" data-act="addPool" data-id="' + taskId + '">加入再听写池</button>' +
          '<button class="btn btn-primary" data-act="genList" data-id="' + taskId + '">生成再听写词表</button>' +
        '</div></section>' +
      '<div class="card" style="padding:6px 16px">' + list + '</div>';
  }

  function notFound() {
    return '<div class="card"><div class="empty"><h3>找不到这个任务</h3>' +
      '<div class="empty-actions"><a class="btn" href="#/dictation">返回听写中心</a></div></div></div>';
  }

  /* ---------------- 渲染入口 ---------------- */
  P.render = function (params) {
    if (params && params[0] === 'new') return wizard();
    if (params && params[0] && params[1] === 'results') return resultsView(params[0]);
    if (params && params[0] && params[1] === 'wrong') return wrongView(params[0]);
    return listView();
  };

  P.onInput = function (k, v) {
    if (k === 'title') wiz.title = v;
    if (k === 'due') wiz.due = v;
  };
  P.onChange = function (k, v, el) {
    if (k === 'interval') wiz.interval = v;
    if (k === 'repeat') wiz.repeat = v;
    if (k === 'shuffle') wiz.shuffle = el.checked;
    if (k === 'replay') wiz.allowReplay = el.checked;
  };

  P.actions = {
    filter(el) { state.status = el.dataset.v; App.refresh(); },

    results(el) { location.hash = '#/dictation/' + el.dataset.id + '/results'; },
    wrong(el) { location.hash = '#/dictation/' + el.dataset.id + '/wrong'; },

    copyLink() {
      UI.toast('学生端第二期上线后，这里会生成班级码链接与二维码');
    },

    publishTask(el) {
      const t = Store.byId('tasks', el.dataset.id);
      if (!t) return;
      t.status = 'published';
      t.publishedAt = U.today();
      t.dueAt = U.addDays(U.today(), 3);
      Store.save('tasks');
      App.refresh();
      UI.toast('已发布');
    },

    closeTask(el) {
      const t = Store.byId('tasks', el.dataset.id);
      UI.confirm({
        title: '结束这次听写',
        message: '结束后学生不能再提交，但已录入的结果都保留。',
        confirmText: '结束'
      }).then(ok => {
        if (!ok) return;
        t.status = 'closed'; Store.save('tasks'); App.refresh(); UI.toast('已结束');
      });
    },

    delTask(el) {
      const t = Store.byId('tasks', el.dataset.id);
      UI.confirm({
        title: '删除听写任务',
        message: '删除 <b>' + U.esc(t.title) + '</b> 以及它的 <b>' +
          Store.db.records.filter(r => r.taskId === t.id).length + '</b> 条记录？',
        confirmText: '删除', danger: true
      }).then(ok => {
        if (!ok) return;
        Store.db.tasks = Store.db.tasks.filter(x => x.id !== t.id);
        Store.db.taskEntries = Store.db.taskEntries.filter(x => x.taskId !== t.id);
        Store.db.records = Store.db.records.filter(r => r.taskId !== t.id);
        Store.save('tasks'); Store.save('taskEntries'); Store.save('records');
        App.refresh(); UI.toast('已删除');
      });
    },

    pickList(el) {
      wiz.listId = el.dataset.id;
      wiz.entryIds = Store.entriesOf(wiz.listId).map(e => e.id);
      App.refresh();
    },

    toggleEntry(el) {
      const id = el.dataset.id;
      const i = wiz.entryIds.indexOf(id);
      if (el.checked && i < 0) wiz.entryIds.push(id);
      if (!el.checked && i >= 0) wiz.entryIds.splice(i, 1);
      const box = document.querySelector('.wiz .card-head .small');
      if (box) box.textContent = '已选 ' + wiz.entryIds.length + ' / ' + Store.entriesOf(wiz.listId).length + ' 词';
    },

    pickClass(el) { wiz.classId = el.dataset.id; App.refresh(); },
    pickMode(el) { wiz.mode = el.dataset.v; App.refresh(); },

    next() {
      if (wiz.step === 1) {
        if (!wiz.listId) { UI.toast('先选一个词表', { type: 'warn' }); return; }
        if (!wiz.entryIds.length) { UI.toast('至少要选一个词', { type: 'warn' }); return; }
        wiz.step = 2;
      } else if (wiz.step === 2) {
        if (!wiz.classId) { UI.toast('选一个班级', { type: 'warn' }); return; }
        wiz.step = 3;
      }
      App.refresh();
    },
    prev() { if (wiz.step > 1) { wiz.step -= 1; App.refresh(); } },

    saveDraft() { createTask('draft'); },
    publish() { createTask('published'); },

    cell(el) {
      const k = el.dataset.stu + '|' + el.dataset.ent;
      const cur = draft.map[k] || null;
      const nx = CYCLE[(CYCLE.indexOf(cur) + 1) % CYCLE.length];
      if (nx === null) delete draft.map[k]; else draft.map[k] = nx;
      el.className = 'cell ' + cellClass(nx);
      el.textContent = cellLabel(nx);
      const bar = document.getElementById('sumBar');
      if (bar) bar.innerHTML = summaryHTML();
    },

    pickStu(el) { mobileStu = el.dataset.id; App.refresh(); },

    cellM(el) {
      const stu = el.dataset.stu || mobileStu;
      const k = stu + '|' + el.dataset.ent;
      const cur = draft.map[k] || null;
      const nx = CYCLE[(CYCLE.indexOf(cur) + 1) % CYCLE.length];
      if (nx === null) delete draft.map[k]; else draft.map[k] = nx;
      el.className = 'm-btn ' + (nx === 'ok' ? 'ok' : nx ? 'bad' : '');
      el.textContent = nx === 'ok' ? '✓ 正确' : nx ? ETYPE[nx] : '未填';
      syncChip(stu);
      const bar = document.getElementById('sumBar');
      if (bar) bar.innerHTML = summaryHTML();
    },

    nextStu() { moveStu(1); },
    prevStu() { moveStu(-1); },

    allCorrect() {
      const t = Store.byId('tasks', draft.taskId);
      if (!t) return;
      Store.studentsOf(t.classId).forEach(s => {
        Store.taskEntries(t.id).forEach(e => { draft.map[s.id + '|' + e.id] = 'ok'; });
      });
      App.refresh();
    },

    saveResults(el) {
      const taskId = el.dataset.id;
      const recs = Object.keys(draft.map).map(k => {
        const [studentId, entryId] = k.split('|');
        const v = draft.map[k];
        return {
          id: U.uid('rc'), taskId, studentId, entryId,
          isCorrect: v === 'ok', errorType: v === 'ok' ? '' : v,
          source: 'manual', createdAt: new Date().toISOString()
        };
      });
      Store.db.records = Store.db.records.filter(r => r.taskId !== taskId).concat(recs);
      Store.save('records');
      UI.toast('已保存 ' + recs.length + ' 条记录');
      App.refresh();
    },

    addPool(el) {
      const rows = Store.topWrong(el.dataset.id, 999).filter(x => x.rate > 0);
      const n = Store.addToPool(rows.map(x => ({
        entryId: x.entry.id, word: x.entry.word, phonetic: x.entry.phonetic,
        meaning: x.entry.meaningZh, rate: x.rate
      })), 'task');
      UI.toast(n ? '已加入再听写池 ' + n + ' 个' : '这些词已在池中');
    },

    genList(el) {
      const rows = Store.topWrong(el.dataset.id, 999).filter(x => x.rate > 0);
      if (!rows.length) { UI.toast('这次没有错词', { type: 'warn' }); return; }
      if (window.openGenerateList) window.openGenerateList(rows.map(x => x.entry.id), '再听写 · ' + U.fmtShort(U.today()));
    }
  };

  function createTask(status) {
    const l = Store.byId('wordlists', wiz.listId);
    const c = Store.byId('classes', wiz.classId);
    const title = (wiz.title || '').trim() ||
      (l.name.split(' ').pop() + ' 听写 · ' + c.name + ' · ' + U.fmtShort(U.today()));
    const t = {
      id: U.uid('tk'), title, listId: wiz.listId, classId: wiz.classId, mode: wiz.mode,
      intervalSec: Number(wiz.interval), repeatTimes: Number(wiz.repeat), shuffle: !!wiz.shuffle,
      allowReplay: !!wiz.allowReplay, audioSource: 'upload', status,
      entryCount: wiz.entryIds.length,
      publishedAt: status === 'published' ? U.today() : '', dueAt: wiz.due || U.addDays(U.today(), 2),
      createdAt: new Date().toISOString()
    };
    Store.db.tasks.push(t);
    wiz.entryIds.forEach((eid, i) => Store.db.taskEntries.push({ taskId: t.id, entryId: eid, order: i + 1 }));
    Store.save('tasks'); Store.save('taskEntries');
    resetWiz();
    location.hash = '#/dictation';
    App.refresh();
    UI.toast(status === 'published' ? '已发布，可以录结果了' : '已存为草稿');
  }

  window.Pages.dictation = P;
})();
