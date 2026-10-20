/* 成绩分析：第三期页面，先给出规划与现有数据 */
(function () {
  const P = { title: '成绩分析' };

  P.render = function () {
    const exams = Store.db.exams;
    const scores = Store.db.scores;
    const exam = exams[0];

    let preview = '';
    if (exam) {
      const list = scores.filter(s => s.examId === exam.id).map(s => s.score);
      const avg = list.length ? (list.reduce((a, b) => a + b, 0) / list.length).toFixed(1) : '—';
      const max = list.length ? Math.max.apply(null, list) : '—';
      const min = list.length ? Math.min.apply(null, list) : '—';
      preview = '<div class="stats">' +
        '<div class="stat"><div class="stat-num">' + avg + '</div><div class="stat-label">班均</div><div class="stat-sub">' + U.esc(exam.name) + '</div></div>' +
        '<div class="stat"><div class="stat-num">' + max + '</div><div class="stat-label">最高分</div><div class="stat-sub">满分 ' + exam.fullScore + '</div></div>' +
        '<div class="stat"><div class="stat-num">' + min + '</div><div class="stat-label">最低分</div><div class="stat-sub">' + list.length + ' 人参考</div></div>' +
        '<div class="stat"><div class="stat-num">' + Store.db.records.length + '</div><div class="stat-label">可关联听写记录</div><div class="stat-sub">用来画第二根曲线</div></div>' +
      '</div>' +
      '<p class="small muted">示例数据里已经放了一场考试和 ' + scores.length + ' 条成绩，第三期接上页面后就能直接看到效果。</p>';
    }

    return '<section class="page-head"><div><h1>成绩分析</h1>' +
        '<p class="sub">第三期开放。现在先把数据攒起来。</p></div></section>' +
      '<div class="card" style="margin-bottom:16px">' +
        '<div class="banner banner-info" style="margin-bottom:14px"><span class="banner-ico">i</span>' +
          '<div><strong>这一期先把听写闭环跑顺</strong>' +
          '<div class="small" style="opacity:.85">成绩页的价值在于"和听写数据对照"，所以等错词数据攒够两个月再接最合适。</div></div></div>' +
        '<header class="card-head"><h2>接上来以后是什么样</h2></header>' +
        '<div class="steps3">' +
          '<div class="step3"><span class="step3-num">1</span><div><b class="small">录入考试</b>' +
            '<div class="tiny muted">名称、日期、班级、满分；分数两列粘贴就能导入。</div></div></div>' +
          '<div class="step3"><span class="step3-num">2</span><div><b class="small">看班级整体</b>' +
            '<div class="tiny muted">班均、最高最低、分数段柱状图、排名变化。</div></div></div>' +
          '<div class="step3"><span class="step3-num">3</span><div><b class="small">点学生下钻</b>' +
            '<div class="tiny muted">历次分数与排名，叠加同一时间的听写正确率。</div></div></div>' +
          '<div class="step3"><span class="step3-num">4</span><div><b class="small">反推备课重点</b>' +
            '<div class="tiny muted">把"成绩下滑 + 某单元错词高"写进那节课的备课备注。</div></div></div>' +
        '</div>' +
      '</div>' +
      (preview ? '<div class="card"><header class="card-head"><h2>现有数据预览</h2>' +
        '<span class="pill">第三期接入后生效</span></header>' + preview + '</div>' : '') +
      '<div class="card"><div class="empty"><div class="empty-ico"><svg viewBox="0 0 24 24">' +
        '<path d="M5 20V11M12 20V5M19 20v-6"/></svg></div>' +
        '<h3>暂时不能录入成绩</h3><p>点下面的按钮可以先看看设计文档里成绩页的字段与交互。</p>' +
        '<div class="empty-actions"><a class="btn" href="#/today">回到今日</a>' +
        '<a class="btn btn-primary" href="#/errors">先去看错词</a></div></div></div>';
  };

  window.Pages.exams = P;
})();
