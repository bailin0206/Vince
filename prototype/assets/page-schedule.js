/* 课表与备课：周视图 / 备课抽屉 / 提醒规则 */
(function () {
  const P = { title: '课表与备课' };
  const state = { weekOffset: 0, classId: 'all' };
  const SL = { todo: '未开始', preparing: '备课中', ready: '已就绪', done: '已上课' };
  const PERIODS = [1, 2, 3, 4, 5, 6, 7];

  function weekStart() {
    return U.addDays(U.weekStart(U.today()), state.weekOffset * 7);
  }
  function dates() {
    const s = weekStart();
    return [1, 2, 3, 4, 5].map(i => U.addDays(s, i - 1));
  }
  function coursesAt(iso, period) {
    return Store.coursesOn(iso).filter(c => c.period === period)
      .filter(c => state.classId === 'all' || c.classId === state.classId);
  }
  function className(id) { return (Store.byId('classes', id) || {}).name || '班级'; }

  function lessonHTML(c, iso) {
    const status = Store.prepStatus(c.id, iso);
    return '<button class="lesson ' + status + '" data-act="prep" data-course="' + c.id + '" data-date="' + iso + '" ' +
      'title="' + U.esc(className(c.classId) + ' · ' + SL[status]) + '">' +
      '<b>' + U.esc(className(c.classId)) + '</b>' +
      '<span>' + U.esc(c.startTime) + ' · ' + SL[status] + '</span>' +
      '<span>' + U.esc(c.location || '') + '</span></button>';
  }

  function gridHTML() {
    const ds = dates();
    const head = '<div></div>' + ds.map(d =>
      '<div class="wk-h' + (d === U.today() ? ' today' : '') + '"><b>' + U.fmtWD(d) + '</b>' + U.fmtShort(d) + '</div>').join('');
    const rows = PERIODS.map(p => {
      const cells = ds.map(d => {
        const cs = coursesAt(d, p);
        if (!cs.length) {
          return '<div class="wk-cell empty"><button data-act="addCourse" data-date="' + d + '" data-period="' + p +
            '" aria-label="添加课程">+</button></div>';
        }
        return '<div class="wk-cell">' + cs.map(c => lessonHTML(c, d)).join('') + '</div>';
      }).join('');
      return '<div class="wk-p"><b>第' + p + '节</b></div>' + cells;
    }).join('');
    return '<div class="week-grid">' + head + rows + '</div>';
  }

  function dayListHTML() {
    const ds = dates();
    return '<div class="day-list">' + ds.map(d => {
      const cs = Store.coursesOn(d).filter(c => state.classId === 'all' || c.classId === state.classId);
      return '<div class="day-group' + (d === U.today() ? ' today' : '') + '"><h3>' +
        U.fmtMD(d) + ' ' + U.fmtWD(d) + (d === U.today() ? ' · 今天' : '') + '</h3>' +
        (cs.length ? cs.map(c => {
          const status = Store.prepStatus(c.id, d);
          return '<button class="lesson ' + status + '" style="padding:9px 11px;margin-bottom:6px" ' +
            'data-act="prep" data-course="' + c.id + '" data-date="' + d + '">' +
            '<b>' + U.esc(className(c.classId)) + ' · 第 ' + c.period + ' 节</b>' +
            '<span>' + U.esc(c.startTime) + '–' + U.esc(c.endTime) + ' · ' + U.esc(c.location || '') + ' · ' + SL[status] + '</span></button>';
        }).join('') : '<div class="small muted" style="padding:6px 2px">没有课</div>') +
        '</div>';
    }).join('') + '</div>';
  }

  P.render = function () {
    const ds = dates();
    const classes = Store.db.classes.filter(c => !c.archived);
    const unready = Store.upcoming(3).filter(x => x.status !== 'ready' && x.status !== 'done').length;
    const thisWeek = ds.reduce((n, d) => n + Store.coursesOn(d).filter(c => state.classId === 'all' || c.classId === state.classId).length, 0);

    return '<section class="page-head"><div><h1>课表与备课</h1>' +
        '<p class="sub">' + U.fmtMD(ds[0]) + ' – ' + U.fmtMD(ds[4]) + ' · 本周 ' + thisWeek + ' 节课</p></div>' +
        '<div class="head-actions"><button class="btn" data-act="print">打印课表</button>' +
        '<button class="btn btn-primary" data-act="addCourse">+ 添加课程</button></div></section>' +
      (unready ? '<div class="banner banner-warn"><span class="banner-ico">!</span>' +
        '<div><strong>未来 3 天有 ' + unready + ' 节课没备好</strong>' +
        '<div class="small" style="opacity:.8">点课程卡片打开备课面板，状态改成"已就绪"就不再提醒。</div></div></div>' : '') +
      '<div class="week-head">' +
        '<button class="btn btn-sm" data-act="week" data-v="-1">←</button>' +
        '<span class="week-title">' + U.fmtMD(ds[0]) + ' – ' + U.fmtMD(ds[4]) + '</span>' +
        '<button class="btn btn-sm" data-act="week" data-v="1">→</button>' +
        '<button class="btn btn-sm btn-ghost" data-act="week" data-v="0">今天</button>' +
        '<div class="seg" style="margin-left:auto">' +
          '<button class="seg-item' + (state.classId === 'all' ? ' active' : '') + '" data-act="cls" data-v="all">全部</button>' +
          classes.map(c => '<button class="seg-item' + (state.classId === c.id ? ' active' : '') + '" data-act="cls" data-v="' + c.id + '">' +
            U.esc(c.name) + '</button>').join('') +
        '</div></div>' +
      '<div class="card" style="padding:14px">' + gridHTML() + dayListHTML() + '</div>' +
      '<div class="small muted" style="margin-top:12px">课程卡左侧色条：灰=未开始 · 琥珀=备课中 · 绿=已就绪 · 蓝灰=已上课。点卡片打开备课面板。</div>';
  };

  /* ---------------- 备课面板 ---------------- */
  P.openPrep = function (courseId, iso) {
    const c = Store.byId('courses', courseId);
    if (!c) return;
    const prep = Store.prep(courseId, iso) || {
      status: 'todo', outline: '', listIds: [], taskIds: [], examId: '', resources: [], note: ''
    };
    const tasks = Store.db.tasks.filter(t => t.classId === c.classId);
    const lists = Store.db.wordlists;
    const exams = Store.db.exams.filter(e => e.classId === c.classId);
    const resText = (prep.resources || []).map(r => r.name + ' | ' + r.url).join('\n');
    let status = prep.status;

    const statusBtns = ['todo', 'preparing', 'ready', 'done'].map(s =>
      '<button class="seg-item' + (status === s ? ' active' : '') + '" data-st="' + s + '">' + SL[s] + '</button>').join('');

    const m = UI.drawer({
      title: className(c.classId) + ' · 第 ' + c.period + ' 节',
      sub: U.fmtMD(iso) + ' ' + U.fmtWD(iso) + ' · ' + U.esc(c.startTime) + '–' + U.esc(c.endTime) +
        (c.location ? ' · ' + U.esc(c.location) : ''),
      body:
        '<div class="field"><label class="label">备课状态</label><div class="seg" id="stSeg" style="width:100%">' + statusBtns + '</div></div>' +
        '<div class="field"><label class="label">教案要点</label>' +
          '<textarea class="textarea" data-outline placeholder="1. 复习上节错词&#10;2. 阅读 P52&#10;3. 布置再听写">' + U.esc(prep.outline || '') + '</textarea></div>' +
        '<div class="field"><label class="label">关联词表</label>' +
          '<div style="max-height:140px;overflow:auto;border:1px solid var(--c-line);border-radius:10px;padding:6px 10px">' +
            (lists.length ? lists.map(l =>
              '<label class="check" style="padding:3px 0"><input type="checkbox" data-list="' + l.id + '"' +
              ((prep.listIds || []).indexOf(l.id) >= 0 ? ' checked' : '') + '> ' + U.esc(l.name) +
              '<span class="tiny muted">（' + Store.entriesOf(l.id).length + ' 词）</span></label>').join('')
              : '<div class="small muted">还没有词表</div>') +
          '</div>' +
          '<button class="btn btn-sm btn-ghost" data-act="newList" style="align-self:flex-start;margin-top:6px">+ 从错词池新建词表</button></div>' +
        '<div class="field"><label class="label">关联听写</label>' +
          '<div style="max-height:120px;overflow:auto;border:1px solid var(--c-line);border-radius:10px;padding:6px 10px">' +
            (tasks.length ? tasks.map(t =>
              '<label class="check" style="padding:3px 0"><input type="checkbox" data-task="' + t.id + '"' +
              ((prep.taskIds || []).indexOf(t.id) >= 0 ? ' checked' : '') + '> ' + U.esc(t.title) + '</label>').join('')
              : '<div class="small muted">这个班还没有听写任务</div>') +
          '</div></div>' +
        '<div class="field"><label class="label">关联成绩分析（第三期）</label>' +
          '<select class="select" data-exam><option value="">不关联</option>' +
            exams.map(e => '<option value="' + e.id + '"' + (prep.examId === e.id ? ' selected' : '') + '>' +
              U.esc(e.name) + '</option>').join('') + '</select></div>' +
        '<div class="field"><label class="label">资源链接（每行一条，格式：名称 | 网址）</label>' +
          '<textarea class="textarea" data-res style="min-height:70px" placeholder="课件 | https://example.com/ppt">' + U.esc(resText) + '</textarea></div>' +
        '<div class="field"><label class="label">备注</label>' +
          '<input class="input" data-note value="' + U.esc(prep.note || '') + '" placeholder="这节课的提醒">' +
          '<span class="hint">课后可写：哪几个词还需要强化。</span></div>',
      footer: '<button class="btn" data-ui-close>关闭</button>' +
        '<button class="btn btn-danger-ghost" data-del>删除记录</button>' +
        '<button class="btn btn-primary" data-save style="margin-left:auto">保存</button>'
    });

    m.body.querySelector('#stSeg').addEventListener('click', e => {
      const b = e.target.closest('[data-st]');
      if (!b) return;
      status = b.dataset.st;
      m.body.querySelectorAll('#stSeg .seg-item').forEach(x => x.classList.toggle('active', x.dataset.st === status));
    });

    m.body.querySelector('[data-act="newList"]').addEventListener('click', () => {
      m.close();
      location.hash = '#/errors';
      UI.toast('在错词分析里勾选词，生成再听写词表后再回来关联');
    });

    m.el.querySelector('[data-save]').addEventListener('click', () => {
      const listIds = [...m.body.querySelectorAll('[data-list]:checked')].map(x => x.dataset.list);
      const taskIds = [...m.body.querySelectorAll('[data-task]:checked')].map(x => x.dataset.task);
      const resources = m.body.querySelector('[data-res]').value.split('\n').filter(Boolean).map(line => {
        const i = line.indexOf('|');
        return i >= 0
          ? { name: line.slice(0, i).trim(), url: line.slice(i + 1).trim() }
          : { name: line.trim(), url: '' };
      });
      Store.upsertPrep(courseId, iso, {
        status,
        outline: m.body.querySelector('[data-outline]').value,
        listIds, taskIds,
        examId: m.body.querySelector('[data-exam]').value,
        resources,
        note: m.body.querySelector('[data-note]').value
      });
      m.close();
      App.refresh();
      UI.toast(status === 'ready' ? '已标记为已就绪' : '备课已保存');
    });

    m.el.querySelector('[data-del]').addEventListener('click', () => {
      UI.confirm({
        title: '删除备课记录',
        message: '这节课的教案要点、关联词表与备注都会清空，状态回到"未开始"。',
        confirmText: '删除', danger: true
      }).then(ok => {
        if (!ok) return;
        Store.db.preps = Store.db.preps.filter(p => !(p.courseId === courseId && p.date === iso));
        Store.save('preps');
        m.close(); App.refresh(); UI.toast('已删除');
      });
    });
  };

  /* ---------------- 操作 ---------------- */
  P.actions = {
    week(el) {
      const v = Number(el.dataset.v);
      state.weekOffset = v === 0 ? 0 : state.weekOffset + v;
      App.refresh();
    },
    cls(el) { state.classId = el.dataset.v; App.refresh(); },
    print() { window.print(); },

    prep(el) { P.openPrep(el.dataset.course, el.dataset.date); },

    addCourse(el) {
      const ds = dates();
      const classes = Store.db.classes.filter(c => !c.archived);
      if (!classes.length) { UI.toast('先在设置里建一个班级', { type: 'warn' }); return; }
      const m = UI.modal({
        title: '添加课程',
        body: '<div class="form-grid">' +
            '<div class="field"><label class="label">班级</label><select class="select" data-cls>' +
              classes.map(c => '<option value="' + c.id + '">' + U.esc(c.name) + '</option>').join('') + '</select></div>' +
            '<div class="field"><label class="label">星期</label><select class="select" data-wd>' +
              [1, 2, 3, 4, 5].map(i => '<option value="' + i + '"' + (U.weekday(el.dataset.date || U.today()) === i ? ' selected' : '') + '>周' +
                '一二三四五'[i - 1] + '</option>').join('') + '</select></div>' +
            '<div class="field"><label class="label">第几节</label><select class="select" data-period>' +
              PERIODS.map(p => '<option value="' + p + '"' + (Number(el.dataset.period) === p ? ' selected' : '') + '>第 ' + p + ' 节</option>').join('') +
            '</select></div>' +
            '<div class="field"><label class="label">地点</label><input class="input" data-loc value="教学楼302"></div>' +
            '<div class="field"><label class="label">开始</label><input class="input" type="time" data-start value="08:55"></div>' +
            '<div class="field"><label class="label">结束</label><input class="input" type="time" data-end value="09:40"></div>' +
          '</div>',
        footer: '<button class="btn" data-ui-close>取消</button><button class="btn btn-primary" data-ok>添加</button>'
      });
      m.foot.querySelector('[data-ok]').addEventListener('click', () => {
        const wd = Number(m.body.querySelector('[data-wd]').value);
        const period = Number(m.body.querySelector('[data-period]').value);
        const exists = Store.db.courses.some(c => c.weekday === wd && c.period === period && c.classId === m.body.querySelector('[data-cls]').value);
        if (exists) { UI.toast('这个时间已经有这个班的课了', { type: 'warn' }); return; }
        Store.db.courses.push({
          id: U.uid('cs'), classId: m.body.querySelector('[data-cls]').value, subject: '英语',
          weekday: wd, period, startTime: m.body.querySelector('[data-start]').value,
          endTime: m.body.querySelector('[data-end]').value, location: m.body.querySelector('[data-loc]').value,
          term: '', active: true
        });
        Store.save('courses');
        m.close(); App.refresh(); UI.toast('已添加课程');
      });
    }
  };

  window.Pages.schedule = P;
})();
