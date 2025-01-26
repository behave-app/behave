# Model FAQ

During the first step of the [infer task](./infer-faq.html), you will be asked to choose a model.
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

The [infer FAQ](./infer-faq.md) has more information about the speed of a model and how this can be improved.

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

### Why do you support only Ultralytics YOLO architecture models?

Ultralytics YOLO are some of the most versatile, most used models and best performing models.
When we started the project 2 years ago, this was an obvious choice for us, also because MegaDetector was using this architecture.

We are more than happy to also support other model architectures if there is a serious interest in them.

Of course any other model architecture can still run infer outside of BEHAVE, and then import the results into BEHAVE UI. Please see the [infer FAQ](./infer-faq.html) for more info.

### Why do all models only look at a single image?

As follow up to the last question, it may be interesting in looking at models that don't look at a single image to determine if something interesting is happening, but look at multiple images (just as a human will more easily pick out something interesting from a video stream than from a photo).
Late 2024 [we have seen a paper doing just that](https://www.mdpi.com/1424-8220/24/24/8002), and we are excited to follow their progress, or try something similar for ourselves.

### How do I obtain an .onnx file for my model?

The YOLO models are usually distributed as `.pt` files, whereas BEHAVE infer needs the models in .onnx format.

We convert between the formats using the [ultralytics python package](https://pypi.org/project/ultralytics/), but there may be other ways to do it.

Feel free to contact us if you want a certain model converted, we would be happy to do it.
