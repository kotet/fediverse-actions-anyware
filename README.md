# Fediverse Actions Anyware

[日本語](README.ja.md)

A Firefox extension that lets you favourite, boost, bookmark and reply to posts on Mastodon instances you are not signed in to, with your own account.

Found a post on another instance and want to favourite it? Normally you would have to copy its URL, open your own instance, search for it there, and act on it from there. This extension does this for you from the page you are already on.

## Usage

1. Open the popup from the toolbar icon and register your Mastodon account (your "home account"). You sign in on your own instance's page, so the extension never sees your password.
2. Open a post on a Mastodon instance you are not signed in to. Its reply, boost, favourite and bookmark buttons are replaced with copies marked by a thin underline, and the star in the toolbar icon turns gold.
3. Press a replaced button, and the action runs on your home instance. Press it again to undo.
4. Reply opens the same post on your home instance in a new tab, where you write the reply.

The underline on a button shows its state.

| Underline | State |
|-----------|-------|
| Thin solid line | Not run yet (marks a button that acts through your home account) |
| Moving dashes | Running |
| Thick purple line | Favourited, boosted or bookmarked |
| Dots | Failed (hover over the button to see why) |

## Works on

- Post pages and timelines of the standard Mastodon web interface
- The public pages Mastodon 3.x shows to visitors who are not signed in (post pages, account pages, the public timeline and hashtag pages). These pages have no bookmark button to begin with, so bookmarking is not available there. The public timeline and hashtag pages have no reply button either
- Several home accounts can be registered; the one selected in the popup is used
- On pages of an instance you are signed in to, the extension adds nothing, because the page's own buttons already act as your account there
- Firefox 140 or later for desktop

Not supported yet:

- Other fediverse software such as Misskey, and alternative Mastodon web interfaces
- Firefox for Android
- Settings (for example, choosing which buttons to replace)

## Data

The extension talks only to the Mastodon instances you register. When you press one of its buttons, it sends the URL of that post to your home instance to look the post up there, then performs the action. Nothing is sent to the developer or to anyone else.

- To respond faster, the lookup starts as soon as a button is pressed down. The URL is sent even if you then move the pointer away without completing the click
- Nothing is sent about posts whose buttons you have not pressed. The contents of posts and of the page you are viewing are never sent
- Registered accounts and access tokens are kept in the extension's local storage inside Firefox. Logging out deletes the access token, and removing an account deletes everything stored for it

## Build

Node.js and npm are required.

```sh
npm ci
node build.mjs --release
npx web-ext build --source-dir dist-release --artifacts-dir web-ext-artifacts/release --overwrite-dest
```

The extension is written to `dist-release/` and the zip to `web-ext-artifacts/release/`. [BUILD.md](BUILD.md) has the full instructions, including the environment and how to verify the result, for AMO reviewers.

The version comes from a git tag such as `0.2.0`, so a release build (`--release`) can only be made on a tagged commit. On an untagged commit, use the development build (`node build.mjs`, written to `dist/`), whose version is `0.0.0`.

Pushing a tag such as `0.2.0` makes GitHub Actions submit a new version to AMO, the Firefox add-on store (`.github/workflows/release.yml`).

## Development

The development workflow, the directory layout, and the split between checks that run in unit tests and checks that need a real browser are documented in [docs/development.md](docs/development.md) (in Japanese).

Firefox is driven through the firefox-devtools MCP server:

```sh
claude mcp add firefox-devtools npx @mozilla/firefox-devtools-mcp@latest
```

## License

Licensed under the Mozilla Public License 2.0. See [LICENSE](LICENSE).
