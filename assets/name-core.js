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

  // 取名字里的「名」（去掉姓氏）：3字名=后二字，2字名=后一字，更长=最后二字
  function givenPart(q) {
    const arr = Array.from(q);
    const l = arr.length;
    if (l === 2) return arr.slice(1).join("");
    if (l === 3) return arr.slice(1).join("");
    if (l > 3) return arr.slice(l - 2).join("");
    return "";
  }

  // 常见复姓（用于正确拆分姓氏与名）
  var COMPOUND = {};
  ("欧阳,司马,上官,诸葛,东方,皇甫,尉迟,公孙,慕容,司徒,司空,夏侯,长孙,宇文,令狐,轩辕,南宫,端木,西门,呼延,独孤,闻人,东郭,百里,南郭,羊舌,乐正,钟离,鲜于,万俟,公冶,宗政,濮阳,淳于,单于,太叔,申屠,公羊,仲孙,北宫,公良,拓跋,夹谷,谷梁,段干,子车,东门,漆雕,壤驷,梁丘").split(",").forEach(function (s) { COMPOUND[s] = true; });

  // 风格字库（用于「自由组合」按风格取字）
  var STYLE_CHARS = {
    "文雅": "文雅清墨书韵含茹知乐聆笙词赋",
    "大气": "宇轩昊博睿泽铭梓弘远宸翊骁",
    "温柔": "柔婉婷静怡安若妍佳暖澄舒沁",
    "现代": "沐辰可欣悦子亦安晴诺言朗然",
    "古风": "卿南北青陌简予祈疏影扶舟鸣",
    "简约": "一尚简朴静聪谦和平直允中言"
  };

  // 典雅典籍名字的出处 / 寓意（可选）
  var MEANINGS = {
    "致远": "《诫子书》非宁静无以致远", "慎独": "《中庸》君子慎其独也",
    "若愚": "《老子》大智若愚", "景行": "《诗经》高山仰止，景行行止",
    "知行": "王阳明·知行合一", "观澜": "《孟子》观水有术，必观其澜",
    "思齐": "《论语》见贤思齐", "见贤": "《论语》见贤思齐焉",
    "明诚": "《中庸》自明诚", "正心": "《大学》正心诚意",
    "守拙": "陶渊明·守拙归园田", "如琢": "《诗经》如切如磋，如琢如磨",
    "一苇": "《诗经》一苇杭之", "三省": "《论语》吾日三省吾身",
    "朝闻": "《论语》朝闻道", "九思": "《论语》君子有九思",
    "素履": "《周易》素履之往", "乘月": "张若虚·不知乘月几人归",
    "长风": "李白·长风破浪会有时", "乐山": "《论语》仁者乐山",
    "乐水": "《论语》智者乐水", "云深": "贾岛·云深不知处",
    "之恒": "《诗经》如月之恒", "可久": "《周易》可久则贤人之德",
    "于飞": "凤凰于飞", "鹤鸣": "《诗经》鹤鸣九皋",
    "怀瑾": "《楚辞》怀瑾握瑜", "清源": "朱熹·为有源头活水来",
    "既明": "《诗经》既明且哲", "行远": "《中庸》行远必自迩",
    "望舒": "《楚辞》前望舒使先驱", "扶摇": "《逍遥游》抟扶摇而上",
    "若水": "《道德经》上善若水", "既白": "苏轼·东方之既白",
    "未央": "《诗经》夜未央", "若华": "《楚辞》若华之敷",
    "子衿": "《诗经》青青子衿", "采薇": "《诗经》采薇采薇",
    "芷若": "香草·芷若芬芳", "疏影": "林逋·疏影横斜水清浅",
    "暗香": "林逋·暗香浮动月黄昏", "清欢": "苏轼·人间有味是清欢",
    "初晴": "苏轼·水光潋滟晴方好", "兰若": "香草·兰若",
    "令仪": "《诗经》令仪令色", "其琛": "来贡其琛",
    "知微": "《周易》知微知彰", "语冰": "《庄子》夏虫不可语冰",
    "月白": "月白风清", "柔嘉": "《诗经》柔嘉维则",
    "思归": "《诗经》岂不怀归", "云岫": "陶渊明·云无心以出岫",
    "南乔": "《诗经》南有乔木", "淡月": "月色淡雅",
    "青竹": "青竹高洁", "栖梧": "凤凰栖梧",
    "照影": "临水照影", "嘉禾": "嘉禾瑞穗",
    "婉清": "《诗经》清扬婉兮", "如初": "愿如初见"
  };

  // ---------- 建立索引：查重 + 起名素材 ----------
  function buildIndexes(records, trend, classic) {
    const ind = new Map();
    const pools = {
      男: { big: {}, single: {}, sur: {}, trend: {}, classic: {} },
      女: { big: {}, single: {}, sur: {}, trend: {}, classic: {} }
    };
    for (const rec of records) {
      const n = rec[0], g = rec[1];
      const k = foldName(n);
      if (!ind.has(k)) ind.set(k, { name: n, items: [] });
      ind.get(k).items.push({ gender: g, age: rec[2] });
      if (g === "男" || g === "女") {
      const src = pools[g];
        const chars = Array.from(n);
        const L = chars.length;
        if (L >= 2 && isHan(n)) {
          let surLen = 1;
          if (L >= 3 && COMPOUND[n.slice(0, 2)]) surLen = 2;
          const surname = chars.slice(0, surLen).join("");
          const givenArr = chars.slice(surLen);
          const given = givenArr.join("");
          if (givenArr.length === 1) src.single[given] = (src.single[given] || 0) + 1;
          else if (givenArr.length === 2) src.big[given] = (src.big[given] || 0) + 1;
          src.sur[surname] = (src.sur[surname] || 0) + 1;
        }
      }
    }
    // 近年流行的二字名（来自官方新生儿姓名统计），按榜单名次加权
    if (trend) {
      for (const g of ["男", "女"]) {
        const arr = (trend[g] || []);
        for (let i = 0; i < arr.length; i++) {
          pools[g].trend[arr[i]] = (pools[g].trend[arr[i]] || 0) + (arr.length - i);
        }
      }
    }
    if (classic) {
      for (const g of ["男", "女"]) {
        const arr = (classic[g] || []);
        for (let i = 0; i < arr.length; i++) {
          pools[g].classic[arr[i]] = (pools[g].classic[arr[i]] || 0) + (arr.length - i);
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
      sur: merge(pools["男"].sur, pools["女"].sur),
      trend: merge(pools["男"].trend, pools["女"].trend),
      classic: merge(pools["男"].classic, pools["女"].classic)
    };
  }

  function randomSurname(pool) {
    const s = sampleWeighted(weightedEntries(pool.sur), 1);
    return s.length ? s[0] : "李";
  }

  // ---------- 起名 ----------
  function freeMap(pool, style) {
    if (style && STYLE_CHARS[style]) {
      var m = {};
      Array.from(STYLE_CHARS[style]).forEach(function (ch) { m[ch] = (m[ch] || 0) + 1; });
      return m;
    }
    var agg = {};
    for (var big in pool.big) {
      for (var i = 0; i < Array.from(big).length; i++) {
        var ch = Array.from(big)[i];
        agg[ch] = (agg[ch] || 0) + pool.big[big];
      }
    }
    return agg;
  }

  function generate(built, surname, gender, mode, nameLen, style) {
    const pool = poolFor(built.pools, gender);
    const sur = (surname || "").trim() || randomSurname(pool);
    const single = nameLen === 2; // 二字名→名用一字
    let given;
    if (single) {
      if (mode === "free") {
        const s = sampleWeighted(weightedEntries(freeMap(pool, style)), 1);
        given = s.length ? s[0] : "梓";
      } else {
        const s = sampleWeighted(weightedEntries(pool.single || {}), 1);
        given = s.length ? s[0] : "梓";
      }
    } else if (mode === "trend") {
      const s = sampleWeighted(weightedEntries(pool.trend || {}), 1);
      given = s.length ? s[0] : "梓";
    } else if (mode === "classic") {
      const s = sampleWeighted(weightedEntries(pool.classic || {}), 1);
      given = s.length ? s[0] : "梓";
    } else if (mode === "free") {
      const s = sampleWeighted(weightedEntries(freeMap(pool, style)), 2);
      given = s.join("");
    } else {
      const big = sampleWeighted(weightedEntries(pool.big), 1);
      given = big.length ? big[0] : "梓";
    }
    const full = sur + given;
    return { name: full, known: built.ind.has(foldName(full)), given: given, meaning: MEANINGS[given] || "" };
  }

  // 生僻字 / 谐音歧义检测（启发式）
  var AVOID = "屎尿死癌丧蠢贱骚鸡狗猪牛龟鳖脓疮痨屁屌逼屄鸟遗病亡灾祸凶霉";
  function isRareChar(ch) {
    var c = ch.codePointAt(0);
    return (c >= 0x3400 && c <= 0x4DBF) || c > 0x9FFF || (c >= 0xF900 && c <= 0xFAFF);
  }
  function analyzeName(given) {
    var issues = [];
    var arr = Array.from(given || "");
    var rare = arr.filter(isRareChar);
    if (rare.length) issues.push("含生僻字（" + rare.join("") + "），可能难输入/难辨认");
    var bad = arr.filter(function (ch) { return AVOID.indexOf(ch) >= 0; });
    if (bad.length) issues.push("含易谐音歧义的字（" + bad.join("") + "），建议规避");
    return issues;
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
    const given = givenPart(k);
    const trend = [];
    const seen = {};
    if (given) {
      for (const g of ["男", "女"]) {
        if (built.pools[g].trend && built.pools[g].trend[given]) {
          if (!seen[given]) { seen[given] = true; trend.push({ gender: g, given: given }); }
        }
      }
    }
    const hit = built.ind.get(k);
    if (!hit) return { found: false, trend: trend };
    const items = hit.items;
    const gc = {};
    items.forEach(it => { gc[it.gender] = (gc[it.gender] || 0) + 1; });
    const ages = [...new Set(items.map(it => it.age))].filter(Boolean);
    return { found: true, name: hit.name, count: items.length, gender: gc, ages: ages, trend: trend };
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
    analyzeName: analyzeName,
    normalizeRows: normalizeRows
  };

  if (typeof module !== "undefined" && module.exports) module.exports = core;
  global.NameCore = core;
})(typeof window !== "undefined" ? window : globalThis);
