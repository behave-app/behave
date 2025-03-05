FROM emscripten/emsdk:3.1.47-arm64 AS ready-to-build-arm64
FROM emscripten/emsdk:3.1.47 AS ready-to-build-amd64
ARG TARGETARCH

FROM ready-to-build-${TARGETARCH} AS ready-to-build
ARG LIBAVJS_COMMIT

RUN apt-get update && apt-get install -y cmake pkg-config && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/Yahweasel/libav.js /libav.js && cd /libav.js && git checkout $LIBAVJS_COMMIT
WORKDIR /libav.js

RUN cd configs && ./mkconfig.js behave '["demuxer-ogg", "demuxer-mp4", "demuxer-mov", "demuxer-opus", "demuxer-matrosha", "demuxer-webm", "parser-h264", "swscale", "decoder-h264", "muxer-mp4", "demuxer-mpegts", "cli", "filter-scale", "muxer-ffmetadata"]'

FROM ready-to-build AS build
ARG FILES_TO_BUILD

RUN make $FILES_TO_BUILD

FROM scratch AS artifact
COPY --from=build /libav.js/dist /dist
