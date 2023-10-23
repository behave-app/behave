set -e
nerdctl.lima build --platform=amd64 --tag libav.js-dev .
OUTDIR="$(mktemp -d --tmpdir=/tmp/lima/)"
mkdir "$OUTDIR/dist"
nerdctl.lima run --platform=amd64 --rm -v "$OUTDIR/dist":/libav.js/dist libav.js-dev make dist/libav-4.5.6.0-behave.dbg.js dist/libav-4.5.6.0-behave.dbg.simd.js dist/libav-4.5.6.0-behave.dbg.simd.wasm
echo "Files are in $OUTDIR/dist"
