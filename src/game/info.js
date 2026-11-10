// What every effect, item, event and square does, in plain words. One table drives the banner
// sub-line, the first-time explanation card and the Guide tab, so they never disagree.
// Each entry: cat (guide section), icon, ja: [name, description], en: [name, description].
// Descriptions may use {0} (filled in by the caller, e.g. a duration in seconds).
import { getLang } from '../i18n.js';

export const INFO_CATS = ['basic', 'item', 'event', 'wheel', 'road', 'jp', 'boss', 'device', 'rush', 'endgame'];
export const INFO_CAT_NAME = {
  ja: { basic: '基本', item: 'アイテム（手前に落とすと発動）', event: 'ランダムイベント', wheel: 'ラッキーホイール', road: 'ラッキーロード（すごろく）', jp: 'ジャックポット', boss: 'ボス戦', device: '台の仕掛け', rush: 'ビンゴ・RUSH', endgame: 'やりこみ' },
  en: { basic: 'Basics', item: 'Items (activate when pushed off the front)', event: 'Random events', wheel: 'Lucky wheel', road: 'Lucky Road (board game)', jp: 'Jackpot', boss: 'Boss battles', device: 'Table devices', rush: 'Bingo & RUSH', endgame: 'Long-term goals' },
};

export const INFO = {
  // ---- basics
  gate: { cat: 'basic', icon: '🚪', ja: ['光のゲート', '動く光のゲートをメダルが通ると、スロットの保留が1つ増える。保留が満タンのときはJPが少し増える。'], en: ['Light gate', 'A medal passing the moving light gate adds one slot stock. With full stock the JP pool grows a little instead.'] },
  stock: { cat: 'basic', icon: '🎰', ja: ['保留', 'スロットを回せる回数。色が変わると当たりやすい（白＜青＜金＜虹）。'], en: ['Stock', 'Slot spins in reserve. Its colour shows the odds (white < blue < gold < rainbow).'] },
  combo: { cat: 'basic', icon: '⛓', ja: ['プッシュコンボ', '1回の押し出しでたくさん落ちるとボーナス。'], en: ['Push combo', 'Many medals falling in a single push pay a bonus.'] },
  pocket: { cat: 'basic', icon: '🕳', ja: ['中央ポケット', '時々開く盤面中央の穴。入ると保留・サイコロ・アイテムなどが出る。'], en: ['Center pocket', 'A hole in the middle of the field that opens now and then. Medals falling in give stock, dice or items.'] },
  bonusZone: { cat: 'basic', icon: '🟩', ja: ['ボーナスゾーン', '手前の縁を動く緑の光。そこから落ちた金・虹・ビッグは2倍、時々保留+1。'], en: ['Bonus zone', 'The green light moving along the front edge. Gold / rainbow / big medals falling there pay ×2, sometimes +1 stock.'] },
  outZone: { cat: 'basic', icon: '⛔', ja: ['OUTゾーン', '「むずかしい」以上で手前の縁の両端にある赤い区画。そこから落ちたメダルはロスト。'], en: ['OUT zone', 'From Hard up, the red ends of the front edge. Medals falling there are lost.'] },
  timeStop: { cat: 'basic', icon: '⏸', ja: ['時間停止', 'クレーンやプリンコなど台の装置を操作している間は、フィーバーなどの残り時間が減らない。'], en: ['Time stop', 'While you operate a device (crane, plinko…) the timers of fever and other effects do not run.'] },
  hold: { cat: 'basic', icon: '🎟', ja: ['チャンス保留', 'フィーバーなど時間制限のある効果の間は、操作の要るチャンス（クレーン・プリンコ）を保留し、終わってから始める。'], en: ['Chance on hold', 'During fever and other timed boosts, chances you have to operate (crane, plinko) wait until the boost ends.'] },
  // ---- items / tokens
  tok_wall: { cat: 'item', icon: '🛡', ja: ['ガード壁', '左右の溝に壁が立ち、メダルが落ちなくなる。{0}秒。'], en: ['Guard walls', 'Walls close the side gutters so no medal is lost there. {0}s.'] },
  tok_shower: { cat: 'item', icon: '💧', ja: ['コインシャワー', 'ホッパーから銀メダル25枚が台に注がれる。'], en: ['Coin shower', 'The hopper pours 25 silver medals onto the table.'] },
  tok_turbo: { cat: 'item', icon: '≫', ja: ['ターボ', 'プッシャーが速く動き、押し出しが増える。{0}秒。'], en: ['Turbo', 'The pusher moves faster and pushes more medals off. {0}s.'] },
  tok_double: { cat: 'item', icon: '×2', ja: ['獲得2倍', '手前から落ちたメダルの価値が2倍。{0}秒。'], en: ['Double', 'Medals falling off the front are worth double. {0}s.'] },
  tok_fever: { cat: 'item', icon: '🔥', ja: ['フィーバー', 'ゲートが広がり、スロットが当たりやすく、金メダルが混ざる。{0}秒。'], en: ['Fever', 'Wider gate, better slot odds and gold medals in your drops. {0}s.'] },
  tok_stock: { cat: 'item', icon: '🎰', ja: ['保留MAX', 'スロットの保留が満タンになる。'], en: ['Stock MAX', 'Fills the slot stock.'] },
  tok_plinko: { cat: 'item', icon: '📍', ja: ['プリンコ', 'ピン盤が降りてくる。落とす位置を選んでタップ。端の受け口はJPボール。'], en: ['Plinko', 'A pin board swings down: aim and tap. The outer pockets give a JP ball.'] },
  tok_dice: { cat: 'item', icon: '🎲', ja: ['サイコロ+2', 'ラッキーロードを2回進める。'], en: ['Dice +2', 'Two moves on the Lucky Road.'] },
  tok_magnet: { cat: 'item', icon: '🧲', ja: ['マグネット', '溝際のメダルが中央へ引き寄せられる。{0}秒。'], en: ['Magnet', 'Medals near the gutters are pulled to the middle. {0}s.'] },
  tok_bomb: { cat: 'item', icon: '💣', ja: ['ボム', 'フィールドで爆発し、メダルの山を崩して手前へ押し出す。'], en: ['Bomb', 'Explodes on the field and blasts the pile towards the edge.'] },
  tok_shake: { cat: 'item', icon: '🌋', ja: ['シェイク', '台全体が揺れて、縁のメダルが落ちる。'], en: ['Shake', 'The whole table shakes medals off the edge.'] },
  tok_crane: { cat: 'item', icon: '🏗', ja: ['クレーンチャンス', '左右を合わせてタップ。つかんだ物は景品シュートへ運ばれ、そのまま2倍で払い出される。光るカプセルは確定アイテム。'], en: ['Crane chance', 'Aim left/right and tap. What the claw grabs goes down the prize chute and pays ×2. Glowing capsules hold a sure item.'] },
  tok_flipper: { cat: 'item', icon: '🏓', ja: ['フリッパー', '左右の溝の入口のフリッパーが連打し、溝に落ちそうなメダルを中央へ弾き返す。{0}秒。'], en: ['Flippers', 'The flippers at both gutters flap and knock medals back to the middle. {0}s.'] },
  it_gem: { cat: 'item', icon: '💎', ja: ['宝石', '図鑑に登録。新しい宝石ほどコインが多い。種類がそろうとボーナス。'], en: ['Gem', 'Added to the gem book. New ones pay more; a full set pays a bonus.'] },
  it_chest: { cat: 'item', icon: '🧰', ja: ['宝箱', 'コイン・宝石・アイテムのどれか。'], en: ['Chest', 'Coins, a gem or an item.'] },
  it_big: { cat: 'item', icon: '🪙', ja: ['ビッグメダル', '30枚分。中央寄りに落ちてくる。'], en: ['Big medal', 'Worth 30. It drops a little off centre.'] },
  it_capsule: { cat: 'item', icon: '💊', ja: ['景品カプセル', 'クレーンでつかむと確定アイテム（JPボール・フィーバー・サイコロなど）。'], en: ['Prize capsule', 'Grab it with the crane for a sure item (JP ball, fever, dice…).'] },
  // ---- events
  ev_goldRush: { cat: 'event', icon: '🥇', ja: ['ゴールドラッシュ', '投入するメダルの半分が金メダル（5枚分）になる。{0}秒。'], en: ['Gold rush', 'Half of your drops are gold medals (worth 5). {0}s.'] },
  ev_meteor: { cat: 'event', icon: '☄', ja: ['メテオシャワー', '銀20枚・金3枚・ビッグ1枚が降ってくる。'], en: ['Meteor shower', '20 silver, 3 gold and 1 big medal rain down.'] },
  ev_giant: { cat: 'event', icon: '🌕', ja: ['ジャイアントメダル', '50枚分の巨大メダルが落ちてきて山を崩す。'], en: ['Giant medal', 'A huge medal worth 50 crashes onto the pile.'] },
  ev_hyper: { cat: 'event', icon: '⚡', ja: ['ハイパープッシャー', 'プッシャーが長く速く動く。{0}秒。'], en: ['Hyper pusher', 'The pusher strokes longer and faster. {0}s.'] },
  ev_luckyGate: { cat: 'event', icon: '🚪', ja: ['ラッキーゲート', 'ゲートが2.6倍に広がる。{0}秒。'], en: ['Lucky gate', 'The gate is 2.6× wider. {0}s.'] },
  ev_challenge: { cat: 'event', icon: '⏱', ja: ['タイムチャレンジ', '時間内に目標枚数を獲得するとコインとアイテム。{0}秒。'], en: ['Time challenge', 'Win the target number of coins in time for coins and an item. {0}s.'] },
  ev_tower: { cat: 'event', icon: '🗼', ja: ['メダルタワー', '積み上げたメダルの塔が棚に2本置かれ、押されて崩れる。'], en: ['Medal tower', 'Two stacked towers land on the shelf and topple forward.'] },
  ev_quake: { cat: 'event', icon: '🌋', ja: ['大地震', '台が3回大きく揺れる。'], en: ['Earthquake', 'The table shakes hard three times.'] },
  ev_crane: { cat: 'event', icon: '🏗', ja: ['クレーンチャンス', 'クレーンが動く。つかんだ物は2倍で払い出し。'], en: ['Crane chance', 'Play the crane; what it grabs pays ×2.'] },
  ev_spinField: { cat: 'event', icon: '🌀', ja: ['スピンフィールド', '左右の回転盤が回り、メダルを中央へ寄せる。{0}秒。'], en: ['Spin field', 'The turntables spin and sweep medals inward. {0}s.'] },
  ev_rock: { cat: 'event', icon: '🪨', ja: ['落石', '重い岩が落ちてくる（修羅・地獄）。押し出すと3枚、ボス戦中は大ダメージ。'], en: ['Falling rock', 'A heavy rock lands (Carnage / Inferno). Pushing it off pays 3 and hits a boss hard.'] },
  // ---- wheel
  wh_coins: { cat: 'wheel', icon: '🪙', ja: ['コイン', '表示の枚数がホッパーから注がれる。'], en: ['Coins', 'The shown number of medals is poured from the hopper.'] },
  wh_item: { cat: 'wheel', icon: '🎁', ja: ['アイテム', 'ランダムなアイテムが棚に出る。'], en: ['Item', 'A random item lands on the shelf.'] },
  wh_tower: { cat: 'wheel', icon: '🗼', ja: ['タワー', 'メダルタワーが1本置かれる。'], en: ['Tower', 'One medal tower lands on the shelf.'] },
  wh_double: { cat: 'wheel', icon: '×2', ja: ['×2', '獲得2倍が{0}秒。'], en: ['×2', 'Double payout for {0}s.'] },
  wh_ball: { cat: 'wheel', icon: '⚽', ja: ['JPボール', 'JPボールがコースターから出てくる。'], en: ['JP ball', 'A JP ball rides in over the coaster.'] },
  // ---- road
  rd_coin: { cat: 'road', icon: '🪙', ja: ['コイン', '表示の枚数をすぐ獲得（周回で増える）。'], en: ['Coins', 'Paid at once (grows with laps).'] },
  rd_shower: { cat: 'road', icon: '💧', ja: ['シャワー', '表示の枚数が台に注がれる。'], en: ['Shower', 'Poured onto the table.'] },
  rd_back: { cat: 'road', icon: '◀', ja: ['もどる', '表示のマス数だけ戻る。'], en: ['Back', 'Move back that many squares.'] },
  rd_again: { cat: 'road', icon: '🔁', ja: ['もう一回', 'サイコロ+1。'], en: ['Again', 'One more die.'] },
  rd_stock: { cat: 'road', icon: '🎰', ja: ['保留MAX', 'スロットの保留が満タン。'], en: ['Stock MAX', 'Fills the slot stock.'] },
  rd_event: { cat: 'road', icon: '🚨', ja: ['イベント', 'ランダムイベントがすぐ始まる。'], en: ['Event', 'A random event starts now.'] },
  rd_goal: { cat: 'road', icon: '🏁', ja: ['ゴール', '大量のコイン＋JPボール＋ボスゲージ。'], en: ['Goal', 'Big payout + JP ball + boss gauge.'] },
  rd_lap: { cat: 'road', icon: '🏆', ja: ['1周ボーナス', '周回ごとにボーナス。周回が増えるほどマスの報酬も上がる。'], en: ['Lap bonus', 'A bonus every lap; square rewards grow with laps.'] },
  // ---- jackpot
  jpBall: { cat: 'jp', icon: '⚽', ja: ['JPボール', 'コースターを走って分岐器へ。手前に押し出すとクルーンでJP抽選。'], en: ['JP ball', 'Runs the coaster to the switch. Push it off the front for the croon JP lottery.'] },
  route_field: { cat: 'jp', icon: '🔵', ja: ['分岐：フィールド', '台の中央寄りに落ちる。押し出せばクルーン1段目から抽選。'], en: ['Switch: field', 'Drops near the middle of the table. Push it off for the croon from stage 1.'] },
  route_super: { cat: 'jp', icon: '🟣', ja: ['分岐：スーパー', 'クルーンに直行し、2段目から始まる（JPの確率が約2倍）。'], en: ['Switch: super', 'Goes straight to the croon and starts at stage 2 (about 2× the JP odds).'] },
  route_premium: { cat: 'jp', icon: '🟡', ja: ['分岐：プレミアム', 'クルーンに直行し、最終段から始まる（JPの確率が約8倍）。'], en: ['Switch: premium', 'Goes straight to the croon and starts at the final stage (about 8× the JP odds).'] },
  jp_mini: { cat: 'jp', icon: '🔹', ja: ['MINI JACKPOT', '4段階JPのいちばん下。よく当たる。'], en: ['MINI jackpot', 'The lowest of the four jackpots; hits often.'] },
  jp_minor: { cat: 'jp', icon: '🟢', ja: ['MINOR JACKPOT', '4段階JPの2番目。'], en: ['MINOR jackpot', 'The second of the four jackpots.'] },
  jp_major: { cat: 'jp', icon: '🟡', ja: ['MAJOR JACKPOT', '従来のJP。投入でよく伸びる。'], en: ['MAJOR jackpot', 'The classic jackpot; grows fast with every drop.'] },
  jp_grand: { cat: 'jp', icon: '🌈', ja: ['GRAND JACKPOT', 'めったに当たらない最上位のJP。JP強化で当たりやすくなる。'], en: ['GRAND jackpot', 'The rare top jackpot; JP upgrades make it more likely.'] },
  jpPity: { cat: 'jp', icon: '🧱', ja: ['JP天井', 'JPが出ないほどJP穴が当たりやすくなり、{0}回外れると次は最終段から大きなJP穴で抽選。'], en: ['JP pity', 'Every miss makes the JP hole easier; after {0} misses the next lottery starts at the final stage with a big JP hole.'] },
  croon: { cat: 'jp', icon: '🎯', ja: ['3段クルーン', '回る皿を3段抜けて最終段のJP穴に入ればJP総取り。外れの穴もコインやフィーバー。'], en: ['3-stage croon', 'Through three spinning dishes into the JP hole for the whole pool. Other holes pay coins or fever.'] },
  // ---- boss
  bossGauge: { cat: 'boss', icon: '👹', ja: ['ボスゲージ', '投入とゲート通過で貯まり、満タンでボス出現。'], en: ['Boss gauge', 'Fills with drops and gate passes; when full a boss appears.'] },
  bossWeak: { cat: 'boss', icon: '💚', ja: ['弱点チャンス', 'コアが緑の間、ゲート通過が5倍のクリティカル。'], en: ['Weak point', 'While the core glows green, gate passes deal ×5 critical damage.'] },
  bossBarrier: { cat: 'boss', icon: '🔮', ja: ['バリア', '弱点・岩・ビーム破壊のダメージしか通らない（地獄）。'], en: ['Barrier', 'Only weak-point hits, rocks and beam breaks get through (Inferno).'] },
  bossEnrage: { cat: 'boss', icon: '💢', ja: ['怒り', 'HP3割以下で攻撃が速くなる（達人〜）。'], en: ['Enraged', 'Below 30% HP the boss attacks faster (Expert+).'] },
  bwarn_rock: { cat: 'boss', icon: '⚠', ja: ['予告：岩石投げ', 'まもなく棚に岩が投げ込まれる。押し出せば大ダメージの反撃。'], en: ['Warning: rock throw', 'Rocks will land on the shelf. Push them off to counter for big damage.'] },
  bwarn_jam: { cat: 'boss', icon: '⚠', ja: ['予告：ゲート封鎖', 'まもなくゲートが封鎖される。今のうちにゲートを狙おう。'], en: ['Warning: gate jam', 'The gate is about to be jammed — hit it now.'] },
  bwarn_drain: { cat: 'boss', icon: '⚠', ja: ['予告：メダル吸引', 'まもなくフィールドのメダルが数枚吸われる。'], en: ['Warning: medal drain', 'A few medals will be sucked off the field.'] },
  bwarn_freeze: { cat: 'boss', icon: '⚠', ja: ['予告：時間凍結', 'まもなくプッシャーが遅くなり、ガード壁が消える。'], en: ['Warning: time freeze', 'The pusher will slow down and the guard walls drop.'] },
  batk_rock: { cat: 'boss', icon: '🪨', ja: ['岩石投げ', '棚に岩が落ちた。押し出せば反撃ダメージ。'], en: ['Rock throw', 'Rocks on the shelf. Push them off to counter.'] },
  batk_jam: { cat: 'boss', icon: '🚫', ja: ['ゲート封鎖ビーム', 'ゲートが赤いビームでふさがれた。ゲートに{0}回当てると壊せる！'], en: ['Gate jam beam', 'A red beam blocks the gate. Hit it {0} times to break it!'] },
  batk_drain: { cat: 'boss', icon: '🌀', ja: ['メダル吸引', 'フィールドのメダルが数枚吸われた。'], en: ['Medal drain', 'A few medals were sucked away.'] },
  batk_freeze: { cat: 'boss', icon: '❄', ja: ['時間凍結', 'プッシャーが遅くなり、ガード壁が消える。'], en: ['Time freeze', 'The pusher slows and the guard walls drop.'] },
  beamBroken: { cat: 'boss', icon: '💥', ja: ['ビーム破壊！', '封鎖が解け、ボスが3秒スタン（攻撃も回復もしない）。ゲートもすぐ使える！'], en: ['Beam broken!', 'The jam ends and the boss is stunned for 3s (no attacks, no regeneration) — the gate is back!'] },
  // ---- bingo & rush
  checker: { cat: 'rush', icon: '🔢', ja: ['ナンバーチェッカー', '奥の壁に1〜9の番号板。ときどき1枚が点滅してから開く。開いている番号板の真下に落ちたメダルで、その番号がビンゴカードに印される。'], en: ['Number checker', 'Plates 1-9 on the back wall. Now and then one blinks and opens; a medal falling right under the open plate marks that number on the bingo card.'] },
  bingoLine: { cat: 'rush', icon: '➖', ja: ['ビンゴのライン', '縦・横・斜めがそろうと払い出し。同じカードで2本目、3本目…と増えるほど多くなる。'], en: ['Bingo line', 'A row, column or diagonal pays; each further line on the same card pays more.'] },
  bingo: { cat: 'rush', icon: '🎉', ja: ['BINGO', '9マス全部でBINGO。大量払い出し＋クルーン2段目からのJP抽選。カードを重ねるほど報酬が上がる。'], en: ['BINGO', 'All nine numbers: a big payout and a JP lottery from croon stage 2. Rewards grow with every card.'] },
  rush: { cat: 'rush', icon: '🔥', ja: ['RUSH（連チャン）', 'JPの後と777の半分で突入し、スロットが{0}回タダで高速回転。その間に777が出ると回数が戻り連チャン、続くほどボーナス増。'], en: ['RUSH', 'After a jackpot (and half of the 777s) the slot spins {0} times for free. Another 777 refills it — the chain bonus grows.'] },
  stockColor: { cat: 'rush', icon: '🌈', ja: ['保留の色', '保留は入った時点で結果が決まり、色で期待度が分かる。白＜青＜金＜虹（虹は大当たり確定）。'], en: ['Stock colours', 'Each stock decides its result when gained; the colour shows the odds: white < blue < gold < rainbow (rainbow = big win).'] },
  // ---- long-term goals
  mastery: { cat: 'endgame', icon: '📈', ja: ['マスタリー', '「やりこみ」タブ。上限なしの強化で、払い出し・スロット・JP・フィーバー・ゲートが少しずつ伸びる。'], en: ['Mastery', 'Goals tab: endless upgrades for payout, slot odds, JP growth, fever and gate width.'] },
  rebirthInfo: { cat: 'endgame', icon: '★', ja: ['転生', '任意。進行を戻す代わりに★を得て、ずっと残る★強化を買う。'], en: ['Rebirth', 'Optional: start the run over for ★ and buy permanent star perks.'] },
  gachaInfo: { cat: 'endgame', icon: '💊', ja: ['カプセル', 'コインでチャームを引く。チャームはずっと効く小さな効果で、重ねるとレベルアップ。SSRは天井あり。'], en: ['Capsules', 'Pull charms with coins: small permanent bonuses that level up with duplicates. SSR has a pity counter.'] },
  bigWin: { cat: 'endgame', icon: '💥', ja: ['BIG / MEGA / EPIC WIN', 'RUSH・JP・ビンゴの合計が大きいほど演出が一段ずつ派手になる（100 / 300 / 1000枚〜）。'], en: ['BIG / MEGA / EPIC WIN', 'The bigger a RUSH, jackpot or bingo total, the bigger the celebration (100 / 300 / 1000+).'] },
  // ---- devices
  crane: { cat: 'device', icon: '🏗', ja: ['クレーン', '左右を合わせてタップ。つかんだ物は景品シュートで2倍払い出し。光るカプセルは確定アイテム。'], en: ['Crane', 'Aim and tap. Grabbed medals go down the prize chute for ×2. Glowing capsules hold a sure item.'] },
  wheel: { cat: 'device', icon: '🎡', ja: ['キャッチャーとホイール', '棚の上を動くカップにメダルを入れると、12枚でホイールが回る。'], en: ['Catcher & wheel', 'Land medals in the cup moving over the shelf; 12 catches spin the wheel.'] },
  flipper: { cat: 'device', icon: '🏓', ja: ['サイドフリッパー', '溝の入口でメダルを中央へ弾き返す。フリッパーアイテムとフィーバー中に連打。救った枚数は「SAVE」で表示。'], en: ['Side flippers', 'Knock medals back from the gutters. They flap with the flipper item and in fever; saved medals show as SAVE.'] },
  turntable: { cat: 'device', icon: '🌀', ja: ['回転盤', 'フィーバーとスピンフィールド中に回り、メダルを寄せる。'], en: ['Turntables', 'Spin in fever and Spin Field and sweep medals inward.'] },
  kicker: { cat: 'device', icon: '👊', ja: ['ボールキッカー', '棚に長く留まったJPボールを奥から押し出す。'], en: ['Ball kicker', 'Pushes a JP ball that sat on the shelf too long.'] },
};

export function infoText(id, ...args) {
  const e = INFO[id];
  if (!e) return null;
  const pair = e[getLang() === 'en' ? 'en' : 'ja'] || e.ja;
  let desc = pair[1];
  args.forEach((a, i) => { desc = desc.replace(`{${i}}`, a); });
  return { name: pair[0], desc, icon: e.icon, cat: e.cat };
}

// id of the token info entry for a TOKEN index
export const TOKEN_INFO = ['tok_wall', 'tok_shower', 'tok_turbo', 'tok_double', 'tok_fever', 'tok_stock', 'tok_plinko', 'tok_dice', 'tok_magnet', 'tok_bomb', 'tok_shake', 'tok_crane', 'tok_flipper'];
