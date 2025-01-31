# Model FAQ

During the first step of the [infer task]($(BASEDIR)/help/infer-faq.html), you will be asked to choose a model.
If you want to deep-dive into models, we invite you to [read the Wikipedia article](https://en.wikipedia.org/wiki/Machine_learning#Models) and proceed from there.
In this document we will try to explain how models are important to BEHAVE.

### What do you mean by "Model" ?

The first line of above-mentioned Wikipedia article reads:

> A machine learning model is a type of mathematical model that, once "trained" on a given dataset, can be used to make predictions or classifications on new data.

Technically what we mean in BEHAVE context with "model" is a "trained model" (and specifically a Ultralytics YOLO Object Detection trained model), so it's both the "mathematical model" or the architecture, and the weights that it was trained to.

Non-technically, a model (in BEHAVE context) is a (super-complex) formula, where the input is an image, and the output is a list of items found on the image.
"Super-complex" in this case means that the formula itself can be many megabytes large, and may take seconds to complete on a standard computer.

### So give me an example of what a model does

A model takes an image as input.
Take for example the famous [Abbey Road album cover](https://en.wikipedia.org/wiki/Abbey_Road#/media/File:Beatles_-_Abbey_Road.jpg).
Given this image as input, a computer will run the model on this image (this process is called "inference").
A result may be that the model returns the following data (with `((x0, y0), (x1, y1))` being the corners of the bounding box):

|  class          | x0 | y0 | x1 | y1 |confidence|
|-----------------|----|----|----|----|----------|
|person           | 15 | 155| 88 | 277| 95%      |
|person           | 87 | 150| 150| 270| 96%      |
|person           | 148| 160| 218| 278| 93%      |
|person           | 213| 145| 290| 286| 95%      |
|zebra crossing   | 0  | 233| 316| 316| 87%      |
|car              | 47 | 151| 104| 194| 70%      |

That's all, a model is a function that converts an image into this kind of data.


### How are different models different?

From the point of view of the end user, BEHAVE models differ in three areas:

- What items do they detect.
  Each model has a predefined list of "classes" (or labels) it can detect (an example of a class: "person", "bicycle", "car", "dog").
  Some models can detect only a single class, others can detects a hundred classes or more.
  Different models may detect the same part of the image as different classes (e.g. given a photo with a dog on it, some model may use the class "animal", another model the class "dog", yet another model may label it "Jack Russell". Yet another model may not label this item at all (e.g. it may have only classes "car", "lorry", "bicycle", "motorbike", so it will not detect the dog as something it knows"
- How good is the model at detecting the classes (and in which circumstances).
  Most models that have a "person" class, will detect a person when they are taking up a large part in the center of the image.
  But what if the person is somewhere in the background?
  Or what if they are partially occluded, or photographed from the back?
  Likewise, a model's performance may be influenced by low, or bright, light, when there is fog, in the snow, etc.
- How large is the model.
  A larger model will take more space on disk, and will generally take longer to run.

Generally there is a trade-off between the model size, and the first two dimensions, although development in the AI field is quick, and we often see that newer models (newer architecture, better training methods) outperform older models, while being smaller.

### Why should I care about the model size (and therefore runtime)? I thought infer was run in the background anyways?

Even though infer was designed to run in the background (e.g. during the night or over the weekend, when a computer is not in use), running these super-complex formulae (infer) can take so much time that it becomes important again how long infer of a single image takes.

For example, a single 30-minute 25-frames-per-minute video has 45,000 frames.
If each frame takes a second to infer, this means it takes 12.5 hours to process a single video.
This may still be acceptable (over a weekend, one could infer 5 videos).
If the model gets more complex and takes 5 seconds per image, 62.5 hours per video, it may be a lot less acceptable...

The [infer FAQ]($(BASEDIR)/help/infer-faq.html) has more information about the speed of a model and how this can be improved.

### What model does BEHAVE ship with?

BEHAVE made an explicit choice not to provide a model, you will have to find your own model.

### So what model is the best, and where can I download it?

The optimal model for a particular situation depends on the exact context.
For instance for some videos a model that has a class "animal", and therefore can differentiate between frames with an animal and without one, will be all they need.
However in other situations it might be important to find a model that has "cow" and "bird" as separate classes (if you are interested in frames with birds, but not frames with cows).

Above is but one example of how a model can work in some situations but not in others.
This shows that there is no such thing as a "best model"; some models may work best in some situations, other models work best in other situations.
Even if there was a model that performed best in all situations, it would probably be very large (and therefore very slow).

Having said that, if you're just getting started and you're looking for something that works well in detecting animals, the [PyTorch Wildlife repository](https://github.com/microsoft/CameraTraps) has just released (January 2025) MegaDetector 6, both as a very small model ([MDV6-yolov10n.onnx, 9.3MB](https://www.dropbox.com/scl/fi/50zyi776reyrklqchbav4/MDV6-yolov10n.onnx?rlkey=nhmoq09hlmnj1z4m5umx0253g&dl=1)) and a (better performing) larger model ([MDV6b-yolov9c.onnx 101MB](https://www.dropbox.com/scl/fi/u26qtmr7e4txeyafvfbie/MDV6b-yolov9c.onnx?rlkey=17sl4h1fb9tm58zzv31oiv5yn&dl=1)).
They may or may not work well for your use case.


### So which model should I use for BEHAVE?

As explained in the previous question, there is no simple answer for that.
The ideal model detects an object on every frame that you're interested in for coding behaviour, while not detecting anything in all frames that you're not interested in, while at the same time being small.
Obviously such an ideal model does not exist.

In practice you will need a model that is "good enough".
Just like human watching the video might miss an event, the AI model may also occasionally miss something that is important.
Within BEHAVE UI its possible to change the sensitivity of the detections "on the fly", allowing a trade-off between missing events, and looking at lots of frames without events.

Then within the set of models that are "good enough", you want the smallest one.

In practice, I would start to see if the MegaDetector v6 models (see previous question) suffice, and if not, look for alternatives.

If you contact us, we are usually more than happy to think with you and help find the right model for you.

### Should I train my own model?

It's certainly possible to train your own model.
This means that you provide a lot of examples of things your model should detect (and things it should not detect), and the model will become gradually more sensitive to what you want.

Training your own model however is not easy, although many online services are popping up to help you ([google "train your own yolov10 model in the cloud"](https://www.google.com/search?client=safari&rls=en&q=train+your+own+yolov10+model+in+the+cloud&ie=UTF-8&oe=UTF-8); please note that some/most/all of these will require something back when you use their services; either you have to pay, or you have to promise to make your model open source, etc.).

However when you have trained your own model, it will probably outperform more general models.
In the end you will have to make the decision if the energy spent in training a model will pay itself back.

Feel free to contact us with questions about training your own model.
We are far from experts in the field, but we have done this before.

### Can you train my model for me if I just send you a bunch of videos?

Setting up to train a model takes quite a bit of manpower.
We don't intend to train models for other teams as a matter of course.
At the same time we are not saying that we are always unable to help; feel free to reach out to us.

### Can you help us with other AI related problems?

You can always ask, and if it's something we can easily answer we will be happy to do so.
At the same time, don't expect that we are the ultimate experts on all things AI and be prepared to get an answer that we just don't know :).

### Why do you support only Ultralytics YOLO architecture models?

Ultralytics YOLO are some of the most versatile, most used models and best performing models.
When we started the project 2 years ago, this was an obvious choice for us, also because MegaDetector was using this architecture.

We are more than happy to also support other model architectures if there is a serious interest in them.

Of course any other model architecture can still run infer outside of BEHAVE, and then import the results into BEHAVE UI. Please see the [infer FAQ]($(BASEDIR)/help/infer-faq.html) for more info.

### Why do all models only look at a single image?

As follow up to the last question, it may be interesting in looking at models that don't look at a single image to determine if something interesting is happening, but look at multiple images (just as a human will more easily pick out something interesting from a video stream than from a photo).
Late 2024 [we have seen a paper doing just that](https://www.mdpi.com/1424-8220/24/24/8002), and we are excited to follow their progress, or try something similar for ourselves.

### How do I obtain an .onnx file for my model?

The YOLO models are usually distributed as `.pt` files, whereas BEHAVE infer needs the models in .onnx format.

We convert between the formats using the [ultralytics python package](https://pypi.org/project/ultralytics/), but there may be other ways to do it.

Feel free to contact us if you want a certain model converted, we would be happy to do it.

### Can a model distinguish between different individuals within a species?

It's an interesting question.
There has certainly been [research](https://arxiv.org/abs/2304.09657) [into](https://pmc.ncbi.nlm.nih.gov/articles/PMC8490693/) [using AI](https://arxiv.org/abs/2206.02261) [to recognise individuals](https://arxiv.org/abs/1902.09324) (these links are not a full list, just the result of a quick Googling).
Especially in cases when individuals are enhanced in order to improve recognition (e.g. coloured rings on birds), this may be possible to do.

Whether it's worth the effort and whether you are not missing information, depends on the exact situation.
For instance a nest camera in an area where there are always birds around, may benefit from being able to detect the exact individual.
On the other hand, it should be remembered that AI will not alert you to suspicious/interesting behaviour that it was not trained for.

As an example, just last year our group, while using BEHAVE to inspect videos of Little Auks, found [unexpected / unknown alloparental feeding behaviour](https://onlinelibrary.wiley.com/doi/full/10.1002/ece3.11188).
We are using an AI model with BEHAVE that detects Little Auks; if instead we would have been using a model that would only recognise the "registered occupants" of a certain nesting site, its possible this behaviour would not have been noticed (because the alloparent would not have been detected as a subject of interest by the AI).

### How accurate can a model be?

This question is slightly related to the previous one.
An ideal model would detect any subject/situation that you are interested in, while not detecting any other situation.
It will however be impossible to specify exactly the situations you are interested in, especially because if some situation occurs that you did not anticipate, that may be super interesting (and worth an academic paper); so how do you train your model on situations you don't anticipate.

In addition there is another problem.
Often people discuss the accuracy of models (this is how different models are compared in papers or competitions), however this is always based on a very clear set of examples with a ground truth.
There is a picture of a dog, and if the model labels it as a dog it gets 1 point, if it labels it as a cat, -1 point.

In real life the situation is not always that clear.
In many situations subjects of interest are either very far in the background (obviously if the subject is 1 pixel large, it makes sense that it does not get detected. But what about 5 pixels? Or 10? Or 20? There is no clear-cut point at which point the blob of pixels becomes a subject of interest. The same is true for partially occluded subjects, or subjects that are mostly out of the frame.

Therefore we argue that its not even that easy to determine how to determine what model is "the most accurate".

We don't really think it makes sense to talk about "ideal models" or "the most accurate model"; it's more important to find a model that is good enough (next question).

### How accurate does a model have to be?

A much more sensible question that the last one :).

Let's quickly talk about what we need by accuracy.
Basically, an accurate model detects whenever an item of a class it was trained on is in view.
Whenever the model detects something that is not there (e.g. it thinks a stone is an animal), we call it a false positive.
Whenever the model does not detect something that is there (e.g. a there is an animal but the model does not detect it), it's a false negative.
Since the model detects things with a certain confidence (rather than saying "there is a dog there" it says "I'm 65% sure there is a dog there"), one can later (in BEHAVE UI) use a confidence cutoff to find the ideal balance between false positives and false negatives.

What is an acceptable number of false positives and negatives depends on the situation.
Even models that have high false negatives (e.g. they detect an animal only in half the cases that it's in the frame) may be acceptable for slower animals that always are in frame for at least 10 frames in a row (if only one of those frames are detected, the human doing the coding will look at the other ones as well). 
On the other hand, for an animal that is only in frame for single frame, one might want a better true detection rate.

False positives mean that the person doing BEHAVE UI will look at an image where nothing is happening.
This is not a problem if it happens a couple of times per video.
On the other hand, if this happens every other frame, the result is that the detections are useless.

Having said all this, one of the things we learned while developing BEHAVE is that even a model with moderate accuracy was quite useful.
For the first year we ran BEHAVE with the MegaDetector v5 model.
Only when BEHAVE proved to be very useful, we started training our own model with a higher accuracy.

### How would I determine if a model is good enough?

Basically how we determined whether the MegaDetector v5 model was good enough for us was by behaviour coding some videos with BEHAVE with detections, and in the old-fashioned way (manually watching the whole video).
This way it quickly became clear that we did not miss any behaviours when using the detections (meaning we did not have too many false negatives)
At the same time it took much less time (and was more fun) to use BEHAVE (meaning there were also not too many false positives).


It should be noted that MegaDetector v5 is not supported anymore, but MegaDetector v6 (which is both more accurate and faster) is supported.
