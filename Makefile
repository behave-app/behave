all: public/app/index.js all-bundled

all-bundled: $(patsubst %.ts, public/%.js, $(wildcard bundled/*.ts)) public/bundled/tfjs-wasm

public/bundled/%.js: bundled/%.ts
	./node_modules/esbuild/bin/esbuild $< --sourcemap --bundle --format=esm --outfile=$@

public/app/%.js: src/%.ts tsconfig.json
	./node_modules/esbuild/bin/esbuild $< --sourcemap --format=esm --outfile=$@

public/bundled/tfjs-wasm: $(wildcard node_modules/@tensorflow/tfjs-backend-wasm/wasm-out/*.wasm)
	mkdir -p $@
	cp $^ $@

clean:
	rm -r public
