### Is it possible for BEHAVE to do behaviour coding fully automatically?

No.

Even though there possibly are AI models out there that can, in theory, do very simple behaviour coding, these are not supported by BEHAVE, since BEHAVE is not designed for this.
We believe that in the coming years these models (even if they exist) at best can do some very rudimentary behaviour coding.

### What kind of speedup can I expect?

The idea of BEHAVE is that you will be able to do behaviour coding of long videos a lot faster thanks to AI detections.
A logical question is "how much faster"; the annoying answer is "it depends".

Let's assume one has a 1 hour time-laspsed video, that has to be played at 1-speed (so 1 hour) to see if there is any activity.
So the baseline without BEHAVE is 1 hour (and possibly more if there is a lot of activity and a lot of pausing / searching back is necessary).

In the most optimal case (speedup-wise) there is no activity at all on the video, which one sees as soon as BEHAVE is opened.
This will take 10 seconds, so you saved yourself 59:50 :).

In the worst case, there is activity on the video all the time, and BEHAVE's AI detections don't add any benefit.
We still think that BEHAVE adds a benefit over using just a video player and excel in coding and data consistency, but there are other programs for this as well.

Most cases will be somewhere in between: skipping the sections without detections will speed things up, but time is still needed for watching and coding the sections with detections.

Speedup can be influenced as well by the chosen model.
If the model can very accurately detect the target species or target individual (also see [the model FAQ]($(BASEDIR)/help/model-faq.html)), there will be fewer frames that have to be inspected that do not contain data you're interested in.

### Is BEHAVE suited for my use-case?

We mostly think BEHAVE is suited for situations where long continuous videos are taken where only occasionally there is activity.
The more videos there are, the more it makes sense to have a dedicated app for behaviour coding.
The more sections there are without activity, the more sense it makes to use AI to detect them (especially if there are AI Models that do a good job in detecting these sections; even if not, at a certain amount of videos it still makes sense to train a custom AI model; see [the model FAQ]($(BASEDIR)/help/model-faq.html) for more info).

There may be other use-cases that can benefit from BEHAVE that we did not consider yet, or that we have not implemented yet.
We especially think that the low bar set by the "zero-install" mentality of BEHAVE may make it useful in many situations when only occasional AI inference is needed.

We would love to come into contact with teams that believe that (parts of) BEHAVE (with some small improvements) may be useful for their use-cases.
We cannot promise we can accommodate all requests, but we will always be happy to see what's possible.

### What kind of accuracy can I expect from the AI inference?

We invite you to read the [infer FAQ]($(BASEDIR)/help/infer-faq.html) and [model FAQ]($(BASEDIR)/help/model-faq.html) for a more in-depth answer.

Here we just want to explain that the used AI model is what determines the accuracy of the detections (no matter how you want to define the accuracy).
BEHAVE does not provide any AI models.
It has some links to AI models that one can use, and whether these perform well enough or not really depends on the video.

For instance, a well let video where a large mammal will move into the center of the image, will probably perform better (on general animal models) than a dark video of an obscure insect from an awkward angle.
On the other hand, if the model is specifically designed for insects in dark places and from awkward angles, it may do that job extremely well, while completely ignore an elephant taking up the whole frame.
