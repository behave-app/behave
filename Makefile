TS_SRC :=  $(shell find src -path src/bundled -prune -o -name \*.ts -print)
TS_JS := $(patsubst src/%.ts, public/app/%.js, $(TS_SRC))

BUNDLED_SRC := $(shell find src/bundled -name \*.ts -print)
BUNDLED_JS := $(patsubst src/%.ts, public/app/%.js, $(BUNDLED_SRC))

LIBAVJS_VERSION := 4.6.6.0.1
LIBAVJS_COMMIT := 83ceadd53f92cbdb6048bc0ca4d29591eacdd158
LIBAVJS_BASE_FILES := \
	behave.dbg.js \
	behave.dbg.simd.js \
	behave.dbg.thrsimd.js \
	behave.dbg.thr.js \
  behave.dbg.simd.wasm
LIBAVJS_MAKE_FILES := $(addprefix dist/libav-$(LIBAVJS_VERSION)-, $(LIBAVJS_BASE_FILES)) dist/libav.types.d.ts
LIBAVJS_TARGET_FILES := $(addprefix public/bundled/libavjs/, $(LIBAVJS_MAKE_FILES))

.PHONY=all libavjs

all: $(TS_JS) $(BUNDLED_JS) libavjs public/bundled/tfjs-wasm

libavjs:  $(LIBAVJS_TARGET_FILES)

$(LIBAVJS_TARGET_FILES): libav.js/Dockerfile
	$(eval OUTDIR := $(shell mktemp -d --tmpdir=/tmp/lima/))
	@nerdctl.lima build libav.js \
		--build-arg="LIBAVJS_COMMIT=$(LIBAVJS_COMMIT)" \
		--build-arg="FILES_TO_BUILD=$(LIBAVJS_MAKE_FILES)" \
		--target=artifact --output type=local,dest=$(OUTDIR)
	@mkdir -p public/bundled/libavjs
	@cp -R $(OUTDIR)/ public/bundled/libavjs

$(BUNDLED_JS): public/app/bundled/%.js: src/bundled/%.ts
	./node_modules/esbuild/bin/esbuild $< --sourcemap --bundle --format=esm --outfile=$@

$(TS_JS): $(TS_SRC) tsconfig.json libavjs
	$(eval OUTDIR := $(shell mktemp -d))
	@tsc --outDir $(OUTDIR)
	@rm -r $(OUTDIR)/bundled
	@mkdir -p public/app
	@cp -r $(OUTDIR)/* public/app
	@rm -r $(OUTDIR)

public/bundled/tfjs-wasm: $(wildcard node_modules/@tensorflow/tfjs-backend-wasm/dist/*.wasm)
	@mkdir -p $@
	@cp $^ $@

clean:
	rm -r public


