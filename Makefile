DOCKER ?= nerdctl.lima

DOCKER_TMPDIR ?= /tmp/lima/
ENVIRONMENT ?= development
LIBAVJS_VERSION := 5.1.6.1.1
LIBAVJS_COMMIT := $(shell cat libav.js/commit.txt | tr -d '\n')
LIBAVJS_BASE_FILES := \
	behave.dbg.mjs \
	behave.dbg.wasm.mjs \
	behave.dbg.thr.js \
	behave.dbg.thr.mjs
LIBAVJS_MAKE_FILES := $(addprefix dist/libav-$(LIBAVJS_VERSION)-, $(LIBAVJS_BASE_FILES)) dist/libav.types.d.ts dist/libav-behave.dbg.js dist/libav-behave.dbg.mjs 
LIBAVJS_TARGET_FILES := $(addprefix public/app/bundled/libavjs-$(LIBAVJS_COMMIT)/, $(LIBAVJS_MAKE_FILES))
STATIC_MARKDOWN_FILES := $(shell find static -type f -name '*.md')
STATIC_TARGET_MARKDOWN_FILES_WITHOUT_HASHES := $(STATIC_MARKDOWN_FILES:static/%.md=public/%.nohash.html)
STATIC_TARGET_MARKDOWN_FILES := $(STATIC_MARKDOWN_FILES:static/%.md=public/%.html)
STATIC_ASSET_FILES := $(shell find static/assets -type f)
ENTRYPOINTS := \
    ./src/convert/App.tsx \
    ./src/infer/App.tsx \
    ./src/viewer/index.tsx
OUTFILESBASE := $(basename $(ENTRYPOINTS:./src/%=app/%))
BEHAVE_VERSION := $(shell node determine_version_number.mjs)

.PHONY=all public/app/bundled/libavjs lint public/app/tsc libavjs test build

build: public/app/tsc public/app/bundled/libavjs-$(LIBAVJS_COMMIT)/version.txt $(STATIC_TARGET_MARKDOWN_FILES) public/app/bundled/ort-wasm

all: build test

test: build lint
	@npx cypress run --browser=chrome

public/app/bundled/libavjs: public/app/bundled/libavjs-$(LIBAVJS_COMMIT)/version.txt

public/app/bundled/libavjs-$(LIBAVJS_COMMIT)/version.txt: $(LIBAVJS_TARGET_FILES)
	@find public/app/bundled/ -maxdepth 1 -a -name libavjs-\* -a ! -name libavjs-$(LIBAVJS_COMMIT) -exec rm -r {} \;
	@mkdir -p public/app/bundled/libavjs/dist
	@cp public/app/bundled/libavjs-$(LIBAVJS_COMMIT)/dist/libav.types.d.ts public/app/bundled/libavjs/dist/libav.types.d.ts
	@echo $(LIBAVJS_COMMIT) > $@

$(LIBAVJS_TARGET_FILES): libav.js/Dockerfile libav.js/commit.txt
	@mkdir -p "$(DOCKER_TMPDIR)"
	$(eval OUTDIR := $(shell mktemp -d --tmpdir=$(DOCKER_TMPDIR)))
	@$(DOCKER) build --no-cache libav.js \
		--build-arg="LIBAVJS_COMMIT=$(LIBAVJS_COMMIT)" \
		--build-arg="FILES_TO_BUILD=$(LIBAVJS_MAKE_FILES)" \
		--target=artifact --output type=local,dest=$(OUTDIR)
	@mkdir -p public/app/bundled/libavjs
	@mkdir -p public/app/bundled/libavjs-$(LIBAVJS_COMMIT)
	@cp -R $(OUTDIR)/dist public/app/bundled/libavjs-$(LIBAVJS_COMMIT)
	@rm -r "$(OUTDIR)"

node_modules/tag: package.json
	@npm install  --no-save .
	@cd node_modules/libavjs-webcodecs-bridge && npm install typescript@5.1.6 && make all
	@touch $@

lint: tsconfig.json $(shell find src) public/app/bundled/libavjs-$(LIBAVJS_COMMIT)/version.txt node_modules/tag
	@tsc --noEmit
	@npx eslint --max-warnings 0 .

public/app/tsc: tsconfig.json $(shell find src) public/app/bundled/libavjs-$(LIBAVJS_COMMIT)/version.txt node_modules/tag $(STATIC_ASSET_FILES) determine_version_number.mjs copy_and_version.py
	@./node_modules/esbuild/bin/esbuild ./src/worker/Worker.ts --sourcemap --bundle --format=esm --outbase=src --outdir=public/app/ --define:BEHAVE_VERSION='$(BEHAVE_VERSION)' --define:LIBAVJS_COMMIT=\"$(LIBAVJS_COMMIT)\" --define:process.env.NODE_ENV=\"$(ENVIRONMENT)\" && rm public/app/worker/Worker.css*
	@WORKER_VERSION=$$(md5sum public/app/worker/Worker.js | cut -c-10); \
	mv public/app/worker/Worker.js public/app/worker/Worker.$${WORKER_VERSION}.js; \
	./node_modules/esbuild/bin/esbuild $(ENTRYPOINTS) --sourcemap --bundle --format=esm --outbase=src --outdir=public/app/ --define:BEHAVE_VERSION='$(BEHAVE_VERSION)' --define:WORKER_URL=\"worker/Worker.$${WORKER_VERSION}.js\" --define:process.env.NODE_ENV=\"$(ENVIRONMENT)\" --loader:.woff2=file
	@(cd public $(foreach ext,js css,$(foreach outfilebase,$(OUTFILESBASE),&& if [ -f "$(outfilebase).$(ext)" ]; then MD5=$$(md5sum "$(outfilebase).$(ext)" | cut -c-10) && mv "$(outfilebase).$(ext)" "$(outfilebase).$${MD5}.$(ext)" && echo "s|$(outfilebase).$(ext)|$(outfilebase).$${MD5}.$(ext)|g"; fi))) > $@.part
	@python3 copy_and_version.py static/assets public/assets >> $@.part
	@mv $@.part $@

$(STATIC_TARGET_MARKDOWN_FILES_WITHOUT_HASHES): public/%.nohash.html: static/%.md node_modules/tag static/header._html static/footer._html markdown.mjs determine_version_number.mjs
	@mkdir -p "$$(dirname "$@")"
	@node markdown.mjs "$<" static/ '$(BEHAVE_VERSION)' '$(STATIC_TARGET_MARKDOWN_FILES)' > "$@"

$(STATIC_TARGET_MARKDOWN_FILES): public/%.html: public/%.nohash.html public/app/tsc
	@sed -f public/app/tsc "$<" > "$@"

clean:
	@if [ -e public ]; then rm -r public; fi


public/app/bundled/ort-wasm: $(wildcard node_modules/onnxruntime-web/dist/*.wasm)
	@mkdir -p $@
	@cp node_modules/onnxruntime-web/dist/*.wasm $@
