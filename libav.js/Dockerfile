FROM debian as emscripten-arm64

RUN apt-get update && apt-get install -y git xz-utils python3 curl && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/emscripten-core/emsdk.git && cd /emsdk && ./emsdk install latest-arm64-linux && ./emsdk activate latest-arm64-linux
ENTRYPOINT ["/emsdk/docker/entrypoint.sh"]



FROM emscripten-arm64

RUN apt-get update && apt-get install -y cmake pkg-config && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/Yahweasel/libav.js /libav.js && cd /libav.js && git checkout 83ceadd53f92cbdb6048bc0ca4d29591eacdd158
WORKDIR /libav.js

RUN cd configs && PATH=/emsdk/node/16.20.0_64bit/bin:$PATH ./mkconfig.js behave '["demuxer-ogg", "demuxer-mp4", "demuxer-mov", "demuxer-opus", "demuxer-matrosha", "demuxer-webm", "parser-h264", "decoder-h264", "muxer-mp4", "demuxer-mpegts", "cli"]'
