In order to understand why we chose to develop BEHAVE as a Web Application (webapp), it's important to understand the differences between traditional (native) applications and webapps.
This documents describes the advantages and disadvantages of both, and explain the choices we made.

## Native application vs web application (the quick story)

Most applications that people are familiar with are traditional apps (also sometimes known as native apps).
These applications typically need to be downloaded and installed before they can be used.
Well known applications like Microsoft Word, Photoshop and R Studio fall in this category.

Webapps on the other hand are generally started by going to a certain URL in a browser (although icons can be made on the Desktop that directly open a certain URL in the browser).
Probably the most famous application of this type is Google Docs.
BEHAVE is a webapp, but unlike Google Docs, it does not need an account to work, nor is any information stored in the cloud.

A big difference between the two types of applications is the security model, or to what extend the computer trusts the application code.
Native applications generally expect to have wide ranging access to the computer they run on.
They can access many files and other resources on the computer without the use knowing about it.
Even though by far most applications behave properly, and only access the files you tell them to open, there are examples where other files are also read/collected/altered.
In some cases this is done with malicious intend, but often it is the result of a bug in the code, or even behaviour that was intended by the developer, but unexpected by the end user.

Web application on the other hand always start with no access to the computer they run on, and have to ask permission every time they want to do something with the data on the user's computer.
This way the user can always decide whether access to certain resources should be given or denied.

The reason for this difference is where the applications come from.
Traditional apps are descendants of the first applications that were written in the 1980s.
In those days cyber security was not a big topic, and the easiest model was to give applications the same access to the computer that the user running the application had.
This model still remains in place for the most part, even though modern operating systems may ask permission before access to particularly privacy sensitive information is allowed.

Webapps on the other hand evolved from websites.
In the early days of the internet, websites were just pieces of text and images, however with the introduction of JavaScript it started to be possible to add small programs to websites.
However since it would be undesirable if any website you visited, would be able to access files and information on your computer, these small programs would have no access to these files.
By now JavaScript allows one to make very complex programs on your webpage; these kinds of webpages are called webapps.

In recent years it has become clear that webapps can become much more useful if they do have certain access to local resources, and therefore methods were developed how a user can give permission to a webpage (or webapp) to use certain files from the computer.
Furthermore additions to JavaScript (WASM, WebCodecs, WebGL, WebGPU), mean that more and more things can be done from within a webapp, up to the point where things like BEHAVE became possible.

These days (2024) most applications that are being written are still native applications.
This is because a from a developer's point of view, making native apps is easier, and the possibilities of webapps are still largely unknown.
However we would argue that in many cases webapps have big advantages for end users.
Users can try a webapp by simply going to a web address; there is no install step, no commands one has to copy paste into the terminal or Java runtimes that need to be installed.
There is no risk that a webapp will be able to install malware, or look at files on your computer you don't explicitly give it permission to.
Webapps will generally run in many different browsers on many different platforms (although the webapps that use more complex features may be more restricted; e.g. in spring 2024 BEHAVE only runs on a recent version of Chrome).

The downsides of a webapp is that development is harder, there is less choice of development platforms, and there are still certain restrictions -- things that cannot be done in a native app but that are blocked in a webapp.
Also a web app will have to ask permission to access local files, meaning more popups for the user to click through, and can never run as fast as a well optimised native app, although recent developments narrow this gap all the time.
For example, BEHAVE cannot scan your hard disk for compatible video files, a user needs to explicitly drag in the video files they want processed, and Chrome will pop up an extra dialog to ask if you are sure that you want to share certain files.
Finally there is a perception issue; because so much on the internet seems to be aimed at violating privacy or security, a webapp may _feel_ less secure, even though it can do _much less harm_ than a native app.

We chose to develop BEHAVE as a webapp.
All BEHAVE requires is that one has a recent version of Chrome installed on their computer.
There is no installation step, BEHAVE works right out of the box, there is no installation step, and trying BEHAVE is risk-free.

Comparison of native app vs webapp

|         | native | webapp |
|---------|---------|--------|
| Works without install step | 𐄂 | ✓ |
| Secure (only access to files you give it access to) | 𐄂 | ✓ |
| Secure (cannot install other programs) | 𐄂 | ✓ |
| Secure (cannot run other programs on the computer) | 𐄂 | ✓ |
| Works without internet | ✓ | ✓ |
| Can use accellerated AI | ✓ | ✓ |
| Always downloads latest version (if internet is availble) | 𐄂 | ✓ |
