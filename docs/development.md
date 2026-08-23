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
| `src/popup/popup.html`, `src/popup/popup.css`, `src/content/content.css` | 静的ファイル（ビルド時に `dist/` へコピー） |

## 開発サイクル

### 1. コードを編集する

`src/background/`・`src/content/`・`src/popup/` 以下の `.ts` ファイルを編集します。
`manifest.json` や `src/popup/popup.html`・`src/popup/popup.css`・`src/content/content.css` の変更も `make build` で `dist/` に反映されます。

### 2. ビルドして lint で検証する

```sh
make lint
```

エラーがなければ次のステップへ進みます。警告は内容を確認したうえで対応を判断します。

### 3. Firefox に拡張機能をインストールする

レイアウトシフトを確認する場合は、**インストールする前**に比較用のスクリーンショットを撮っておきます。拡張機能を入れたあとでは比較対象を作れません。

```
mcp__firefox-devtools__navigate_page
  url: "https://mastodon.archive.org/@internetarchive/116818894033044875"

mcp__firefox-devtools__screenshot_page
  saveTo: "temp_agent_scripts/before.png"
```

Claude Code から次の MCP ツールを呼び出します。

```
mcp__firefox-devtools__install_extension
  type: "path"
  path: "/workspaces/fediverse-actions-anyware/dist"
```

すでにインストール済みの場合は再インストールになります（リロード操作は不要）。

### 4. 動作確認する

#### 何を実機で確認するか

ユニットテストは happy-dom 上で動くため、次の性質に依存するものは原理的に検証できません。**実機確認の対象はこれに限られます。** DOM の構造とロジックだけで決まることはユニットテストで担保し、実機では見ません。

| 依存する性質 | 検証できない理由 |
|--------------|------------------|
| CSS の解決結果 | カスケードも配色も解決されない |
| レイアウト計算 | 寸法・位置が得られず、レイアウトシフトを判定できない |
| ホストページの実装 | fixture は静的 HTML で、フレームワークが付けるハンドラや仮想化による要素の出入りを含まない |
| DOM の生成タイミング | クライアントサイドレンダリング・SPA 遷移・再描画は実環境依存 |
| 実環境の通信 | fetch・CORS・認証は実環境依存 |

#### コーディングエージェントが観測できる経路

MCP から観測できるのは次の4経路だけです。**確認したいことをこのいずれかで判定できる形に落とせるなら、エージェントだけで完結します。**

| 経路 | 判定できるもの |
|------|----------------|
| `screenshot_page` | ページに描画されるもの（見た目・寸法・位置）。撮影前後の比較でレイアウトシフト |
| `take_snapshot` | DOM に存在するもの（要素の有無・個数・状態） |
| `evaluate_script` | ページの realm から読めるもの（属性値・計算済みスタイル・URL） |
| ストレージへの直接書き込み | 拡張機能の状態を任意に設定したうえでの上記すべて |

裏を返すと、**観測がこの経路の外に出るものはエージェントでは確認できません。** ポップアップ UI の内側で完結するもの、ブラウザ chrome が描画するもの、コンソールにしか現れないもの、実インスタンスの資格情報や副作用を伴うもの、人間の知覚で判断するものが該当します。これらは人間が Firefox を操作して確認します。

#### 確認の前提を作る

アカウントが1つも登録されていないとボタンは描画されません。**通信を伴わない範囲の確認はモックアカウントで足ります。** ポップアップは MCP から開けないため、拡張機能ページの realm でストレージへ直接書き込みます（`AGENTS.md` の「ポップアップは直接開けない」）。

```js
await browser.storage.local.set({
  homeAccountStore: {
    accounts: [{ id: "mock-1", software: "mock", label: "Mock" }],
    activeAccountId: "mock-1",
  },
});
```

`MockHomeAccount` は既定で認証済みを返すため、この書き込みだけでボタンが表示される状態になります。複数アカウントや未選択といった**確認したい状態はすべてこの書き込みで作れます**。ポップアップを経由しないので、UI 操作の検証にはならない点に注意してください。

レイアウトシフトを見るなら、拡張機能をインストールする前に比較用のスクリーンショットが要ります（手順3）。スクリーンショットは `temp_agent_scripts/` に保存します（`.gitignore` 済み）。

#### コンソール出力を読む場合

ページのコンソールを直接読むツールはありません。`restart_firefox` で stdout に流す回避策が必要です（`AGENTS.md` 参照）。再起動でプロファイルが作り直されるため、拡張機能の再インストールと内部 UUID の取り直しが必要になり、OAuth で得たトークンなどプロファイルに保存された状態も失われます。**コンソールを読む確認と OAuth を要する確認の両方が必要なら、コンソール側を先に済ませてください。**

### 5. 繰り返す

コードを修正したら手順 2 に戻ります。Firefox を再起動する必要はなく、手順 3 の再インストールだけで変更が反映されます。

## Firefox MV3 向けの注意点

- `data_collection_permissions` は将来的に必須になる予定（現時点では警告のみ）。

詳細は [Firefox MV3 ドキュメント](https://mzl.la/4r6SF1L) を参照してください。
