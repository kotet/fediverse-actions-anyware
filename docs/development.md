# 開発フロー

このプロジェクトでのブラウザ拡張機能の開発・動作確認フロー。

環境要件・ブラウザ操作の制約・Firefox MV3 の注意点については `AGENTS.md` を参照。

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

`src/background/`・`src/content/`・`src/popup/` 以下の `.ts` ファイルを編集する。
`manifest.json` や `src/popup/popup.html`・`src/popup/popup.css`・`src/content/content.css` の変更も `make build` で `dist/` に反映される。

### 2. ビルドして lint で検証する

```sh
make lint
```

エラーがなければ次のステップへ進む。警告は内容を確認したうえで対応を判断する。

### 3. Firefox に拡張機能をインストールする

レイアウトシフトを確認する場合は、**インストールする前**に比較用のスクリーンショットを撮っておく。拡張機能を入れたあとでは比較対象を作れない。

```
mcp__firefox-devtools__navigate_page
  url: "https://mastodon.archive.org/@internetarchive/116818894033044875"

mcp__firefox-devtools__screenshot_page
  saveTo: "temp_agent_scripts/before.png"
```

Claude Code から次の MCP ツールを呼び出す。

```
mcp__firefox-devtools__install_extension
  type: "path"
  path: "/workspaces/fediverse-actions-anyware/dist"
```

すでにインストール済みの場合は再インストールになる（リロード操作は不要）。

### 4. 動作確認する

#### 何を実機で確認するか

ユニットテストは happy-dom 上で動くため、次の性質に依存するものは原理的に検証できない。**実機確認の対象はこれに限られる。** DOM の構造とロジックだけで決まることはユニットテストで担保し、実機では見ない。

| 依存する性質 | 検証できない理由 |
|--------------|------------------|
| CSS の解決結果 | カスケードも配色も解決されない |
| レイアウト計算 | 寸法・位置が得られず、レイアウトシフトを判定できない |
| ホストページの実装 | fixture は静的 HTML で、フレームワークが付けるハンドラや仮想化による要素の出入りを含まない |
| DOM の生成タイミング | クライアントサイドレンダリング・SPA 遷移・再描画は実環境依存 |
| 実環境の通信 | fetch・CORS・認証は実環境依存 |

#### コーディングエージェントが観測できる経路

MCP から観測できるのは次の4経路だけ。**確認したいことをこのいずれかで判定できる形に落とせるなら、エージェントだけで完結する。**

| 経路 | 判定できるもの |
|------|----------------|
| `screenshot_page` | ページに描画されるもの（見た目・寸法・位置）。撮影前後の比較でレイアウトシフト |
| `take_snapshot` | DOM に存在するもの（要素の有無・個数・状態） |
| `evaluate_script` | ページの realm から読めるもの（属性値・計算済みスタイル・URL） |
| ストレージへの直接書き込み | 拡張機能の状態を任意に設定したうえでの上記すべて |

裏を返すと、**観測がこの経路の外に出るものはエージェントでは確認できない。** ポップアップ UI の内側で完結するもの、ブラウザ chrome が描画するもの、コンソールにしか現れないもの、実インスタンスの資格情報や副作用を伴うもの、人間の知覚で判断するものが該当する。これらは人間が Firefox を操作して確認する。

#### 確認の前提を作る

アカウントが1つも登録されていないとボタンは描画されない。**通信を伴わない範囲の確認はモックアカウントで足りる。** ポップアップは MCP から開けないため、拡張機能ページの realm でストレージへ直接書き込む（`AGENTS.md` の「ポップアップは直接開けない」）。

```js
await browser.storage.local.set({
  homeAccountStore: {
    accounts: [{ id: "mock-1", software: "mock", label: "Mock" }],
    activeAccountId: "mock-1",
  },
});
```

`MockHomeAccount` は既定で認証済みを返すため、この書き込みだけでボタンが表示される状態になる。複数アカウントや未選択といった**確認したい状態はすべてこの書き込みで作れる**。ポップアップを経由しないので、UI 操作の検証にはならない点に注意。

レイアウトシフトを見るなら、拡張機能をインストールする前に比較用のスクリーンショットが要る（手順3）。スクリーンショットは `temp_agent_scripts/` に保存する（`.gitignore` 済み）。

#### コンソール出力を読む場合

ページのコンソールを直接読むツールはない。`restart_firefox` で stdout に流す回避策が必要（`AGENTS.md` 参照）。再起動でプロファイルが作り直されるため、拡張機能の再インストールと内部 UUID の取り直しが必要になり、OAuth で得たトークンなどプロファイルに保存された状態も失われる。**コンソールを読む確認と OAuth を要する確認の両方が必要なら、コンソール側を先に済ませること。**

#### 想定される失敗と切り分け

| 症状 | 考えられる原因 | 確認・対処 |
|------|----------------|------------|
| ボタンが1つも出ない | サーバーが返す HTML はアプリシェルのみで、投稿は API 取得後にクライアントが描画する。`content.ts` はこれをデバウンス付き `MutationObserver` で待つため、監視が動いていないと0件のままになる | コンソールで `[content] Extracted 0 post(s).` が出たまま更新されないか確認する。`[content] Extracted 1 post(s).` に変われば監視は動いている |
| `This site does not support the replace-underline mode.` が出る | ページアダプターが `ActionButtonReplacer` を実装していない | 使用中のアダプターを確認する。`MockPageAdapter` は意図的に非対応 |
| `No active home account.` が出る | アクティブアカウントが未選択 | ストレージの `activeAccountId` を設定する（ポップアップからならラジオボタンを選択する） |
| ボタンは出るがアクションが失敗する | ホームインスタンスへの通信はバックグラウンドが行う。コンテンツスクリプトから直接 `fetch` すると、ホストページの CSP（`connect-src`）で必ず失敗する（`AGENTS.md` の「ホームインスタンスへの通信はバックグラウンドで行う」） | 失敗しているのが依頼（`runtime.sendMessage`）か通信かを分ける。バックグラウンドまで届いていれば `ActionError` が返り、届かなければ送信側で例外になる |
| タイムラインで一部の投稿にしかボタンが出ない | Mastodon は画面外の投稿をアンマウントする（仮想化）ため、アクションバー自体が存在しない | 想定どおりの挙動。スクロールしてマウントされた投稿には `MutationObserver` が追従する |
| 返信を押すと新しいタブが開く | 拡張内にコンポーザを持たないため、ホームインスタンス上の該当投稿を開く方式 | 想定どおりの挙動。投稿を解決できなければタブは開かず `ActionError` が返る |
| ページの表示が崩れる | 元ボタンを削除してしまっている | `replaceActionButton` が元ボタンを `display: none` で隠すだけになっているか確認する。削除すると React の再描画が失敗する |

### 5. 繰り返す

コードを修正したら手順 2 に戻る。Firefox を再起動する必要はなく、手順 3 の再インストールだけで変更が反映される。

## Firefox MV3 向けの注意点

- `data_collection_permissions` は将来的に必須になる予定（現時点では警告のみ）。

詳細は [Firefox MV3 ドキュメント](https://mzl.la/4r6SF1L) を参照。
