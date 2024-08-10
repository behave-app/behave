# Inference speed

Inference is the process of taking a video and using AI to determine which frames have potentially interesting information on them.
This is being done by going through the video frame by frame, and use an AI network to do Object Detection on the still image.
It may be possible to use different (AI or other) methods to determine which frames contain potentially interesting information, but for now BEHAVE implements only the method described above.
BEHAVE does support using external tools to generate the detection file, but this is outside the scope of this page.

Inference is a computationally heavy operation, and therefore the general workflow for BEHAVE is that inference is done some time before behaviour recording is done.
Typically one or multiple video files will be queued in the background, during a time that the computer is not in use (e.g. at night).
In BEHAVE the inference is designed to run on an "average laptop", so that a researcher does not have to invest in additional hardware in order to use BEHAVE.
In our tests we have seen large differences in inference speed however between laptops, and different settings, and this page aims to explain the factors influencing this speed.
To give a high-level idea of what to expect, on a mid-range 2022 MacBook inference will happen at about 3x speed (meaning we can infer a 1 hour video in 20 minutes); at the same time, a low-range 2017 windows laptop did the same videos 10 times slower (taking 5 hours for a 1 hour video).

## Factors in inference speed
We found that all the laptops used by the researchers in our group (including the old laptops used by graduate students) were _able_ to do inference, however some took a whole night for a single video.
In practice we settled on some of the quicker macbooks doing some extra inference, and then sharing the resulting detection files with the owners of the slower computers.

### Number of frames
The first thing to consider in how long inference of a certain video will take, is the length and frame rate of the video.
Since inference is run once for each frame, double the amount of frames means double the inference time.
For example, a 30 minute, 25 frames-per-second video has `30*60*25=45,000` frames.
A 60 minute 25 frames per second video, or a 30 minute 50 frames-per-second video has double the frames, so will take twice as long to infer.

An easy solution to speedup inference, is to tell BEHAVE not to run inference on every single frame, but for instance only one in ten frames.
Whether this is acceptable depends on the subject of the video; a slow animal will generally allow for bigger gaps between which frames are inferred.
Generally using more frames (so smaller gaps) will result in better accuracy, since even if the AI model does not recognise your subject in one frame, it may do so in the next, if the subject is visible for multiple frames.

### Chosen model
AI models have a size, which roughly corresponds to how many calculations need to be done to come to a conclusion (for each frame).
Larger AI models will need more calculations, and therefore take longer on each frame.
The choice of the AI model will therefore influence how long inference takes.

### Hardware inference runs on
AI calculations differ considerably from traditional computer calculations.
Since a couple of years computer manufacturers realise that in the future more and more AI work is required on desktops/laptops/phones, and therefore they start to add specific hardware to accelerate AI calculations.
For computers without specific AI hardware, hardware that was meant to accelerate 3D games, can be used for AI calculations as well.
Many pre-2020 laptops however were created without AI or 3D gaming hardware.
Although these computers may be quite fast in normal operations (like R and python code, or large excel sheets), they will preform worse in inference workloads.

It may be hard to estimate up front for a certain computer how quick it will be able to do inference, although newer laptops and gaming laptops will generally perform better.
We have a [speed test](/speedtest) page where the laptop inference speed can quickly be tested.

At the moment we don't expect inference to run on any mobile phones.

## What inference speed do you need

