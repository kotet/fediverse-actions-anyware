# 開発フロー

このプロジェクトでのブラウザ拡張機能の開発・動作確認フローをまとめます。

環境要件・ブラウザ操作の制約・Firefox MV3 の注意点については `AGENTS.md` を参照してください。

## ツールの役割

| ツール | 用途 | 備考 |
|--------|------|------|
| `make build` | TypeScript のコンパイルと `dist/` への出力 | esbuild + 静的ファイルコピー |
| `make lint` | マニフェストやコードの静的検証 | `make build` を内包、エラー 0 を目指す |
| `make typecheck` | TypeScript の型チェックのみ | ビルドせず型エラーだけ確認 |
| firefox-devtools MCP | Firefox の操作・拡張機能のインストール | Claude Code から直接操作できる |

## ディレクトリ構成

| パス | 役割 |
|------|------|
| `src/` | TypeScript ソースファイル |
| `dist/` | ビルド成果物（gitignore 対象） |
| `manifest.json` | 拡張機能マニフェスト（ビルド時に `dist/` へコピー） |
| `src/popup/popup.html`, `src/popup/popup.css` | 静的ファイル（ビルド時に `dist/` へコピー） |

## 開発サイクル

### 1. コードを編集する

`src/background/`・`src/content/`・`src/popup/` 以下の `.ts` ファイルを編集します。
`manifest.json` や `src/popup/popup.html`・`src/popup/popup.css` の変更も `make build` で `dist/` に反映されます。

### 2. ビルドして lint で検証する

```sh
make lint
```

エラーがなければ次のステップへ進みます。警告は内容を確認したうえで対応を判断します。

### 3. Firefox に拡張機能をインストールする

Claude Code から次の MCP ツールを呼び出します。

```
mcp__firefox-devtools__install_extension
  type: "path"
  path: "/workspaces/fediverse-actions-anyware/dist"
```

すでにインストール済みの場合は再インストールになります（リロード操作は不要）。

### 4. 動作確認する

#### ページへの遷移

```
mcp__firefox-devtools__navigate_page
  url: "https://example.com"
```

#### コンソールログの確認

コンテンツスクリプトや background service worker の `console.log` を確認します。

```
mcp__firefox-devtools__list_console_messages
  textContains: "確認したいキーワード"
```

#### スクリーンショットの取得

```
mcp__firefox-devtools__screenshot_page
  saveTo: "temp_agent_scripts/screenshot.png"
```

### 5. 繰り返す

コードを修正したら手順 2 に戻ります。Firefox を再起動する必要はなく、手順 3 の再インストールだけで変更が反映されます。

## Firefox MV3 向けの注意点

- `data_collection_permissions` は将来的に必須になる予定（現時点では警告のみ）。

詳細は [Firefox MV3 ドキュメント](https://mzl.la/4r6SF1L) を参照してください。
