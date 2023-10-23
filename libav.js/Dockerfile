FROM emscripten/emsdk

ARG ENV

RUN apt-get update -y && apt-get upgrade -y && apt-get install -y pkg-config vim git

RUN git clone https://github.com/Yahweasel/libav.js /libav.js && cd /libav.js && git checkout v4.5.6.0

COPY configs/behave  /libav.js/configs/behave/

WORKDIR /libav.js
