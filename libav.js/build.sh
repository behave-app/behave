set -e
nerdctl.lima build --tag libav.js-dev .
OUTDIR="$(mktemp -d --tmpdir=/tmp/lima/)"
mkdir "$OUTDIR/dist"
nerdctl.lima run --rm -ti -v "$OUTDIR/dist":/libav.js/dist libav.js-dev make dist/libav-4.5.6.0-behave.dbg.js dist/libav-4.5.6.0-behave.dbg.simd.js dist/libav-4.5.6.0-behave.dbg.simd.wasm
echo "Files are in $OUTDIR/dist"
