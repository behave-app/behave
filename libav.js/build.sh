set -e
OUTDIR="$(mktemp -d --tmpdir=/tmp/lima/)"
nerdctl.lima build . --target=artifact --output type=local,dest=$OUTDIR
echo "Files are in $OUTDIR/dist"
