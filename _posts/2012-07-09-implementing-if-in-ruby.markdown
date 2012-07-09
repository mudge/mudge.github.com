---
layout: post
title: Implementing if in Ruby
summary: Implementing Smalltalk conditionals in Ruby.
---
It was with some interest that I watched [J. Pablo Fern&aacute;ndez](http://pupeno.com/)'s presentation at the [London Ruby User Group](http://lrug.org/meetings/2012/06/18/july-2012-meeting/) tonight entitled "What Ruby Can't Do". Ever concerned of being too myopic about the language that happens to provide my income, I am keen to see what features other languages offer we can unabashedly steal. Pablo did this by implementing the `if` conditional first in Smalltalk, then Lisp.

As [Tom Stuart succinctly put it on Twitter](https://twitter.com/mortice/status/222393465663787008), "Spoiler alert: Smalltalk lets you pass multiple blocks to a method naturally, Ruby doesn't." However, [I tweeted](https://twitter.com/mudge/status/222398046825234432) that this might not be true.

To directly steal the Smalltalk implementation (and assuming a Ruby version of at least 1.9), the following syntax is actually valid:

{% highlight ruby %}
predicate.if ->{ "It's true!" }, else: ->{ "It's false!" }
{% endhighlight %}

To actually implement this functionality, we can take advantage of Ruby's notoriously open classes:

{% highlight ruby %}
class BasicObject
  def if(if_true, options = {})
    if_true.call
  end
end

module Falsey
  def if(if_true, options = {})
    if_false = options.fetch(:else, ->{})

    if_false.call
  end
end

class NilClass
  include Falsey
end

class FalseClass
  include Falsey
end
{% endhighlight %}

Note that I default the `if_false` case to a simple no-op simply to avoid using `if` internally (and therefore sidestep some furore).

(Those of you wishing to draw ire from your colleagues are welcome to download
the above code as a [gem](http://rubygems.org/gems/if).)

Of course, there is a performance penalty for using such a technique and avoiding Ruby's intrinsic optimisations for the `if` keyword. That said, it implements functionality in typical Ruby that was previously reserved as a "special" language feature and, at the same time, achieves conditional logic purely via polymorphism.

This latter point is rather tongue-in-cheek because at some point a "truthy" or "falsey" value must be produced but reminds me of a topic I have been increasingly interested in: treating conditions as a code smell.

The aforementioned [Tom Stuart recently stated](https://twitter.com/mortice/status/221225889407565824):

> Applying my new rule: "conditional logic only allowed to determine class of object created". Hoping to infuriate some people with it.

While Tom admitted this was a rather provocative statement, it is not an approach without merit. [Robert "Uncle Bob" Martin recently did a presentation at Skills Matter](http://skillsmatter.com/podcast/agile-scrum/uncle-bob-expert-insights) which discussed the fragility of code that relies heavily on conditions in place of polymorphism. What this really boiled down to was the difference between the following version of some code to input and output data from different sources:

{% highlight csharp %}
bool GtapeReader = false;
bool GtapePunch = false;

void copy(void)
{
  int ch;
  while( (ch=GtapeReader ?
             ReadTape() :
             ReadKeyboard()) != EOF)
    GtapePunch ?
      WritePunch(ch) :
      WritePrinter(ch);
}
{% endhighlight %}

And this alternative version of the same functionality:

{% highlight csharp %}
void Copy()
{
  int c;
  while( (c=getchar()) != EOF)
    putchar(c);
}
{% endhighlight %}

I'll let Uncle Bob describe the differences better than I can but it's a
powerful idea and a stern warning: conditions bind you much more strongly than
you might first expect.

