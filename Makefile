.PHONY: build lint typecheck

build:
	node build.mjs
	web-ext build --source-dir dist --overwrite-dest

lint: build
	web-ext lint --source-dir dist

typecheck:
	npx tsc --noEmit
