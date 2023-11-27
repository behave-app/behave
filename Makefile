DOCKER ?= nerdctl.lima
DOCKER_TMPDIR ?= /tmp/lima/
LIBAVJS_VERSION := 4.6.6.0.1
LIBAVJS_COMMIT := 83ceadd53f92cbdb6048bc0ca4d29591eacdd158
LIBAVJS_BASE_FILES := \
	behave.dbg.js \
	behave.dbg.simd.js \
	behave.dbg.thrsimd.js \
	behave.dbg.thr.js \
  behave.dbg.simd.wasm
LIBAVJS_MAKE_FILES := $(addprefix dist/libav-$(LIBAVJS_VERSION)-, $(LIBAVJS_BASE_FILES)) dist/libav.types.d.ts
LIBAVJS_TARGET_FILES := $(addprefix public/app/bundled/libavjs/, $(LIBAVJS_MAKE_FILES))

.PHONY=all

all: public/app/tsc public/app/bundled/libavjs/empty public/app/bundled/tfjs-wasm

public/app/bundled/libavjs/empty:  $(LIBAVJS_TARGET_FILES)
	@touch $@

$(LIBAVJS_TARGET_FILES): libav.js/Dockerfile
	$(eval OUTDIR := $(shell mktemp -d --tmpdir=$(DOCKER_TMPDIR)))
	@$(DOCKER) build libav.js \
		--build-arg="LIBAVJS_COMMIT=$(LIBAVJS_COMMIT)" \
		--build-arg="FILES_TO_BUILD=$(LIBAVJS_MAKE_FILES)" \
		--target=artifact --output type=local,dest=$(OUTDIR)
	@mkdir -p public/app/bundled/libavjs
	@cp -R $(OUTDIR)/ public/app/bundled/libavjs

public/app/tsc: tsconfig.json $(shell find src) public/app/bundled/libavjs/empty 
	@tsc --noEmit
	@./node_modules/esbuild/bin/esbuild $$(node -p "require('./tsconfig.json').include.join(' ')") --sourcemap --bundle --format=esm --outdir=public/app/
	touch $@

public/app/bundled/tfjs-wasm: $(wildcard node_modules/@tensorflow/tfjs-backend-wasm/dist/*.wasm)
	@mkdir -p $@
	@cp $^ $@

clean:
	@if [ -e public ]; then rm -r public; fi


