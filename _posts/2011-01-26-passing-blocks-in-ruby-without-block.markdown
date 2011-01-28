---
layout: post
title: Passing Blocks in Ruby Without <code>&amp;block</code>
---

There are two main ways to pass [blocks][Containers, Blocks, and Iterators] into a method in Ruby:
using [`yield`][yield] like so:

{% highlight ruby %}
def speak
  puts yield
end

speak { "Hello" }
# Hello
#  => nil
{% endhighlight %}

The other is to prefix the last argument in a method signature with an ampersand
which will then create a [`Proc`][Proc] object from the block which can then be executed
with [`call`][call] like so:

{% highlight ruby %}
def speak(&block)
  puts block.call
end

speak { "Hello" }
# Hello
#  => nil
{% endhighlight %}

The problem with the second approach is that instantiating a new `Proc` object incurs
a surprisingly heavy performance penalty as detailed by [Aaron Patterson][] in his
excellent RubyConf X presentation, ["ZOMG WHY IS THIS CODE SO SLOW?"][ZOMG]
(beginning around the 30 minute mark or from [slide 181][ZOMG Slides]).

This can easily be verified with the following benchmark, `block_benchmark.rb`:

{% highlight ruby %}
require "benchmark"

class ProcMonkey
  def self.speak(&block)
    block.call
  end
end

class BlockMonkey
  def self.speak
    yield
  end
end

n = 1_000_000
Benchmark.bmbm do |x|
  x.report("&block") { n.times { ProcMonkey.speak  { "ook" } } }
  x.report("yield")  { n.times { BlockMonkey.speak { "ook" } } }
end
{% endhighlight %}

The results of this on my own machine are as follows (the numbers themselves aren't
as important as their difference):

    $ ruby block_benchmark.rb 
    Rehearsal ------------------------------------------
    &block   1.410000   0.020000   1.430000 (  1.430050)
    yield    0.290000   0.000000   0.290000 (  0.291750)
    --------------------------------- total: 1.720000sec

                 user     system      total        real
    &block   1.420000   0.030000   1.450000 (  1.452686)
    yield    0.290000   0.000000   0.290000 (  0.292179)

So it is clearly preferable to choose `yield` over `&block` but what if you need to
pass a block to another method?

For example, if you are implementing some dynamic functionality via
[`method_missing`][method_missing], you might want to pass the given block to some
other method like so:

{% highlight ruby %}
class Monkey

  def self.tell(name, &block)
    puts "#{name}: #{block.call}"
  end

  # Monkey.tell_ape { "ook!" }
  # ape: ook!
  #  => nil
  def self.method_missing(name, *args, &block)
    subject = name.to_s[/^tell_(.+)$/, 1]
    if subject
      tell(subject, &block)
    else
      super
    end
  end
end
{% endhighlight %}

Such a thing is not possible with the `yield` keyword:

{% highlight ruby %}
class Monkey

  def self.tell(name)
    puts "#{name}: #{yield}"
  end

  # Monkey.tell_ape { "ook!" }
  # ArgumentError: wrong number of arguments (2 for 1)
  def self.method_missing(name, *args)
    subject = name.to_s[/^tell_(.+)$/, 1]
    if subject
      tell(subject, yield)
    else
      super
    end
  end
end
{% endhighlight %}

However, there is a way to only create a `Proc` object when needed and that is
to use the little known behaviour of [`Proc.new`][Proc.new] as explained in
Aaron Patterson's aforementioned presentation.

If `Proc.new` is called from inside a method without any arguments of its own,
it will return a new `Proc` containing the block given to its surrounding method.

{% highlight ruby %}
def speak
  puts Proc.new.call
end

speak { "Hello" }
# Hello
#  => nil
{% endhighlight %}

This means that it is now possible to pass a block between methods without using the
`&block` parameter:

{% highlight ruby %}
class Monkey

  def self.tell(name)
    puts "#{name}: #{yield}"
  end

  # Monkey.tell_ape { "ook!" }
  # ape: ook!
  #  => nil
  def self.method_missing(name, *args)
    subject = name.to_s[/^tell_(.+)$/, 1]
    if subject
      tell(subject, &Proc.new)
    else
      super
    end
  end
end
{% endhighlight %}

Of course, if you do use `Proc.new` then you lose the performance benefit of using
only `yield` but it is an interesting feature of the language nonetheless.

  [Aaron Patterson]: http://tenderlovemaking.com
  [Containers, Blocks, and Iterators]: http://ruby-doc.org/docs/ProgrammingRuby/html/tut_containers.html
  [Proc.new]: http://www.ruby-doc.org/core/classes/Proc.html#M000547
  [Proc]: http://www.ruby-doc.org/core/classes/Proc.html
  [ZOMG]: http://confreaks.net/videos/427-rubyconf2010-zomg-why-is-this-code-so-slow
  [ZOMG Slides]: http://www.slideshare.net/tenderlove/zomg-why-is-this-code-so-slow/181
  [call]: http://www.ruby-doc.org/core/classes/Proc.html#M000548
  [method_missing]: http://ruby-doc.org/docs/ProgrammingRuby/html/ref_c_object.html#Object.method_missing
  [yield]: http://ruby-doc.org/docs/keywords/1.9/files/keywords_rb.html#M000042
