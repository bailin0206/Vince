/* 通用工具：转义、日期、CSV、下载、随机数 */
(function () {
  const pad = n => String(n).padStart(2, '0');

  const U = {
    esc(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[c]));
    },
    uid(p) { return p + '_' + Math.random().toString(36).slice(2, 7); },

    iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); },
    today() { return U.iso(new Date()); },
    addDays(iso, n) {
      const d = new Date(iso + 'T00:00:00');
      d.setDate(d.getDate() + n);
      return U.iso(d);
    },
    weekday(iso) { const d = new Date(iso + 'T00:00:00').getDay(); return d === 0 ? 7 : d; },
    weekStart(iso) { return U.addDays(iso, 1 - U.weekday(iso)); },
    fmtMD(iso) { const d = new Date(iso + 'T00:00:00'); return (d.getMonth() + 1) + '月' + d.getDate() + '日'; },
    fmtShort(iso) { const d = new Date(iso + 'T00:00:00'); return (d.getMonth() + 1) + '/' + d.getDate(); },
    fmtWD(iso) { return '周' + ['一', '二', '三', '四', '五', '六', '日'][U.weekday(iso) - 1]; },
    nowHM() { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); },
    greeting() {
      const h = new Date().getHours();
      if (h < 6) return '夜深了';
      if (h < 11) return '早上好';
      if (h < 13) return '中午好';
      if (h < 18) return '下午好';
      return '晚上好';
    },
    daysBetween(a, b) {
      return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
    },
    relDay(iso) {
      const n = U.daysBetween(iso, U.today());
      if (n === 0) return '今天';
      if (n === 1) return '昨天';
      if (n === 2) return '前天';
      if (n > 0) return n + ' 天前';
      return Math.abs(n) + ' 天后';
    },

    pct(n, d) { return d ? Math.round(n / d * 100) : 0; },
    clamp(v, a, b) { return Math.min(b, Math.max(a, v)); },

    rng(seed) {
      let a = seed >>> 0;
      return function () {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },

    parseCSV(text) {
      const rows = [];
      String(text).replace(/\r\n/g, '\n').split('\n').forEach(line => {
        if (!line.trim()) return;
        const out = [];
        let cur = '', q = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (q) {
            if (ch === '"') {
              if (line[i + 1] === '"') { cur += '"'; i++; } else q = false;
            } else cur += ch;
          } else if (ch === '"') q = true;
          else if (ch === ',' || ch === '\t') { out.push(cur); cur = ''; }
          else cur += ch;
        }
        out.push(cur);
        rows.push(out.map(s => s.trim()));
      });
      return rows;
    },

    toCSV(rows) {
      return rows.map(r => r.map(c => {
        const s = c == null ? '' : String(c);
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(',')).join('\n');
    },

    download(filename, text, mime) {
      const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 400);
    },

    debounce(fn, ms) {
      let t;
      return function (...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms || 160); };
    },

    initials(name) { return String(name || '师').slice(0, 1); }
  };

  window.U = U;
})();
