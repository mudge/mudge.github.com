---
layout: post
title: Naming Dynamically Created iframes
summary: Working around issues with setting iframe names in Internet Explorer.
---
For the past year, I have been working on a web application that relies heavily on [inline frames (aka `iframe`s)](https://developer.mozilla.org/en/HTML/Element/iframe). During the course of development, we have run into some interesting issues and I thought I would record some of these for posterity.

The [W3C specification for the `IFRAME` element][iframe] states the following document type definition:

{% highlight html %}
<!ELEMENT IFRAME - - (%flow;)*         -- inline subwindow -->
<!ATTLIST IFRAME
  %coreattrs;                          -- id, class, style, title --
  longdesc    %URI;          #IMPLIED  -- link to long description
                                          (complements title) --
  name        CDATA          #IMPLIED  -- name of frame for targetting --
  src         %URI;          #IMPLIED  -- source of frame content --
  frameborder (1|0)          1         -- request frame borders? --
  marginwidth %Pixels;       #IMPLIED  -- margin widths in pixels --
  marginheight %Pixels;      #IMPLIED  -- margin height in pixels --
  scrolling   (yes|no|auto)  auto      -- scrollbar or none --
  align       %IAlign;       #IMPLIED  -- vertical or horizontal alignment --
  height      %Length;       #IMPLIED  -- frame height --
  width       %Length;       #IMPLIED  -- frame width --
  >
{% endhighlight %}

The key thing I'm interested in here is the [`name` attribute][name]. Our particular application allows `iframe`s to fire events which are then caught by the parent window. In order to identify the source of these events, the `iframe`s send along their `name` (accessed via [`window.name`][window name]).

If you have an `iframe` like the following in your web page:

{% highlight html %}
<iframe frameborder="0" name="bob" src="/some-page"></iframe>
{% endhighlight %}

And `/some-page` contains the following HTML:

{% highlight html %}
<!DOCTYPE html>
<title>Test</title>
<script>
document.write('My name is ' + window.name);
</script>
{% endhighlight %}

Then the `iframe` should output the following:

    My name is bob

Here's that in action:

<iframe frameborder=0 name=bob src=/code/iframe-test.html></iframe>

However, if you are dynamically creating `iframe`s with JavaScript (perhaps to avoid [BFCache](https://developer.mozilla.org/En/Working_with_BFCache) bugs) then you may run into some issues where `window.name` is `undefined` in Internet Explorer 6 and 7.

Specifically, if you create an `iframe` and set its name like so:

{% highlight html %}
<script>
(function () {
    var iframe = document.createElement('iframe');
    iframe.src = '/some-page';
    iframe.name = 'bob';
    document.body.appendChild(iframe);
}());
</script>
{% endhighlight %}

Then `/some-page` will report the following:

    My name is

Again, a live demonstration (note that this will only be broken in Internet Explorer):

<div id="test-1"></div>
<script>
(function () {
  var t = document.getElementById('test-1'),
      i = document.createElement('iframe');
  i.src = '/code/iframe-test.html';
  i.name = 'bob';
  i.frameBorder = 0;
  t.appendChild(i);
}());
</script>

The same will occur if you use [jQuery][]:

{% highlight html %}
<script>
$(function () {
  $('<iframe/>', {
    src: '/some-page',
    name: 'bob'
  }).appendTo(document.body);
});
</script>
{% endhighlight %}

The issue arises because the `name` of an `iframe` cannot be changed in Internet Explorer, much like the `type` attribute on `input` (there is a [caveat in the jQuery documentation about the `type` issue when creating elements][caveat]).

This means that you must set the `name` attribute on *creation* of the element, not afterwards.

With jQuery, it's a case of doing the following:

{% highlight html %}
<script>
$(function () {
  $('<iframe name="bob"></iframe>').attr({
    src: '/some-page'
  }).appendTo(document.body);
});
</script>
{% endhighlight %}

With pure JavaScript it is slightly trickier as you can no longer use [`document.createElement`](https://developer.mozilla.org/en/DOM/document.createElement). However, you can create a temporary container element (say, a [`div`](https://developer.mozilla.org/en/HTML/Element/div)), and then modify that element's [`innerHTML`](https://developer.mozilla.org/en/DOM/element.innerHTML) to create your `iframe` with its `name` from the beginning. You can then take your newly created `iframe` and insert that directly into the DOM (without ever inserting your temporary `div`) like so:

{% highlight html %}
<script>
(function () {
  var temp = document.createElement('div');
  temp.innerHTML = '<iframe name="bob" src="/some-page"></iframe>';
  document.body.appendChild(temp.firstChild);
}());
</script>
{% endhighlight %}

(This is actually what jQuery does internally in the prior example.)

In this way, all browsers should now correctly report:

    My name is bob

And a live demonstration:

<div id="test-2"></div>
<script>
(function () {
  var t = document.getElementById('test-2'),
      temp = document.createElement('div');
  temp.innerHTML = '<iframe frameborder=0 name=bob src=/code/iframe-test.html></iframe>';
  t.appendChild(temp.firstChild);
}());
</script>

  [iframe]: http://www.w3.org/TR/html4/present/frames.html#h-16.5
  [name]: http://www.w3.org/TR/html4/present/frames.html#adef-name-IFRAME
  [window name]: https://developer.mozilla.org/en/DOM/window.name
  [jQuery]: http://jquery.com/
  [caveat]: http://api.jquery.com/jQuery/#creating-new-elements
