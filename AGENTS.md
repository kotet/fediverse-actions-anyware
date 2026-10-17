# AGENTS.md

## 関連ドキュメント

- [docs/development.md](docs/development.md) — 開発フロー（lint・インストール・動作確認の手順）
- [docs/human-only-verification.md](docs/human-only-verification.md) — 動作確認を人間とエージェントに振り分ける基準（人間へ依頼する手順は常設せず都度書く）

## ブラウザ操作

Firefox の操作には **firefox-devtools MCP** を使う。

### `web-ext run` は使用しない

`web-ext run` は MCP が接続している Firefox とは別プロセスを起動するため、MCP 経由で操作できない。拡張機能のインストールには `mcp__firefox-devtools__install_extension` を使う。

### ポップアップは直接開けない

`moz-extension://` への `navigate_page` / `new_page` は BiDi が拒否する（`unsupported operation`）。

**ポップアップ UI を開く必要のある操作は人間に依頼する。** 拡張機能ページを別の経路（`web_accessible_resources` の `window.open` など）で開き、その realm からストレージを書き換えて状態を作る回避策は使わない。何を依頼し、どこからをエージェントが引き受けるかは [docs/human-only-verification.md](docs/human-only-verification.md) の基準に従う。

### コンソール出力の取得

ページのコンソールを読むツールはない。`restart_firefox` で `prefs: { "devtools.console.stdout.content": true }` と `env: ["MOZ_REMOTE_ALLOW_SYSTEM_ACCESS=1"]` を指定すると、`console.log` が Firefox の stdout に流れ、`get_firefox_output` で読めるようになる。再起動でプロファイルが作り直されるため、拡張機能の再インストールが必要。

### ページの realm には CSP が効く

`evaluate_script` はページの realm で動くため、Mastodon の CSP により `<style>` 要素の注入がブロックされる（`sheet` が生成されない）。スタイルを試す場合は `element.style.setProperty(..., "important")` を使う。コンテンツスクリプトが注入する CSS はページの CSP の対象外。

## ホームインスタンスへの通信はバックグラウンドで行う

コンテンツスクリプトからの `fetch` はホストページの CSP (`connect-src`) の対象になる。Mastodon は自身のオリジンしか許可しないため、他インスタンスへのリクエストは必ず失敗する（`securitypolicyviolation` イベントで実測）。host permission では回避できない。

ホームインスタンスへ出る通信は `src/background/` に置き、他の realm からは `runtime.sendMessage` で依頼する。ポップアップと `oauth-callback.html` は拡張機能ページなので、この制約を受けず直接リクエストできる。

ユニットテストの happy-dom に CSP は無いため、**この誤りはテストでは検出できない。**

## Firefox MV3 の注意点

Chrome/Edge との仕様差異により、以下を必ず `manifest.json` に含めること。

- `browser_specific_settings.gecko.id` — Firefox MV3 では必須
- `background.scripts` — Firefox は `service_worker` を無視するため、フォールバックとして必要
