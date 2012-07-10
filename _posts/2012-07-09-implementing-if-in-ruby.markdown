---
layout: post
title: Implementing if in Ruby
summary: Using multiple blocks in Ruby to implement Smalltalk-style control flow.
---
It was with great interest that I watched [J. Pablo Fern&aacute;ndez](http://pupeno.com/)'s presentation at the [London Ruby User Group](http://lrug.org/meetings/2012/06/18/july-2012-meeting/) tonight entitled "What Ruby Can't Do". Concerned of being myopic about the language that happens to provide my income, I am keen to see what we can unabashedly steal from other languages (see [Joseph Wilk's excellent "Testing Outside of the Ruby World" for a similar sentiment](http://www.confreaks.com/videos/551-scotlandruby2011-testing-outside-of-the-ruby-world)). Pablo offered two alternatives to Ruby -- Smalltalk and Lisp -- and then demonstrated their relative power by implementing his own `if` condition in both.

While the Lisp example demonstrated homoiconicity and the power of macros, the Smalltalk example was (barring syntactic oddities) much closer to home for Rubyists.

To summarise: Smalltalk eschews keywords for control structures such as `if` in favour of message sends (to use the Smalltalk parlance for method calls). This means that conditional logic is just another method on an object (not entirely dissimilar to Ruby's infamous `5.times { ... }` example):

{% highlight smalltalk %}
somePredicate ifTrue:  [ Transcript show: 'I am true'  ]
              ifFalse: [ Transcript show: 'I am false' ]
{% endhighlight %}

The implementation of these messages is simple: define a method that takes two arguments, one block to call when true (e.g. `trueBlock`) and one block to call when false (e.g. `falseBlock`). Objects that can be considered "truthy" evaluate the first block and those that are "falsey" evaluate the second:

{% highlight smalltalk %}
ifTrue: trueBlock ifFalse: falseBlock
  "Implementation for truthy objects."
  ^ trueBlock value

ifTrue: trueBlock ifFalse: falseBlock
  "Implementation for falsey objects."
  ^ falseBlock value
{% endhighlight %}

Pablo bemoaned that such a construction cannot be done in Ruby easily without chaining `Proc` objects and [Tom Stuart summarised the problem on Twitter](https://twitter.com/mortice/status/222393465663787008): "Spoiler alert: Smalltalk lets you pass multiple blocks to a method naturally, Ruby doesn't." However, [I tweeted](https://twitter.com/mudge/status/222398046825234432) that this might not be true from Ruby 1.9 onwards.

To mimic the Smalltalk example, the following syntax is actually valid Ruby:

{% highlight ruby %}
some_predicate.if ->{ "It's true!" }, else: ->{ "It's false!" }
{% endhighlight %}

While it might at first seem odd, it's actually equivalent to the following:

{% highlight ruby %}
some_predicate.if(lambda { "It's true!" },
    { :else => lambda { "It's false!" } })
{% endhighlight %}

To implement this functionality, we can take advantage of Ruby's notoriously open classes:

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

Note that I default the `if_false` case to a no-op to avoid using `if` internally (and therefore sidestep some furore).

(Those of you wishing to draw ire from your colleagues are welcome to download and use
the above code as a [gem](http://rubygems.org/gems/if).)

Practically speaking, there is likely to be a performance penalty in avoiding Ruby's intrinsic optimisations for the `if` keyword. However, it implements functionality in typical Ruby that was previously reserved as a "special" language feature and, at the same time, demonstrates achieving conditional logic purely via polymorphism.

This latter point is rather tongue-in-cheek because at some point a "truthy" or "falsey" value must be produced but reminds me of a topic I have been increasingly interested in: treating conditions as a code smell.

The aforementioned [Tom Stuart recently stated](https://twitter.com/mortice/status/221225889407565824):

> Applying my new rule: "conditional logic only allowed to determine class of object created". Hoping to infuriate some people with it.

While Tom admitted this was a rather provocative statement, it is not an approach without merit. [Robert "Uncle Bob" Martin recently did a presentation entitled "The S.O.L.I.D. Principles of OO and Agile Design"](http://skillsmatter.com/podcast/agile-scrum/uncle-bob-expert-insights) which discussed the fragility of code that relies heavily on conditions in place of polymorphism. What this really boiled down to was the difference between the following version of some code to input and output data from different sources:

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

