# best-lights-selector 仕様書

PC に常駐する仮想の Matter 照明デバイス。Home アプリからは 1 つの「ライト」に見え、ON/OFF の命令を受けると、現在の時刻に応じて SwitchBot Cloud API で実際のライトを切り替える。Bun + TypeScript(Matter は matter.js)。単体実行ファイルとして配る。

この文書は動作の決まり(コードの正)。変えたら同じ PR でこの文書も直す。

## 構成

| 場所 | 役割 |
|---|---|
| `src/index.ts` | コマンドの振り分け |
| `src/run.ts` | 仮想の Matter ライトの起動、Home からの命令の処理、起動時の同期、時間帯の監視 |
| `src/config.ts` | `config.toml` の読み込みと検証 |
| `src/selector.ts` | 今の時刻に使うライトの選択(`pickLight`)と、切り替わりの監視(`watchSchedule`) |
| `src/lights.ts` | 実際のライトの ON/OFF(`applyPower`)と、状態の比較(`isInSync`) |
| `src/switchbot.ts` | SwitchBot Cloud API v1.1 のクライアント |
| `src/network.ts` | ネットワークアダプタの一覧と、番号からの解決 |
| `src/list-devices.ts`, `src/list-interfaces.ts` | 一覧のコマンド |
| `build.ts` | 単体実行ファイルのビルド |
| `patches/@matter%2Fnodejs@0.17.9.patch` | matter.js の Windows 向け修正(`bun install` で適用) |

## コマンド

| コマンド | 動作 |
|---|---|
| (なし) | 仮想の Matter ライトを起動する |
| `list-devices` | SwitchBot のデバイスを一覧する(`[lights.*]` の `device_id` を調べる用) |
| `list-interfaces` | ネットワークアダプタを一覧する(`[matter].network_interface` の番号を調べる用) |
| `help` / `--help` / `-h` | 使い方を出す |

- オプション `-c` / `--config <パス>`: 設定ファイルを指定する。なければカレントディレクトリの `config.toml`。パスが無ければエラー。
- 最初の引数が `-` で始まるオプション(`help` 系を除く)なら、コマンドなし(起動)として扱う。知らないコマンドは使い方を出して終了コード 1。
- ファイルがなければ `Config file not found` で終了する。

## 設定 `config.toml`

| 項目 | 内容 |
|---|---|
| `[switchbot]` | 必須。`token`、`secret`(どちらも空でない文字列) |
| `[matter]` | `name`(既定 `Best Light`)、`port`(既定 5540、1〜65535)、`network_interface`(既定 0)、`passcode`(既定 20202021、1〜99999998)、`discriminator`(既定 3840、0〜4095)、`storage_path`(既定 `.matter-storage`)、`log_level`(`debug` / `info` / `warn` / `error`、既定 `info`) |
| `[lights.<名前>]` | 1 つ以上必須。`device_id`: 文字列、または文字列の配列(空でない)。同じ `[lights.*]` のデバイスはまとめて ON/OFF する |
| `[schedules.<N>]` | 省略可。`start`、`end`(`HH:MM`)、`light`(`[lights.*]` の名前) |
| `default_light` | 省略可。どの時間帯にも当てはまらないときのライト。空なら何も点けない。`[lights.*]` にない名前はエラー |

- 時刻は `HH:MM`(`00:00`〜`23:59`)。終わりだけ `24:00` を許す。`start` 以上 `end` 未満。`start` > `end` なら日付をまたぐ。`start` と `end` が同じならエラー。時刻はこの PC のローカル時刻。
- 時間帯が重なるときは、キーの順で先の `[schedules.*]` が勝つ。
- `network_interface`: インターフェース番号(IPv6 のゾーン ID。`list-interfaces` で調べる)。0 ならすべてのアダプタ。番号が見つからなければ、使える番号の一覧つきでエラー。指定すると mDNS の広告をそのアダプタだけにする(VPN などの仮想アダプタのアドレスを Home に渡さないため)。
- `config.toml` には認証情報が入り、ペアリング情報(`storage_path`)も機密。リポジトリに入れない(`.gitignore` で除外する)。

## 動作

### Home から

- **ON**: 今の時刻の時間帯のライトを ON にし、ほかのすべてのライトを OFF にする。
- **OFF**: すべてのライトを OFF にする。
- どの時間帯にも当てはまらず `default_light` もなければ、警告を出し、何も ON にしない(ほかのライトの OFF はする)。
- 命令は届いた順に 1 つずつ処理する。

### ライトの切り替え(`applyPower`)

- 点けるライト(ON のときは `pickLight`、OFF のときは無し)のデバイスには `turnOn` を送る。
- ほかのデバイスは、状態を読み、すでに OFF なら何もしない。ON、または状態が分からない(赤外線リモコンのライトなど)なら `turnOff` を送る。
- デバイスごとのリクエストは並列に送る。全部が終わるのを待ち、1 つでも失敗したらエラー(失敗したものはログに出す)。

### 失敗したとき

SwitchBot の操作が失敗したら、Home 側のスイッチの状態を、最後にうまくいった状態に戻す。

### 時間帯の切り替え

15 秒ごとに「今の時刻に使うライト」を調べ、前回と変わったら、Home のライトが ON のときだけ、新しいライトを ON にして、ほかを OFF にする(Home が OFF なら何もしない)。タイマーを 1 本で待たずに周期的に調べるので、PC のスリープや時計の変更があっても正しく動く。

### 起動時の同期

- まだ Home とペアリングされていなければ、何もしない(ライトはそのまま)。
- ペアリング済みなら、Home が最後に見ていた状態(matter.js が保存したもの)と実際のライトを比べる。食い違っていれば、実際のライトを Home の状態に合わせる(`applyPower`)。状態が読めないデバイスは、食い違いに数えない。

### ペアリング

起動して、まだペアリングされていなければ、コンソールに QR コードとセットアップコードを出す。Home アプリの「アクセサリを追加」で読み取る(未認証のデバイスの警告は「このまま追加」)。ペアリング情報は `storage_path` に保存する。ペアリングし直すにはこのフォルダを消す。

- デバイスの種類は OnOffLight、ベンダー ID はテスト用(`0xfff1`)。
- Home のハブ(HomePod / Apple TV)とこの PC は、mDNS が通る同じネットワークにいる必要がある。UDP 5353(mDNS)と `matter.port`(UDP)の受信を許可する。

## SwitchBot API

`https://api.switch-bot.com/v1.1`。リクエストごとに、ヘッダー `Authorization`(token)、`sign`、`t`(ミリ秒の時刻)、`nonce`(UUID)をつける。`sign` は `HMAC-SHA256(secret, token + t + nonce)` の base64。

- `GET /devices`: デバイスの一覧。
- `GET /devices/{id}/status`: 電源の状態(`power` が `on` / `off`)。読めない、または値がなければ「不明」として扱う(失敗してもエラーにしない)。
- `POST /devices/{id}/commands`: `turnOn` / `turnOff`。
- HTTP のエラー、または `statusCode` が 100 でなければエラー。タイムアウトとリトライはない。

## matter.js のパッチ

`patches/@matter%2Fnodejs@0.17.9.patch`: Windows で受信パケットのインターフェースが数字のゾーン ID で渡されるのに、matter.js が名前で探していて mDNS の問い合わせがすべて無視される問題の修正。`@matter/*` のバージョンを上げるときは、本体に取り込まれたかを確認する。

## ビルドとリリース

- `bun run build` で単体実行ファイルを作る。`BUN_TARGET` でクロスコンパイル、`BUN_OUTFILE` で出力名。Bun に `node:sqlite` がないため、使われない import を空の実装に置き換える。
- Releases の対象: Windows x86_64、macOS aarch64、Linux x86_64 / aarch64(musl)。各実行ファイルに `.sha256` と、`config.example.toml` が付く。動作確認は Windows と macOS だけ。

## セキュリティ上の注意

- `token` と `secret` は `config.toml` に平文で入る。ペアリング情報(`storage_path`)も、同じ LAN で Home の代わりに操作するのに使えるので、守る。
- 既定の `passcode` と `discriminator` は matter.js のよく知られたテスト値。ペアリング中の LAN 内の他人が参加できるので、必要なら変える。
