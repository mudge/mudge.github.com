---
layout: post
title: Testing Vim Plugins on Travis CI with RSpec and Vimrunner
excerpt: >
  How to continuously integrate and test-drive Vim plugin development
  with the Vimrunner gem.
---
I have been using [Vim][] as my primary text editor for several years but it
was only recently that I decided to try and write [my own Vim
plugin][runspec.vim]. My aim was simple: to create a function that would run
the tests for whatever file I was working on. If the file was a test itself
then simply run it but if it wasn't, try to find the corresponding test and
run that.

Having heard Vim script (sometimes referred to as VimL) is a rather esoteric
language, I pored through the [official Vim manual section][usr_41] and [Steve
Losh's "Learn Vimscript the Hard Way"][LVTHW] and got stuck in.

The code was simple at first but, as it progressed, I found myself programming
and then firing up Vim to check whether everything worked as expected. At the
recent [London Ruby User Group "TDD Fishbowl" debate][TDD Fishbowl], this
method of verifying code correctness was derisively referred to as
"Refresh-Driven Development". Mindful of this bad practice and having grown
tired of manually inspecting functions in Vim, I decided to look into
solutions for not only automating the testing of Vim script but also
techniques for test *driving* development.

My initial searches resulted in a [Stack Overflow post about Vim script unit
test frameworks][Stack Overflow] but none of the solutions appeared
particularly popular or actively maintained. However, by adding "driving" to
my search terms, I came across [Andrew Radev's "Driving Vim with Ruby and
Cucumber"][Driving Vim].

I recommend you read Andrew's full post but the summary is that he wrote a
gem called [Vimrunner][] which uses [Vim's client-server
functionality][clientserver] to drive Vim from [Ruby][]. Using this gem, he
was able to create [an extension to Cucumber][cucumber-vimscript] to write
acceptance tests for his Vim plugins.

This was almost exactly what I was looking for except that I prefer to use
[RSpec][] for small libraries rather than [Cucumber][]. Luckily, the [core of
cucumber-vimscript][cucumber-vimscript core] is very simple, so I decided to
explore using only Vimrunner and RSpec to test-drive my plugin.

To begin with, I had the following directory layout with the standard files:

    .
    ├── plugin
    │   └── runspec.vim
    ├── autoload
    │   └── runspec.vim
    └── doc
        └── runspec.txt

In order to get up and running with these Ruby testing frameworks, I added a
[`Gemfile`][Gemfile] with the following contents:

{% highlight ruby %}
source 'https://rubygems.org'
gem 'vimrunner', '~> 0.3.1'
gem 'rspec',     '~> 3.1.0'
{% endhighlight %}

The actual process of testing the plugin is as follows:

1. Start a Vim server by invoking Vim with an explicit
   [`servername`][servername];
2. Load our plugin under test into the server (viz. put it in Vim's [runtime
   path][rtp] and [execute the main script][runtime]);
3. Start sending commands to our Vim server using [`remote-expr`][remote-expr]
   and check the results for correctness;
4. Quit the Vim server.

If we're writing a spec called `spec/runspec.vim_spec.rb` then steps 1, 2
and 4 are straightforward thanks to Vimrunner:

{% highlight ruby %}
require 'vimrunner'

vim = Vimrunner.start
vim.add_plugin(File.expand_path('../..', __FILE__), 'plugin/runspec.vim')

RSpec.describe "runspec.vim" do
  after(:all) do
    vim.kill
  end
end
{% endhighlight %}

As you can see, we require the gem and then start a new Vim server with
`start`. We add our plugin to the server using the `add_plugin` helper
method and pass the directory (given relative to our current test file) and
the relative path of the main plugin script. We also add an [RSpec `after`
hook][after] to shut down the server once we are done.

With this in place, we can start writing some basic tests.

As the point of my plugin is to run tests by executing a shell command with
[`:!`][:!], it could prove difficult to exhaustively test. However, instead of focussing on
the actual execution, I can test the parts of the plugin leading up to that
final stage. In particular, let's look at the part of the plugin that tries to
find the most appropriate spec for the currently open file.

Before I started writing tests, this function was private and accessible only
to the plugin thereby making it difficult if not impossible to test. By
switching to using Vim's [autoload][] functionality, I could now access (and
*test*) the function from outside the plugin but without worrying too much
about namespace clashes.

Here's the first (admittedly simple) spec:

{% highlight ruby %}
require 'vimrunner'

vim = Vimrunner.start
vim.add_plugin(File.expand_path('../..', __FILE__), 'plugin/runspec.vim')

RSpec.describe "runspec.vim" do
  after(:all) do
    vim.kill
  end

  describe "#SpecPath" do
    it "returns the current file if it ends in _spec.rb" do
      expect(vim.command('echo runspec#SpecPath("bar/foo_spec.rb")')).to
          eq("bar/foo_spec.rb")
    end
  end
end
{% endhighlight %}

Running the spec produced the following, rather thrilling output:

{% highlight console %}
$ rspec spec/runspec.vim_spec.rb
.

Finished in 0.49066 seconds
1 example, 0 failures
{% endhighlight %}

As it ran, I saw an instance of Vim fire up and then be shut down as the test
suite completed. More importantly, all my specified behaviour was checked
without my having to interfere.

This was a great start but is only really good if you are testing functions
that have no side-effects. However, one part of my plugin relies on checking
the file system to determine its behaviour: namely, it reads a `Gemfile.lock` to
determine whether to use `rspec` or not. How could we test this sort of
functionality?

Well, we can simply write out a dummy `Gemfile.lock` during our test and see
if the function works correctly:

{% highlight ruby %}
File.open("Gemfile.lock", "w") do |f|
  f.puts(<<-EOF)
GEM
  remote: https://rubygems.org/
  specs:
    diff-lcs (1.1.3)
    rake (0.9.2.2)
    rspec (2.9.0)
      rspec-core (~> 2.9.0)
      rspec-expectations (~> 2.9.0)
      rspec-mocks (~> 2.9.0)
    rspec-core (2.9.0)
    rspec-expectations (2.9.1)
      diff-lcs (~> 1.1.3)
    rspec-mocks (2.9.0)

PLATFORMS
  ruby

DEPENDENCIES
  rake
  rspec
  EOF
end
{% endhighlight %}

However, this file won't be removed at the end of your test runs and, what's
worse, it could potentially interfere with other tests.

To fix this, we can use Ruby's [`Dir.mktmpdir`][mktmpdir] and [`Dir.chdir`][chdir]
in an [RSpec `around` hook][around] to create a temporary directory and `cd`
into it for every single test. As we are re-using the same instance of Vim for
each test, we'll also have to `cd` the server into each new directory:

{% highlight ruby %}
# At the top of your spec:
require "tmpdir"

# In your example group:
around do |example|
  Dir.mktmpdir do |dir|
    Dir.chdir(dir) do
      vim.command("cd #{dir}")
      example.call
    end
  end
end
{% endhighlight %}

By using the block form of both `mktmpdir` and `chdir`, Ruby will destroy the
temporary directory and restore the current working directory after every run.

This made it possible for me to write specs like the following without
worrying about the disk being littered with test files:

{% highlight ruby %}
it "finds a test with the most similar name" do
  FileUtils.mkdir_p("test/unit")
  FileUtils.touch("test/unit/user_test.rb")

  expect(vim.command('echo runspec#SpecPath("app/models/user.rb")')).to
      eq("test/unit/user_test.rb")
end
{% endhighlight %}

At this point, there was quite a bit of set up in the spec file so I decided
to move it out into a separate `spec_helper.rb` to keep the actual tests
concise:

{% highlight ruby %}
require 'tmpdir'
require 'vimrunner'

RSpec.configure do |config|
  config.around do |example|
    Dir.mktmpdir do |dir|
      Dir.chdir(dir) do
        VIM.command("cd #{dir}")
        example.call
      end
    end
  end

  config.before(:suite) do
    VIM = Vimrunner.start
    VIM.add_plugin(File.expand_path('../..', __FILE__), 'plugin/runspec.vim')
  end

  config.after(:suite) do
    VIM.kill
  end
end
{% endhighlight %}

Note the use of a `VIM` constant in `before(:suite)` instead of a simple local
variable so that the server is available to all specs and the changing of
`after(:all)` to `after(:suite)` so that the Vim server is shut down once the
*entire* test suite is finished and not just those in the current example
group.

So now we have a fully automated test suite that we can run locally; what
next? How about continuously integrating that test suite to ensure that no
commit breaks the build? How about using [Travis CI][] for that purpose?

If you are unfamiliar with Travis, have a look at their [Getting started][]
guide which will lead you through creating an account, hooking it up to your
[GitHub][] repositories and running your first build.

In this case, we're going to use their [Ruby support][] to run our test suite.
In order to do that, we need a default [Rake][] task that will run the tests.

Firstly, we need to add Rake as a dependency to our existing `Gemfile`:

{% highlight ruby %}
gem 'rake', '~> 10.3.2'
{% endhighlight %}

Then we need to create a `Rakefile` and a task to run the tests. Luckily,
RSpec ships with [such a task][RSpec Rake Task] by default which we can use
and define as the default like so:

{% highlight ruby %}
require 'rspec/core/rake_task'

RSpec::Core::RakeTask.new(:spec)

task :default => :spec
{% endhighlight %}

(Note that `RSpec::Core::RakeTask.new` will name the task `:spec` by default
but I'm being explicit here for clarity.)

You should now be able to run your suite like so:

{% highlight console %}
$ rake
..............

Finished in 4.85 seconds
14 examples, 0 failures
{% endhighlight %}

All that is left is to configure Travis to do that too. Simply create a file
named `.travis.yml` with the following contents:

{% highlight yaml %}
language: ruby
rvm:
  - 2.1.3
before_install: sudo apt-get install vim-gtk
before_script:
  - "export DISPLAY=:99.0"
  - "sh -e /etc/init.d/xvfb start"
{% endhighlight %}

This will inform Travis to use the latest version of Ruby (as of writing) and
to install a version of Vim with the necessary client-server functionality we
need for testing. We also need to start a [X virtual framebuffer][Xvfb] so
that we can create a Vim server successfully which is what the two
`before_script` options are doing (see [GUI & Headless browser testing][GUI]
for more information).

With that in place, the next time you push to GitHub, it should trigger a
build on Travis: see [Build #8 of runspec.vim](http://travis-ci.org/#!/mudge/runspec.vim/builds/1148554) for an example.

To see a fully worked example (and my finished plugin), feel free to browse
the [source code of runspec.vim][runspec.vim] and look at the [build history
on Travis CI][].

*Update:* Updated for [RSpec 3][].

  [Vim]: http://www.vim.org/
  [runspec.vim]: https://github.com/mudge/runspec.vim
  [usr_41]: http://vimdoc.sourceforge.net/htmldoc/usr_41.html
  [LVTHW]: http://learnvimscriptthehardway.stevelosh.com/
  [Stack Overflow]: http://stackoverflow.com/questions/3029882/tools-for-testing-vim-plugins
  [TDD Fishbowl]: http://skillsmatter.com/podcast/ajax-ria/lrug-tdd-fishbowl
  [Driving Vim]: http://andrewradev.com/2011/11/15/driving-vim-with-ruby-and-cucumber/
  [Vimrunner]: https://github.com/AndrewRadev/vimrunner
  [cucumber-vimscript]: https://github.com/AndrewRadev/cucumber-vimscript
  [cucumber-vimscript core]: https://github.com/AndrewRadev/cucumber-vimscript/blob/master/lib/cucumber/vimscript.rb
  [MacVim]: http://code.google.com/p/macvim/
  [mac-support]: https://github.com/AndrewRadev/vimrunner/pull/2
  [RSpec]: https://www.relishapp.com/rspec
  [Cucumber]: http://cukes.info/
  [clientserver]: http://vimdoc.sourceforge.net/htmldoc/remote.html
  [autoload]: http://vimdoc.sourceforge.net/htmldoc/eval.html#autoload
  [mktmpdir]: http://www.ruby-doc.org/stdlib-1.9.3/libdoc/tmpdir/rdoc/Dir.html#method-c-mktmpdir
  [chdir]: http://www.ruby-doc.org/core-1.9.3/Dir.html#method-c-chdir
  [around]: https://www.relishapp.com/rspec/rspec-core/v/2-9/docs/hooks/around-hooks
  [Travis CI]: http://travis-ci.org/
  [Getting started]: http://about.travis-ci.org/docs/user/getting-started/
  [GitHub]: https://github.com/
  [Ruby support]: http://about.travis-ci.org/docs/user/languages/ruby/
  [Rake]: http://rake.rubyforge.org/
  [Xvfb]: http://en.wikipedia.org/wiki/Xvfb
  [GUI]: http://about.travis-ci.org/docs/user/gui-and-headless-browsers/
  [build history on Travis CI]: http://travis-ci.org/mudge/runspec.vim
  [Ruby]: http://www.ruby-lang.org/en/
  [Gemfile]: http://gembundler.com/man/gemfile.5.html
  [rtp]: http://vimdoc.sourceforge.net/htmldoc/options.html#'runtimepath'
  [runtime]: http://vimdoc.sourceforge.net/htmldoc/repeat.html#:runtime
  [servername]: http://vimdoc.sourceforge.net/htmldoc/remote.html#--servername
  [remote-expr]: http://vimdoc.sourceforge.net/htmldoc/remote.html#--remote-expr
  [after]: https://www.relishapp.com/rspec/rspec-core/v/2-9/docs/hooks/before-and-after-hooks
  [:!]: http://vimdoc.sourceforge.net/htmldoc/various.html#:!
  [RSpec Rake Task]: https://www.relishapp.com/rspec/rspec-core/v/2-9/docs/command-line/rake-task
  [RSpec 3]: http://myronmars.to/n/dev-blog/2014/05/notable-changes-in-rspec-3
