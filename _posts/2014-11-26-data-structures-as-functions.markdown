---
layout: post
title: Data Structures as Functions (or, Implementing <code>Set#to_proc</code> and <code>Hash#to_proc</code> in Ruby)
excerpt: Experimenting with using hashes and sets as functions in Ruby.
---

<i>**Update:** Now with a lot more background and alternate `Array#to_proc` and
`Symbol#to_proc` implementations as ported from Clojure's vectors and
keywords.</i>

Reading [Henrik Nyh's "Array#to_proc for hash
access"](http://thepugautomatic.com/2014/11/array-to-proc-for-hash-access/)
made me think about a similar concept in [Clojure](http://clojure.org/): that
of data structures being used as functions.

## Functions

First of all, let's be clear what we mean by "functions".
The definition of a [function in mathematics][Functions] is as follows:

> A <b>function</b> is a relation between a set of inputs and a set of
permissible outputs with the property that each input is related to exactly
one output.

So a function `f` can be considered as a way of mapping from some input (its
"[domain][]") to some output (its "[codomain][]"), e.g.

```ruby
f(1)
# => 2
```

Crucially, whenever the function is called with a specific input, it should
*always* produce the same output. This means `f` in the following example
would *not* be a function because it produces two different outputs given the
same input:

```ruby
f(1)
# => 2

f(1)
# => 3
```

Whole programming languages are built out of this concept (it's called
[*functional* programming][functional programming] for a reason) but they also appear in languages
that aren't purely functional, such as Ruby.

A common place you might find them is when using methods from
[`Enumerable`](http://ruby-doc.org/core-2.1.5/Enumerable.html) such as
[`all?`][all?]
and [`map`][Ruby map]:

```ruby
(1..10).all? { |x| x > 4 }
# => false

(1..10).map { |x| x * 2 }
# => [2, 4, 6, 8, 10, 12, 14, 16, 18, 20]
```

In both of the above cases, the [blocks][] passed to `all?` and `map` are
actually simple functions.

```ruby
->(x) { x > 4 }
```

No matter how many times you call this function with the number 0, it will
*always* return false.

```ruby
->(x) { x * 2 }
```

Similarly, no matter how many times you call this function with the number 1,
it will *always* return 2.

With this in mind, let's take a look at functions in Clojure.

## Using sets as functions

In Clojure (as in many languages, including Ruby), there are data structures
for [sets][Clojure sets] and [maps][Clojure maps] (not to be confused with the
[function of the same name][Clojure map] but something akin to a [Hash][Ruby hash]
in Ruby or a [dictionary][Python dictionary] in Python) but, unlike other
languages, these structures can be used in places where you would expect a
function.

For example, Clojure's [`filter`][Clojure filter] takes two arguments: a
function `pred` and a collection `coll`. As you might expect from its name, it
goes through `coll` and only returns elements that return true when fed into
`pred`. We can use this to filter even numbers from a range using
[`even?`][Clojure even]:

```clojure
(filter even? (range 1 30))
;; => (2 4 6 8 10 12 14 16 18 20 22 24 26 28)
```

Of course, `even?` can be used by itself too:

```clojure
(even? 5)
;; => false
```

Nothing too surprising there but what if we used a set instead of an existing
function?

Let's define a set of numbers we like:

```clojure
(def perfect-numbers #{6 28 496})
```

Now let's filter our range again but using the set instead of `even?`:

```clojure
(filter perfect-numbers (range 1 30))
;; => (6 28)
```

To understand what happened here, let's just try using the set as a function
as we did `even?`:

```clojure
(perfect-numbers 1)
;; => nil

(perfect-numbers 6)
;; => 6
```

It turns out that sets can be used as functions of their members: when given
some input, they will return that input if (and only if) it is a member of the
set; if it isn't, it returns `nil`. This behaviour makes for a nifty shortcut
when testing whether a value is in some whitelist:

```clojure
(def valid-attributes #{:name :age})

(defn foo [attribute]
  (when (valid-attributes attribute)
    ;; insert money-making business logic here
    (println "PROFIT")))
```

The way this actually works in Clojure is that sets implement the [`IFn`
interface][IFn] meaning that they have an `invoke` method that can be used to
call them as if they were ordinary functions. There's a very similar [`__invoke`
magic method][invoke] in [PHP][] that allows objects to be called as functions:

```php
<?php
class Monkey
{
    public function __invoke($name)
    {
        return "Ook, {$name}!";
    }
}

$monkey = new Monkey;
$monkey('Bob');
// => 'Ook, Bob!'
```

We can achieve similar behaviour in Ruby by implementing `Set#to_proc` (in the same
way Henrik implemented `to_proc` on `Array`):

```ruby
class Set
  def to_proc
    ->(x) { x if include?(x) }
  end
end
```

This means we can do the same sort of filtering using
[`select`][Ruby select]:

```ruby
require "set"

perfect_numbers = Set[6, 28, 496]

(1..30).select(&perfect_numbers)
# => [6, 28]
```

If you're unfamiliar with the syntax above, let's take a quick detour (if this
is old news to you, feel free to [skip ahead](#calling-procs)).

## What's with the ampersand?

In Ruby, there are methods (such as `select` above) that take [blocks][]. A
good example of this is [`map`][Ruby map] which evaluates a given block for
each item in a collection and returns a new collection with the results:

```ruby
(1..30).map { |x| x.to_s }
# => ["1", "2", "3", ..., "30"]
```

Wherever you can pass a block in Ruby, you can also pass a
[`Proc`][Proc] using an ampersand like so:

```ruby
stringify = ->(x) { x.to_s }

(1..30).map(&stringify)
# => ["1", "2", "3", ..., "30"]
```

Note that `stringify` is already a `Proc` here but if it wasn't, Ruby would
internally call `to_proc` on it in an attempt to coerce it to the right type.

As mapping over a collection and calling a method on each element is quite a
common task and armed with the knowledge of Ruby's internal use of `to_proc`,
a technique emerged of using symbols as a shortcut:

```ruby
(1..30).map(&:to_s)
# => ["1", "2", "3", ..., "30"]
```

This works by implementing `Symbol#to_proc` with something like so:

```ruby
class Symbol
  def to_proc
    ->(x) { x.send(self) }
  end
end
```

(The [real implementation][Symbol#to_proc] actually features a cache to reduce some of the
performance overhead of this approach.)

You can think of this as expanding like so:

```ruby
(1..30).map(&:to_s)
(1..30).map(&:to_s.to_proc)
(1..30).map(&->(x) { x.send(:to_s) })
(1..30).map { |x| x.send(:to_s) }
(1..30).map { |x| x.to_s }
```

## Calling Procs

With `to_proc` implemented on sets, can we use them as we did in Clojure?

```ruby
perfect_numbers.call(1)
# NoMethodError: undefined method `call' for #<Set: {6, 28, 496}>
```

Sadly not, as sets themselves are not `Proc`s. Perhaps we could use the
ampersand trick?

```ruby
&perfect_numbers.call(1)
# SyntaxError: unexpected &, expecting end-of-input
# &perfect_numbers.call(1)
#  ^
```

No luck there either. In fact, we'd have to do the following:

```ruby
perfect_numbers.to_proc.call(1)
# => nil
```

This is where our efforts diverge from Clojure: simply implementing `to_proc`
doesn't mean that sets are now functions. You could maybe make them more
`Proc`-like with something like the following but there is no equivalent to
Clojure's `IFn` or PHP's `__invoke` in Ruby:

```ruby
class Object
  def call(*args)
    to_proc.call(*args)
  end
end

perfect_numbers.call(3)
# => 6
```

## Using hashes as functions

A slightly more interesting case is that of maps in Clojure:

```clojure
({:a 2 :b 3} :a)
;; => 2

({:a 2 :b 3} :c)
;; => nil
```

Like the behaviour of sets, maps are functions of their keys: given the input
of the key, they return the corresponding value (or `nil` if there is no such
entry). This fits quite nicely with our original mathematical functions: the
keys being the [domain][] and the values being the [codomain][].

As for how this might be useful, [Jay Fields wrote up an interesting use
case][Jay Fields] when comparing and filtering two maps. It also gives us an
alternate way to access hash keys as in Henrik's original post.

First, let's implement `Hash#to_proc` to mirror Clojure's behaviour:

```ruby
class Hash
  def to_proc
    method(:[]).to_proc
  end
end
```

Here we simply take `Hash`'s existing [`[]`][aref] method for accessing values and
convert it to a `Proc`. Now we can use it like so:

```ruby
%w(a b c d).map(&{"a" => 1, "b" => 2, "c" => 3})
# => [1, 2, 3, nil]
```

Or, to use a more realistic example:

```ruby
person = { name: "Robert Paulson", age: 43 }

name, age = [:name, :age].map(&person)
# => ["Robert Paulson", 43]
```

In this second example, it's almost the reverse of Henrik's `Array#to_proc`
behaviour where the hash is passed into a function created from the keys:

```ruby
[{ name: "A" }, { name: "B" }].map(&[:name])
# => ["A", "B"]
```

In our case, it is the key that is passed into a function created from the
hash:

```ruby
[:name].map(&{ name: "A" })
# => "A"
```

## Other data structures as functions

Maps and sets are not the only data structures to implement the `IFn`
interface in Clojure.

There are vectors:

```clojure
([1 2 3] 0)
;; => 1
```

Which would be equivalent to the following `Array#to_proc`:

```ruby
class Array
  def to_proc
    method(:[]).to_proc
  end
end

(1..3).map(&["A", "B", "C", "D", "E"])
# => ["B", "C", "D"]
```

There are also keywords which are similar to Ruby's symbols:

```clojure
(:name {:name "Robert Paulson", :age 42})
;; => "Robert Paulson"
```

To implement this in Ruby, we'd have to override the now standard
`Symbol#to_proc` like so:

```ruby
class Symbol
  def to_proc
    ->(coll) { coll[self] }
  end
end

[{ name: "Robert Paulson", age: 42 }].map(&:name)
# => ["Robert Paulson"]
```

Of course, this would mean you can no longer use it for method access.

In conclusion, we shouldn't be afraid to experiment with concepts from other
languages. After all, as [Alan Perlis
said](http://blog.fogus.me/2011/08/14/perlis-languages/):

> A language that doesn't affect the way you think about programming is not
> worth knowing.

  [Clojure sets]: http://clojure.org/data_structures#Data%20Structures-Sets
  [Clojure maps]: http://clojure.org/data_structures#Data%20Structures-Maps%20(IPersistentMap)
  [Clojure map]: https://clojuredocs.org/clojure.core/map
  [Ruby hash]: http://www.ruby-doc.org/core-2.1.5/Hash.html
  [Python dictionary]: https://docs.python.org/2/tutorial/datastructures.html#dictionaries
  [Clojure filter]: https://clojuredocs.org/clojure.core/filter
  [Clojure even]: https://clojuredocs.org/clojure.core/even_q
  [Ruby select]: http://www.ruby-doc.org/core-2.1.5/Array.html#method-i-select
  [Ruby map]: http://www.ruby-doc.org/core-2.1.5/Array.html#method-i-map
  [Proc]: http://www.ruby-doc.org/core-2.1.5/Proc.html
  [Method]: http://www.ruby-doc.org/core-2.1.5/Method.html
  [Functions]: http://en.wikipedia.org/wiki/Function_(mathematics)
  [Jay Fields]: http://blog.jayfields.com/2010/08/clojure-using-sets-and-maps-as.html
  [aref]: http://www.ruby-doc.org/core-2.1.5/Hash.html#method-i-5B-5D
  [Crystal to_proc]: http://crystal-lang.org/2013/09/15/to-proc.html
  [functional programming]: http://en.wikipedia.org/wiki/Functional_programming
  [blocks]: http://ruby-doc.com/docs/ProgrammingRuby/html/tut_containers.html#S2
  [all?]: http://ruby-doc.org/core-2.1.5/Enumerable.html#method-i-all-3F
  [IFn]: https://github.com/clojure/clojure/blob/master/src/jvm/clojure/lang/IFn.java
  [Symbol#to_proc]: https://github.com/ruby/ruby/blob/25bab786cb416aa491ff62e6d9b6ba196251bfc6/string.c#L8631-L8669
  [domain]: http://en.wikipedia.org/wiki/Domain_of_a_function
  [codomain]: http://en.wikipedia.org/wiki/Codomain_(mathematics)
  [invoke]: http://php.net/manual/en/language.oop5.magic.php#object.invoke
  [PHP]: http://php.net/

