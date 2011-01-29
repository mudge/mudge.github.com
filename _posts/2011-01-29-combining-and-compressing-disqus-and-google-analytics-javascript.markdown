---
layout: post
title: Combining and Compressing Disqus' and Google Analytics' JavaScript
---
In setting up this [Jekyll][]-powered blog, I had cause to dust off my [Google
Analytics][] account and finally take [Disqus][] for a spin. Both services
provide small snippets of JavaScript for inclusion in your web pages; Google
Analytics' looks much like this (with line breaks added for readability):

{% highlight html %}
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
{% endhighlight %}

Disqus' is as follows (with line breaks added and extraenous comments
removed):

{% highlight html %}
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
{% endhighlight %}

Both seem terse enough and are meant for inclusion in at the bottom of your web
page.

A quick check with [Amy Hoy and Thomas Fuchs' "DOM Monster"][DOM Monster] shows that
the number of `script` tags should ideally be kept to a minimum so let's combine
the two into one (and let's specify those recommended Disqus variables while we're
at it):

{% highlight html %}
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
{% endhighlight %}

We could stop at this point but I am something of a sucker for compressing web pages
and JavaScript down to their bare minimum (I have been known to pore through the
[HTML5 specification's "optional tags" section][HTML5 Optional tags] and butcher
my markup appropriately).

We might decide to put the whole thing into something like
Google's [Closure Compiler][] to optimise the code for us but let's take it more
slowly and start by looking at the `script` tag itself: it turns out that the `type`
attribute is optional and is [specified as having a default value of
`text/javascript`][script type specification] so we can immediately lose that. It
turns out that the actual JavaScript itself is also creating `script` tags
and specifying the `type` attribute so let's remove those as well:

{% highlight html %}
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
{% endhighlight %}

Another thing that has caught my eye is the odd set up of the `_gaq` variable:
it checks to see if it has already been defined (which it has not in my case),
assigns an empty array and then pushes two arrays onto it. Taking a cue from
Mark Pilgrim's code from "[dive into mark][]", we can simplify
this quite drastically:

{% highlight html %}
<script>
  var _gaq = [['_setAccount', 'UA-XXXXX-X'], ['_trackPageview']];
  // ... omitted for brevity ...
</script>
{% endhighlight %}

While we are looking at variable declarations, another easy optimisation we
can make is to take advantage of [JavaScript's syntax to declare multiple variables
at once][var]:

{% highlight html %}
<script>
  var _gaq = [['_setAccount', 'UA-XXXXX-X'], ['_trackPageview']],
      disqus_shortname = 'example',
      disqus_identifier = 'unique_dynamic_id_1234',
      disqus_url = 'http://example.com/permalink-to-page.html';
  // ... omitted for brevity ...
</script>
{% endhighlight %}

With those low-hanging fruit out of the way, we need to consider what both snippets
are actually *doing*. They are, in fact, very similar: they are both creating
`script` tags set to load some external JavaScript on your page in the following way:

1. Create a new `script` element;
2. Inform the script that it is to load asynchronously by setting the
   [`async`][async] attribute;
3. Set the [`src`][src] of the element thereby identifying the location of the external
   script;
4. Insert the finished element into the web page.

With this knowledge, we can start to remove some repetition in the code. Firstly,
we can streamline the creation of the two `script` tags by setting them up
simultaneously (and moving them into the same closure while we're at it):

{% highlight html %}
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
{% endhighlight %}

We've stated that both snippets insert their newly-created `script` elements into
the [DOM][] but they are currently doing it in different ways. Let's change this
and, in the spirit of following [Google's Performance Best Practices][], let's
append the `script` elements to the `body` tag:

{% highlight html %}
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
{% endhighlight %}

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
   inside parentheses (e.g. `(function() { ... })()` should be done *inside* the
   parentheses instead of outside (e.g. `(function() { ... }())`).

If you decide to take these (admittedly more drastic) steps then you might end up
with something like the following:

{% highlight html %}
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
{% endhighlight %}

At this point you can now turn to more brutal compressors such as [YUI Compressor][]
or the aforementioned [Closure Compiler][] which (after heeding [JSLint][]'s advice)
will result in a final single snippet like so (line breaks added for some
semblance of readability):

{% highlight html %}
<script>
var _gaq=[["_setAccount","UA-XXXXX-X"],["_trackPageview"]],
disqus_shortname="example",disqus_identifier="unique_dynamic_id_1234",
disqus_url="http://example.com/permalink-to-page.html";(function(){
var a=document.createElement("script"),b=document.createElement("script"),
c=document.body;a.async=b.async=true;a.src="http://www.google-analytics.com/ga.js";
b.src="http://example.disqus.com/embed.js";c.appendChild(a);c.appendChild(b);}());
</script>
{% endhighlight %}

  [JSLint]: http://www.jslint.com
  [Closure Compiler]: http://closure-compiler.appspot.com/
  [DOM Monster]: http://mir.aculo.us/dom-monster/
  [DOM]: https://developer.mozilla.org/en/DOM
  [DRY]: http://en.wikipedia.org/wiki/Don't_repeat_yourself
  [Disqus]: http://disqus.com
  [Google Analytics]: http://www.google.com/analytics/
  [Google's Performance Best Practices]: http://code.google.com/speed/page-speed/docs/payload.html#DeferLoadingJS
  [HTML5 Optional tags]: http://dev.w3.org/html5/spec/syntax.html#optional-tags
  [Jekyll]: http://jekyllrb.com
  [dive into mark]: http://diveintomark.org
  [YUI Compressor]: http://developer.yahoo.com/yui/compressor/
  [async]: http://dev.w3.org/html5/spec/scripting-1.html#attr-script-async
  [script type specification]: http://dev.w3.org/html5/spec/scripting-1.html#attr-script-type
  [src]: http://dev.w3.org/html5/spec/scripting-1.html#attr-script-src
  [var]: https://developer.mozilla.org/en/JavaScript/Reference/Statements/var