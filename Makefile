TS_SRC :=  $(shell find src -path src/bundled -prune -o -name \*.ts -print)
TS_JS := $(patsubst src/%.ts, public/app/%.js, $(TS_SRC))

BUNDLED_SRC := $(shell find src/bundled -name \*.ts -print)
BUNDLED_JS := $(patsubst src/%.ts, public/app/%.js, $(BUNDLED_SRC))

.PHONY=all

all: $(TS_JS) $(BUNDLED_JS)


$(BUNDLED_JS): public/app/bundled/%.js: src/bundled/%.ts
	./node_modules/esbuild/bin/esbuild $< --sourcemap --bundle --format=esm --outfile=$@

$(TS_JS): $(TS_SRC) tsconfig.json
	$(eval OUTDIR := $(shell mktemp -d))
	tsc --outDir $(OUTDIR)
	rm -r $(OUTDIR)/bundled
	mkdir -p public/app
	cp -r $(OUTDIR)/* public/app
	rm -r $(OUTDIR)

public/bundled/tfjs-wasm: $(wildcard node_modules/@tensorflow/tfjs-backend-wasm/wasm-out/*.wasm)
	mkdir -p $@
	cp $^ $@

clean:
	rm -r public
