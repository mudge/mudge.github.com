---
layout: post
title: Data Structures as Functions (or, Implementing <code>Set#to_proc</code> and <code>Hash#to_proc</code> in Ruby)
excerpt: Experimenting with using hashes and sets as functions in Ruby.
---

Reading [Henrik Nyh's "Array#to_proc for hash
access"](http://thepugautomatic.com/2014/11/array-to-proc-for-hash-access/)
made me think about a similar concept in [Clojure](http://clojure.org/): that
of data structures being used as functions.

## Using sets as functions

In Clojure (as in many languages, including Ruby), there are data structures
for [sets][Clojure sets] and [maps][Clojure maps] (not to be confused with the
[function of the same name][Clojure map] but something akin to a [Hash][Ruby hash]
in Ruby or a [dictionary][Python dictionary] in Python) but, unlike other
languages, these structures can be used in places where you would expect a
function.

For example, Clojure's [`filter`][Clojure filter] is a function that takes two
arguments: a function `pred` that returns true or false and some collection
`coll`. It will test each item in the collection by calling `pred` with it and
return a new collection containing only items that return true. We can use
this to filter even numbers from a range using [`even?`][Clojure even]:

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
some value, they will return that value if (and only if) that value is a
member of that set. This makes for a nifty shortcut when testing whether a
value is in some whitelist:

```clojure
(def valid-attributes #{:name :age})

(defn foo [attribute]
  (when (valid-attributes attribute)
    ;; insert money-making business logic here
    (println "PROFIT")))
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
is old news to you, feel free to [skip ahead](#using-hashes-as-functions)).

## What's with the ampersand?

In Ruby, there are methods (such as `select` above) that take
[blocks](http://ruby-doc.com/docs/ProgrammingRuby/html/tut_containers.html#S2).
A good example of this is [`map`][Ruby map] which evaluates a given block for
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

(The real implementation actually features a cache to reduce some of the
performance overhead of this approach.)

You can think of this as expanding like so (though note some of the
intermediate steps are not valid Ruby):

```ruby
(1..30).map(&:to_s)
(1..30).map(:to_s.to_proc)
(1..30).map(->(x) { x.send(self) })
(1..30).map { |x| x.send(:to_s) }
(1..30).map { |x| x.to_s }
```

## Using hashes as functions

A slightly more interesting case is that of maps in Clojure:

```clojure
({:a 2 :b 3} :a)
;; => 2

({:a 2 :b 3} :c)
;; => nil
```

This behaviour reminds me of the definition of a [function in
mathematics][Functions]:

> A <b>function</b> is a relation between a set of inputs and a set of
permissible outputs with the property that each input is related to exactly
one output.

In this case, given the input of the key, the map returns the
corresponding value for that key (or `nil` if there is no such entry).

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

name, age = %i(name age).map(&person)
# => ["Robert Paulson", 43]
```

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
