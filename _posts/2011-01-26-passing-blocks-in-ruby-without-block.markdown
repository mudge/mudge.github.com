---
layout: post
title: Passing Blocks in Ruby Without <code>&amp;block</code>
excerpt: Using yield and Proc.new to avoid unnecessary Proc object creation in Ruby.
redirect_from: /2011/01/26/passing-blocks-in-ruby-without-block.html
updated: 2020-07-01 08:53:00
---
***Update**: The ability to call [`Proc.new`](https://ruby-doc.org/core-3.0.1/Proc.html#new-method) without a block was [removed in Ruby 3.0.0](https://bugs.ruby-lang.org/issues/10499) so the technique described below will only work on versions of Ruby prior to that.*

There are two main ways to receive [blocks][Containers, Blocks, and Iterators] in a method in Ruby:
the first is to use the [`yield`][yield] keyword like so:

```ruby
def speak
  puts yield
end

speak { "Hello" }
# Hello
#  => nil
```

The other is to prefix the last argument in a method signature with an
ampersand which will then create a [`Proc`][Proc] object from any block passed
in. This object can then be executed with the [`call`][call] method like so:

```ruby
def speak(&block)
  puts block.call
end

speak { "Hello" }
# Hello
#  => nil
```

The problem with the second approach is that instantiating a new `Proc` object incurs
a surprisingly heavy performance penalty as detailed by [Aaron Patterson][] in his
excellent RubyConf X presentation, "[ZOMG WHY IS THIS CODE SO SLOW?][ZOMG]"
(beginning around the 30 minute mark or from [slide 181][ZOMG Slides]).

This can easily be verified with the following benchmark, `block_benchmark.rb`:

```ruby
require "benchmark"

def speak_with_block(&block)
  block.call
end

def speak_with_yield
  yield
end

n = 1_000_000
Benchmark.bmbm do |x|
  x.report("&block") do
    n.times { speak_with_block { "ook" } }
  end
  x.report("yield") do
    n.times { speak_with_yield { "ook" } }
  end
end
```

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

For example, here is a class that implements a method `tell_ape` which delegates to
another, more generic method named `tell`. This sort of pattern is commonly done
using [`method_missing`][method_missing] but I'll keep the methods explicit for
simplicity:

```ruby
class Monkey

  # Monkey.tell_ape { "ook!" }
  # ape: ook!
  #  => nil
  def self.tell_ape(&block)
    tell("ape", &block)
  end

  def self.tell(name, &block)
    puts "#{name}: #{block.call}"
  end
end
```

Such a thing is not possible with the `yield` keyword:

```ruby
class Monkey

  # Monkey.tell_ape { "ook!" }
  # ArgumentError: wrong number of arguments (2 for 1)
  def self.tell_ape
    tell("ape", yield)
  end

  def self.tell(name)
    puts "#{name}: #{yield}"
  end
end
```

Neither does it work by using an ampersand:

```ruby
class Monkey

  # Monkey.tell_ape { "ook!" }
  # TypeError: wrong argument type String (expected Proc)
  def self.tell_ape
    tell("ape", &yield)
  end

  def self.tell(name)
    puts "#{name}: #{yield}"
  end
end
```

However, there is a way to only create a `Proc` object when needed and that is
to use the little known behaviour of [`Proc.new`][Proc.new] as explained in
Aaron Patterson's aforementioned presentation.

If `Proc.new` is called from inside a method without any arguments of its own,
it will return a new `Proc` containing the block given to its surrounding method.

```ruby
def speak
  puts Proc.new.call
end

speak { "Hello" }
# Hello
#  => nil
```

This means that it is now possible to pass a block between methods without using the
`&block` parameter:

```ruby
class Monkey

  # Monkey.tell_ape { "ook!" }
  # ape: ook!
  #  => nil
  def self.tell_ape
    tell("ape", &Proc.new)
  end

  def self.tell(name)
    puts "#{name}: #{yield}"
  end
end
```

Of course, if you do use `Proc.new` then you lose the performance benefit of using
only `yield` (as `Proc` objects are being created as with `&block`) but it does
avoid unnecessary creation of Proc objects when you don't need them. This can be
demonstrated with the following benchmark, `proc_new_benchmark.rb`:

```ruby
require "benchmark"

def sometimes_block(flag, &block)
  if flag && block
    block.call
  end
end

def sometimes_proc_new(flag)
  if flag && block_given?
    Proc.new.call
  end
end

n = 1_000_000
Benchmark.bmbm do |x|
  x.report("&block") do
    n.times do
      sometimes_block(false) { "won't get used" }
    end
  end
  x.report("Proc.new") do
    n.times do
      sometimes_proc_new(false) { "won't get used" }
    end
  end
end
```

Which makes the following rather significant difference:

    $ ruby code/proc_new_benchmark.rb 
    Rehearsal --------------------------------------------
    &block     1.080000   0.160000   1.240000 (  1.237644)
    Proc.new   0.160000   0.000000   0.160000 (  0.156077)
    ----------------------------------- total: 1.400000sec

                   user     system      total        real
    &block     1.090000   0.080000   1.170000 (  1.178771)
    Proc.new   0.160000   0.000000   0.160000 (  0.155053)

The key here is that using `&block` will *always* create a new `Proc` object,
even if we don't make use of it. By using `Proc.new` only when we actually
need it, we can avoid the cost of this object instantiation entirely.

That said, there is a potential trade-off here between performance and
readability: it is clear from the `sometimes_block` method signature that it
takes a block and therefore will presumably do something with it; the same cannot
be said for the more efficient `sometimes_proc_new`.

In the end, it comes down to your specific requirements but it is still a useful
language feature to know.

  [Aaron Patterson]: http://tenderlovemaking.com
  [Containers, Blocks, and Iterators]: http://ruby-doc.org/docs/ProgrammingRuby/html/tut_containers.html
  [Proc.new]: http://www.ruby-doc.org/core/classes/Proc.html#M000547
  [Proc]: http://www.ruby-doc.org/core/classes/Proc.html
  [ZOMG]: http://confreaks.net/videos/427-rubyconf2010-zomg-why-is-this-code-so-slow
  [ZOMG Slides]: http://www.slideshare.net/tenderlove/zomg-why-is-this-code-so-slow/181
  [call]: http://www.ruby-doc.org/core/classes/Proc.html#M000548
  [method_missing]: http://ruby-doc.org/docs/ProgrammingRuby/html/ref_c_object.html#Object.method_missing
  [yield]: http://ruby-doc.org/docs/keywords/1.9/files/keywords_rb.html#M000042
