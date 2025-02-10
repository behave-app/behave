# How to use the programmable ethogram

This guide assumes you have completed the [Quickstart Guide]($(BASEDIR)/guides/quickstart.md).

BEHAVE UI allows one to setup an ethogram (a list of behaviours that can be recorded).
Each behaviour can be given a shortcut keystroke, so that behaviour recording can happen fully by keyboard.
Both the list of subjects and the list of behaviours (and the chosen shortcut keys) can be saved into a file for easy backup, or in order to share the settings between multiple computers.

## Opening the shortcut settings

The ethogram is defined on the shortcuts-settings page.
In order to access this page, click the shortcut settings button <button><span class="iconWrapper"><span class="icon">indeterminate_question_box</span></span></button> in the left bar of BEHAVE UI (you may need to close the "upload video file" window first by pressing <kbd>esc</kbd> or clicking next to its window).
Note that in the controls and info pane is open as well (the default), the same button can also be found all the way on the right.

![Location the shortcut buttons can be found in the default layout]($(BASEDIR)/assets/shortcuts-button.webp)

The shortcuts settings page shows all the currently defined actions and the associated shortcuts.

![Shortcuts settings page]($(BASEDIR)/assets/shortcuts-settings-page.webp)

Let's understand what is displayed here.
The shortcuts settings page has three sections, "General Shortcuts", "Subject List and Shortcuts" and "Behaviour List and Shortcuts" (you may need to scroll to see them all).

We first focus on the large buttons under the "General Shortcuts" section (annotated by a red box in the screenshot above).
These buttons represent all the actions that can be taken to control BEHAVE UI.
This is a fixed list of actions (as opposed to the "Subject/Behaviour List and Shortcuts" actions (that do the actual behaviour coding), which can be deleted and created to suit the user's needs).
Each large button is an action (and you can click the button directly on this page to execute that action).
A button can be enabled or disabled (meaning: can you press it), depending on the current state of the UI.
For instance, when no video is loaded, the "play" and "next frame" actions are disabled ("next frame" will also be disabled when you are already looking at the last frame in a video).
In addition a button can be pressed-down or not-pressed-down (meaning: is the associated action active or not).
Note that for instance a "play" button can be in the pressed state (when the video is playing), whereas a "next frame" button will never stay in the pressed-down state.
In the screenshot, _Show "Behave version and video info"-popup_ is enabled, not-pressed, whereas _Show "Key shortcuts help and customization"-popup_ is enabled and pressed (note: to see a button's full title, hover the mouse over the button and a tooltip will appear).
This button is pressed, because right now the "key shortcuts popup" is shown (the page you're looking at right now; whereas the "Behave version and video info popup" is hidden).
_Increase playback speed_ is disabled (not not pressed) since no video is loaded; there are no examples of disabled/pressed.

At the right side of each action, the keyboard shortcut defined for that button can be seen (the default shortcuts were chosen so that the left side of a US QWERTY keyboard can be used to control the video playback).
Some actions have no keyboard shortcuts, others have a single shortcut, and yet others have multiple shortcuts.
For instance, _next frame_ has the shortcut <kbd>D</kbd>, whereas _Pause if playing, play if paused_ has two keyboard shortcuts: <kbd>S</kbd> and <kbd>Space</kbd>, meaning that either key will control this action.
Some shortcuts have modifier-keys (e.g. _Show "Key shortcuts help and customization"-popup_ has a single shortcut <kbd>Shift</kbd> + <kbd>/</kbd> (on US keyboard layouts, the characters that is typed by pressing <kbd>Shift</kbd> and <kbd>/</kbd> is a question mark, which is the icon for this action).
All shortcuts can be customised, we will do this later in the guide.

Now let's look at the actions in the "Subject Lists and Shortcuts" sections, the yellow box on the screenshot.
There are two subjects defined by default: "Andrea" and "Beatrice" (each with their own shortcut).
As can be seen in the screenshot, all subject actions are disabled, since no video file was loaded into BEHAVE UI yet.
Unlike general actions, subject actions are either all enabled or all disabled, and cannot be in "pressed down" state.
The same is true for the behaviour actions (in the dark-blue box): either all behaviour actions are enabled, or all are disabled.

We have in our explanation so far skipped over the drop-down lists that are just above the red, yellow and blue boxes (reading: "default", "example subjects" and "example behaviours").
These are used to select shortcut lists, meaning that you can have multiple lists of subjects, behaviours, and keyboard shortcut mappings, and quickly switch between them.

Let's click on the "default" drop-down (in the "General Shortcuts" section) and select "Create new...".
Give the new shortcut list the name "tutorial".
You will now see that all "tutorial" is chosen as shortcut list, and all keyboard shortcuts were removed (switch between "default" and "tutorial" in the drop-down, and see that one has shortcuts on the actions, and the other does not).
Since the actions are fixed in the general section, the newly created, empty, "tutorial" still has the same actions, but no shortcuts.

Now let's try to do the same thing for "Subject List and Shortcuts": click on "example subjects", choose "Create new..." and give the name "tutorial subjects".
Since subject actions are not fixed, you're now faced with an empty list (no subject actions are present).
This will work the same for behaviour actions.

The four buttons on the right to the shortcut list drop-down, are actions that can be taken on the shortcut list:

- <button><span class="iconWrapper"><span class="icon">edit</span></span></button>: change the name of the shortcut list
- <button><span class="iconWrapper"><span class="icon">content_copy</span></span></button>: duplicate the current shortcut list
- <button><span class="iconWrapper"><span class="icon">download</span></span></button>: export the shortcut list to a file (inside the drop-down there is an "Import from file..." option to reimport it on the same or another computer)
- <button><span class="iconWrapper"><span class="icon">delete</span></span></button>: delete the shortcut list

Feel free to play around a bit with creating new shortcut lists and removing old ones.

### Sections, shortcut lists, actions, shortcuts
The whole structure may seem a bit disorienting at first (with sections, shortcut lists, actions and shortcuts).
Many people will use BEHAVE with a single shortcut list (per section); in this section we give some examples why multiple lists may be useful.
Whether this applies to your case, is something you have to decide for yourself.

First the structure.
There are three _sections_, "general", "subjects" and "behaviours".
Each of these sections has one or more _shortcut lists_ (each of which has a unique name), of which one (per section) is the active shortcut list.

Each shortcut list contains _actions_.
Actions are the buttons you can click (the actions you can take) within BEHAVE.
In the case of the general section these actions are fixed (you cannot add or remove actions, and each shortcuts list has exactly the same actions).
In the case of subjects and behaviours sections, the actions are dynamic.
You can add and remove actions, a new shortcut list in this section will start with 0 actions (unless you duplicated another shortcut list), and you can add as many actions as you like to the shortcut list.
The _actions_ in these sections are the subjects and behaviours you want to record (we call them _actions_ because if you create a subject called "Andrea", you actually add a button that performs the "Add a new line to the behaviour file, with Andrea as subject"-action).
Different shortcut lists in the subjects section (and likewise in behaviours) can have completely different actions, partly overlapping actions, or completely the same actions (there are use-cases for each, which we will get to below).

Finally, each action can have one or more _shortcuts_ connected to it.
A shortcut is a keyboard combination (it can be a single key like <kbd>A</kbd>, a special key like <kbd>F1</kbd> or a combination of modifier keys and other keys (e.g. <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>backspace</kbd>); note that a combination of non-modifier keys is not allowed, so <kbd>A</kbd>+<kbd>B</kbd> is not possible).
There are some things to consider when choosing your shortcuts, please see the note below.

<div class="note_information">

### What are good shortcuts

BEHAVE UI likes to put you in charge of the shortcuts you can use; it asks the browser to be in control of every key-press, and then records them (when you record a shortcut) and handles them when you press that key combination while watching a video.
In addition it asks the browser not to execute the default behaviour for that key-press (e.g. on windows, <kbd>Ctrl</kbd>+<kbd>C</kbd> will by default copy the selected text; if this shortcut is registered in BEHAVE, the BEHAVE webpage asks the browser not to do the copy action).
In practice, some browsers listen to these requests better than other browsers.
Some browsers will therefore, when <kbd>Ctrl</kbd>+<kbd>C</kbd> is pressed, only do the associated BEHAVE action, some will do both the BEHAVE action and the default (copy) action, and some will only do the copy action (never letting BEHAVE know that these keys were pressed).
Obviously this may be frustrating if, after changing ones browser, or when exporting the shortcut list to another (a colleague's?) computer, the shortcuts behave differently.

So in order to stay most compatible, we would advice to use the following rule: Only use letters and number keys (and of course only use those letters that are on everyone's keyboard), and only use <kbd>Shift</kbd> as a modifier.
This will give you (26 + 10) * 2 = 72 actions, which should probably be enough.

(a quick final note: keyboard combinations are recorded as the _key_ that is pressed, not the _character_ that is printed.
Therefore <kbd>B</kbd> means "pressing the `B` key", even though that key would result in a lowercase `b`; else we would write <kbd>Shift</kbd>+<kbd>B</kbd>.
Likewise the default shortcut to open the shortcuts settings popup, is <kbd>Shift</kbd>+<kbd>/</kbd>, which on a US keyboard would print a character `?` (however on a French AZERTY keyboard this combination cannot be typed, since there is no <kbd>/</kbd> key (a `/` is typed by doing <kbd>Shift</kbd>+<kbd>:</kbd>).
This last example also shows why using non-letter-and-number keys for shortcuts will not work as well when you move between computers.

</div>

In all this structure the _shortcut lists_ are probably the most confusing.
In many situations a user may be completely fine with having only a single shortcut list per section, however some advanced use-cases demand that multiple shortcut lists are available and can be switched between.

The most obvious situation is having multiple shortcut lists in the subjects section.
When doing behaviour coding, there may be multiple nests / burrows / locations from which video is available, which have distinct individuals (subjects).
One solution may be to make a single subject shortcut list with all individuals from all locations.
This leads however to potential behaviour coding mistakes (during coding accidentally an individual from another location may be chosen).
In addition, when there are many locations, one may run out of shortcuts.

So in this case it would make more sense to create a separate shortcut list per location.
These lists can reuse the same shortcuts (even in a consistent manned; e.g. <kbd>Shift</kbd>+<kbd>M</kbd> is always the alpha male, <kbd>Shift</kbd>+<kbd>F</kbd> always the alpha female, etc).
Behaviour coding for all locations would use the same behaviour shortcut list (the list of behaviours you would want to code), but the subject shortcut list would be custom to the per location.

Having a second behaviour shortcut list probably makes sense if videos are coded for different projects: project A may use a certain list of behaviours it's interested in, project B uses another list.

The benefits of having a second general shortcut list are harder to imagine.
Possibly if multiple people are using the same computer (but are used to different shortcuts).

In the end BEHAVE doesn't dictate if one list or multiple lists are best for a certain situation.
It provides the ability to use multiple lists, and leaves it up to the user on what they prefer.



<div class="note_information">

### Shortcut collisions

It's fully possible for a single key-combination to be bound to multiple actions, either actions within the same section, or actions in different sections.
For instance, the default shortcut lists define <kbd>Shift</kbd>+<kbd>C</kbd> to be a shortcut for the behaviour-action "Climbing".
If one is to make a new subject-action "Clarice", and also assign the shortcut <kbd>Shift</kbd>+<kbd>C</kbd> to it, there is a shortcut collision.

If a shortcut collision is created, a couple of things happen:

- The place where the shortcut was defined gets a red glow, and a message is added to describe what other action this action collides with.
- All actions that have colliding shortcuts on them, turn red in the overview.
- When the shortcut key combination is pressed, a popup appears explaining that multiple actions are defined for this shortcut, and the user is to choose one.

![When multiple actions are assigned to a single key, you have to choose which one you mean]($(BASEDIR)/assets/multiple-actions.webp)

Generally we expect users want to avoid creating collisions (however in certain cases they might be useful, for instance to bring up a list of not-often-used alternatives; again, it's up to the user to decide on what works for them).

In order to avoid collisions (also when a new subject shortcut list is imported, or when switching between shortcut lists), it may be best to agree with the whole team which keys are for which actions.
For instance, the default general shortcut list only (with a couple of exceptions) uses lowercase letters on the left of the keyboard.
A possible rule could be to assign subjects only to the numbers, and use the right hand side letters for behaviours (obviously there are many more strategies possible, find the one that works for your team).

</div>

## Create/edit actions, and assign shortcuts

Let's start by changing some shortcuts in the "General Shortcuts" sections.
Remember that in this sections, the actions are fixed and cannot be changed; only the shortcuts can be changed.
First make a duplicate of the "default" shortcut list by selecting the "default" list from the drop-down and clicking <button><span class="iconWrapper"><span class="icon">content_copy</span></span></button> (it will be called "Copy of default").
By using a duplicate, we can play around without having to worry that the original shortcuts get changed.

We can edit actions (including editing shortcuts) by clicking on the [edit]{.icon} icon that appears to the right side of an action when the mouse hovers over the action.

![When hovering over an action, an edit-button appears]($(BASEDIR)/assets/shortcuts-action-edit-icon.webp)

Clicking the button opens an action edit popup:

![Action edit popup]($(BASEDIR)/assets/shortcuts-edit-action-popup.webp)

At the top we see the name of the action, then the status (in this case this action is disabled), and then a list of shortcuts keys (with a button to add a shortcut keystroke) and a "close" button.
Click the <button><span class="iconWrapper"><span class="icon">add</span></span> Add your first keystroke</button> button.
The app will immediately start recording your keystrokes; let's record a keystroke <kbd>Shift</kbd>+<kbd>G</kbd>.
Feel free to play around, record another keystroke, delete it, and once done, press "Close".
The shortcut is now recorded on the action (however since the action is disabled, pressing the key has no effect).

![Shortcut recorded on the action]($(BASEDIR)/assets/shortcuts-action-shortcut-recorded.webp)

Now add a shortcut <kbd>V</kbd> to the _Show "Behave version and video info"-popup, and after closing the action edit popup, press <kbd>V</kbd> and the version-and-info popup is immediately shown.

Assigning shortcuts to subject and behaviour actions is exactly the same.
These sections however also allow creating new actions, deleting actions, and renaming actions.
These steps should be self-explanatory, feel free to play around a bit with them.

## Exporting and importing shortcut lists

A shortcut list can be exported to a file by clicking the <button><span class="iconWrapper"><span class="icon">download</span></span></button> button next to the shortcut lists drop-down.
Try this now.

This exports the list of actions, and the keyboard shortcuts associated with each action.
The file can be stored as a backup for later, or transferred (e.g. emailed) to another computer and imported there, so that multiple computers share the same actions and shortcuts.
In order to import the actions, choose "Import from file..." from the shortcut lists drop-down (of the appropriate section).
The actions will be imported into a new shortcut list.
