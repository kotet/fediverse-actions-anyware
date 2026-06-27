# AGENTS.md

## 関連ドキュメント

- [docs/development.md](docs/development.md) — 開発フロー（lint・インストール・動作確認の手順）

## ブラウザ操作

Firefox の操作には **firefox-devtools MCP** を使用します。

### `web-ext run` は使用しない

`web-ext run` は MCP が接続している Firefox とは別プロセスを起動するため、MCP 経由での操作ができません。拡張機能のインストールには `mcp__firefox-devtools__install_extension` を使用してください。

## Firefox MV3 の注意点

Chrome/Edge との仕様差異により、以下を必ず `manifest.json` に含めること。

- `browser_specific_settings.gecko.id` — Firefox MV3 では必須
- `background.scripts` — Firefox は `service_worker` を無視するため、フォールバックとして必要
