.PHONY: build lint typecheck test

run: build
	web-ext run --source-dir dist

build:
	node build.mjs
	web-ext build --source-dir dist --overwrite-dest

lint: build
	node scripts/check-i18n.mjs
	web-ext lint --source-dir dist

typecheck:
	npx tsc --noEmit

test:
	npm test
