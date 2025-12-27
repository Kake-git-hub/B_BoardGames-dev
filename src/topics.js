export const TOPIC_CATEGORIES = [
  {
    id: 'food',
    name: '食べ物',
    pairs: [
      ['カレー', 'シチュー'],
      ['ラーメン', 'うどん'],
      ['寿司', '刺身'],
      ['ハンバーガー', 'サンドイッチ'],
      ['チョコ', 'クッキー'],
      ['おにぎり', 'サンドイッチ'],
      ['焼肉', 'しゃぶしゃぶ'],
      ['ピザ', 'グラタン'],
      ['アイス', 'かき氷'],
      ['プリン', 'ゼリー'],
    ],
  },
  {
    id: 'place',
    name: '場所',
    pairs: [
      ['映画館', '劇場'],
      ['学校', '塾'],
      ['コンビニ', 'スーパー'],
      ['病院', '薬局'],
      ['図書館', '本屋'],
      ['温泉', '銭湯'],
      ['水族館', '動物園'],
      ['空港', '駅'],
      ['海', '山'],
      ['カフェ', 'レストラン'],
    ],
  },
  {
    id: 'thing',
    name: 'モノ',
    pairs: [
      ['スマホ', 'タブレット'],
      ['テレビ', 'パソコン'],
      ['傘', 'レインコート'],
      ['時計', 'カレンダー'],
      ['リュック', 'バッグ'],
      ['自転車', 'バイク'],
      ['鉛筆', 'シャーペン'],
      ['ノート', '教科書'],
      ['鍵', '財布'],
      ['メガネ', 'コンタクト'],
    ],
  },
  {
    id: 'job',
    name: '職業',
    pairs: [
      ['先生', '講師'],
      ['医者', '看護師'],
      ['警察官', '消防士'],
      ['料理人', 'パティシエ'],
      ['スポーツ選手', '監督'],
      ['店員', '店長'],
      ['運転手', '整備士'],
      ['漫画家', 'イラストレーター'],
      ['記者', '編集者'],
      ['配達員', '郵便局員'],
    ],
  },
];

export function getCategoryById(id) {
  return TOPIC_CATEGORIES.find((c) => c.id === id) || TOPIC_CATEGORIES[0];
}

export function pickRandomPair(categoryId) {
  const cat = getCategoryById(categoryId);
  const pairs = (cat && cat.pairs) || [];
  if (!pairs.length) throw new Error('候補がありません');
  const idx = Math.floor(Math.random() * pairs.length);
  const pair = pairs[idx];
  // 50%で入れ替えて「多数/少数」を固定化しない
  if (Math.random() < 0.5) return { category: cat, majority: pair[0], minority: pair[1] };
  return { category: cat, majority: pair[1], minority: pair[0] };
}
