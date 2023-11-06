from debian

RUN apt-get update && apt-get install -y cmake nodejs gzip tar curl npm && rm -rf /var/lib/apt/lists/*

RUN curl -L https://github.com/Yahweasel/libavjs-webcodecs-bridge/archive/refs/tags/v0.0.6.tar.gz | tar xvzf -

WORKDIR /libavjs-webcodecs-bridge-0.0.6
