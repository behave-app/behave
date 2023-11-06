set -e
nerdctl.lima build --tag libavjs-webcodecs-bridge-builder .
OUTDIR="$(mktemp -d --tmpdir=/tmp/lima/)"
mkdir "$OUTDIR/libavjs-webcodecs-bridge"
nerdctl.lima run --rm -ti -v "$OUTDIR/dist":/libavjs-webcodecs-bridge-0.0.6/dist libavjs-webcodecs-bridge-builder bash -c 'make && mv libavjs-webcodecs-bridge.js libavjs-webcodecs-bridge.min.js types dist'
echo "Files are in $OUTDIR/dist"
