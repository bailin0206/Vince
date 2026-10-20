/* 设置与备份：资料 / 班级 / 学生 / 语音服务 / 安全 / 备份 / 危险区 */
(function () {
  const P = { title: '设置与备份' };
  const state = { classFilter: 'all', shown: new Set() };

  function classes() { return Store.db.classes.filter(c => !c.archived); }
  function students() {
    const all = Store.db.students.filter(s => s.active !== false);
    return state.classFilter === 'all' ? all : all.filter(s => s.classId === state.classFilter);
  }
  function className(id) { return (Store.byId('classes', id) || {}).name || '—'; }

  P.render = function () {
    const st = Store.settings;
    const voice = st.voice || {};
    const backup = st.backup || {};
    const cls = classes();
    const stu = students();

    const classRows = cls.map(c => {
      const n = Store.studentsOf(c.id).length;
      return '<tr><td><b>' + U.esc(c.name) + '</b><div class="tiny muted">' + U.esc(c.grade || '') + ' · ' + U.esc(c.term || '') + '</div></td>' +
        '<td>' + n + ' 人</td>' +
        '<td><span class="code-chip">' + U.esc(c.accessCode) + '</span></td>' +
        '<td class="nowrap">' +
          '<button class="btn btn-sm btn-ghost" data-act="resetCode" data-id="' + c.id + '">重置码</button>' +
          '<button class="btn btn-sm btn-ghost" data-act="filterClass" data-id="' + c.id + '">看名单</button>' +
          '<button class="btn btn-sm btn-ghost" data-act="delClass" data-id="' + c.id + '">删除</button>' +
        '</td></tr>';
    }).join('');

    const stuRows = stu.map(s => {
      const real = state.shown.has(s.id) ? U.esc(s.realName || '—') : '<span class="muted">已隐藏</span>';
      return '<tr><td><b>' + U.esc(s.displayName) + '</b></td>' +
        '<td>' + real + '</td>' +
        '<td class="mono small">' + U.esc(s.studentNo || '') + '</td>' +
        '<td class="small muted">' + U.esc(s.note || '') + '</td>' +
        '<td class="nowrap">' +
          '<button class="btn btn-sm btn-ghost" data-act="toggleReal" data-id="' + s.id + '">' +
            (state.shown.has(s.id) ? '隐藏' : '看真名') + '</button>' +
          '<button class="btn btn-sm btn-ghost" data-act="delStudent" data-id="' + s.id + '">移除</button>' +
        '</td></tr>';
    }).join('');

    return '<section class="page-head"><div><h1>设置与备份</h1>' +
        '<p class="sub">数据都在这台电脑的浏览器里。定期导出，换电脑也能带走。</p></div></section>' +

      /* 教师资料 */
      '<div class="card set-section"><header class="card-head"><h2>教师资料</h2></header>' +
        '<div class="form-grid">' +
          '<div class="field"><label class="label">称呼</label><input class="input" data-input="teacherName" value="' + U.esc(st.teacherName || '') + '"></div>' +
          '<div class="field"><label class="label">学校</label><input class="input" data-input="school" value="' + U.esc(st.school || '') + '"></div>' +
        '</div>' +
        '<div class="empty-actions" style="justify-content:flex-start"><button class="btn btn-primary btn-sm" data-act="saveTeacher">保存</button></div>' +
      '</div>' +

      /* 班级 */
      '<div class="card set-section"><header class="card-head"><h2>班级</h2>' +
          '<button class="btn btn-sm btn-primary" style="margin-left:auto" data-act="addClass">+ 新建班级</button></header>' +
        '<div class="table-wrap"><table class="table"><thead><tr><th>班级</th><th>人数</th><th>学生访问码</th><th></th></tr></thead>' +
        '<tbody>' + (classRows || '<tr><td colspan="4" class="muted">还没有班级</td></tr>') + '</tbody></table></div>' +
        '<p class="hint" style="margin-top:10px">访问码是给学生用的：第二期上线后，学生输入码就能看到已发布的词表和听写。</p>' +
      '</div>' +

      /* 学生 */
      '<div class="card set-section"><header class="card-head"><h2>学生名单（默认脱敏）</h2>' +
          '<div style="margin-left:auto;display:flex;gap:6px">' +
            '<button class="btn btn-sm" data-act="importStudents">批量粘贴</button>' +
            '<button class="btn btn-sm btn-primary" data-act="addStudent">+ 添加</button></div></header>' +
        '<div class="filters" style="margin-bottom:10px">' +
          '<select class="select" data-change="classFilter"><option value="all">全部班级</option>' +
            cls.map(c => '<option value="' + c.id + '"' + (state.classFilter === c.id ? ' selected' : '') + '>' + U.esc(c.name) + '</option>').join('') +
          '</select><span class="small muted">共 ' + stu.length + ' 人</span></div>' +
        '<div class="table-wrap"><table class="table"><thead><tr><th>显示名</th><th>真实姓名</th><th>学号后两位</th><th>备注</th><th></th></tr></thead>' +
        '<tbody>' + (stuRows || '<tr><td colspan="5" class="muted">还没有学生</td></tr>') + '</tbody></table></div>' +
      '</div>' +

      /* 语音服务 */
      '<div class="card set-section"><header class="card-head"><h2>语音服务</h2>' +
          '<span class="pill ' + (voice.enabled ? 'pill-ok' : '') + '">' + (voice.enabled ? '已启用' : '未启用 · 当前用上传音频') + '</span></header>' +
        '<div class="notice" style="margin-bottom:14px">声音数据（声纹、克隆模型）和学生数据都属于敏感信息，' +
          '建议只在本地电脑或私有服务器上跑。不要把接口 Token 写进公开网页，也不要把学生姓名放进音频文件名。</div>' +
        '<div class="form-grid">' +
          '<div class="field"><label class="label">服务名称</label><input class="input" data-input="voiceProvider" value="' + U.esc(voice.provider || '') + '" placeholder="本地 GPT-SoVITS"></div>' +
          '<div class="field"><label class="label">voice_id / 声音配置 ID</label><input class="input" data-input="voiceId" value="' + U.esc(voice.voiceId || '') + '" placeholder="my_voice_01"></div>' +
          '<div class="field full"><label class="label">接口地址</label><input class="input" data-input="voiceEndpoint" value="' + U.esc(voice.endpoint || '') + '" placeholder="http://127.0.0.1:9880/tts"></div>' +
        '</div>' +
        '<div class="set-row" style="border-bottom:0">' +
          '<div class="grow"><b>启用语音服务</b><span class="small muted">第二期才真正调用；现在打开只是把配置存好。</span></div>' +
          '<label class="switch"><input type="checkbox" data-change="voiceEnabled"' + (voice.enabled ? ' checked' : '') + '><i></i></label>' +
        '</div>' +
        '<div class="empty-actions" style="justify-content:flex-start">' +
          '<button class="btn btn-sm" data-act="testVoice">测试连接</button>' +
          '<button class="btn btn-sm btn-primary" data-act="saveVoice">保存配置</button>' +
          '<button class="btn btn-sm" data-act="genAudio" disabled style="opacity:.5">批量生成音频（第二期）</button>' +
        '</div>' +
        (voice.lastTestedAt ? '<p class="hint" style="margin-top:8px">上次测试：' + U.esc(voice.lastTestedAt) + '</p>' : '') +
      '</div>' +

      /* 安全 */
      '<div class="card set-section"><header class="card-head"><h2>安全</h2>' +
          '<span class="pill">' + (st.passwordHash ? '已设密码' : '未设密码') + '</span></header>' +
        '<div class="form-grid">' +
          '<div class="field"><label class="label">' + (st.passwordHash ? '修改密码' : '设置密码') + '</label>' +
            '<input class="input" type="password" data-input="newPw" placeholder="至少 4 位"></div>' +
          '<div class="field"><label class="label">本机记住登录</label>' +
            '<select class="select" data-change="rememberDays">' +
              [7, 30, 90].map(d => '<option value="' + d + '"' + (Number(st.rememberLoginDays) === d ? ' selected' : '') + '>' + d + ' 天</option>').join('') +
            '</select></div>' +
        '</div>' +
        '<div class="empty-actions" style="justify-content:flex-start">' +
          '<button class="btn btn-sm btn-primary" data-act="savePwd">保存密码</button>' +
          (st.passwordHash ? '<button class="btn btn-sm btn-danger-ghost" data-act="clearPwd">清除密码</button>' +
            '<button class="btn btn-sm" data-act="logout">退出登录</button>' : '') +
        '</div>' +
        '<p class="hint" style="margin-top:10px">提醒：原型阶段的密码只存在浏览器里，能防止别人随手打开看到数据，但不是真正的加密。真正的保护是设备锁屏 + 不在公共电脑上使用。</p>' +
      '</div>' +

      /* 备份 */
      '<div class="card set-section"><header class="card-head"><h2>备份与恢复</h2></header>' +
        '<div class="set-row"><div class="grow"><b>导出完整备份（.json）</b>' +
          '<span class="small muted">包含词表、词条、听写记录、课表、备课、成绩与设置。</span></div>' +
          '<button class="btn btn-primary btn-sm" data-act="exportAll">导出</button></div>' +
        '<div class="set-row"><div class="grow"><b>导出分表 CSV</b>' +
          '<span class="small muted">词条、听写记录、学生名单、成绩各一份，方便用 Excel 看。</span></div>' +
          '<button class="btn btn-sm" data-act="exportCsv">导出</button></div>' +
        '<div class="set-row"><div class="grow"><b>从备份恢复</b>' +
          '<span class="small muted">会覆盖当前全部数据，恢复前建议先导一次。</span></div>' +
          '<button class="btn btn-sm" data-act="importAll">选择文件</button></div>' +
        '<p class="hint">上次备份：' + (backup.lastExportAt ? U.relDay(backup.lastExportAt) + '（' + U.esc(backup.lastExportAt) + '）' : '还没有备份过') + '</p>' +
        (localStorage.getItem('etw:v1:beforeRestore')
          ? '<div class="set-row" style="border-bottom:0"><div class="grow"><b>回滚到上次恢复之前</b>' +
            '<span class="small muted">如果你刚覆盖错了备份，24 小时内还能退回来。</span></div>' +
            '<button class="btn btn-sm" data-act="rollback">回滚</button></div>'
          : '') +
      '</div>' +

      /* 危险区 */
      '<div class="card set-section danger-zone"><header class="card-head"><h2>危险区</h2></header>' +
        '<div class="set-row"><div class="grow"><b>清除全部数据</b>' +
          '<span class="small muted">词表、听写、课表、备课、成绩全部清空，回到初始示例数据。</span></div>' +
          '<button class="btn btn-sm btn-danger" data-act="resetAll">清除</button></div>' +
        '<p class="hint">执行前会要求输入 DELETE，并建议先导出备份。</p>' +
      '</div>';
  };

  P.onInput = function (k, v) {
    if (k === 'teacherName') Store.settings.teacherName = v;
    if (k === 'school') Store.settings.school = v;
    if (k === 'voiceProvider') { Store.settings.voice = Object.assign({}, Store.settings.voice, { provider: v }); }
    if (k === 'voiceId') { Store.settings.voice = Object.assign({}, Store.settings.voice, { voiceId: v }); }
    if (k === 'voiceEndpoint') { Store.settings.voice = Object.assign({}, Store.settings.voice, { endpoint: v }); }
    if (k === 'newPw') Store._newPw = v;
  };

  P.onChange = function (k, v, el) {
    if (k === 'classFilter') { state.classFilter = v; App.refresh(); }
    if (k === 'voiceEnabled') {
      Store.settings.voice = Object.assign({}, Store.settings.voice, { enabled: el.checked });
      Store.saveSettings();
      UI.toast(el.checked ? '语音服务已启用（第二期生效）' : '已停用语音服务');
    }
    if (k === 'rememberDays') {
      Store.settings.rememberLoginDays = Number(v);
      Store.saveSettings();
      UI.toast('已设置为 ' + v + ' 天');
    }
  };

  P.actions = {
    saveTeacher() {
      Store.settings.teacherName = Store.settings.teacherName || '老师';
      Store.saveSettings();
      UI.toast('已保存');
      App.refresh();
    },

    addClass() {
      const m = UI.modal({
        title: '新建班级',
        body: '<div class="form-grid">' +
            '<div class="field"><label class="label">班级名称</label><input class="input" data-name placeholder="高一(5)班"></div>' +
            '<div class="field"><label class="label">年级</label><input class="input" data-grade value="高一"></div>' +
          '</div><p class="hint">创建后会自动生成 6 位学生访问码。</p>',
        footer: '<button class="btn" data-ui-close>取消</button><button class="btn btn-primary" data-ok>创建</button>'
      });
      m.foot.querySelector('[data-ok]').addEventListener('click', () => {
        const name = m.body.querySelector('[data-name]').value.trim();
        if (!name) { UI.toast('给班级起个名字', { type: 'warn' }); return; }
        const code = Math.random().toString(36).slice(2, 8).toUpperCase();
        Store.db.classes.push({
          id: U.uid('cls'), name, grade: m.body.querySelector('[data-grade]').value.trim(),
          accessCode: code, term: '2026-2027-1', archived: false
        });
        Store.save('classes');
        m.close(); App.refresh(); UI.toast('已创建，访问码 ' + code);
      });
    },

    resetCode(el) {
      const c = Store.byId('classes', el.dataset.id);
      UI.confirm({
        title: '重置访问码',
        message: '旧码会立即失效，已经拿着旧码的学生需要重新输入。',
        confirmText: '重置'
      }).then(ok => {
        if (!ok) return;
        c.accessCode = Math.random().toString(36).slice(2, 8).toUpperCase();
        Store.save('classes');
        App.refresh();
        UI.toast('新访问码：' + c.accessCode);
      });
    },

    filterClass(el) {
      state.classFilter = el.dataset.id;
      App.refresh();
    },

    delClass(el) {
      const c = Store.byId('classes', el.dataset.id);
      const n = Store.studentsOf(c.id).length;
      UI.confirm({
        title: '删除班级',
        message: '删除 <b>' + U.esc(c.name) + '</b>？' + (n ? '班里有 <b>' + n + '</b> 名学生，需要先移除学生。' : ''),
        confirmText: '删除', danger: true
      }).then(ok => {
        if (!ok) return;
        if (n) { UI.toast('先移除这个班的学生再删班级', { type: 'warn' }); return; }
        Store.db.classes = Store.db.classes.filter(x => x.id !== c.id);
        Store.save('classes');
        App.refresh(); UI.toast('已删除');
      });
    },

    addStudent() {
      const cls = classes();
      if (!cls.length) { UI.toast('先建一个班级', { type: 'warn' }); return; }
      const m = UI.modal({
        title: '添加学生',
        body: '<div class="form-grid">' +
            '<div class="field"><label class="label">班级</label><select class="select" data-cls>' +
              cls.map(c => '<option value="' + c.id + '">' + U.esc(c.name) + '</option>').join('') + '</select></div>' +
            '<div class="field"><label class="label">显示名（学生端看到的名字）</label><input class="input" data-display placeholder="张同学"></div>' +
            '<div class="field"><label class="label">真实姓名（不会公开显示）</label><input class="input" data-real></div>' +
            '<div class="field"><label class="label">学号后两位</label><input class="input" data-no maxlength="4" placeholder="07"></div>' +
          '</div>',
        footer: '<button class="btn" data-ui-close>取消</button><button class="btn btn-primary" data-ok>添加</button>'
      });
      m.foot.querySelector('[data-ok]').addEventListener('click', () => {
        const display = m.body.querySelector('[data-display]').value.trim();
        if (!display) { UI.toast('填一个显示名', { type: 'warn' }); return; }
        Store.db.students.push({
          id: U.uid('stu'), classId: m.body.querySelector('[data-cls]').value,
          displayName: display, realName: m.body.querySelector('[data-real]').value.trim(),
          studentNo: m.body.querySelector('[data-no]').value.trim(), note: '', active: true
        });
        Store.save('students');
        m.close(); App.refresh(); UI.toast('已添加');
      });
    },

    importStudents() {
      const cls = classes();
      if (!cls.length) { UI.toast('先建一个班级', { type: 'warn' }); return; }
      const m = UI.modal({
        title: '批量导入学生',
        wide: true,
        body: '<div class="field"><label class="label">导入到</label><select class="select" data-cls>' +
            cls.map(c => '<option value="' + c.id + '">' + U.esc(c.name) + '</option>').join('') + '</select></div>' +
          '<div class="field"><label class="label">每行一个学生：显示名, 真名, 学号后两位</label>' +
            '<textarea class="textarea" data-text style="min-height:150px" placeholder="张同学, 张明, 07&#10;李同学, 李静, 12"></textarea></div>' +
          '<div id="stuPreview" class="small muted"></div>',
        footer: '<button class="btn" data-ui-close>取消</button><button class="btn btn-primary" data-ok>导入</button>'
      });
      const ta = m.body.querySelector('[data-text]');
      const pv = m.body.querySelector('#stuPreview');
      ta.addEventListener('input', U.debounce(() => {
        const n = ta.value.split('\n').filter(l => l.trim()).length;
        pv.innerHTML = n ? '识别到 <b>' + n + '</b> 行' : '';
      }, 140));
      m.foot.querySelector('[data-ok]').addEventListener('click', () => {
        const cid = m.body.querySelector('[data-cls]').value;
        const rows = ta.value.split('\n').filter(l => l.trim());
        if (!rows.length) return;
        rows.forEach(line => {
          const p = line.split(/[,，\t]/).map(s => s.trim());
          if (!p[0]) return;
          Store.db.students.push({
            id: U.uid('stu'), classId: cid, displayName: p[0], realName: p[1] || '',
            studentNo: p[2] || '', note: '', active: true
          });
        });
        Store.save('students');
        m.close(); App.refresh(); UI.toast('已导入 ' + rows.length + ' 名学生');
      });
    },

    toggleReal(el) {
      const id = el.dataset.id;
      if (state.shown.has(id)) state.shown.delete(id); else state.shown.add(id);
      App.refresh();
      if (state.shown.has(id)) {
        setTimeout(() => {
          if (state.shown.has(id)) { state.shown.delete(id); App.refresh(); }
        }, 3000);
      }
    },

    delStudent(el) {
      const s = Store.byId('students', el.dataset.id);
      UI.confirm({
        title: '移除学生',
        message: '把 <b>' + U.esc(s.displayName) + '</b> 从名单里移除？历史听写记录会保留。',
        confirmText: '移除', danger: true
      }).then(ok => {
        if (!ok) return;
        s.active = false;
        Store.save('students');
        App.refresh(); UI.toast('已移除');
      });
    },

    saveVoice() {
      const v = Store.settings.voice;
      if (!v.lastTestedAt) v.lastTestedAt = '';
      Store.saveSettings();
      UI.toast('语音服务配置已保存');
      App.refresh();
    },

    testVoice() {
      const v = Store.settings.voice || {};
      if (!v.endpoint) { UI.toast('先填接口地址', { type: 'warn' }); return; }
      const btn = document.querySelector('[data-act="testVoice"]');
      if (btn) { btn.disabled = true; btn.textContent = '测试中…'; }
      setTimeout(() => {
        v.enabled = true;
        v.lastTestedAt = U.today() + ' ' + U.nowHM() + ' · 模拟返回 200，延迟 312ms';
        Store.saveSettings();
        App.refresh();
        UI.toast('连接正常（原型为模拟结果）');
      }, 700);
    },

    genAudio() { UI.toast('第二期开放：批量调用本地语音克隆服务生成 mp3', { type: 'warn' }); },

    savePwd() {
      const pw = (Store._newPw || '').trim();
      if (!pw) { UI.toast('先输入新密码', { type: 'warn' }); return; }
      if (pw.length < 4) { UI.toast('至少 4 位', { type: 'warn' }); return; }
      Store.settings.passwordHash = pw;
      Store.saveSettings();
      Store._newPw = '';
      sessionStorage.setItem('etw:auth', '1');
      App.refresh();
      UI.toast('密码已保存，下次打开需要输入');
    },

    clearPwd() {
      UI.confirm({
        title: '清除密码',
        message: '清除后打开这个页面不再需要密码。确定吗？',
        confirmText: '清除', danger: true
      }).then(ok => {
        if (!ok) return;
        Store.settings.passwordHash = '';
        Store.saveSettings();
        App.refresh(); UI.toast('已清除密码');
      });
    },

    logout() { App.logout(); },

    exportAll() {
      const name = '英语工作台备份_' + U.today() + '.json';
      U.download(name, Store.exportJSON(), 'application/json');
      Store.settings.backup = Object.assign({}, Store.settings.backup, { lastExportAt: U.today() });
      Store.saveSettings();
      App.refresh();
      UI.toast('已导出备份，建议同时复制一份到网盘');
    },

    exportCsv() {
      const es = Store.db.entries.map(e => [e.word, e.phonetic, e.pos, e.meaningZh, e.example, e.audioUrl]);
      U.download('词条_' + U.today() + '.csv', '\uFEFF' + U.toCSV([['word', 'phonetic', 'pos', 'meaning_zh', 'example', 'audio_url']].concat(es)), 'text/csv;charset=utf-8');
      const rs = Store.db.records.map(r => {
        const s = Store.byId('students', r.studentId) || {};
        const e = Store.byId('entries', r.entryId) || {};
        return [s.displayName, e.word, r.isCorrect, r.errorType, String(r.createdAt).slice(0, 10)];
      });
      setTimeout(() => U.download('听写记录_' + U.today() + '.csv',
        '\uFEFF' + U.toCSV([['student', 'word', 'is_correct', 'error_type', 'date']].concat(rs)), 'text/csv;charset=utf-8'), 300);
      UI.toast('已导出两份 CSV');
    },

    importAll() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = () => {
        const f = input.files[0];
        if (!f) return;
        const rd = new FileReader();
        rd.onload = () => {
          try {
            const data = JSON.parse(rd.result);
            UI.confirm({
              title: '从备份恢复',
              message: '将用备份文件覆盖当前全部数据：<b>' +
                (data.tables ? Object.keys(data.tables).map(k => (data.tables[k] || []).length + ' 条' + k).slice(0, 4).join('、') : '') +
                '</b> 等。当前数据会先存一份快照，24 小时内可回滚。',
              confirmText: '覆盖并恢复', danger: true
            }).then(ok => {
              if (!ok) return;
              try {
                localStorage.setItem('etw:v1:beforeRestore', Store.exportJSON());
                Store.importJSON(rd.result);
                Store.init();
                App.refresh();
                UI.toast('已恢复');
              } catch (err) {
                UI.toast('恢复失败：' + err.message, { type: 'err' });
              }
            });
          } catch (e) {
            UI.toast('这个文件不是备份文件', { type: 'err' });
          }
        };
        rd.readAsText(f, 'utf-8');
      };
      input.click();
    },

    rollback() {
      const raw = localStorage.getItem('etw:v1:beforeRestore');
      if (!raw) { UI.toast('没有可回滚的快照', { type: 'warn' }); return; }
      UI.confirm({
        title: '回滚到恢复之前',
        message: '会退回到上一次"从备份恢复"之前的数据状态。',
        confirmText: '回滚', danger: true
      }).then(ok => {
        if (!ok) return;
        try {
          Store.importJSON(raw);
          Store.init();
          App.refresh();
          UI.toast('已回滚');
        } catch (e) {
          UI.toast('回滚失败：' + e.message, { type: 'err' });
        }
      });
    },

    resetAll() {      UI.confirm({
        title: '清除全部数据',
        message: '所有词表、听写记录、课表、备课与成绩都会清空，回到初始示例数据。' +
          '<br><b>建议先导出备份。</b>',
        confirmText: '清除', danger: true, requireText: 'DELETE'
      }).then(ok => {
        if (!ok) return;
        Store.reset();
        App.refresh();
        UI.toast('已清除，已恢复为示例数据');
      });
    }
  };

  window.Pages.settings = P;
})();
