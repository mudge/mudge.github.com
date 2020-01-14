---
layout: post
title: Scripting Photos for macOS with JavaScript
excerpt: Automatically editing photo metadata for iCloud Photos using JavaScript for Automation.
image: /i/script-editor.png
redirect_from: /2019/11/13/scripting-photos-for-macos-with-javascript.html
---
I recently imported hundreds of home videos from the past 20 years into [Photos for macOS](https://www.apple.com/uk/macos/photos/) only to discover that none of the videos had the correct date and time. Thankfully, the correct date and time were encoded into each video's filename, e.g. `CLIP-2003-08-02 21;40;28.MOV` but I didn't fancy updating them all by hand.

As I use [iCloud Photos](https://support.apple.com/en-gb/HT204264) to back up and store all my videos and photos, I needed to find a way to update individual items' metadata that would also register with iCloud. As editing the underlying files stored inside the rather opaque `Photos Library.photoslibrary` wasn't guaranteed to propagate changes to other devices, I decided the safest approach was to use Photos for macOS directly and rely on the [JavaScript for Automation](https://developer.apple.com/library/archive/documentation/LanguagesUtilities/Conceptual/MacAutomationScriptingGuide/index.html) framework introduced in OS X 10.10. This gives us the ability to use JavaScript in place of the rather more arcane [AppleScript](https://developer.apple.com/library/archive/documentation/AppleScript/Conceptual/AppleScriptLangGuide/introduction/ASLR_intro.html#//apple_ref/doc/uid/TP40000983) to automate actions in macOS applications.

1. [Running scripts](#running-scripts)
2. [Using the Photos Dictionary](#using-the-photos-dictionary)
3. [The final script](#the-final-script)

## Running scripts

<img src="/i/script-editor.png" class="pull-right" width="375" height="379" alt=""> There are several ways to write these scripts but let's start by using the Script Editor application found in `/Applications/Utilities`, starting a new script and choosing "JavaScript" from the "Script language" dropdown.

If we open up Photos and select a few items, we can run the following JavaScript in our Script Editor window to print out the selected item filenames:

```javascript
const Photos = Application("Photos");

for (const photo of Photos.selection()) {
    console.log(photo.filename());
}
```

Note we're using relatively modern JavaScript features here from [ECMAScript 6](http://es6-features.org/#Constants) such as `const` and `for...of`, this is because [JavaScript for Automation uses the JavaScriptCore from the version of Safari bundled with macOS](https://github.com/JXA-Cookbook/JXA-Cookbook/wiki/ES6-Features-in-JXA) and I'm running macOS Catalina 10.15 and Safari 13.

Running the script will print its output in the bottom pane of the Script Editor, hopefully listing the filenames of your selected items.

Alternatively, if you're more comfortable on the command line, we can start a REPL using `osascript`:

```console
$ osascript -il JavaScript
>> Application("Photos").selection()
=> [Application("Photos").mediaItems.byId("16AE4D88-E094-466E-B726-74CE4E876DE5/L0/001"), Application("Photos").mediaItems.byId("D11B78C8-82CD-472F-9039-DA148FEF8092/L0/001")]
```

## Using the Photos Dictionary

<img src="/i/photos-dictionary.png" class="pull-right" width="375" height="324" alt=""> While it is all well and good printing filenames, what else can we do with our items? To find out, we can open the Photos "Dictionary" (AppleScript terminology for its API documentation) using Script Editor by going to `File > Open Dictionary...` and choosing `Photos.app` from the list.

You can then choose `JavaScript` from the language dropdown and browse the `Photos Suite` to see the various objects and properties available to you. It's useful to know that the root object you'll be using is the `Application` which is described as follows:

> **Application** _Object_ [see also Standard Suite] : The top level scripting object for Photos.
>
> ELEMENTS  
> contains containers, albums, folders, mediaItems.
>
> PROPERTIES  
> **selection** (list of MediaItem, r/o) : The currently selected media items in the application  
> **favoritesAlbum** (Album, r/o) : Favorited media items album.  
> **slideshowRunning** (boolean, r/o) : Returns true if a slideshow is currently running.  
> **recentlyDeletedAlbum** (Album, r/o) : The set of recently deleted media items

"Elements" here refer to properties on the `Application("Photos")` object so you could print the filename of the first item in your whole library like so:

```javascript
console.log(Application("Photos").mediaItems[0].filename());
```

However, while it appears that `mediaItems` here is an array, it is actually a function:

```javascript
typeof Application("Photos").mediaItems
=> "function"
```

It just happens that these "elements" functions allow you to access specific elements by their index but if you want a true JavaScript array, you'll need to explicitly call the property as a function:

```javascript
// Missing out the () on albums causes an error
for (const album of Application("Photos").albums()) {
  console.log(album.name());
}
```

"Properties" are also functions: to read them, you need to call them. Note that, unlike "elements", they do not support indexing and must always be called as functions:

```javascript
Application("Photos").selection()
=> [Application("Photos").mediaItems.byId("16AE4D88-E094-466E-B726-74CE4E876DE5/L0/001"), Application("Photos").mediaItems.byId("D11B78C8-82CD-472F-9039-DA148FEF8092/L0/001")]
```

Read-only properties are documented as `r/o` (such as `selection` above) but properties without this mean they can be updated.

If we take a look at the documentation for a `MediaItem`, we can see the two properties we're interested in:

> **MediaItem** _Object_ : A media item, such as a photo or video.
>
> PROPERTIES  
> **date** (date) : The date of the media item  
> **filename** (text, r/o) : The name of the file on disk.

In order to read the filename and date, we know to call them as functions:

```javascript
Application("Photos").selection()[0].filename()
=> "IMG_9295.HEIC"

Application("Photos").selection()[0].date()
=> Tue Nov 12 2019 08:28:34 GMT+0000 (GMT)
```

However, to _set_ a property, we set it as we would any property in JavaScript (even though there is already a function with the same name):

```javascript
Application("Photos").selection()[0].date = new Date(2001, 0, 1, 12, 0, 0)
=> Mon Jan 01 2001 12:00:00 GMT+0000 (GMT)
```

## The final script

With this and a little help from [JavaScript Regular Expressions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions), we're now able to write a script to update my videos:

```javascript
// Regular expression to extract date and times from filenames
const pattern = /CLIP-(\d{4})-(\d{2})-(\d{2}) (\d{2});(\d{2});(\d{2})\.MOV/;

// Pull out all the items from my current selection that match the above pattern
const clips = Application("Photos").selection().filter(item => pattern.test(item.filename()));

// For every matching clip...
for (const clip of clips) {

  // Take the current filename
  const filename = clip.filename();

  // Extract the date and time from the above filename
  const [, year, month, day, hours, minutes, seconds] = filename.match(pattern);

  // Create a new Date object for the above (note months are 0-indexed in JavaScript)
  const newDate = new Date(year, month - 1, day, hours, minutes, seconds);

  // Log the change we are about to make for posterity
  console.log(`Setting ${filename} date to ${newDate} from ${clip.date()}`);

  // Update the date, persisting the change to iCloud Photos
  clip.date = newDate;
}
```
