---
layout: post
title: Combining and Compressing Disqus&rsquo; and Google Analytics&rsquo; JavaScript
excerpt: A step-by-step refactoring of Disqus&rsquo; and Google Analytics&rsquo; JavaScript.
---
In setting up this [Jekyll][]-powered blog, I had cause to dust off my [Google
Analytics][] account and finally take [Disqus][] for a spin. Both services
provide small snippets of JavaScript for inclusion in your web pages; Google
Analytics&rsquo; looks much like this (with line breaks added for readability):

```html
<script type="text/javascript">
  var _gaq = _gaq || [];
  _gaq.push(['_setAccount', 'UA-XXXXX-X']);
  _gaq.push(['_trackPageview']);

  (function() {
    var ga = document.createElement('script');
    ga.type = 'text/javascript';
    ga.async = true;
    ga.src = ('https:' == document.location.protocol ? 'https://ssl' : 'http://www') +
      '.google-analytics.com/ga.js';
    var s = document.getElementsByTagName('script')[0];
    s.parentNode.insertBefore(ga, s);
  })();
</script>
```

Disqus&rsquo; is as follows (with line breaks added and extraneous comments
removed):

```html
<script type="text/javascript">
  var disqus_shortname = 'example';
  // var disqus_identifier = 'unique_dynamic_id_1234';
  // var disqus_url = 'http://example.com/permalink-to-page.html';

  (function() {
    var dsq = document.createElement('script');
    dsq.type = 'text/javascript';
    dsq.async = true;
    dsq.src = 'http://' + disqus_shortname + '.disqus.com/embed.js';
    (document.getElementsByTagName('head')[0] ||
      document.getElementsByTagName('body')[0]).appendChild(dsq);
  })();
</script>
```

Both seem terse enough <del>and are meant for inclusion at the bottom
of your web page</del> (*Update:* [enomar on Hacker News pointed out that
Google's asynchronous tracking code is ideally meant to be included at the end
of the `head` element][enomar] while Disqus&rsquo; JavaScript is meant for inclusion
wherever you want your comments to appear but both can be placed at the bottom
of your page, see "[Getting Started with the Asynchronous Snippet][]" and the end
of this post for more information).

A quick check with [Amy Hoy and Thomas Fuchs&rsquo; "DOM Monster"][DOM Monster] shows that
the number of `script` tags should ideally be kept to a minimum so let's combine
the two into one (and let's specify those recommended Disqus variables while we're
at it):

```html
<script type="text/javascript">
  var _gaq = _gaq || [];
  _gaq.push(['_setAccount', 'UA-XXXXX-X']);
  _gaq.push(['_trackPageview']);

  (function() {
    var ga = document.createElement('script');
    ga.type = 'text/javascript';
    ga.async = true;
    ga.src = ('https:' == document.location.protocol ? 'https://ssl' : 'http://www') +
      '.google-analytics.com/ga.js';
    var s = document.getElementsByTagName('script')[0];
    s.parentNode.insertBefore(ga, s);
  })();

  var disqus_shortname = 'example';
  var disqus_identifier = 'unique_dynamic_id_1234';
  var disqus_url = 'http://example.com/permalink-to-page.html';

  (function() {
    var dsq = document.createElement('script');
    dsq.type = 'text/javascript';
    dsq.async = true;
    dsq.src = 'http://' + disqus_shortname + '.disqus.com/embed.js';
    (document.getElementsByTagName('head')[0] ||
      document.getElementsByTagName('body')[0]).appendChild(dsq);
  })();
</script>
```

We could stop at this point but I am something of a sucker for compressing web pages
and JavaScript down to their bare minimum (I have been known to pore through the
[HTML5 specification's "optional tags" section][HTML5 Optional tags] and butcher
my markup appropriately).

We might decide to put the whole thing into something like
Google's [Closure Compiler][] to optimise the code for us but let's take it more
slowly and start by looking at the `script` tag itself: it turns out that the `type`
attribute is optional and is [specified as having a default value of
`text/javascript`][script type specification] so we can immediately lose that
(*Update:* [this is only true if you're using HTML5][enomar HTML5]). It
turns out that the actual JavaScript itself is also creating `script` tags
and specifying the `type` attribute so let's remove those as well:

```html
<script>
  var _gaq = _gaq || [];
  _gaq.push(['_setAccount', 'UA-XXXXX-X']);
  _gaq.push(['_trackPageview']);

  (function() {
    var ga = document.createElement('script');
    ga.async = true;
    ga.src = ('https:' == document.location.protocol ? 'https://ssl' : 'http://www') +
      '.google-analytics.com/ga.js';
    var s = document.getElementsByTagName('script')[0];
    s.parentNode.insertBefore(ga, s);
  })();

  var disqus_shortname = 'example';
  var disqus_identifier = 'unique_dynamic_id_1234';
  var disqus_url = 'http://example.com/permalink-to-page.html';

  (function() {
    var dsq = document.createElement('script');
    dsq.async = true;
    dsq.src = 'http://' + disqus_shortname + '.disqus.com/embed.js';
    (document.getElementsByTagName('head')[0] ||
      document.getElementsByTagName('body')[0]).appendChild(dsq);
  })();
</script>
```

Another thing that has caught my eye is the odd set up of the `_gaq` variable:
it checks to see if it has already been defined (which it has not in my case),
assigns an empty array and then pushes two arrays onto it. This is due to the fact
that `_gaq` can be modified after Google's tracking code has loaded to use more
advanced tracking features (see the [documentation for `_gaq.push`][_gaq.push] for
more information) but seeing as I am only doing basic analytics and taking a cue from
Mark Pilgrim's code from "[dive into mark][]", we can simplify
this quite drastically:

```html
<script>
  var _gaq = [['_setAccount', 'UA-XXXXX-X'], ['_trackPageview']];
  // ... omitted for brevity ...
</script>
```

While we are looking at variable declarations, another easy optimisation we
can make is to take advantage of [JavaScript's syntax to declare multiple variables
at once][var]:

```html
<script>
  var _gaq = [['_setAccount', 'UA-XXXXX-X'], ['_trackPageview']],
      disqus_shortname = 'example',
      disqus_identifier = 'unique_dynamic_id_1234',
      disqus_url = 'http://example.com/permalink-to-page.html';
  // ... omitted for brevity ...
</script>
```

With those low-hanging fruit out of the way, we need to consider what both snippets
are actually *doing*. They are, in fact, very similar: they are both creating
`script` tags set to load some external JavaScript on your page in the following way:

1. Create a new `script` element with [`document.createElement`][createElement];
2. Inform the script that it is to load asynchronously by setting the
   [`async`][async] attribute;
3. Set the [`src`][src] of the element thereby identifying the location of the external
   script;
4. Insert the finished element into the web page.

With this knowledge, we can start to remove some repetition in the code. Firstly,
we can streamline the creation of the two `script` tags by setting them up
simultaneously (and moving them into the same closure while we're at it):

```html
<script>
  var _gaq = [['_setAccount', 'UA-XXXXX-X'], ['_trackPageview']],
      disqus_shortname = 'example',
      disqus_identifier = 'unique_dynamic_id_1234',
      disqus_url = 'http://example.com/permalink-to-page.html';

  (function() {
    var ga = document.createElement('script'),
        dsq = document.createElement('script');
    ga.async = dsq.async = true;
    ga.src = ('https:' == document.location.protocol ? 'https://ssl' : 'http://www') +
      '.google-analytics.com/ga.js';
    dsq.src = 'http://' + disqus_shortname + '.disqus.com/embed.js';
    var s = document.getElementsByTagName('script')[0];
    s.parentNode.insertBefore(ga, s);
    (document.getElementsByTagName('head')[0] ||
      document.getElementsByTagName('body')[0]).appendChild(dsq);
  })();
</script>
```

We've stated that both snippets insert their newly-created `script` elements into
the [DOM][] but they are currently doing it in different ways. Let's change this
and, in the spirit of following [Google's Performance Best Practices][], let's
append the `script` elements to the `body` tag by using [`document.body`][body]
and [`appendChild`][appendChild]:

```html
<script>
  var _gaq = [['_setAccount', 'UA-XXXXX-X'], ['_trackPageview']],
      disqus_shortname = 'example',
      disqus_identifier = 'unique_dynamic_id_1234',
      disqus_url = 'http://example.com/permalink-to-page.html';

  (function() {
    var ga = document.createElement('script'),
        dsq = document.createElement('script');
    ga.async = dsq.async = true;
    ga.src = ('https:' == document.location.protocol ? 'https://ssl' : 'http://www') +
      '.google-analytics.com/ga.js';
    dsq.src = 'http://' + disqus_shortname + '.disqus.com/embed.js';
    document.body.appendChild(ga);
    document.body.appendChild(dsq);
  })();
</script>
```

We're now in much better shape than when we started and a lot closer to following
the [Don't Repeat Yourself (DRY) principle][DRY].

If you want to take this even further then there are a few other changes that you
might consider making:

1. If your site is only served via HTTP and not HTTPS then you can lose the
   `'https:' == document.location.protocol` check;
2. You can remove the string concatenation that uses the `disqus_shortname` by
   explicitly setting the `src` to your own Disqus URL such as
   `http://example.disqus.com/embed.js`;
3. Instead of calling `document.body` twice, you can cache it once in a variable
   which you can then reuse.
4. A quick check with [JSLint][] reveals that invoking a function defined inside
   parentheses (e.g. `(function() { ... })()`) should be done *inside* the
   parentheses instead of outside (e.g. `(function() { ... }())`).

If you decide to take these (admittedly more drastic) steps then you might end up
with something like the following:

```html
<script>
  var _gaq = [['_setAccount', 'UA-XXXXX-X'], ['_trackPageview']],
      disqus_shortname = 'example',
      disqus_identifier = 'unique_dynamic_id_1234',
      disqus_url = 'http://example.com/permalink-to-page.html';

  (function() {
    var ga = document.createElement('script'),
        dsq = document.createElement('script'),
        body = document.body;
    ga.async = dsq.async = true;
    ga.src = 'http://www.google-analytics.com/ga.js';
    dsq.src = 'http://example.disqus.com/embed.js';
    body.appendChild(ga);
    body.appendChild(dsq);
  }());
</script>
```

At this point you can now turn to more brutal compressors such as [YUI
Compressor][] or the aforementioned [Closure Compiler][] which (after some
tweaks to keep [JSLint][] happy) will result in a single snippet like
so (line breaks added for some semblance of readability):

```html
<script>
var _gaq=[["_setAccount","UA-XXXXX-X"],["_trackPageview"]],
disqus_shortname="example",disqus_identifier="unique_dynamic_id_1234",
disqus_url="http://example.com/permalink-to-page.html";(function(){
var a=document.createElement("script"),b=document.createElement("script"),
c=document.body;a.async=b.async=true;a.src="http://www.google-analytics.com/ga.js";
b.src="http://example.disqus.com/embed.js";c.appendChild(a);c.appendChild(b);}());
</script>
```

Of course, there's no reason for it to end there. I've got it down to 412
characters while still passing [JSLint][], feel free to post your own attempts in
the comments:

```html
<script>
var _gaq=[["_setAccount","UA-XXXXX-X"],["_trackPageview"]],
disqus_shortname="example",disqus_identifier="unique_dynamic_id_1234",
disqus_url="http://example.com/permalink-to-page.html";(function(){
var a=document,b=a.createElement("script"),c=a.body,d;
b.async=true;d=b.cloneNode(false);b.src="http://www.google-analytics.com/ga.js";
d.src="http://example.disqus.com/embed.js";c.appendChild(b);c.appendChild(d);}());
</script>
```

There are only two rules:

1. Your solution must not produce any errors from [JSLint][] with "Assume a browser"
   ticked;
2. The only global variables that should be declared are `_gaq`,
   `disqus_identifier`, `disqus_shortname` <del>and `disqus_url`</del>
   (*Update:* Disqus software engineer [Anton Kovalyov][] says in the comments
   that `disqus_url` is not required if `disqus_identifier` is set so feel free
   to leave that one out).

*Update:* Based on feedback from [Steve Klabnik][], [Anton Kovalyov][] and
[Andrew Walker][], here is a solution that consists of only 345 characters:

```html
<script>
var _gaq=[["_setAccount","UA-XXXXX-X"],["_trackPageview"]],
disqus_shortname="example",disqus_identifier="unique_dynamic_id_1234";
(function(a,b){
var c=a.createElement("script"),d=a.body,e;
c.async=b;e=c.cloneNode(b);c.src="//www.google-analytics.com/ga.js";
e.src="//example.disqus.com/embed.js";d.appendChild(c);d.appendChild(e);
}(document,true));
</script>
```

If you want to follow [Google's recommendation of inserting their
snippet at the bottom of the `head` element][Getting Started with the Asynchronous Snippet] (and continue inserting Disqus&rsquo; snippet at the bottom of
the `body`) then you will have to sacrifice the single, unified `script` for two
separate ones:

```html
<head>
  <!-- Usual HTML head elements here... -->
  <script>
    var _gaq=[["_setAccount","UA-XXXXX-X"],["_trackPageview"]],
    disqus_shortname="example",disqus_identifier="unique_dynamic_id_1234";
    function a(b){var c=document,d=c.createElement("script");
    d.async=true;d.src=b;
    c.documentElement.firstChild.appendChild(d);}
    a("//www.google-analytics.com/ga.js");
  </script>
</head>
<body>
  <!-- Page content here... -->
  <script>a("//example.disqus.com/embed.js");</script>
</body>
```

This version consists of a total of 325 characters but introduces a new global
function named `a` which will create a new `script` element and append it to
the `head` element of the page. The benefit of this approach is that it will
immediately start loading the Google Analytics tracking code which might
otherwise be delayed (particularly on large web pages) but the extra `script`
and population of the `head` element won't win you any favours with the [DOM
Monster][].

*Update #2:* I have since taken to another approach that reduces the number of `script`
elements created by synchronously requiring the Disqus JavaScript yourself at
the bottom of the `body`:

```html
<head>
  <!-- Usual HTML head elements here... -->
  <script>
    var _gaq=[["_setAccount","UA-XXXXX-X"],["_trackPageview"]],
    disqus_shortname="example",disqus_identifier="unique_dynamic_id_1234";
    (function(a){var b=a.createElement("script");b.async=true;
    b.src="//www.google-analytics.com/ga.js";
    a.documentElement.firstChild.appendChild(b);}(document));
  </script>
</head>
<body>
  <!-- Page content here... -->
  <script src=//example.disqus.com/embed.js async></script>
</body>
```

  [Steve Klabnik]: http://www.steveklabnik.com
  [Andrew Walker]: http://www.moddular.org
  [Hacker News]: http://news.ycombinator.com/item?id=2156911
  [Anton Kovalyov]: http://anton.kovalyov.net/
  [_gaq.push]: http://code.google.com/apis/analytics/docs/gaJS/gaJSApi_gaq.html#_gaq.push
  [enomar HTML5]: http://news.ycombinator.com/item?id=2157118
  [Getting Started with the Asynchronous Snippet]: http://code.google.com/apis/analytics/docs/tracking/asyncTracking.html#Installation
  [enomar]: http://news.ycombinator.com/item?id=2157082
  [Closure Compiler]: http://closure-compiler.appspot.com/
  [DOM Monster]: http://mir.aculo.us/dom-monster/
  [DOM]: https://developer.mozilla.org/en/DOM
  [DRY]: http://en.wikipedia.org/wiki/Don't_repeat_yourself
  [Disqus]: http://disqus.com
  [Google Analytics]: http://www.google.com/analytics/
  [Google's Performance Best Practices]: http://code.google.com/speed/page-speed/docs/payload.html#DeferLoadingJS
  [HTML5 Optional tags]: http://dev.w3.org/html5/spec/syntax.html#optional-tags
  [JSLint]: http://www.jslint.com
  [Jekyll]: http://jekyllrb.com
  [YUI Compressor]: http://developer.yahoo.com/yui/compressor/
  [appendChild]: https://developer.mozilla.org/En/DOM/Node.appendChild
  [async]: http://dev.w3.org/html5/spec/scripting-1.html#attr-script-async
  [body]: https://developer.mozilla.org/en/DOM/document.body
  [createElement]: https://developer.mozilla.org/en/DOM/document.createElement
  [dive into mark]: http://diveintomark.org
  [script type specification]: http://dev.w3.org/html5/spec/scripting-1.html#attr-script-type
  [src]: http://dev.w3.org/html5/spec/scripting-1.html#attr-script-src
  [var]: https://developer.mozilla.org/en/JavaScript/Reference/Statements/var
