FROM debian as emscripten-arm64

RUN apt-get update && apt-get install -y git xz-utils python3 curl && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/emscripten-core/emsdk.git && cd /emsdk && ./emsdk install latest-arm64-linux && ./emsdk activate latest-arm64-linux
ENTRYPOINT ["/emsdk/docker/entrypoint.sh"]



FROM emscripten-arm64

RUN apt-get update && apt-get install -y cmake pkg-config && rm -rf /var/lib/apt/lists/*

COPY extra-ffmpeg.diff /tmp/
RUN git clone https://github.com/Yahweasel/libav.js /libav.js && cd /libav.js && git checkout v4.5.6.0 && cat /tmp/extra-ffmpeg.diff >> patches/ffmpeg.diff
WORKDIR /libav.js

COPY configs/behave  /libav.js/configs/behave/
