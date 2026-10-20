/* 数据层：localStorage 读写、示例数据、聚合计算 */
(function () {
  const NS = 'etw:v1:';
  const TABLES = ['classes', 'students', 'wordlists', 'entries', 'tasks', 'taskEntries',
    'records', 'courses', 'preps', 'exams', 'scores', 'pool'];

  const S = { db: {}, settings: {}, ready: false };

  function read(k, def) {
    try { const v = localStorage.getItem(NS + k); return v ? JSON.parse(v) : def; }
    catch (e) { return def; }
  }
  function write(k, v) { localStorage.setItem(NS + k, JSON.stringify(v)); }

  S.init = function () {
    if (localStorage.getItem(NS + 'meta')) {
      TABLES.forEach(t => { S.db[t] = read(t, []); });
      S.settings = read('settings', {});
    } else {
      buildSeed();
    }
    S.ready = true;
  };

  S.save = function (t) { write(t, S.db[t]); };
  S.saveSettings = function () { write('settings', S.settings); };
  S.saveAll = function () {
    TABLES.forEach(t => write(t, S.db[t]));
    write('settings', S.settings);
  };

  S.reset = function () {
    TABLES.concat(['settings', 'meta']).forEach(t => localStorage.removeItem(NS + t));
    buildSeed();
    S.ready = true;
  };

  /* ---------------- 查询 ---------------- */
  S.byId = function (t, id) { return (S.db[t] || []).find(x => x.id === id) || null; };
  S.studentsOf = function (classId) {
    return S.db.students.filter(s => s.classId === classId && s.active !== false);
  };
  S.entriesOf = function (listId) {
    return S.db.entries.filter(e => e.listId === listId).sort((a, b) => a.order - b.order);
  };
  S.coursesOn = function (iso) {
    const wd = U.weekday(iso);
    return S.db.courses.filter(c => c.active !== false && c.weekday === wd)
      .sort((a, b) => a.period - b.period);
  };
  S.prep = function (courseId, iso) {
    return S.db.preps.find(p => p.courseId === courseId && p.date === iso) || null;
  };
  S.prepStatus = function (courseId, iso) {
    const p = S.prep(courseId, iso);
    return p ? p.status : 'todo';
  };
  S.upsertPrep = function (courseId, iso, patch) {
    let p = S.prep(courseId, iso);
    if (!p) {
      p = {
        id: U.uid('pp'), courseId, date: iso, status: 'todo', outline: '',
        listIds: [], taskIds: [], examId: '', resources: [], note: '',
        updatedAt: new Date().toISOString()
      };
      S.db.preps.push(p);
    }
    Object.assign(p, patch, { updatedAt: new Date().toISOString() });
    S.save('preps');
    return p;
  };

  S.upcoming = function (days) {
    const out = [];
    for (let i = 0; i < days; i++) {
      const iso = U.addDays(U.today(), i);
      S.coursesOn(iso).forEach(c => {
        out.push({ iso, course: c, prep: S.prep(c.id, iso), status: S.prepStatus(c.id, iso) });
      });
    }
    return out;
  };
  S.unreadyCount = function (days) {
    return S.upcoming(days).filter(x => x.status !== 'ready' && x.status !== 'done').length;
  };

  S.latestTask = function () {
    const pub = S.db.tasks.filter(t => t.status === 'published')
      .sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)));
    return pub[0] || null;
  };
  S.taskEntries = function (taskId) {
    const ids = S.db.taskEntries.filter(x => x.taskId === taskId).sort((a, b) => a.order - b.order);
    if (!ids.length) return [];
    return ids.map(x => S.byId('entries', x.entryId)).filter(Boolean);
  };
  S.taskStats = function (taskId) {
    const recs = S.db.records.filter(r => r.taskId === taskId);
    const per = {};
    const students = new Set();
    recs.forEach(r => {
      students.add(r.studentId);
      if (!per[r.entryId]) per[r.entryId] = { wrong: 0, total: 0 };
      per[r.entryId].total++;
      if (!r.isCorrect) per[r.entryId].wrong++;
    });
    const correct = recs.filter(r => r.isCorrect).length;
    return {
      recs, per, participants: students.size, total: recs.length, correct,
      avg: recs.length ? Math.round(correct / recs.length * 100) : 0,
      wrongWords: Object.keys(per).filter(k => per[k].wrong > 0).length
    };
  };
  S.topWrong = function (taskId, limit) {
    const st = S.taskStats(taskId);
    return Object.keys(st.per).map(id => {
      const e = S.byId('entries', id);
      const s = st.per[id];
      return e ? { entry: e, wrong: s.wrong, total: s.total, rate: U.pct(s.wrong, s.total) } : null;
    }).filter(Boolean).sort((a, b) => b.rate - a.rate || b.wrong - a.wrong).slice(0, limit || 5);
  };

  /* 按条件汇总记录（错词分析页用） */
  S.queryRecords = function (opt) {
    opt = opt || {};
    let recs = S.db.records.slice();
    if (opt.classId && opt.classId !== 'all') {
      const ids = new Set(S.studentsOf(opt.classId).map(s => s.id));
      recs = recs.filter(r => ids.has(r.studentId));
    }
    if (opt.from) recs = recs.filter(r => String(r.createdAt).slice(0, 10) >= opt.from);
    if (opt.to) recs = recs.filter(r => String(r.createdAt).slice(0, 10) <= opt.to);
    if (opt.listId) {
      const tasks = new Set(S.db.tasks.filter(t => t.listId === opt.listId).map(t => t.id));
      recs = recs.filter(r => tasks.has(r.taskId));
    }
    return recs;
  };

  S.aggregate = function (recs) {
    const m = {};
    recs.forEach(r => {
      if (!m[r.entryId]) m[r.entryId] = { entryId: r.entryId, wrong: 0, total: 0, types: {}, students: new Set() };
      const x = m[r.entryId];
      x.total++;
      if (!r.isCorrect) {
        x.wrong++;
        x.types[r.errorType || 'blank'] = (x.types[r.errorType || 'blank'] || 0) + 1;
        x.students.add(r.studentId);
      }
    });
    return Object.values(m).map(x => {
      x.entry = S.byId('entries', x.entryId);
      x.rate = U.pct(x.wrong, x.total);
      return x;
    }).filter(x => x.entry);
  };

  S.errorCounts = function (recs) {
    const c = { spelling: 0, meaning: 0, sound: 0, blank: 0 };
    recs.forEach(r => { if (!r.isCorrect) c[r.errorType || 'blank'] = (c[r.errorType || 'blank'] || 0) + 1; });
    return c;
  };

  S.weakStudents = function (recs) {
    const m = {};
    recs.forEach(r => {
      if (r.isCorrect) return;
      if (!m[r.studentId]) m[r.studentId] = { studentId: r.studentId, wrong: 0, total: 0, words: {} };
      m[r.studentId].wrong++;
      m[r.studentId].words[r.entryId] = (m[r.studentId].words[r.entryId] || 0) + 1;
    });
    recs.forEach(r => { if (m[r.studentId]) m[r.studentId].total++; });
    return Object.values(m).map(x => {
      x.student = S.byId('students', x.studentId);
      x.rate = U.pct(x.wrong, Math.max(x.total, 1));
      return x;
    }).filter(x => x.student).sort((a, b) => b.wrong - a.wrong);
  };

  /* ---------------- 写入操作 ---------------- */
  S.addList = function (data) {
    const now = new Date().toISOString();
    const list = Object.assign({
      id: U.uid('wl'), name: '未命名词表', textbook: '人教版2019', unit: '', tags: [],
      published: false, source: 'manual', note: '', createdAt: now, updatedAt: now
    }, data);
    S.db.wordlists.push(list);
    S.save('wordlists');
    return list;
  };

  S.addEntries = function (listId, rows) {
    const list = S.byId('wordlists', listId);
    let order = S.entriesOf(listId).length;
    const added = [];
    rows.forEach(r => {
      order += 1;
      const e = {
        id: U.uid('ent'), listId, word: r.word, phonetic: r.phonetic || '', pos: r.pos || '',
        meaningZh: r.meaningZh || '', example: r.example || '', exampleZh: '',
        audioUrl: r.audioUrl || '', audioStatus: r.audioStatus || (r.audioUrl ? 'ready' : 'none'),
        mastery: r.mastery == null ? 50 : r.mastery, order, note: r.note || ''
      };
      S.db.entries.push(e);
      added.push(e);
    });
    if (list) list.updatedAt = new Date().toISOString();
    S.save('entries'); S.save('wordlists');
    return added;
  };

  S.deleteEntry = function (id) {
    S.db.entries = S.db.entries.filter(e => e.id !== id);
    S.db.records = S.db.records.filter(r => r.entryId !== id);
    S.db.taskEntries = S.db.taskEntries.filter(x => x.entryId !== id);
    S.save('entries'); S.save('records'); S.save('taskEntries');
  };

  S.addToPool = function (items, source) {
    let n = 0;
    items.forEach(it => {
      if (!S.db.pool.some(p => p.entryId === it.entryId)) {
        S.db.pool.push({
          entryId: it.entryId, word: it.word, phonetic: it.phonetic || '', meaning: it.meaning || '',
          rate: it.rate || 0, source: source || 'manual', addedAt: U.today()
        });
        n++;
      }
    });
    S.save('pool');
    return n;
  };

  S.createListFromEntries = function (entryIds, name, opts) {
    opts = opts || {};
    const src = entryIds.map(id => S.byId('entries', id)).filter(Boolean);
    const first = src[0];
    let list = S.addList({
      name, unit: first ? (S.byId('wordlists', first.listId) || {}).unit || '' : '',
      tags: ['错词'], source: 'wrongpool', published: !!opts.publish, note: '由错词池生成'
    });
    const rows = src.map((e, i) => ({
      word: e.word, phonetic: e.phonetic, pos: e.pos, meaningZh: e.meaningZh,
      example: e.example, audioUrl: e.audioUrl, audioStatus: e.audioStatus, mastery: e.mastery, order: i
    }));
    S.addEntries(list.id, rows);
    list.entryCount = rows.length;
    S.save('wordlists');
    return list;
  };

  /* ---------------- 备份 ---------------- */
  S.exportJSON = function () {
    const data = { app: 'etw', version: 1, exportedAt: new Date().toISOString(), tables: {} };
    TABLES.forEach(t => { data.tables[t] = S.db[t]; });
    data.settings = Object.assign({}, S.settings);
    if (data.settings.voice) data.settings.voice = Object.assign({}, data.settings.voice, { token: '' });
    return JSON.stringify(data, null, 2);
  };

  S.importJSON = function (text) {
    const data = JSON.parse(text);
    if (!data || data.app !== 'etw' || !data.tables) throw new Error('不是本工作台的备份文件');
    const counts = {};
    TABLES.forEach(t => {
      S.db[t] = Array.isArray(data.tables[t]) ? data.tables[t] : [];
      counts[t] = S.db[t].length;
    });
    if (data.settings) S.settings = data.settings;
    S.saveAll();
    write('meta', { seededAt: U.today(), restoredAt: new Date().toISOString() });
    return counts;
  };

  /* ---------------- 示例数据 ---------------- */
  function buildSeed() {
    const today = U.today();
    const classes = [
      { id: 'cls_01', name: '高一(3)班', grade: '高一', accessCode: 'A3K9Q2', term: '2026-2027-1', archived: false },
      { id: 'cls_02', name: '高一(7)班', grade: '高一', accessCode: 'B7M4T1', term: '2026-2027-1', archived: false }
    ];

    const names = [
      ['张同学', '张明', '07'], ['李同学', '李静', '12'], ['王同学', '王浩', '03'],
      ['刘同学', '刘畅', '21'], ['陈同学', '陈欣', '15'], ['杨同学', '杨帆', '09'],
      ['赵同学', '赵磊', '18'], ['黄同学', '黄悦', '02'], ['周同学', '周宇', '25'], ['吴同学', '吴倩', '11']
    ];
    const students = [];
    [['cls_01', 1], ['cls_02', 11]].forEach(([cid, base]) => {
      names.forEach((n, i) => {
        students.push({
          id: 'stu_' + String(base + i).padStart(2, '0'), classId: cid,
          displayName: n[0], realName: n[1], studentNo: n[2],
          note: i === 0 ? '课代表' : '', active: true
        });
      });
    });

    const now = new Date().toISOString();
    const wordlists = [
      { id: 'wl_01', name: '必修一 Unit 4 重点词', textbook: '人教版2019', unit: 'B1U4', tags: ['高频词', '听力词'], published: true, source: 'manual', note: '自然灾害单元', createdAt: now, updatedAt: now },
      { id: 'wl_02', name: '必修一 Unit 3 运动与健康', textbook: '人教版2019', unit: 'B1U3', tags: ['写作词'], published: true, source: 'manual', note: '', createdAt: now, updatedAt: now },
      { id: 'wl_03', name: '高频动词短语（草稿）', textbook: '通用', unit: '', tags: ['高频词', '写作词'], published: false, source: 'paste', note: '还没配音频', createdAt: now, updatedAt: now }
    ];

    const U4 = [
      ['disaster', '/dɪˈzɑːstə(r)/', 'n.', '灾难；灾害', 'The earthquake was a terrible disaster.'],
      ['rescue', '/ˈreskjuː/', 'v.&n.', '营救；救援', 'They rescued two children from the fire.'],
      ['destroy', '/dɪˈstrɔɪ/', 'v.', '摧毁；毁灭', 'The storm destroyed many houses.'],
      ['damage', '/ˈdæmɪdʒ/', 'n.&v.', '损害；损坏', 'The flood caused serious damage.'],
      ['survivor', '/səˈvaɪvə(r)/', 'n.', '幸存者', 'The survivors were taken to hospital.'],
      ['shelter', '/ˈʃeltə(r)/', 'n.&v.', '避难所；掩蔽', 'We took shelter from the rain.'],
      ['affect', '/əˈfekt/', 'v.', '影响；感动', 'The disaster affected thousands of people.'],
      ['emergency', '/iˈmɜːdʒənsi/', 'n.', '突发事件；紧急情况', 'Call 120 in an emergency.'],
      ['injure', '/ˈɪndʒə(r)/', 'v.', '使受伤；损害', 'Two workers were injured in the accident.'],
      ['breathe', '/briːð/', 'v.', '呼吸', 'It was hard to breathe in the smoke.'],
      ['ruin', '/ˈruːɪn/', 'n.&v.', '废墟；毁坏', 'The village was in ruins.'],
      ['sweep', '/swiːp/', 'v.', '清扫；席卷', 'The waves swept away the bridge.'],
      ['shock', '/ʃɒk/', 'n.&v.', '震惊；休克', 'The news came as a shock.'],
      ['trap', '/træp/', 'v.&n.', '使困住；陷阱', 'Many people were trapped under the building.'],
      ['bury', '/ˈberi/', 'v.', '埋葬；掩埋', 'They were buried in the snow.'],
      ['calm', '/kɑːm/', 'adj.&v.', '平静的；使镇静', 'Try to stay calm.'],
      ['aid', '/eɪd/', 'n.&v.', '援助；帮助', 'First aid is important.'],
      ['effort', '/ˈefət/', 'n.', '努力；力气', 'It took a lot of effort.'],
      ['volunteer', '/ˌvɒlənˈtɪə(r)/', 'n.&v.', '志愿者；自愿', 'Many volunteers helped the victims.'],
      ['report', '/rɪˈpɔːt/', 'n.&v.', '报告；报道', 'The report was written last night.']
    ];
    const U3 = [
      ['athlete', '/ˈæθliːt/', 'n.', '运动员', 'She is a famous athlete.'],
      ['champion', '/ˈtʃæmpiən/', 'n.', '冠军', 'He became the world champion.'],
      ['fitness', '/ˈfɪtnəs/', 'n.', '健康；健壮', 'Swimming is good for fitness.'],
      ['stadium', '/ˈsteɪdiəm/', 'n.', '体育场', 'The new stadium holds 40,000 people.'],
      ['competition', '/ˌkɒmpəˈtɪʃn/', 'n.', '比赛；竞争', 'The competition starts on Monday.'],
      ['medal', '/ˈmedl/', 'n.', '奖牌', 'She won a gold medal.'],
      ['coach', '/kəʊtʃ/', 'n.', '教练', 'Our coach is very strict.'],
      ['defeat', '/dɪˈfiːt/', 'v.&n.', '击败；失败', 'They defeated the home team.'],
      ['strength', '/streŋθ/', 'n.', '力量；强项', 'Reading is her greatest strength.'],
      ['challenge', '/ˈtʃælɪndʒ/', 'n.&v.', '挑战', 'Climbing is a real challenge.'],
      ['victory', '/ˈvɪktəri/', 'n.', '胜利', 'It was an easy victory.'],
      ['spirit', '/ˈspɪrɪt/', 'n.', '精神；心灵', 'Team spirit matters most.']
    ];
    const PH = [
      ['give up', '/ɡɪv ʌp/', 'phr.', '放弃'],
      ['take part in', '/teɪk pɑːt ɪn/', 'phr.', '参加'],
      ['work out', '/wɜːk aʊt/', 'phr.', '锻炼；解决'],
      ['come along', '/kʌm əˈlɒŋ/', 'phr.', '一起来；进展'],
      ['set out', '/set aʊt/', 'phr.', '出发；着手'],
      ['keep up with', '/kiːp ʌp wɪð/', 'phr.', '跟上'],
      ['look forward to', '/lʊk ˈfɔːwəd tuː/', 'phr.', '期待'],
      ['carry on', '/ˈkæri ɒn/', 'phr.', '继续']
    ];

    const entries = [];
    function put(listId, arr, readyCount) {
      arr.forEach((w, i) => {
        const ready = i < readyCount;
        entries.push({
          id: 'ent_' + listId.slice(3) + String(i + 1).padStart(2, '0'),
          listId, word: w[0], phonetic: w[1], pos: w[2], meaningZh: w[3],
          example: w[4] || '', exampleZh: '',
          audioUrl: ready ? 'audio/' + listId + '/' + w[0].replace(/\s+/g, '_') + '.mp3' : '',
          audioStatus: ready ? 'ready' : 'none',
          mastery: 40 + ((i * 17) % 50), order: i + 1, note: ''
        });
      });
    }
    put('wl_01', U4, 16);
    put('wl_02', U3, 12);
    put('wl_03', PH, 0);

    const tasks = [
      {
        id: 'tk_01', title: 'Unit 4 听写 · 高一(3)班 · ' + U.fmtShort(U.addDays(today, -3)),
        listId: 'wl_01', classId: 'cls_01', mode: 'listen_word', intervalSec: 5, repeatTimes: 2,
        shuffle: true, allowReplay: true, audioSource: 'upload', status: 'published',
        entryCount: 20, publishedAt: U.addDays(today, -3), dueAt: U.addDays(today, 1), createdAt: now
      },
      {
        id: 'tk_02', title: 'Unit 3 听写 · 高一(7)班 · ' + U.fmtShort(U.addDays(today, -6)),
        listId: 'wl_02', classId: 'cls_02', mode: 'meaning_word', intervalSec: 5, repeatTimes: 1,
        shuffle: false, allowReplay: true, audioSource: 'upload', status: 'published',
        entryCount: 12, publishedAt: U.addDays(today, -6), dueAt: U.addDays(today, -2), createdAt: now
      },
      {
        id: 'tk_03', title: '短语听写 · 高一(3)班（草稿）',
        listId: 'wl_03', classId: 'cls_01', mode: 'listen_word', intervalSec: 6, repeatTimes: 2,
        shuffle: true, allowReplay: true, audioSource: 'upload', status: 'draft',
        entryCount: 8, publishedAt: '', dueAt: '', createdAt: now
      }
    ];

    const taskEntries = [];
    ['tk_01', 'tk_02', 'tk_03'].forEach(tid => {
      const t = tasks.find(x => x.id === tid);
      entries.filter(e => e.listId === t.listId).forEach((e, i) => {
        taskEntries.push({ taskId: tid, entryId: e.id, order: i + 1 });
      });
    });

    const sched = [
      ['cls_01', 1, 2, '08:55', '09:40', '教学楼302'],
      ['cls_02', 1, 5, '13:30', '14:15', '教学楼305'],
      ['cls_01', 2, 4, '10:50', '11:35', '教学楼302'],
      ['cls_02', 2, 2, '08:55', '09:40', '教学楼305'],
      ['cls_01', 3, 1, '08:00', '08:45', '教学楼302'],
      ['cls_02', 3, 6, '14:25', '15:10', '教学楼305'],
      ['cls_01', 4, 5, '13:30', '14:15', '教学楼302'],
      ['cls_02', 4, 3, '09:50', '10:35', '教学楼305'],
      ['cls_01', 5, 3, '09:50', '10:35', '教学楼302'],
      ['cls_02', 5, 7, '15:20', '16:05', '教学楼305']
    ];
    const courses = sched.map((r, i) => ({
      id: 'cs_' + String(i + 1).padStart(2, '0'), classId: r[0], subject: '英语',
      weekday: r[1], period: r[2], startTime: r[3], endTime: r[4], location: r[5],
      term: '2026-2027-1', active: true
    }));

    const preps = [];
    const cycle = ['ready', 'preparing', 'todo', 'todo', 'preparing', 'ready'];
    const outlines = {
      ready: '1. 复习 disaster / rescue 的搭配\n2. 听力填空（课本 P52）\n3. 讲解 -ed/-ing 形容词',
      preparing: '1. 检查听写结果\n2. 重点讲 thorough / affect\n3. 布置再听写',
      todo: ''
    };
    let n = 0;
    for (let d = 0; d < 7; d++) {
      const iso = U.addDays(today, d);
      const dayCourses = courses.filter(c => c.weekday === U.weekday(iso));
      dayCourses.forEach((c, j) => {
        let st;
        if (d === 0 && j === 0) st = 'ready';
        else if (d === 0 && j === 1) st = 'preparing';
        else if (d === 3 && j === 0) st = 'done';
        else st = cycle[n++ % cycle.length];
        preps.push({
          id: 'pp_' + (preps.length + 1), courseId: c.id, date: iso, status: st,
          outline: outlines[st] || '',
          listIds: st === 'todo' ? [] : ['wl_01'],
          taskIds: st === 'done' ? ['tk_01'] : [],
          examId: '', resources: st === 'ready' ? [{ name: '课件 · Unit 4 阅读', url: 'https://example.com/ppt' }] : [],
          note: '', updatedAt: now
        });
      });
    }

    /* 听写记录：按词难度生成，保证有可分析的错词 */
    const diffU4 = [0.55, 0.08, 0.12, 0.18, 0.42, 0.30, 0.62, 0.35, 0.48, 0.15, 0.52, 0.26, 0.28, 0.38, 0.22, 0.16, 0.09, 0.33, 0.45, 0.20];
    const diffU3 = [0.15, 0.28, 0.22, 0.35, 0.42, 0.18, 0.12, 0.30, 0.45, 0.38, 0.10, 0.20];
    const factor = [0.6, 0.8, 1.0, 1.2, 1.4, 0.9, 1.1, 0.7, 1.3, 0.5];
    const types = [['spelling', 0.58], ['meaning', 0.20], ['sound', 0.15], ['blank', 0.07]];
    function pickType(r) {
      let acc = 0;
      for (const [k, p] of types) { acc += p; if (r < acc) return k; }
      return 'spelling';
    }
    const records = [];
    let rc = 0;
    [['tk_01', 'cls_01', 'wl_01', diffU4, 11], ['tk_02', 'cls_02', 'wl_02', diffU3, 22]].forEach(([tid, cid, lid, diff, seed]) => {
      const rnd = U.rng(seed * 7919);
      const listEntries = entries.filter(e => e.listId === lid).sort((a, b) => a.order - b.order);
      const task = tasks.find(t => t.id === tid);
      students.filter(s => s.classId === cid).forEach((stu, si) => {
        // 留几个人没交，方便演示"进行中 / 待录入"状态
        if ((tid === 'tk_01' && si === 9) || (tid === 'tk_02' && si >= 8)) return;
        listEntries.forEach((e, ei) => {
          const p = U.clamp((diff[ei] || 0.2) * factor[si % factor.length], 0, 0.95);
          const wrong = rnd() < p;
          const type = wrong ? pickType(rnd()) : '';
          const day = U.addDays(today, -3 + (si % 2));
          records.push({
            id: 'rc_' + (++rc), taskId: tid, studentId: stu.id, entryId: e.id,
            isCorrect: !wrong, errorType: type, source: 'manual',
            createdAt: day + 'T' + (task.mode === 'listen_word' ? '20' : '09') + ':1' + (ei % 9) + ':00'
          });
        });
      });
    });

    const exams = [{
      id: 'ex_01', name: '高一(3)班 9 月月考', date: U.addDays(today, -20), classId: 'cls_01',
      fullScore: 150, type: 'monthly', note: ''
    }];
    const scoreVals = [128, 121, 116, 112, 108, 104, 98, 92, 86, 79];
    const scores = scoreVals.map((v, i) => ({
      id: 'sc_' + (i + 1), examId: 'ex_01', studentId: 'stu_' + String(i + 1).padStart(2, '0'),
      score: v, note: ''
    }));

    S.db = {
      classes, students, wordlists, entries, tasks, taskEntries,
      records, courses, preps, exams, scores, pool: []
    };
    S.settings = {
      teacherName: '李老师', school: '示例中学',
      passwordHash: '', rememberLoginDays: 30, autoLockMinutes: 30, privacyMode: 'masked',
      voice: { provider: '', endpoint: '', voiceId: '', enabled: false, lastTestedAt: '' },
      backup: { lastExportAt: U.addDays(today, -3), remindDays: 14 },
      ui: { projectionMode: false }
    };
    S.saveAll();
    write('meta', { seededAt: today, version: 1 });
  }

  window.Store = S;
})();
