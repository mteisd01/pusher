# エンドゲーム調査: ショップ全買い後も続く達成感とドパり

調査日: 2026-11-10 / 対象: ブラウザ3Dメダルプッシャー（落とす位置だけ選ぶ操作）

## 0. 調査の限界（先に明記）
- Konami公式（Grand Cross / Anima Lotta）の演出ルール詳細は、公式ページが画像主体で本文が取れず**未検証**。確認できたのは名称レベルのみ。
- Sega Spinfever / Star Horse 系の進行型JP仕様は信頼できる一次情報が見つからず**未検証**。
- パチンコの天井（一定回転で当確）は今回の検索で記述が得られず**未検証**。
- ソシャゲの確率・信頼度などの数値は攻略サイト・コミュニティ由来で公式でない。特定機種の具体数値は引用しない。以下のチューニング値は**このゲーム用の提案値**であり、実在ゲームの値ではない。

## 1. 確認できた事実（出典付き）
| 事実 | 出典 |
|---|---|
| Grand Cross公式に「JACKPOT CHANCE」「GRAND JACKPOT CHANCE」「GRAND SLOT」「リーチ」等の項目がある（段階的なJP名称）。内容は未取得 | https://www.konami.com/arcadegames/medal/grandcross/play_3.html |
| Grand Cross Chronicle 設置店は最大32人同時プレイ | https://gamesradar.com/plus-alpha-feel-it-one-drop |
| Fortune Trinity(Konami)は着地でJACKPOT CHANCE、中央ユニットでJP抽選。TYRANNO版は倍率抽選後に2回目の抽選 | https://www.haveagood-holiday.com/en/articles/fortune-trinity-jurassic-treasure-launch |
| Anima Lottaは抽選球(ルーレット)型。クエスト、Stars通貨、ガチャチケット、Animaマップを持つ。2026年で15周年 | https://haveagood-holiday.com/en/articles/anima-lotta-series-15th-anniversary |
| Anima系の一作が「Wonderful Jackpot Chance」「Miracle Roulette」を導入（ファンWiki、要注意） | https://konami.fandom.com/wiki/Anima_Lotta:_Anima_to_Hoshi_no_Monogatari |
| プッシャーは複数台を連結して「10万枚超のメガJP」を作る例がある。メダルは現金に戻せず再プレイか景品交換のみ | https://en.wikipedia.org/wiki/Medal_game |
| 保留変化は先読み予告の一種で、色・柄・形・点滅で後の当たりの熱さを予告。信頼度は機種別（攻略サイト推定） | https://nana-press.com/post/1590655 |
| 確変=確率変動、STは回数で終わる確変（継続上限あり） | 同上 |
| 増分ゲーのプレステージ: 通貨は最大/生涯/リセット後の収益等から計算。AdVenture Capitalistは生涯収益の平方根、Cookie Clickerは立方根、Egg, Inc.は0.14乗。進行は「でこぼこ」にし、マイルストーンで購入の爆発を作る | https://gamedeveloper.com/design/the-math-of-idle-games-part-iii |
| 開発者ブログ: 最初のプレステージは早く、報酬は逓減、乗算は積み上げ。「痛みが無いと転生に意味が無い」（逸話・非学術） | https://dev.to/tanishpaul1106/aura-data-and-prestige-designing-the-economy-of-doomscroll-2077-293f |
| Coin Master: 村を完成させ次の村へ。ブーストイベント、トーナメント、襲撃/シールドによる損失回避。プレイ内容は初日から大差ない（解説記事、品質ばらつきあり） | https://www.pocketgamer.biz/why-are-people-still-playing-coin-master , https://blog.udonis.co/mobile-marketing/mobile-games/coin-master-monetization |
| ガチャの天井: ハード(固定回数で確定)とソフト(確率が漸増)。悪運の上限を切る。閾値数値はコミュニティ推定。モンテカルロ検証が推奨 | https://dotgg.gg/how-gacha-pity-systems-actually-work-soft-pity-hard-pity-and-the-50-50/ , https://gamedev.net/news/3360-stop-bad-rng-build-a-pity-system/ |
| 可変比率強化(Skinner 1953)。ニアミス効果はPisklak 2020で**再現に失敗**。一方、当たり可能性の期待(EEG)は支持される | https://pubmed.ncbi.nlm.nih.gov/31522339/ , https://www.ualberta.ca/en/folio/2019/09/near-misses-on-slot-machines-may-not-encourage-continued-gambling-study.html |

設計への含意: 「ニアミスで続けさせる」より「期待(予兆)を段階的に見せる」方が根拠が強い。予告演出を中心に据える。

---

## 2. メカニクス別の整理

### M1. 無限スケールの強化（マスタリー）
- 何か: 有限の12強化とは別に、上限なし・コスト指数増加の強化を1〜3系統置く（出玉の基礎倍率、JP積立率、レア配当など）。
- 心理: 常に「あと少しで次」が残る。10/25/50段などのマイルストーンで効果を跳ねさせ、購入の爆発を作る（Game Developer記事）。
- 実例: 増分ゲー各種の指数コスト（上記記事）。
- 本作への適用: ショップ全買い後に解放。効果は「メダルが増える」より「大当たりの質が上がる」側に振る。落とすだけの操作と相性が良い。
- リスク: 複利で経済が暴走し、配当が膨らんで価値が崩壊する。
- チューニング(提案): コストは1段ごとに約1.15〜1.3倍、効果は加算または逓減(平方根)にしてコスト成長を効果成長より速くする。乗算はマイルストーンのみ（例: x1.5）。

### M2. 任意の転生（プレステージ）と永続ボーナス
- 何か: 条件を満たすと店を畳んで「新装開店」。コインと強化段階をリセットし、勲章を得て恒久ボーナスに使う。
- 心理: 低い所から再び伸びる快感。最初の転生は早く、以降は逓減（dev.to、Game Developer）。
- 実例: Cookie Clicker（生涯収益の立方根）、Egg, Inc.（0.14乗）。
- 適用: レベル・実績・ジェム・スキン・称号は維持。コインと強化段階だけリセット。
- リスク: 12強化の買い直しが作業化する。コレクション喪失は反発を招く。
- 提案: 転生後の再購入が初回の約1/3の時間で済むよう係数を置く。勲章は 生涯収益^0.4〜0.5 程度で逓減。完全に任意。

### M3. 進行型ジャックポット＋段階JP
- 何か: 投入メダルの一部が常にJPプールへ積み上がり、小/中/大/GRANDの階層を持つ。
- 心理: 金額が見えて増えるので期待が常に生き、大きいほど当たりの価値が上がる。
- 実例: Grand CrossのJACKPOT CHANCE/GRAND JACKPOT CHANCE（詳細未検証）、Fortune Trinityの二段抽選、連結メガJP（Wikipedia）。
- 適用: 既存のJPボールと3段クルーンの上に総合プールを置き、取得時にベース額へリセット。画面上部に常時表示。
- リスク: 一括当選でコインが急膨張。長期間当たらず不満。
- 提案: 積立率は投入の2〜5%、ベース額と上限額を設ける。当選確率は積立額に応じ緩やかに上昇（M5と併用）。

### M4. ST型ラッシュ＋連チャン
- 何か: 大当たり後、一定回数のドロップの間だけ当たり確率・配当が上がる。再当たりで延長。
- 心理: 「今は熱い」状態の没入と連続で来るドパり。STは終わりが見えるので安心して追える。
- 実例: パチンコの確変/ST（nana-press）。
- 適用: JP等の取得で突入。10〜30投のSTで抽選率UPと演出変化。操作は変わらず落とすだけ。
- リスク: 期待連鎖数が無限になるとコインが爆発。短すぎると地味。
- 提案: 平均の連鎖が2〜3回になる継続率にし、継続率に上限（80%台）。ラッシュ中の倍率に上限。内部のソフトキャップ。

### M5. 天井（ピティ）カウンター
- 何か: JP/大当たりが出ないまま一定回数続くと当確、または手前から確率が漸増。
- 心理: 悪運の上限を切り、挫折を防ぐ。「ここまで来れば熱い」という目標にもなる。
- 実例: ガチャの天井（ソフト/ハード）。パチンコの天井は未検証。
- 適用: 隠しゲージ「ご無沙汰ゲージ」を画面端に薄く表示。満タン近くで予告が濃くなる。
- リスク: 満タンまで待つだけの放置化。
- 提案: ハード天井は平均当選間隔の約2〜3倍、ソフト天井の開始はその半分付近。シミュレーションで95/99%点と最長ドライ期間を確認。

### M6. 予告演出ラダー（保留変化/先読み）
- 何か: 当たり前に色・形・音が段階的に熱くなる（白→青→赤→金）。外れることもある。
- 心理: 期待の時間そのものが快感。ニアミス効果の根拠は弱い一方、期待の神経反応は支持されるため、「外れ」より「段階が上がる過程」を重視する。
- 実例: 保留変化（nana-press）。
- 適用: JPボール落下前、スロットのリーチ、カメラ寄り、BGM変化。段階ごとに内部の信頼度を定義。
- リスク: ガセが多いと白ける。
- 提案: 最終段階(金)は当確、中間段階の的中は30〜60%を目安、ガセは全予告の3〜5割以内。

### M7. 演出エスカレーションと当たりの階層比
- 何か: 配当の大きさで画面揺れ、スロー、コイン雨、専用BGM、カウントアップを5段階（通常/小/中/大/超）に分ける。
- 心理: 小当たりが頻繁で大当たりが稀、という落差が可変比率の緊張を保つ。
- 適用: 累積獲得枚数の閾値で段階を決定。超大当たりは固有カットイン。
- リスク: 演出過多でテンポ悪化、慣れて飽きる。
- 提案: 超大当たりの演出は最長10〜15秒でスキップ可、小当たりは1秒以内。頻度は桁違いに（小:中:大:超 おおむね 1000:100:10:1）。

### M8. 週替わりチャレンジ＋無限シーズントラック（非課金）
- 何か: 週替わり目標と累積ポイント。報酬は見た目・称号・短時間ブースト。最終ティア以降は繰り返し報酬で無限化。
- 心理: 目標が常に提示され、小さな達成が連続する。
- 実例: Anima Lottaのクエスト/Stars/ガチャチケット、Coin Masterのイベント。
- 適用: 現在のデイリーミッションの拡張。日付はローカル時計で判定（オフライン）。
- リスク: 毎日やらないと損という義務感。
- 提案: 未達成でも累積は消えず、進捗は繰り越し。週単位の完了条件を緩く。

### M9. コレクション拡張＋コインガチャ（天井付き）
- 何か: 24ジェム完成後も、レアリティ付きの新コレクション（宝飾品、メダル柄、背景）をコインのガチャまたは交換所で入手。重複は「かけら」に変換。
- 心理: 収集完成欲。コインの恒常的な使い道。Anima Lottaのガチャショップ/マップが同種。
- リスク: 運だけだと不満。回転数稼ぎの作業化。
- 提案: 10連でレア以上確定、ソフト/ハード天井付き、排出率を常時表示。コストは固定額でレベルに連動して改定。

### M10. エクストリームボス（コインを賭ける挑戦）
- 何か: 既存6段階のボスに上位段階を足し、入場料としてコインを支払う。報酬は称号と高倍率JP。
- 心理: コインを賭けるリスクがショップ後のコインに意味を与える。
- リスク: 負け続けると挫折。
- 提案: 失敗時に入場料の半分程度を返還。目標勝率は30〜60%。

### M11. オフライン収益（任意）
- 何か: 閉じている間に少量のメダルが貯まる（上限付き）。
- 評価: 再訪動機にはなるが、ドパり感は乏しい。優先度は低い。上限は数時間分。

---

## 3. 優先度ランキング（本作向け Top 10）
基準: 落とす操作のみで成立 / ショップ後もコインに意味 / ドパり / 数百時間の長期性 / 実装コスト。

| 順位 | 機能 | 理由 |
|---|---|---|
| 1 | M4 ST型ラッシュ＋連チャン | 操作不変で最もドパりを作る。既存JP/クルーンに連結しやすい。 |
| 2 | M1 無限強化（マスタリー） | コインの恒常シンク。実装が単純で長期の土台。 |
| 3 | M3 進行型JP＋段階JP | 常時見える期待。コインを積む理由になる。 |
| 4 | M2 任意転生 | 長期性の主軸。経済暴走の最大の安全弁（リセット）。 |
| 5 | M6 予告演出ラダー | 期待の質を上げる。低コストで既存演出に被せられる。 |
| 6 | M5 天井カウンター | 挫折防止。M3/M4と併用で安定。 |
| 7 | M7 演出エスカレーション | ドパりの体感を増幅。演出中心の実装。 |
| 8 | M9 コレクション＋天井付きガチャ | コインシンクと収集欲。 |
| 9 | M8 週替わり/シーズントラック | 日々の目標。オフライン日付で成立。 |
| 10 | M10 エクストリームボス | リスクを取る選択。 |

推奨の導入順: M7とM6（演出）→ M3 → M4（ドパり本体）→ M1 → M5 → M2（長期）→ M9/M8/M10。

## 4. 経済暴走・不満を防ぐ共通ルール（提案）
1. シンクとソースの比: 永続シンク（M1/M9/M10）が獲得の大部分を吸収するよう、レベル連動でコストを上げる。
2. 乗算は少数に集約: 乗算は積算で効くため、永続倍率は転生と無限強化のみ、他は加算にする。
3. ソフトキャップ: 連鎖と倍率に内部上限を置き、超過分は逓減。
4. シミュレーション: 天井・ST・JPは数百万回のモンテカルロで平均、95/99%点、最長ドライ期間を確認（dotgg / gamedev.net の推奨）。
5. 期待の見せ方: 外れ演出より「段階が上がる」演出を重視（ニアミス効果の根拠が弱いため）。
6. 挫折対策: 天井、損失の一部返還、未達成でも進捗が消えない設計。
7. ペースは「でこぼこ」に: 速い区間と遅い区間を混ぜる（Game Developer）。

## 5. 要確認・未検証事項
- Grand Cross / Anima Lotta / Fortune Trinity のJP抽選の具体的な確率・段階構造（公式は画像のみ）。
- Spinfever、Star Horse 系の進行型JP仕様。
- パチンコの天井の実装と数値。
- Coin Master等のリテンション数値の一次情報。
- 本書の提案値（比率、確率、秒数）はすべて設計案であり、実在ゲームの値ではない。

## 6. 出典一覧
- https://www.konami.com/arcadegames/medal/grandcross/play_3.html
- https://gamesradar.com/plus-alpha-feel-it-one-drop
- https://www.haveagood-holiday.com/en/articles/fortune-trinity-jurassic-treasure-launch
- https://haveagood-holiday.com/en/articles/anima-lotta-series-15th-anniversary
- https://konami.fandom.com/wiki/Anima_Lotta:_Anima_to_Hoshi_no_Monogatari
- https://en.wikipedia.org/wiki/Medal_game
- https://nana-press.com/post/1590655
- https://gamedeveloper.com/design/the-math-of-idle-games-part-iii
- https://dev.to/tanishpaul1106/aura-data-and-prestige-designing-the-economy-of-doomscroll-2077-293f
- https://www.pocketgamer.biz/why-are-people-still-playing-coin-master
- https://blog.udonis.co/mobile-marketing/mobile-games/coin-master-monetization
- https://dotgg.gg/how-gacha-pity-systems-actually-work-soft-pity-hard-pity-and-the-50-50/
- https://gamedev.net/news/3360-stop-bad-rng-build-a-pity-system/
- https://pubmed.ncbi.nlm.nih.gov/31522339/
- https://www.ualberta.ca/en/folio/2019/09/near-misses-on-slot-machines-may-not-encourage-continued-gambling-study.html
