#!/bin/bash

sandbox-exec -f ../osx-config/sandboxes/make.sb -DSITE_DIR="$(pwd)" -DTMPDIR="$(realpath "$TMPDIR")" make $@
