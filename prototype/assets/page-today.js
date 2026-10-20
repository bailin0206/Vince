/* 今日（仪表盘） */
(function () {
  const SL = { todo: '未开始', preparing: '备课中', ready: '已就绪', done: '已上课' };
  const rateClass = r => r >= 35 ? 'high' : r >= 15 ? 'mid' : 'low';

  window.Pages = window.Pages || {};

  Pages.today = {
    title: '今日',

    render() {
      const st = Store.settings;
      const today = U.today();
      const courses = Store.coursesOn(today);
      const weekTotal = Store.db.courses.filter(c => c.active !== false).length;
      const unready = Store.unreadyCount(3);
      const lastTask = Store.latestTask();
      const top = lastTask ? Store.topWrong(lastTask.id, 5) : [];
      const needPrep = Store.upcoming(7).filter(x => x.status !== 'ready' && x.status !== 'done');
      const drafts = Store.db.tasks.filter(t => t.status === 'draft');
      const exams = Store.db.exams.filter(e => !e.analyzedAt);
      const backup = st.backup || {};
      const days = backup.lastExportAt ? U.daysBetween(backup.lastExportAt, today) : 99;
      const remind = Number(backup.remindDays || 14);
      const noLists = Store.db.wordlists.length === 0;

      const banners = [];
      if (noLists) {
        // 新用户引导优先
      } else if (unready > 0) {
        banners.push(
          '<div class="banner banner-warn"><span class="banner-ico">!</span>' +
          '<div><strong>未来 3 天有 ' + unready + ' 节课备课还没就绪</strong>' +
          '<div class="small" style="opacity:.8">今天起算，含今天。点右侧去处理。</div></div>' +
          '<a class="btn btn-sm" href="#/schedule">去处理</a></div>'
        );
      } else {
        banners.push(
          '<div class="banner banner-ok"><span class="banner-ico">✓</span>' +
          '<div><strong>未来 3 天的课都备好了</strong></div></div>'
        );
      }
      if (days > remind) {
        banners.push(
          '<div class="banner banner-info"><span class="banner-ico">i</span>' +
          '<div><strong>已经 ' + (days > 90 ? '很久' : days + ' 天') + ' 没有导出备份</strong>' +
          '<div class="small" style="opacity:.8">浏览器数据一旦被清理就无法找回，建议今天导一次。</div></div>' +
          '<a class="btn btn-sm" href="#/settings">去备份</a></div>'
        );
      }

      const courseRows = courses.length ? courses.map(c => {
        const cls = Store.byId('classes', c.classId) || { name: '班级' };
        const prep = Store.prep(c.id, today);
        const status = prep ? prep.status : 'todo';
        const line = prep && prep.outline ? prep.outline.split('\n')[0].replace(/^\d+\.\s*/, '') : '教案要点还没写';
        return '<button class="course-row" data-act="prep" data-course="' + c.id + '" data-date="' + today + '">' +
          '<span class="course-time">' + U.esc(c.startTime) + '<span>第 ' + c.period + ' 节</span></span>' +
          '<span class="course-main"><b>' + U.esc(cls.name) + ' · ' + U.esc(c.subject) + '</b>' +
          '<span class="small muted">' + U.esc(line) + '</span></span>' +
          '<span class="course-status"><span class="dot ' + status + '"></span>' + SL[status] + '</span>' +
          '</button>';
      }).join('') : '<div class="empty" style="padding:22px 8px">' +
        '<p>今天没有课。可以去看看这周的课表。</p>' +
        '<div class="empty-actions"><a class="btn btn-sm" href="#/schedule">查看周课表</a></div></div>';

      const topRows = top.map((x, i) =>
        '<div class="word-row">' +
          '<div class="word-head"><span class="rank">' + (i + 1) + '</span>' +
            '<b>' + U.esc(x.entry.word) + '</b>' +
            '<span class="ph">' + U.esc(x.entry.phonetic || '') + '</span>' +
            '<span class="rate ' + rateClass(x.rate) + '">' + x.rate + '%</span></div>' +
          '<div class="track"><i class="' + rateClass(x.rate) + '" style="width:' + Math.max(x.rate, 3) + '%"></i></div>' +
          '<div class="word-sub"><span>' + x.wrong + ' / ' + x.total + ' 人写错</span>' +
            '<span>·</span><span>' + U.esc(x.entry.meaningZh || '') + '</span></div>' +
        '</div>').join('');

      const topCard = lastTask
        ? (top.length
          ? '<div class="card"><header class="card-head"><h2>最近一次听写 · 错误率 Top5</h2>' +
            '<a class="link" href="#/errors">全部错词 →</a></header>' +
            '<div class="tiny muted" style="margin:-6px 0 6px">' + U.esc(lastTask.title) + ' · ' +
            U.relDay(String(lastTask.publishedAt).slice(0, 10)) + '</div>' + topRows + '</div>'
          : '<div class="card"><header class="card-head"><h2>最近一次听写</h2></header>' +
            '<div class="empty"><div class="empty-ico">' + ico('check') + '</div>' +
            '<h3>这次没有错词</h3><p>整班全对，可以往前推进度了。</p></div></div>')
        : '<div class="card"><header class="card-head"><h2>最近一次听写</h2></header>' +
          '<div class="empty"><div class="empty-ico">' + ico('mic') + '</div>' +
          '<h3>还没有听写记录</h3><p>先发一次听写，或者手动录入一次结果，这里就会显示错词排行。</p>' +
          '<div class="empty-actions"><a class="btn btn-primary btn-sm" href="#/dictation/new">新建听写</a>' +
          '<a class="btn btn-sm" href="#/dictation">去录入结果</a></div></div></div>';

      const prepTile = needPrep.length
        ? '<a class="tile" href="#/schedule"><span class="tile-num">' + needPrep.length + '</span>' +
          '<span class="tile-label">未完成备课</span><span class="tile-hint">未来 7 天</span></a>'
        : '<a class="tile zero" href="#/schedule"><span class="tile-num">0</span>' +
          '<span class="tile-label">未完成备课</span><span class="tile-hint">未来 7 天</span></a>';

      const html =
        '<section class="page-head"><div>' +
          '<h1>' + U.greeting() + '，' + U.esc(st.teacherName || '老师') + '</h1>' +
          '<p class="sub">' + U.fmtMD(today) + ' ' + U.fmtWD(today) + ' · 今天 ' + courses.length +
          ' 节课 · 本周共 ' + weekTotal + ' 节</p>' +
        '</div></section>' +
        banners.join('') +
        (noLists ? this.onboard() :
          '<div class="dash">' +
            '<div class="card"><header class="card-head"><h2>今日课表</h2>' +
              '<a class="link" href="#/schedule">查看周课表 →</a></header>' + courseRows + '</div>' +
            topCard +
          '</div>' +
          '<div class="tiles">' + prepTile +
            '<a class="tile" href="#/dictation">' +
              '<span class="tile-num">' + drafts.length + '</span>' +
              '<span class="tile-label">待生成听写</span><span class="tile-hint">草稿任务</span></a>' +
            '<a class="tile" href="#/exams">' +
              '<span class="tile-num">' + exams.length + '</span>' +
              '<span class="tile-label">待分析成绩</span><span class="tile-hint">成绩分析第三期开放</span></a>' +
          '</div>' +
          '<div class="quick">' +
            '<button class="quick-btn" data-act="newList"><span class="q-ico">+</span><b>新建词表</b>' +
              '<span class="small muted">粘贴一批单词</span></button>' +
            '<a class="quick-btn" href="#/dictation/new"><span class="q-ico">▶</span><b>新建听写</b>' +
              '<span class="small muted">选词表 3 步发布</span></a>' +
            '<button class="quick-btn" data-act="importScore"><span class="q-ico">↑</span><b>导入成绩</b>' +
              '<span class="small muted">第三期开放</span></button>' +
            '<a class="quick-btn" href="#/errors"><span class="q-ico">◎</span><b>查看错词</b>' +
              '<span class="small muted">聚合与再听写</span></a>' +
          '</div>'
        );

      return html;
    },

    onboard() {
      return '<div class="card"><header class="card-head"><h2>从这里开始，三步就能跑起来</h2></header>' +
        '<div class="steps3">' +
          '<div class="step3"><span class="step3-num">1</span><div style="flex:1">' +
            '<b class="small">建一个词表</b><div class="tiny muted">把这一单元的词粘进去，每行一个。</div></div>' +
            '<button class="btn btn-sm btn-primary" data-act="newList">新建词表</button></div>' +
          '<div class="step3"><span class="step3-num">2</span><div style="flex:1">' +
            '<b class="small">发一次听写</b><div class="tiny muted">选词表、选班级，3 步完成。</div></div>' +
            '<a class="btn btn-sm" href="#/dictation/new">发听写</a></div>' +
          '<div class="step3"><span class="step3-num">3</span><div style="flex:1">' +
            '<b class="small">录一次结果</b><div class="tiny muted">手动打勾或导入 CSV，错词会自动聚合。</div></div>' +
            '<a class="btn btn-sm" href="#/dictation">去录入</a></div>' +
        '</div></div>';
    },

    actions: {
      prep(el) {
        const cid = el.dataset.course, d = el.dataset.date;
        if (window.Pages.schedule && Pages.schedule.openPrep) Pages.schedule.openPrep(cid, d);
        else location.hash = '#/schedule';
      },
      newList() {
        if (window.Pages.lists && Pages.lists.openCreate) Pages.lists.openCreate();
        else location.hash = '#/lists';
      },
      importScore() {
        UI.modal({
          title: '导入成绩（第三期开放）',
          body: '<p class="confirm-msg">成绩分析安排在第三期：录入考试 → 导入分数 → 看班均与分数段 → ' +
            '点学生看历次趋势，并把听写正确率作为一条曲线叠上去。</p>' +
            '<p class="small muted" style="margin-top:12px">这一期先把词表、听写、错词和备课跑顺，' +
            '等数据攒起来，成绩页才有分析价值。</p>',
          footer: '<a class="btn btn-primary" href="#/exams">看看规划</a>' +
            '<button class="btn" data-ui-close>知道了</button>'
        });
      }
    }
  };

  function ico(name) {
    const p = {
      check: '<path d="M5 12.5 9.5 17 19 7"/>',
      mic: '<path d="M12 4a3 3 0 0 1 3 3v4a3 3 0 0 1-6 0V7a3 3 0 0 1 3-3z"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/>'
    }[name] || '';
    return '<svg viewBox="0 0 24 24">' + p + '</svg>';
  }
})();
