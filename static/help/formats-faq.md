# Supported formats FAQ

### Which video formats are supported in BEHAVE convert / infer?

We decided to take an approach in BEHAVE that we limit the allowed formats to the ones that we know that work.
This means that we only enabled those formats that we actually had examples from that we could test.
It's very likely that other formats also work, however we want to avoid enabling all of them and then later finding out that they lead to subtile bugs.

If you have a format that currently is not supported, we are happy to look into getting it to work; please contact us.

Currently supported are MP4 files (MP4 files don't need a convert step, so are not supported in convert) and MTS files (with a conversion step).
It should be noted that even within MP4 and MTS files, there are many small differences.
It therefore can happen that your particular files do not work.
In that case, please contact us with an example video and we will look into it.

### Why does a certain video file not work in convert / infer / BEHAVE?

We have seen that very occasionally it happens that a video file does not work in BEHAVE, even though all other video files from the same camera do work.
We don't know exactly why this happens.
We would be very grateful if you would be able to share this file with us, so that we can test it internally.
At the same time we cannot guarantee that we will be able to fix this.

If none of the files of a certain camera work, please see the previous and next question.

### How can I ask for my video format to be supported in BEHAVE?

If you send us an example of the video that does not work, we will look into what we can do to support it.
Please send us the whole file (usually you can use Dropbox or Google Drive to send large files; if not, let us know and we can give you an upload link); if you use software to make the video smaller, or send only part of the video, it may result in a video file with a slightly different format, and we will be adding the wrong format.

