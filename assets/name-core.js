/*
 * 名字助手 · 核心逻辑（浏览器 / Node 通用）
 * 数据记录格式统一为 [姓名, 性别, 年龄]
 */
(function (global) {
  "use strict";

  // ---------- 基础工具 ----------
  function foldName(n) { return String(n).replace(/\s+/g, ""); }
  function isHan(s) { return /^[\u4e00-\u9fa5]+$/.test(s); }
  function len(s) { return Array.from(String(s)).length; }

  // ---------- 建立索引：查重 + 起名素材 ----------
  function buildIndexes(records) {
    const ind = new Map();
    const pools = { 男: { big: {}, single: {}, sur: {} }, 女: { big: {}, single: {}, sur: {} } };
    for (const rec of records) {
      const n = rec[0], g = rec[1];
      const k = foldName(n);
      if (!ind.has(k)) ind.set(k, { name: n, items: [] });
      ind.get(k).items.push({ gender: g, age: rec[2] });
      if (g === "男" || g === "女") {
        const src = pools[g];
        if (len(n) === 3 && isHan(n)) {
          src.big[n.slice(1)] = (src.big[n.slice(1)] || 0) + 1;
          src.sur[n[0]] = (src.sur[n[0]] || 0) + 1;
        } else if (len(n) === 2 && isHan(n)) {
          src.single[n[1]] = (src.single[n[1]] || 0) + 1;
          src.sur[n[0]] = (src.sur[n[0]] || 0) + 1;
        }
      }
    }
    return { ind: ind, pools: pools, total: records.length, uniq: ind.size };
  }

  function weightedEntries(map) {
    const arr = [];
    for (const k in map) arr.push([k, map[k]]);
    return arr;
  }

  function sampleWeighted(arr, n) {
    const pool = arr.slice();
    const out = [];
    const total = () => pool.reduce((s, e) => s + e[1], 0);
    for (let i = 0; i < n && pool.length; i++) {
      let t = total();
      let r = Math.random() * t;
      let pick = 0;
      for (let j = 0; j < pool.length; j++) {
        r -= pool[j][1];
        if (r <= 0) { pick = j; break; }
      }
      out.push(pool[pick][0]);
      pool.splice(pick, 1);
    }
    return out;
  }

  function poolFor(pools, gender) {
    if (gender === "男" || gender === "女") return pools[gender];
    const merge = (m1, m2) => {
      const o = {};
      for (const k in m1) o[k] = (o[k] || 0) + m1[k];
      for (const k in m2) o[k] = (o[k] || 0) + m2[k];
      return o;
    };
    return {
      big: merge(pools["男"].big, pools["女"].big),
      single: merge(pools["男"].single, pools["女"].single),
      sur: merge(pools["男"].sur, pools["女"].sur)
    };
  }

  function randomSurname(pool) {
    const s = sampleWeighted(weightedEntries(pool.sur), 1);
    return s.length ? s[0] : "李";
  }

  // ---------- 起名 ----------
  function generate(built, surname, gender, mode) {
    const pool = poolFor(built.pools, gender);
    const sur = (surname || "").trim() || randomSurname(pool);
    let given;
    if (mode === "free") {
      const agg = {};
      for (const big in pool.big) {
        for (const ch of Array.from(big)) agg[ch] = (agg[ch] || 0) + pool.big[big];
      }
      const picked = sampleWeighted(weightedEntries(agg), 2);
      given = picked.join("");
    } else {
      const big = sampleWeighted(weightedEntries(pool.big), 1);
      given = big.length ? big[0] : "梓";
    }
    const full = sur + given;
    return { name: full, known: built.ind.has(foldName(full)) };
  }

  function realNamesFor(built, surname, gender, n) {
    const sur = (surname || "").trim();
    if (!sur) return [];
    const out = [];
    const seen = new Set();
    for (const rec of built.ind.values()) {
      const name = rec.name, g = rec.items[0].gender;
      if (name.startsWith(sur) && len(name) >= 2 && (gender === "不限" ? true : g === gender)) {
        if (!seen.has(name)) { seen.add(name); out.push({ name: name, known: true }); }
        if (out.length >= n) break;
      }
    }
    return out;
  }

  // ---------- 查重 ----------
  function lookup(built, query) {
    const k = foldName(query.trim());
    const hit = built.ind.get(k);
    if (!hit) return { found: false };
    const items = hit.items;
    const gc = {};
    items.forEach(it => { gc[it.gender] = (gc[it.gender] || 0) + 1; });
    const ages = [...new Set(items.map(it => it.age))].filter(Boolean);
    return { found: true, name: hit.name, count: items.length, gender: gc, ages: ages };
  }

  // ---------- Excel 行解析（sheet_to_json 的 header:1 输出 -> 记录） ----------
  function normalizeRows(rows) {
    if (!Array.isArray(rows)) return [];
    let header = null;
    const headLimit = Math.min(rows.length, 12);
    for (let i = 0; i < headLimit; i++) {
      const r = rows[i] || [];
      const c = r.map(x => String(x == null ? "" : x).trim());
      const ni = c.findIndex(x => /^(姓名|名字|name)$/i.test(x));
      const gi = c.findIndex(x => /^(性别|gender|sex)$/i.test(x));
      const ai = c.findIndex(x => /^(年龄|生日|age)$/i.test(x));
      if (ni >= 0) { header = { start: i + 1, ni: ni, gi: gi, ai: ai }; break; }
    }
    let source, ni, gi, ai;
    if (header) {
      source = rows.slice(header.start);
      ni = header.ni; gi = header.gi; ai = header.ai;
    } else {
      source = rows.filter(r => Array.isArray(r) && r.some(x => String(x == null ? "" : x).trim()));
      ni = 0; gi = 2; ai = 1;
    }
    const out = [];
    for (const r of source) {
      if (!Array.isArray(r)) continue;
      const name = String(r[ni] == null ? "" : r[ni]).replace(/\s+/g, "").trim();
      if (!name) continue;
      if (name.endsWith("之女") || name.endsWith("之子")) continue;
      const gender = String(r[gi] == null ? "" : r[gi]).trim() || "未";
      const age = String(r[ai] == null ? "" : r[ai]).trim();
      out.push([name, gender, age]);
    }
    return out;
  }

  var core = {
    foldName: foldName,
    isHan: isHan,
    len: len,
    buildIndexes: buildIndexes,
    generate: generate,
    realNamesFor: realNamesFor,
    lookup: lookup,
    normalizeRows: normalizeRows
  };

  if (typeof module !== "undefined" && module.exports) module.exports = core;
  global.NameCore = core;
})(typeof window !== "undefined" ? window : globalThis);
