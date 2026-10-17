.PHONY: build build-release source-archive lint typecheck test

run: build
	web-ext run --source-dir dist

build:
	node build.mjs
	web-ext build --source-dir dist --overwrite-dest

build-release:
	node build.mjs --release
	web-ext build --source-dir dist-release --artifacts-dir web-ext-artifacts/release --overwrite-dest

source-archive:
	node scripts/build-source-archive.mjs

lint: build build-release
	node scripts/check-i18n.mjs
	web-ext lint --source-dir dist
	web-ext lint --source-dir dist-release

typecheck:
	npx tsc --noEmit

test:
	npm test
