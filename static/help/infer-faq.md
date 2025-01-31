# Infer FAQ

### What happens during infer?

Each frame of the video is fed through a YOLO Object Detection AI model, which detects objects on the frames.
These results are stored in a JSON file, to later be used in BEHAVE UI.

### Why is infer so slow?

The easiest answer is: it needs to do many frames.
A typical 30 minute, 25 frames per minute, video has 45,000 frames.
Running an AI model on a single image (inferring) is a complex operation, that has to be repeated for all images.
Even if inferring a single image takes 0.1 seconds, the video as a whole will be 45,000 * 0.1 seconds = 75 minutes.
Depending on the model and the computer that is used for inference, doing a single frame may take considerably more than 0.1 seconds.

### What influences infer speed

There are three factors that influence how it takes to infer a single frame:

- The model
- Your computer
- The chosen backend

The model (architecture) has a huge influence on how long it takes to infer a single frame.
As described in [the models FAQ]($(BASEDIR)/help/model-faq.html), a model can be thought of as one super-complex function that takes an image as input, and a number of detections as output.
A certain model may contain hundreds of millions of operations to get to its answer.
Obviously this model is going to be slower than a model that takes only tens of millions of operations.

Generally the file-size of the model is a good approximation for the complexity: a model that is twice as large will take twice as long to run.

Secondly your computer has a very big influence on inference speed.
Unsurprisingly a newer, faster, computer will do inference faster.
However it turns out that the calculations for AI models similar enough to the calculations that are needed to generate 3D scenes, that infer can make excellent use of the same hardware as 3D games.
Therefore gaming-computers are surprisingly good at doing inference (sometimes 10 times faster than the non-gaming devices).
Up till about 2020 most business laptops did not have dedicated gaming hardware, but many later models do.

Lastly, within BEHAVE INFER a backend is chosen on which the model runs.
This selection is done automatically, based on your available hardware (specifically if you have hardware for 3D games in your computer).
The "WebGPU" backend uses the graphics processor (gaming hardware) to run the model, whereas "WASM" runs only on the CPU.
Generally WASM will only be chosen if the system fails to use WebGPU; in such a case it can be helpful to update the windows drivers for your graphics card.

Personally we have very good experiences with using BEHAVE infer on M1 and M2 MacBooks.


### How can I speed up infer

The easiest answers are related to the previous answer: find a smaller model (we have some hints in the [model FAQ]($(BASEDIR)/help/model-faq.html), get a better computer and make sure that your windows drivers support WebGPU.

Another approach may be to do the inference on a different computer.
Detection files (the result from the inference) are simple JSON files that can easily be moved between computers.
If you have a colleague with a faster computer (especially one with better gaming performance), they may be willing to run inference for you.
It may even be feasible if you have lots of videos to buy a dedicated inference machine (the Mac Mini delivers great price/performance here) and run all inference in a central place.

Finally we would advice people to experiment with the concurrency slider in the infer app.
If for instance a concurrency of 2 is chosen, two video files are inferred at the same time, usually in less than twice the time of a single file.


Another idea to make inference quicker is to not infer every frame; unfortunately we don't have this working yet (see next question).

### Is it possible to run infer not on every frame but for instance only on 1 frame in 10?

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

### How accurate is BEHAVE infer? How many false-positives or false-negatives does it produce? Is it more or less accurate than X?

All that BEHAVE infer does is to run a model (which can be compared to a super-complicated function).
The accuracy of the result is therefore 100% dependent on the chosen model.
Whether this model is run in BEHAVE infer or in any other tool makes no difference on the result (technically, there may be some small differences due to rounding errors). 

BEHAVE does not provide a model, and therefore the choice of model (and the trade-offs between accuracy and speed) should be made by the user.

Read the [model FAQ]($(BASEDIR)/help/model-faq.html) for more information.

### Infer failed, what could be the reason?

There are a couple of reasons why infer may fail.
If infer consistently fails on videos from a certain camera / in a certain format, while it works on other videos, then check the [format FAQ]($(BASEDIR)/help/formats-faq.html) to make sure your format is supported.

Infer may fail because the computer runs out of memory during the infer.
In this case, lowering the concurrency can resolve memory pressure.
As a last resort, one can choose to switch the model from running on WebGPU to running on WASM.
This is a much more robust method to run inference (however also a lot slower often).

You are always welcome to reach out and have us look into the reasons that inference failed in your case.

### What video formats are supported / why is my format not supported / how can I get my video format supported?
Please see the [format FAQ]($(BASEDIR)/help/formats-faq.html).


### Can I run inference on one computer / on some central computer / in the could and BEHAVE UI on another machine?

Yes, absolutely!

If you have a colleague with a computer that is good at inference (we know that especially post-2020 apple-silicon macs are very good), it may make sense to ask them to infer a bunch of files.

It may also be an option to buy a Mac Mini and use that as central inference hub.
Although BEHAVE was designed in a way that it should work on most slightly-modern computers, there may be practical reasons to use another method.

### Is it better to run BEHAVE infer, or run infer in a third party tool?

A certain model ran on a certain video frame will always return the same result, regardless in what tool it was run (there are some slight difference due to rounding errors).
However the speed at which inference runs can differ between different setups.
BEHAVE infer uses the Graphics Card (GPU) to speed up inference (if this is available and can be accessed by the browser).
However some setups may have more dedicated hardware to do inference.
Therefore it may be possible third party tools are faster than BEHAVE infer; there are also situations where BEHAVE infer will be faster.

We expect that the situations where a third party tool is much faster than BEHAVE infer will be very few.
A large advantage of using BEHAVE infer is that it makes the correct output format from the start, without post-processing.
However feel free to experiment with different setups.

One situation where a third party tool will be essential is when running a model that is not (yet) supported by BEHAVE infer.

We would love to hear your experiences; for instance if it turns out that there are some much-used models that we don't support in BEHAVE infer, we can look into supporting them.

### What format is the file that BEHAVE infer writes / BEHAVE UI expects?

BEHAVE infer writes (and BEHAVE UI expects) a detection file in JSON format.

```
{
    "version": 1,
    "sourceFileName": "example.MTS",
    "sourceFileXxHash64": "82f16f09b8327ed1",
    "modelName": "yolo11n.onnx",
    "modelKlasses": {
        "0": "person".
        "1": "animal",
        ....,
    },
    "framesInfo": [
        {
            "detections": []
        },
        {
            "detections": [
                {
                    "klass": 14,
                    "cx": 0.64064970703125,
                    "cy": 0.615576513671875,
                    "width": 0.08330521850585937,
                    "height": 0.15274920654296875,
                    "confidence": 0.314255615234375
                }
            ]
        },
        ....,
    ]
}
```

#### version
Version should always be 1

#### sourceFileName
The filename of the video file that was inferred.
Used for information only, may be some other string (including empty string)

#### sourceFileXxHash64
In order to be able to match the correct video file, this contains the [xxh64 hash](https://xxhash.com) of the video file.
In order to speed up matching, only the first and last 5 * 1024 * 1024 bytes are used for the hash (or the whole file if the file is < 10MB).
If this hash does not match, a warning is shown in BEHAVE UI but you can still continue, so feel free to leave this an empty string.

#### modelKlasses
A dictionary of all classes defined in the model, key being class-number (as a string, since JSON only supports string keys) and name being the value.
Make sure that there are no detections with numbers that are not in this list

#### framesInfo
An array, one entry per frame.
The array length should be the number of frames in the video.
Each entry in the array is a dictionary with a single key: `detections`
Even if there are no detections, this key should exist.

##### framesInfo[].detections
An array of all detections in this frame.
BEHAVE infer is set to add all detections with more than 0.25 confidence; BEHAVE UI can filter out detections under a certain confidence.

Each element in the array has a dictionary with keys `klass`, `cx`, `cy`, `width`, `heigh`, and `confidence`.

- `klass` is the class-number that was detected (as a number, not as a string)
- `cx`, `cy` defined the middle-point of the bounding box. The coordinate-system uses (0, 0) for the top-left of the video frame and (1, 1) for the bottom right.
- `width,`, `height` of the bounding box, in the same coordinate-system.
- `confidence` number between 0 and 1

### How can I convert the output of my custom infer tool to BEHAVE UI's format?

Please send us an example of the output that you have, and we can advise you how to convert it.

### Could one use BEHAVE with detections generated in some other way than inference?
Certainly, detections are nothing more than a list of frames that should be investigated in BEHAVE UI.
If there are other data sources having this information (that can be matched to frame numbers) this will certainly also work in BEHAVE.

Other data-sources could be infra-red movement detectors, NFC detectors, sound detection, etc.

If you have such data and would like help with this, let us know!
