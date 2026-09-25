/* Everything a re-skin needs to change lives here: copy, names, dates and art / logo slots.
   All names below are fictional and original to this study.
   Any `art` / `logo` field accepts an image URL (png/jpg/webp, transparent png recommended for art);
   null draws the built-in placeholder, so the piece always renders.
   Quick test without editing: ?bust=url&full=url&logo=url  (see assets.js) */
'use strict';
PV.CONFIG = {
  accent2: '#ff7a5c', // secondary accent: used only in the operator / outfit segment

  game: {
    name: 'DASTER',
    cn: '相位档案',
    en: 'PHASE ARCHIVE',
    logo: null, // game logo slot (opening card, outfit page, key visual)
  },

  event: {
    series: 'PHASE SHIFT',
    seriesCN: '相位跃迁',
    no: '#01',
    title: '共生回路',
    titleEN: 'SYMBIOSIS CIRCUIT',
    kind: '限时活动 · 即将开启',
    kindEN: 'LIMITED-TIME EVENT · COMING SOON',
    dates: '10.08 04:00 — 10.22 03:59',
    emblem: null, // event emblem slot; null = procedural hex emblem
  },

  operator: {
    code: '藤曦',
    en: 'VINELIGHT',
    rarity: 6,
    cls: '召唤师',
    clsEN: 'SUMMONER',
    faction: '环境模拟实验室',
    factionEN: 'E.S.L. / ECO-SIMULATION LAB',
    quote: '让信号生长，直到它学会开花。',
    quoteEN: 'Let the signal grow until it learns to bloom.',
    tags: ['召唤', '治疗', '生态模拟'],
    illustrator: 'ILLUSTRATOR / 画师署名占位',
    bust: null, // half-body art slot, ~1:1
  },

  outfit: {
    series: 'ATELIER HALO',
    seriesCN: '光环工坊',
    year: '2026 NEW SERIES',
    name: '静默花期',
    nameEN: ['QUIET', 'BLOOM'],
    tag: 'NEW OUTFIT · 限定时装',
    wearer: '藤曦',
    note: '工坊为外勤研究员设计的轻量礼装，外层织入可发光的藤蔓纤维。',
    illustrator: 'ILLUSTRATOR / 画师署名占位',
    art: null, // full-body art slot, ~1:2
  },

  studio: { name: 'DASTER.ME', logo: null },

  // end slates on black, in order
  slates: [
    { label: 'PLATFORM', cn: '发行平台 Logo 占位', logo: null },
    { label: 'DEVELOPER', cn: '开发商 Logo 占位', logo: null, useStudio: true },
    { label: 'AGE RATING', cn: '适龄提示占位', logo: null, rating: '12+' },
  ],
};
