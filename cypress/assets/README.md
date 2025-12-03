Here are files that are needed to run the tests. Mostly these are video files. It's unfortunate that they are clogging up the git repo (probably 99% of the repo's size are these bytes). But for now I don't have a better solution (I bascially don't want to worry about data transfer fees every time the test runs, I guess I could try to cache them somehow....).

For each valid video file, there is also a result for the inference (using the yolov8 litte auk nano model).

Below I will also try to explain what each additional video file brings to the table (probably looking at the commit that added it, should also be able to give you some info):

- example.MTS: default little auk video (that started it all)
- example2.mp4: standard MP4 file
- example-sps-pps-extradata.mp4: MP4 file with extradata (see https://stackoverflow.com/a/66751323/1207489)
- example-sps-illegal-padding.mp4: Received an MP4 file with additional 0 bytes padding to the SPS. This is illegal per spec, but it seems to happen a lot (often to align to 2 or 4 byte boundary), and all parsers out there seem to accept and ignore the padding.
