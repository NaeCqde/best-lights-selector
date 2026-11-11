# best-lights-selector

[English](README.en.md) | 日本語

PC に常駐する仮想の **Matter 照明デバイス**です。Home アプリから 1 つの「ライト」として見え、ON/OFF の命令を受けると、現在の時刻に応じて SwitchBot API で実際のライトを切り替えます(昼はシーリングライト、夜はスポットライト、など)。

- Home から **ON**: 現在時刻が含まれる `[schedules.*]` のライトを ON にし、それ以外のライトが点いていたら OFF にします。
- Home から **OFF**: すべてのライトを OFF にします。
- ON のまま時間帯が切り替わった場合(例: 06:00 / 18:00)、新しい時間帯のライトを ON にして、他のライトを OFF にします(15 秒ごとに判定)。
- SwitchBot の操作に失敗した場合、Home 側のスイッチ状態も元に戻します。
- 起動時、Home が最後に見ていた状態(ペアリング情報と一緒に保存)と実際のライトを比べ、食い違っていれば実際のライトを Home の状態に合わせます(初回ペアリング前は何もしません)。

## インストール

[Releases](https://github.com/NaeCqde/best-lights-selector/releases/latest) から、お使いの環境に合う実行ファイルと `config.example.toml` をダウンロードします。

| ファイル | 対象 |
|---|---|
| `best-lights-selector-Windows-x86_64.exe` | Windows (x64)(動作確認済み) |
| `best-lights-selector-macOS-aarch64` | macOS (Apple Silicon)(動作確認済み) |
| `best-lights-selector-Linux-x86_64-musl` | Linux (x64) |
| `best-lights-selector-Linux-aarch64-musl` | Linux (arm64) |
| `config.example.toml` | 設定ファイルのテンプレート |

> 動作確認は Windows と macOS で行っています。Linux 版は同じコードからビルドしていますが、動作は未確認です。

各実行ファイルには `.sha256` が付いています。単体実行ファイルなので別途インストールは不要です。macOS / Linux では `chmod +x` で実行権限を付けてください。

## セットアップ

設定はすべて `config.toml`(カレントディレクトリから読み込み)にまとめています。`config.example.toml` をコピーして使います。

> `config.toml` には SwitchBot の認証情報が含まれ、ペアリング情報(`.matter-storage`)も機密です。どちらも `.gitignore` で除外してあるので、コミットしないでください。

1. `[switchbot]` に token / secret を設定します(取得方法はファイル内コメント参照)。
2. ライトの deviceId を調べ、`[lights.<名前>]` の `device_id` に設定します。文字列 1 つでも配列(`["id1", "id2"]`)でも書け、配列の場合は列挙したデバイスをまとめて ON/OFF します(SwitchBot API にグループ機能はないため、デバイスごとにリクエストを送ります)。一覧は `best-lights-selector list-devices`(ソースから実行する場合は `bun run list-devices`)で取得できます。
3. `[schedules.N]` に時間帯とライトを設定します(`start` 以上 `end` 未満。`start` > `end` なら日付をまたぎます)。

## 実行

実行ファイルを `config.toml` のあるフォルダで起動します。

```bash
./best-lights-selector-macOS-aarch64
```

起動すると、まだペアリングされていない場合はコンソールに QR コードとセットアップコード(manual pairing code)が表示されます。Home アプリの「アクセサリを追加」→ QR を読み取る、または「その他のオプション」からコードを入力してください(未認証デバイスの警告が出たら「このまま追加」)。

設定ファイルは `--config <パス>` で指定することもできます。

ペアリング情報は `storage_path`(既定 `.matter-storage`)に保存されます。ペアリングし直したい場合はこのフォルダを削除してください。

> Tailscale などの VPN/仮想アダプタが有効だと、Home から接続できなくなることがあります。その場合は `config.toml` の
> `[matter] network_interface` に LAN 側のアダプタの番号(例: `15`)を指定してください。
> 起動時に名前が見つからない場合は、使えるアダプタ一覧が表示されます。
>
> アダプタの番号は `best-lights-selector list-interfaces`(ソースからは `bun run list-interfaces`)で一覧できます(番号が見つからない場合も、起動時に使える番号が表示されます)。
>
> Home のハブ(HomePod / Apple TV)とこの PC は同じネットワーク(mDNS が通る LAN)にいる必要があります。
> Windows ファイアウォールで UDP 5353(mDNS)と `matter.port`(既定 UDP 5540)の受信を許可してください。

## matter.js のパッチについて

`patches/@matter%2Fnodejs@0.17.9.patch` は matter.js(`@matter/nodejs`)の Windows 向け修正です(`bun install` で自動的に適用されます)。
Windows では受信パケットのインターフェースが数字のゾーン ID(例: `15`)で渡されますが、matter.js はそれをインターフェース名で
検索していました。このため mDNS の問い合わせ(HomePod が「このデバイスはどこ?」と探してくる)がすべて無視され、
ペアリング直後しか Home から操作できない(しばらくすると「応答なし」になる)状態になっていました。
`@matter/*` のバージョンを上げる場合は、この修正が本体に取り込まれたか確認してください。

## ソースから実行・ビルド

[Bun](https://bun.com) が必要です。

```bash
bun install
cp config.example.toml config.toml
bun run start            # 実行
bun run list-devices     # SwitchBot デバイス一覧
bun run list-interfaces  # ネットワークアダプタ一覧
bun run build            # 単体実行ファイルを best-lights-selector として生成
```

## ライセンス

MIT
