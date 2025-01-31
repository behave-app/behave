# Convert FAQ

### Why is there a convert step necessary? Why can BEHAVE UI not just open all video formats?

The BEHAVE UI runs in the browser. It uses the HTML `<video>` tag, which does not support all formats.
Especially .MTS video files are not supported by default.

There are some work around for that, and we have extensively looked into those, but we have not found a satisfactory one.
Especially the fact that we want quick random access (including quickly showing the _previous_ frame) in BEHAVE UI, and we want this to work smoothly even on not state-of-the-art laptops, we are for now limited to using MP4 files in the BEHAVE UI.

NOTE: Because of the way video steams are encoded in a file, showing the _next_ frame is much easier (e.g. required much less work from the computer) than showing the _previous_ frame.
Since being able to step forward and backward quickly is essential when doing behaviour coding, even on relatively slow hardware, we decided to use the most performant video player in the browser, which is the `<video>` tag.

### Does the conversion result in loss of quality?

No. The chosen method for conversion does not result in a loss of quality.
Only the container format is replaced, the video stream itself remains intact.

### Can I just convert files myself to MP4 in order to use them in BEHAVE?

Yes, this is certainly possible, if you have the software to do so.
Using the BEHAVE convert tool has certain advantages.
Usually certain metadata gets lost when using other conversion tools.
This is true for instance for the timestamps (the "real time" that video camera saves in the MTS files).

Something else to consider is that, depending on the settings in the video conversion, quality can get lost.

### How does BEHAVE convert actually work?

Most of the heavy lifting is done by using a version of the open-source video tool [ffmpeg](https://www.ffmpeg.org) that runs inside browser (through [`libavjs`](https://github.com/Yahweasel/libav.js/)).

The command that is used can be found [in the source code](https://github.com/behave-app/behave/blob/main/src/worker/video.ts).

It globally comes to: `ffmpeg -i #inputfile# -c:v copy -an #outputfile#`, but with some extra flags to store metadata and timestamps.
The `-c:v copy` _copies_ the video stream, rather than re-encode it.
The `-an` strips out the audio stream (see next question)

### Why is the audio stream stripped out of the converted video?
This was done because we were not using the audio stream in BEHAVE, and BEHAVE was developed on timelapsed videos where the audio stream is not useful anyways.
This is something that may be changed in the near future, if we figure out how audio can be used successfully in the BEHAVE UI.

### I think I have found a bug in BEHAVE convert

You are always welcome to contact us, or to [file an issue on GitHub](https://github.com/behave-app/behave/issues/new?template=Blank+issue)

### What formats are supported / why is my format not supported / how can I get my video format supported?
Please see the [format FAQ]($(BASEDIR)/help/formats-faq.html).
