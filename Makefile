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

SOURCE_ENTRYPOINTS := $(wildcard src/*/App.tsx)
TARGET_ENTRYPOINTS := $(SOURCE_ENTRYPOINTS:src/%/App.tsx=public/app/%.js)

.PHONY=all

all: $(TARGET_ENTRYPOINTS) public/app/bundled/libavjs/empty public/app/bundled/tfjs-wasm

public/app/bundled/libavjs/empty:  $(LIBAVJS_TARGET_FILES)
	@touch $@

$(LIBAVJS_TARGET_FILES): libav.js/Dockerfile
	$(eval OUTDIR := $(shell mktemp -d --tmpdir=/tmp/lima/))
	@nerdctl.lima build libav.js \
		--build-arg="LIBAVJS_COMMIT=$(LIBAVJS_COMMIT)" \
		--build-arg="FILES_TO_BUILD=$(LIBAVJS_MAKE_FILES)" \
		--target=artifact --output type=local,dest=$(OUTDIR)
	@mkdir -p public/app/bundled/libavjs
	@cp -R $(OUTDIR)/ public/app/bundled/libavjs

$(TARGET_ENTRYPOINTS): public/app/%.js: src/%/App.tsx
	@echo '{"extends": "'$$(pwd)'/tsconfig.json", "include": [ "'$$(pwd)'/$<" ] }' > $$TMPDIR/.tsconfig.make-temp.json
	tsc --noEmit --project $$TMPDIR/.tsconfig.make-temp.json ; ret=$$? ; rm $$TMPDIR/.tsconfig.make-temp.json; exit $$ret
	./node_modules/esbuild/bin/esbuild $< --sourcemap --bundle --format=esm --outfile=$@

public/app/bundled/tfjs-wasm: $(wildcard node_modules/@tensorflow/tfjs-backend-wasm/dist/*.wasm)
	@mkdir -p $@
	@cp $^ $@

clean:
	@if [ -e public ]; then rm -r public; fi


