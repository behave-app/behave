DOCKER ?= nerdctl.lima

DOCKER_TMPDIR ?= /tmp/lima/
ENVIRONMENT ?= development
LIBAVJS_VERSION := 4.8.6.0.1
LIBAVJS_COMMIT := $(shell cat libav.js/commit.txt | tr -d '\n')
LIBAVJS_BASE_FILES := \
	behave.dbg.js \
	behave.dbg.simd.js \
	behave.dbg.thrsimd.js \
	behave.dbg.thr.js \
  behave.dbg.simd.wasm
LIBAVJS_MAKE_FILES := $(addprefix dist/libav-$(LIBAVJS_VERSION)-, $(LIBAVJS_BASE_FILES)) dist/libav.types.d.ts
LIBAVJS_TARGET_FILES := $(addprefix public/app/bundled/libavjs-$(LIBAVJS_COMMIT)/, $(LIBAVJS_MAKE_FILES))
HTML_FILES := $(wildcard *.html)
HTML_TARGET_FILES := $(addprefix public/, $(HTML_FILES))
ENTRYPOINTS := \
    ./src/convert/App.tsx \
    ./src/infer/App.tsx \
    ./src/debug/App.tsx \
    ./src/viewer/index.tsx
OUTFILESBASE := $(basename $(ENTRYPOINTS:./src/%=app/%))

.PHONY=all public/app/bundled/libavjs lint public/app/tsc

all: public/app/tsc public/app/bundled/libavjs-$(LIBAVJS_COMMIT)/version.txt $(HTML_TARGET_FILES) public/app/bundled/tfjs-wasm

public/app/bundled/libavjs: public/app/bundled/libavjs-$(LIBAVJS_COMMIT)/version.txt

public/app/bundled/libavjs-$(LIBAVJS_COMMIT)/version.txt: $(LIBAVJS_TARGET_FILES)
	@find public/app/bundled/ -maxdepth 1 -a -name libavjs-\* -a ! -name libavjs-$(LIBAVJS_COMMIT) -exec rm -r {} \;
	@mkdir -p public/app/bundled/libavjs/dist
	@cp public/app/bundled/libavjs-$(LIBAVJS_COMMIT)/dist/libav.types.d.ts public/app/bundled/libavjs/dist/libav.types.d.ts
	@echo $(LIBAVJS_COMMIT) > $@

$(LIBAVJS_TARGET_FILES): libav.js/Dockerfile libav.js/commit.txt
	@mkdir -p "$(DOCKER_TMPDIR)"
	$(eval OUTDIR := $(shell mktemp -d --tmpdir=$(DOCKER_TMPDIR)))
	@$(DOCKER) build libav.js \
		--build-arg="LIBAVJS_COMMIT=$(LIBAVJS_COMMIT)" \
		--build-arg="FILES_TO_BUILD=$(LIBAVJS_MAKE_FILES)" \
		--target=artifact --output type=local,dest=$(OUTDIR)
	@mkdir -p public/app/bundled/libavjs
	@cp -R $(OUTDIR)/dist public/app/bundled/libavjs-$(LIBAVJS_COMMIT)
	@rm -r "$(OUTDIR)"

node_modules/tag: package.json
	@npm install --no-save .
	@cd node_modules/libavjs-webcodecs-bridge && make all
	@touch $@

lint: tsconfig.json $(shell find src) public/app/bundled/libavjs-$(LIBAVJS_COMMIT)/version.txt node_modules/tag
	@tsc --noEmit
	@./node_modules/eslint/bin/eslint.js src

public/app/tsc: tsconfig.json $(shell find src) public/app/bundled/libavjs-$(LIBAVJS_COMMIT)/version.txt node_modules/tag
	@./node_modules/esbuild/bin/esbuild $(ENTRYPOINTS) --sourcemap --bundle --format=esm --outbase=src --outdir=public/app/ --define:process.env.NODE_ENV=\"$(ENVIRONMENT)\" --loader:.woff2=file
	@(cd public $(foreach ext,js css,$(foreach outfilebase,$(OUTFILESBASE),&& MD5=$$(md5sum "$(outfilebase).$(ext)" | cut -c-10) && mv "$(outfilebase).$(ext)" "$(outfilebase).$${MD5}.$(ext)" && echo "s|$(outfilebase).$(ext)|$(outfilebase).$${MD5}.$(ext)|g"))) > $@.part
	@echo "s|app/bundled/libavjs/|app/bundled/libavjs-$(LIBAVJS_COMMIT)/|g" >> $@.part
	@echo "s&___BEHAVE_VERSION___&$$(node determine_version_number.mjs | sed 's/&/\&amp;/g; s/</\&lt;/g; s/>/\&gt;/g; s/"/\&quot;/g; s/'"'"'/\&#39;/g')&g" >> $@.part
	@ mv $@.part $@

$(HTML_TARGET_FILES): public/%.html: %.html public/app/tsc
	@sed -f public/app/tsc < $< > $@

clean:
	@if [ -e public ]; then rm -r public; fi


public/app/bundled/tfjs-wasm: $(wildcard node_modules/@tensorflow/tfjs-backend-wasm/dist/*.wasm)
	@mkdir -p $@
	@cp node_modules/@tensorflow/tfjs-backend-wasm/dist/*.wasm $@
