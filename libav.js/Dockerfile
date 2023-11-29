FROM debian as emscripten-arm64

RUN apt-get update && apt-get install -y git xz-utils python3 curl && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/emscripten-core/emsdk.git && cd /emsdk && ./emsdk install latest-arm64-linux && ./emsdk activate latest-arm64-linux
ENTRYPOINT ["/emsdk/docker/entrypoint.sh"]

FROM emscripten-arm64 as ready-to-build
ARG LIBAVJS_COMMIT

RUN apt-get update && apt-get install -y cmake pkg-config && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/Yahweasel/libav.js /libav.js && cd /libav.js && git checkout $LIBAVJS_COMMIT
WORKDIR /libav.js

RUN cd configs && PATH=/emsdk/node/16.20.0_64bit/bin:$PATH ./mkconfig.js behave '["demuxer-ogg", "demuxer-mp4", "demuxer-mov", "demuxer-opus", "demuxer-matrosha", "demuxer-webm", "parser-h264", "swscale", "decoder-h264", "muxer-mp4", "demuxer-mpegts", "cli", "filter-scale"]'

FROM ready-to-build as build
ARG FILES_TO_BUILD

RUN if [ "$FILES_TO_BUILD" = "" ]; then echo "ERROR: NO FILES TO BUILD" > /dev/stderr; exit 1; fi; echo 'include Makefile\n\nversion:\n\t@echo \$(LIBAVJS_VERSION)' > Makefile-version && LIBAVJS_VERSION="$(make -f Makefile-version version)" && /emsdk/docker/entrypoint.sh make $FILES_TO_BUILD
      # dist/libav-$LIBAVJS_VERSION-behave.dbg.js \
      # dist/libav-$LIBAVJS_VERSION-behave.dbg.simd.js \
      # dist/libav-$LIBAVJS_VERSION-behave.dbg.thrsimd.js \
      # dist/libav-$LIBAVJS_VERSION-behave.dbg.thr.js \
      # dist/libav-$LIBAVJS_VERSION-behave.dbg.simd.wasm

FROM scratch AS artifact
COPY --from=build /libav.js/dist /dist
