set -e
nerdctl.lima build --tag libav.js-dev .
OUTDIR="$(mktemp -d --tmpdir=/tmp/lima/)"
mkdir "$OUTDIR/dist"
LIBAVJS_VERSION=4.6.6.0.1
nerdctl.lima run --rm -ti -v "$OUTDIR/dist":/libav.js/dist libav.js-dev make dist/libav-$LIBAVJS_VERSION-behave.dbg.js dist/libav-$LIBAVJS_VERSION-behave.dbg.simd.js dist/libav-$LIBAVJS_VERSION-behave.dbg.simd.wasm
echo "Files are in $OUTDIR/dist"
