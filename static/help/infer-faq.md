# Infer FAQ

### What happens during infer?

Each frame of the video is fed through a YOLO Object Detection AI model, which detects objects on the frames.
These results are stored in a JSON file, to later be used in BEHAVE UI.

### Why is infer so slow

The easiest answer is: it needs to do many frames.
A typical 30 minute, 25 frames per minute, video has 45,000 frames.
Running an AI model on a single image (inferring) is a complex operation, that has to be repeated for all images.
Even if inferring a single image takes 0.1 seconds, the video as a whole will be 45,000 * 0.1 seconds = 75 minutes.
Depending on the model and the computer that is used for inference, doing a single frame may take considerably more than 0.1 seconds.

### Is it possible to run infer not on every frame but for instance only on 1 frame in 10

We plan to release this feature in the near future, you may check its progress, comment on it, or just show your support for this feature, [in this GitHub issue](https://github.com/behave-app/behave/issues/71).

### The infer page seems to have reloaded itself while I was not looking
The infer page tries to tell the browser that it's doing useful work even when you're not looking at it, and asks the browser to please please please let it run.
This works well most of the time, but when the browser detects that the computer is running out of memory or compute resources, the browser may still decide to close the webpage while you're not looking at it, and quickly load it the moment you open the tab again.
The would work fine in many cases, but in the case of infer, all the work is lost.

We are looking into more robust solutions for this.
In the meantime there are a couple of tricks you can use to make sure the page does not get unloaded.

- Always keep the page visible on the screen. As long as only a small corner of the webpage is visible, the browser will not close it.
- Use a slightly lower concurrency. A lower concurrency may mean that it takes slightly longer to infer all your videos, but it will leave more "space" on your computer for other things, meaning that the browser is less likely to close the page.
- Don't do other tasks that require a lot of CPU / memory while inferring


### Infer failed, what could be the reason

There are a couple of reasons why infer may fail.
If infer consistently fails on videos from a certain camera / in a certain format, while it works on other videos, then check the [format FAQ](formats-faq.html) to make sure your format is supported.

Infer may fail because the computer runs out of memory during the infer.
In this case, lowering the concurrency can resolve memory pressure.
As a last resort, one can choose to switch the model from running on WebGPU to running on WASM.
This is a much more robust method to run inference (however also a lot slower often).

You are always welcome to reach out and have us look into the reasons that inference failed in your case.

### What formats are supported / why is my format not supported / how can I get my video format supported?
Please see the [format FAQ](formats-faq.html).
