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
As described in [the models FAQ]("./model-faq.html), a model can be thought of as one super-complex function that takes an image as input, and a number of detections as output.
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

The easiest answers are related to the previous answer: find a smaller model (we have some hints in the [model FAQ](./model-faq.html), get a better computer and make sure that your windows drivers support WebGPU.

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

Read the [model FAQ](./model-faq.html) for more information.

### Infer failed, what could be the reason?

There are a couple of reasons why infer may fail.
If infer consistently fails on videos from a certain camera / in a certain format, while it works on other videos, then check the [format FAQ](formats-faq.html) to make sure your format is supported.

Infer may fail because the computer runs out of memory during the infer.
In this case, lowering the concurrency can resolve memory pressure.
As a last resort, one can choose to switch the model from running on WebGPU to running on WASM.
This is a much more robust method to run inference (however also a lot slower often).

You are always welcome to reach out and have us look into the reasons that inference failed in your case.

### What video formats are supported / why is my format not supported / how can I get my video format supported?
Please see the [format FAQ](formats-faq.html).

### Is it better to run BEHAVE infer, or run infer in a third party tool?

### What format is the file that infer writes?

### How can I convert the output of my custom infer tool to BEHAVE UI's format?

