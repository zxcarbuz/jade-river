// Bios, schedules, place tree, canned lines and lightweight memory
// helpers for JADE RIVER residents. Inspired by Generative Agents
// (Park et al. 2023), but fully offline and cheap: no LLM at runtime.
//
// People: 12 walkers (ids 0–11) and 9 stationary (ids 12–20).
// Schedules are tied to the continuous game clock (hours 0–24) and to
// the Утро / День / Закат / Ночь presets (7.4 / 12.5 / 17.7 / 21.5).

import { HOUSES, HOUSE_ENTER } from './layout.js';

export const MEM_CAP = 8;
export const DECAY = 0.995; // recency decay per game hour (as in the paper)

// Event kinds stored as small integers in the ring buffer.
export const MK = { PLAYER: 1, TALK: 2, BLOCKED: 3, ACT: 4, GREET: 5 };
const IMP = { [MK.PLAYER]: 7, [MK.TALK]: 5, [MK.BLOCKED]: 2, [MK.ACT]: 3, [MK.GREET]: 4 };

export function periodOf(hour) {
  if (hour >= 19.6 || hour < 5.5) return 'night';
  if (hour < 10) return 'morning';
  if (hour < 16.5) return 'day';
  return 'sunset';
}
export function marketOpen(hour) { return hour >= 7 && hour < 19; }

// hour wraps: [start, end) may cross midnight when start > end
export function inSpan(hour, start, end) {
  return start <= end ? (hour >= start && hour < end) : (hour >= start || hour < end);
}
export function scheduleAct(life, hour) {
  const s = life.schedule;
  for (let i = 0; i < s.length; i++) {
    if (inSpan(hour, s[i][0], s[i][1])) return s[i][2];
  }
  return 'home';
}

// ---------------------------------------------------------------- place tree (matches existing nav / POIs)
export const PLACES = {
  id: 'world', name: ['玉河镇', 'Городок Юйхэ'], children: {
    market: { name: ['市集', 'Овощной рынок'], hint: 'на рынке' },
    teahouse: { name: ['茶楼', 'Чайная «Нефритовый лист»'], hint: 'в чайной' },
    noodle: { name: ['面馆', 'Лапшичная'], hint: 'в лапшичной' },
    inn: { name: ['悦来客栈', 'Гостиница «Радостная встреча»'], hint: 'в гостинице' },
    temple: { name: ['大雄宝殿', 'Храм'], hint: 'в храме' },
    garden: { name: ['怡园', 'Сад и пруд с карпами'], hint: 'у пруда с карпами' },
    canal: { name: ['玉河', 'Канал'], hint: 'у канала' },
    bridge: { name: ['玉带桥', 'Мост Нефритового пояса'], hint: 'на мосту' },
    street: { name: ['街道', 'Улица'], hint: 'на улице' },
  },
};

// ---------------------------------------------------------------- people
// schedule entries: [startHour, endHour, act]
// act is one of shop|tea|noodle|bench|pray|wander|home|work|monk
const W = (id, cn, ru, role, roleRu, traits, traitsRu, home, bio, schedule) => ({
  id, kind: 'walker', name: [cn, ru], role, roleRu, traits, traitsRu, home, bio, schedule,
});
const V = (id, cn, ru, role, roleRu, traits, traitsRu, home, bio, schedule, post) => ({
  id, kind: 'vendor', name: [cn, ru], role, roleRu, traits, traitsRu, home, bio, schedule, post,
});

export const PEOPLE = [
  W(0, '李书生', 'Учёный Ли', '书生', 'книжник',
    ['тихий', 'любознательный'], ['тихий', 'любознательный'], 4,
    'Живёт у книжной лавки, по утрам ходит в храм, любит чай и стихи.',
    [[5.5, 7.2, 'home'], [7.2, 9.5, 'pray'], [9.5, 16.5, 'tea'], [16.5, 19.6, 'tea'], [19.6, 5.5, 'home']]),
  W(1, '王婆婆', 'Бабушка Ван', '邻家婆婆', 'соседка',
    ['добрая', 'говорливая'], ['добрая', 'говорливая'], 3,
    'Хозяйка жилого дома у чайной. Знает всех в округе и любит посидеть у воды.',
    [[5.5, 8.0, 'home'], [8.0, 12.0, 'shop'], [12.0, 16.5, 'bench'], [16.5, 19.6, 'bench'], [19.6, 5.5, 'home']]),
  W(2, '小梅', 'Сяо Мэй', '绣女', 'вышивальщица',
    ['изящная', 'застенчивая'], ['изящная', 'застенчивая'], 7,
    'Вышивает шёлк, часто заходит в чайную и разглядывает ткани на рынке.',
    [[5.5, 8.0, 'home'], [8.0, 11.5, 'shop'], [11.5, 19.6, 'tea'], [19.6, 5.5, 'home']]),
  W(3, '张掌柜', 'Хозяин Чжан', '药铺掌柜', 'хозяин аптеки',
    ['деловитый', 'честный'], ['деловитый', 'честный'], 2,
    'Держит аптеку у рынка. Днём присматривает за торговлей, вечером ужинает лапшой.',
    [[5.5, 7.0, 'home'], [7.0, 16.5, 'shop'], [16.5, 19.6, 'noodle'], [19.6, 5.5, 'home']]),
  W(4, '陈先生', 'Господин Чэнь', '客商', 'купец',
    ['сдержанный', 'наблюдательный'], ['сдержанный', 'наблюдательный'], 5,
    'Приезжий купец, останавливается на восточной улице. Любит лапшу и разговоры за чаем.',
    [[5.5, 8.5, 'home'], [8.5, 16.5, 'tea'], [16.5, 19.6, 'noodle'], [19.6, 5.5, 'home']]),
  W(5, '林姑娘', 'Барышня Линь', '才女', 'барышня',
    ['светская', 'остроумная'], ['светская', 'остроумная'], 8,
    'Дочь чиновника, почти весь день проводит в чайной и любит наблюдать за каналом.',
    [[5.5, 8.5, 'home'], [8.5, 19.6, 'tea'], [19.6, 5.5, 'home']]),
  W(6, '赵渔夫', 'Рыбак Чжао', '渔人', 'рыбак',
    ['спокойный', 'простой'], ['спокойный', 'простой'], 10,
    'Живёт у сада с прудом. Удит у канала и отдыхает на скамейке с соломенной шляпой.',
    [[5.5, 7.0, 'home'], [7.0, 11.0, 'bench'], [11.0, 16.5, 'wander'], [16.5, 19.6, 'bench'], [19.6, 5.5, 'home']]),
  W(7, '周大娘', 'Тётушка Чжоу', '买菜的', 'торговка-покупательница',
    ['хозяйственная', 'громкая'], ['хозяйственная', 'громкая'], 15,
    'Каждый день ходит на рынок за зеленью и любит поторговаться.',
    [[5.5, 7.5, 'home'], [7.5, 19.0, 'shop'], [19.0, 19.6, 'noodle'], [19.6, 5.5, 'home']]),
  W(8, '吴公子', 'Молодой господин У', '公子', 'молодой господин',
    ['праздный', 'щедрый'], ['праздный', 'щедрый'], 11,
    'Сын виноторговца. Днём заглядывает в лапшичную, к закату — в чайную.',
    [[5.5, 9.5, 'home'], [9.5, 16.5, 'noodle'], [16.5, 19.6, 'tea'], [19.6, 5.5, 'home']]),
  W(9, '孙秀才', 'Сюцай Сунь', '秀才', 'сюцай',
    ['набожный', 'усердный'], ['набожный', 'усердный'], 9,
    'Сдал экзамен на сюцая. Часто молится в храме и думает о следующих испытаниях.',
    [[5.5, 7.0, 'home'], [7.0, 11.0, 'pray'], [11.0, 16.5, 'tea'], [16.5, 19.6, 'pray'], [19.6, 5.5, 'home']]),
  W(10, '刘姐', 'Сестрица Лю', '面馆常客', 'завсегдатай лапшичной',
    ['весёлая', 'прямая'], ['весёлая', 'прямая'], 16,
    'Помогает семье и не пропускает миску лапши. К вечеру снова в лапшичной.',
    [[5.5, 8.0, 'home'], [8.0, 19.6, 'noodle'], [19.6, 5.5, 'home']]),
  W(11, '阿福', 'А-Фу', '孩童', 'мальчик',
    ['резвый', 'любопытный'], ['резвый', 'любопытный'], 3,
    'Внук бабушки Ван. Бегает по улицам, сидит у воды и смотрит на карпов.',
    [[5.5, 8.0, 'home'], [8.0, 16.5, 'wander'], [16.5, 19.6, 'bench'], [19.6, 5.5, 'home']]),

  V(12, '果贩老黄', 'Торговец фруктами Хуан', '果贩', 'торговец фруктами',
    ['шумный', 'добродушный'], ['шумный', 'добродушный'], 0,
    'С утра до вечера продаёт персики и хурму на западном ряду рынка.',
    [[7.0, 19.0, 'work'], [19.0, 7.0, 'home']],
    { x: -26.7, z: -11.2, face: Math.PI / 2 }),
  V(13, '陶匠老何', 'Гончар Хэ', '陶匠', 'гончар',
    ['молчаливый', 'умелый'], ['молчаливый', 'умелый'], 6,
    'Лепит миски и кувшины. За прилавком почти не отходит до закрытия рынка.',
    [[7.0, 19.0, 'work'], [19.0, 7.0, 'home']],
    { x: -26.7, z: -15.8, face: Math.PI / 2 }),
  V(14, '绸缎商许', 'Торговка шёлком Сюй', '绸商', 'торговка шёлком',
    ['гордая', 'внимательная'], ['гордая', 'внимательная'], 1,
    'Держит шёлковый ряд напротив фруктов. Знает, кому какое платье к лицу.',
    [[7.0, 19.0, 'work'], [19.0, 7.0, 'home']],
    { x: -13.3, z: -11.2, face: -Math.PI / 2 }),
  V(15, '灯笼匠郑', 'Мастер фонарей Чжэн', '灯笼匠', 'мастер фонарей',
    ['весёлый', 'мастеровитый'], ['весёлый', 'мастеровитый'], 18,
    'Клеит бумажные фонари. К ночи сам расходится по домам — фонари уже горят без него.',
    [[7.0, 19.0, 'work'], [19.0, 7.0, 'home']],
    { x: -13.3, z: -15.8, face: -Math.PI / 2 }),
  V(16, '面馆厨师', 'Повар лапшичной', '面厨', 'повар',
    ['горячий', 'щедрый'], ['горячий', 'щедрый'], 'noodle',
    'Стоит у котла с утра и до позднего ужина, ночует в лапшичной.',
    [[6.5, 20.5, 'work'], [20.5, 6.5, 'home']],
    { x: -12.9, z: 13.15, face: Math.PI, cook: true }),
  V(17, '二厨小李', 'Помощник повара Ли', '二厨', 'помощник повара',
    ['старательный', 'застенчивый'], ['старательный', 'застенчивый'], 'noodle',
    'Помогает на кухне внутри лапшичной и ночует там же.',
    [[6.5, 20.5, 'work'], [20.5, 6.5, 'home']],
    { x: -13.7, z: 18.7, face: 0, cook: true, room: 'noodle' }),
  V(18, '茶博士', 'Чайный мастер', '茶博士', 'чайный мастер',
    ['неспешный', 'вежливый'], ['неспешный', 'вежливый'], 'teahouse',
    'Заваривает чай в зале «Нефритового листа» до позднего вечера.',
    [[7.0, 21.0, 'work'], [21.0, 7.0, 'home']],
    { x: 12.3, z: -19.2, face: 0, room: 'teahouse' }),
  V(19, '掌柜钱', 'Хозяин гостиницы Цянь', '客栈掌柜', 'хозяин гостиницы',
    ['радушный', 'бдительный'], ['радушный', 'бдительный'], 'inn',
    'Встречает путников в приёмном зале и ночует в своей гостинице.',
    [[6.0, 21.0, 'work'], [21.0, 6.0, 'home']],
    { x: 7.5, z: 21.15, face: Math.PI, room: 'inn' }),
  V(20, '慧明法师', 'Монах Хуэй Мин', '住持', 'настоятель',
    ['тихий', 'милосердный'], ['тихий', 'милосердный'], 'temple',
    'Читает сутры у алтаря храма. Вечером не уходит — только голос становится тише.',
    [[0, 24, 'monk']],
    { x: 2.35, z: -49.0, face: -Math.PI / 2 - 0.35, monk: true, room: 'temple' }),
];

export const WALKERS = PEOPLE.filter((p) => p.kind === 'walker');
export const VENDORS = PEOPLE.filter((p) => p.kind === 'vendor');

// ---------------------------------------------------------------- home approach slots (just outside each house, on the street side)
export function buildHomes(nav) {
  const slots = HOUSES.map((h, i) => {
    const wallZ = h.face > 0 ? h.cz + h.d / 2 : h.cz - h.d / 2;
    // keep the enterable house stoop well clear of the door trigger (≈1.8 m)
    const sz = wallZ + h.face * (i === HOUSE_ENTER ? 2.6 : 0.9);
    const sx = h.cx;
    let best = 0, bd = Infinity;
    for (let ni = 0; ni < nav.nodes.length; ni++) {
      const nd = nav.nodes[ni];
      if (h.face > 0 && nd.z < sz - 0.25) continue;
      if (h.face < 0 && nd.z > sz + 0.25) continue;
      const d = (nd.x - sx) * (nd.x - sx) + (nd.z - sz) * (nd.z - sz);
      if (d < bd) { bd = d; best = ni; }
    }
    const nd = nav.nodes[best];
    const path = [];
    if (Math.abs(nd.x - sx) > 0.2) path.push([sx, nd.z]);
    path.push([sx, sz]);
    return { house: i, node: best, path, face: h.face > 0 ? 0 : Math.PI, pose: 'stand', home: true, x: sx, z: sz };
  });
  return slots;
}

// ---------------------------------------------------------------- memory ring (preallocated, no push/pop in the hot path)
export function makeMemory() {
  const slots = new Array(MEM_CAP);
  for (let i = 0; i < MEM_CAP; i++) slots[i] = { kind: 0, hour: 0, imp: 0, x: 0, z: 0, who: -1 };
  return { slots, i: 0, n: 0 };
}
export function remember(mem, kind, hour, x, z, who) {
  const s = mem.slots[mem.i];
  s.kind = kind; s.hour = hour; s.imp = IMP[kind] || 3; s.x = x; s.z = z; s.who = who == null ? -1 : who;
  mem.i = (mem.i + 1) % MEM_CAP;
  if (mem.n < MEM_CAP) mem.n++;
  return s;
}
function hourDelta(now, then) {
  let d = now - then;
  if (d < 0) d += 24;
  if (d > 24) d -= 24;
  return d;
}
export function bestMemory(mem, hour) {
  let best = null, bestS = -1;
  for (let i = 0; i < mem.n; i++) {
    const s = mem.slots[i];
    if (!s.kind) continue;
    const rec = Math.pow(DECAY, hourDelta(hour, s.hour));
    const sc = rec * (s.imp / 10);
    if (sc > bestS) { bestS = sc; best = s; }
  }
  return best;
}

const ACT_RU = {
  walk: 'гуляет', idle: 'смотрит по сторонам', shop: 'выбирает товар', tea: 'пьёт чай',
  noodle: 'ест лапшу', bench: 'отдыхает у воды', pray: 'молится', vendor: 'торгует',
  cook: 'варит лапшу', monk: 'читает сутры у алтаря', work: 'на своём месте',
  home: 'идёт домой', sleep: 'дома, отдыхает', wander: 'гуляет', leave: 'уходит',
  pause: 'оглядывается', inside: 'внутри',
};
export { ACT_RU };

const PLACE_HINT = {
  shop: 'на рынке', tea: 'в чайной', noodle: 'в лапшичной', bench: 'у воды',
  pray: 'в храме', wander: 'по улице', home: 'дома', sleep: 'дома',
  work: 'на своём месте', monk: 'в храме', cook: 'у котла', vendor: 'за прилавком',
};

export function activityLine(r) {
  if (r.hidden) return 'дома, отдыхает';
  if (r.act && ACT_RU[r.act]) return ACT_RU[r.act];
  return ACT_RU[r.state] || r.state;
}

function nameOf(id, people) {
  if (id < 0) return 'путник';
  const p = people[id];
  return p ? p.name[1] : 'кто-то';
}

export function thoughtOf(life, hour, r, mem, people) {
  const act = r.hidden ? 'sleep' : (r.act || r.state);
  const hint = PLACE_HINT[act] || 'по городу';
  const m = bestMemory(mem, hour);
  if (m && m.kind === MK.PLAYER) {
    return r.life.id === 11
      ? 'Этот путник уже заходил. Интересно, он снова пойдёт к карпам?'
      : (m.x < -26 && m.z > 8
        ? 'Этот путник уже был у пруда с карпами. Интересно, задержится ли сегодня.'
        : 'Мы уже встречались сегодня. Приятно видеть знакомое лицо.');
  }
  if (m && m.kind === MK.TALK) {
    return 'Только что перекинулся словом с ' + nameOf(m.who, people) + '.';
  }
  if (m && m.kind === MK.BLOCKED) {
    return 'Хотел сесть, но место заняли — пойду в другое.';
  }
  if (periodOf(hour) === 'night') {
    return life.id === 20 ? 'Ночь тихая. Чищу ум и читаю вечерние сутры.' : 'Пора домой, фонари уже зажглись.';
  }
  if (act === 'pray' || act === 'monk') return 'Сердце спокойнее, когда горит благовоние.';
  if (act === 'tea') return 'Чай сегодня удался — можно сидеть и слушать канал.';
  if (act === 'noodle') return 'После миски лапши и мир кажется добрее.';
  if (act === 'shop') return 'На рынке сегодня людно, стоит присмотреться к товару.';
  if (act === 'bench') return 'Скамейка у воды — лучшее место подумать о своём.';
  if (act === 'wander' || act === 'walk' || act === 'idle') {
    return 'Иду ' + hint + '. ' + life.bio.split('.')[0] + '.';
  }
  return life.bio;
}

export function greetPlayer(life, hour, r, mem) {
  const m = bestMemory(mem, hour);
  const remembered = m && (m.kind === MK.PLAYER || m.kind === MK.GREET);
  if (life.id === 20) return remembered ? 'Снова ты, путник. Мир тебе. Вечерние сутры уже начались.' : 'Мир тебе, путник. Храм открыт.';
  if (life.id === 11) return remembered ? 'О, это снова ты! Пойдём смотреть карпов?' : 'Привет! Ты тоже гуляешь по Юйхэ?';
  if (life.id === 1) return remembered ? 'О, родное лицо. Заходи на чай, если будет время.' : 'Добро пожаловать в Юйхэ, милый человек.';
  if (life.post && life.post.cook) return remembered ? 'Снова голодный? Садись, лапша ещё горячая.' : 'Лапша сегодня удалась, путник. Заходи.';
  if (periodOf(hour) === 'night') return remembered ? 'Поздновато. Фонари горят, а я уже собираюсь домой.' : 'Доброй ночи, путник. Смотри под ноги — мостки тёмные.';
  if (periodOf(hour) === 'morning') return remembered ? 'С добрым утром ещё раз. Рано ты сегодня.' : 'С добрым утром, путник.';
  return remembered ? 'Мы уже виделись. Рад, что ты ещё в городе.' : 'Добро пожаловать в Юйхэ, путник.';
}

export function greetOther(a, b) {
  if (a.id === 20 || b.id === 20) return 'Аминь. Мир вам.';
  if (a.id === 11 || b.id === 11) return 'Привет! Куда бежишь?';
  return 'Здравствуй. Хорошего дня.';
}
