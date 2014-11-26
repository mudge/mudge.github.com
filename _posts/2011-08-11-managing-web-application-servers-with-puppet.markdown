---
layout: post
title: Managing Web Application Servers with Puppet
excerpt: A transcript of my August 2011 LRUG presentation regarding configuration management and Puppet.
---
<a class=pull-right href=//skillsmatter.com/podcast/home/lrug-puppet/><img src=/i/screengrab.png alt="View the full presentation on the Skillsmatter web site" width=239 height=179></a> *At the [August 2011 meeting of the London Ruby User Group][LRUG August], I delivered a presentation titled "Managing Web Application Servers with Puppet". You can watch a video of [the whole presentation and the Q & A session on the Skills Matter web site][Video] but for those of you who prefer to read, here is an edited transcript:*

## Table of Contents

1. [Introduction](#introduction) (who I am, what I am going to talk about);
2. [The Old Way](#the-old-way) (manualling setting up a sample Rails application and some problems);
3. [Enter Configuration Management](#enter-configuration-management) (introduction to configuration management and Puppet);
4. [The Better Way](#the-better-way) (setting up the Rails application from earlier but entirely with Puppet);
5. [Testing](#testing) (a few words on testing configuration);
6. [Wrap-Up](#wrap-up) (closing remarks).

## Introduction

My name's Paul Mucur and I'm going to be talking about managing web application servers with [Puppet][].

First of all, who am I? I've been a Ruby developer since late 2006 and I currently work for the [Nature Publishing Group][NPG]: they publish [Nature][] which is a scientific journal that has been going for [around 140 years][Nature Wikipedia]. However, I don't work on the journal side; I work for their Web Applications team building mainly [Rails][] apps (with a couple of [Sinatra][] bits and pieces) for the scientific community. It's quite a large organisation and the actual system administrators are not only not in the office but they're actually in a totally different *time zone* and I want to talk a bit about how we try to mitigate problems with regards to having that amount of separation.

Who is this talk for? Really, it's for developers not unlike myself (unsurprisingly):

* You've deployed an application (maybe a personal project that you've put on [Linode][] or [Slicehost][]);
* You still have to deploy to servers (i.e. you're not lucky enough to be on [Heroku][]);
* You've heard of Puppet and/or [Chef][] and have maybe had a play around but want to know more;
* You're open to the idea that there is a better way to set up servers than just running a load of commands as `root`.

I'm going to be taking the example of a simple Rails application -- just because it touches on quite a lot of things sysadmin-wise and hopefully you're all familiar with the standard set up -- and we're going to do the following:

* Run through how we would set up the application normally;
* Some problems with doing it like that;
* Offer an alternative using configuration management (and specifically Puppet) as a better way of doing things.

What I'm *not* going to talk about is:

* The nitty-gritty of how to set up Puppet (you can install it from a package manager but we're just going to take it as read that you have it set up);
* Using Puppet as a replacement for your normal deployment workflow (we're still going to be using [Capistrano][] to get our application code on the servers).

## The Old Way

Let's introduce our Rails application. Because I'm a geek and because it will fit neatly on slides, it's just going to be called "[mcp][]" and it's a normal, no-frills Rails application.

```console
$ ls mcp
Capfile      config       log
Gemfile      config.ru    public
Gemfile.lock db           script
README       doc          spec
Rakefile     features     tmp
app          lib          vendor
```

It has a complete test suite, has been set up with Capistrano but has not been deployed yet. First, let's make sure all the tests pass...

```console
$ bundle exec rspec spec
................

Finished in 0.00816 seconds
Many, many examples, 0 failures
```

Everything seems to work so let's get a server prepared for a first time deploy.

We're going to make some assumptions:

* You've already got a server (you don't have to worry about buying it);
* You can already log into the server via SSH;
* You have permission to run commands as `root` as you are responsible for setting things up.

Let's log into the server...

```console
$ ssh mudge@server1
Last login: Mon Aug  1 21:08:06 2011 from 123-45-67-89.
```

We like to separate our applications by user so -- as this is an application called `mcp` -- we'll use an `mcp` user and we will actually keep the application code inside the user's home folder.

So the first thing we need to do is create a user but I can't quite remember what flags we need to pass to `adduser` on this machine...

```console
$ /usr/sbin/adduser -h
adduser [--home DIR] [--shell SHELL]
[--no-create-home] [--uid ID] [--firstuid ID]
[--lastuid ID] [--gecos GECOS]
[--ingroup GROUP | --gid ID]
[--disabled-password] [--disabled-login]
[--encrypt-home] USER
   Add a normal user
```

It looks like this machine's `adduser` will create home directories for us by default (some operating systems require a `-m` flag to do that). Let's drop into a `root` prompt (just to make the slides a bit easier) and add our new user.

```console
$ sudo -i
# adduser mcp
Adding user `mcp' ...
Adding new group `mcp' (1002) ...
Adding new user `mcp' (1001) with group `mcp' ...
Creating home directory `/home/mcp' ...
Copying files from `/etc/skel' ...
Enter new UNIX password: 
Retype new UNIX password: 
...
Is the information correct? [Y/n] 
```

After filling out a little information, we now have our user and, from the output, it looks like we got a group named after the user created as well.

As we're going to be deploying our application with Capistrano and we don't want to be passing around passwords, we now want to set up SSH keys. If you're not familiar with the concept, you can use SSH keys to log into a user account without entering a password by putting your public key in a file called `authorized_keys` in the user's home directory. There are a few tricky things to be aware of though particularly regarding permissions of the files involved in this process.
The first thing we need to do is create a `.ssh` directory but do it in a way that means only the owner can access it...

```console
# mkdir -m 700 ~mcp/.ssh
```

Then we're going to add our key to the `authorized_keys` file and, as I am running as `root` and not `mcp`, we need to make sure that we `chown` everything to the right user so they can access it.

```console
# vi ~mcp/.ssh/authorized_keys
# chmod 600 ~mcp/.ssh/authorized_keys
# chown -R mcp: ~mcp/.ssh
```

That's now done and only the `mcp` user can access our list of public keys.

We want to have a particular directory structure for our deployed application and we're going to copy the one used by Capistrano:

* A `releases` directory that will contain timestamped versions of your application code;
* A `shared` directory that persists across deploys making it ideal for storing configuration like your `database.yml`.

The final part (which will be managed by Capistrano itself) is a symbolic link called `current` which points to the currently active version of your code within the `releases` directory.

While Capistrano will create those directories for us, we want to take advantage of the `shared` directory now so that we can put our configuration in place before we deploy. Let's create our directory structure within the `mcp` user's home directory...

```console
# mkdir -p ~mcp/apps/mcp/shared/config
```

As we're doing everything as `root`, we just need to make sure everything is owned by the right user...

```console
# chown -R mcp: ~mcp/apps
```

As a developer in a large organisation, ideally I'm not supposed to see live usernames and passwords for things like the database so let's say, at this point, we hand over to a system administrator who *does* have authority to handle those details. Perhaps we could supply them with a `database.yml` with "FILL IN THE BLANKS HERE" for the username and password and then guide them to put the file in the right place. Once they have done that then we can make use of the file in our deploys without having to store it on development machines.

```console
# cd ~mcp/apps/mcp/shared/config
# vi database.yml
```

Again, make sure that the user is correct.

```console
# chown mcp: database.yml
```

To run our application, we're going to need to install Ruby. As we might have several applications using different versions, let's install [RVM][] to manage Ruby for us *[NB: this predates the release of [rbenv and the ensuing controversy][rbenv controversy]]*.

Firstly, we'll need to install RVM's dependencies; as we are using Debian, we'll need to use `apt-get` to install the required packages...

```console
# apt-get install curl git-core subversion
Reading package lists... Done
Building dependency tree
Reading state information... Done
```

You can install RVM using a one-liner but, as we are on a production server, we want to be a bit pickier about the version we are using. Luckily, RVM offers an alternative way to install by downloading a single script...

```console
# cd /root
# curl -s \
> https://rvm.beginrescueend.com/install/rvm \
> -o rvm-installer
```

Making it executable...

```console
# chmod +x rvm-installer
```

And then using that to install a known good version, let's say 1.6.32...

```console
# ./rvm-installer --version 1.6.32
Installation of RVM to /usr/local/rvm is
complete.
```

As we are running as `root`, everything will be installed to `/usr/local`.

In order to actually compile and install versions of Ruby, there are a load of other dependencies we need (the list of which you can get by running `rvm notes` on your machine)...

```console
# apt-get install build-essential bison \
> openssl libreadline6 libreadline6-dev \
> zlib1g zlib1g-dev libssl-dev libyaml-dev \
> libsqlite3-0 libsqlite3-dev sqlite3 \
> libxml2-dev libxslt-dev autoconf \
> libc6-dev ncurses-dev libcurl4-openssl-dev
Reading package lists... Done
Building dependency tree
Reading state information... Done
```

Now that we've got all those, we can finally install our chosen version of Ruby. We are lucky enough to be using the latest version of 1.9.2 so let's go ahead and use RVM to install that...

```console
# rvm install 1.9.2-p290
Installing Ruby from source to:
/usr/local/rvm/rubies/ruby-1.9.2-p290, this
may take a while depending on your cpu(s)...
Install of ruby-1.9.2-p290 - #complete 
```

The final piece of the puzzle is our web server: we like to use [nginx][] and [Passenger][] to serve our applications so let's install and configure them. First we'll need to `source` RVM in order to switch environments...

```console
# source /usr/local/rvm/scripts/rvm
```

Now we can choose Ruby 1.9.2...

```console
# rvm use 1.9.2-p290
Using /usr/local/rvm/gems/ruby-1.9.2-p290
```

And then we're going to install a specific version of Passenger...

```console
# gem install passenger -v3.0.8
Fetching: fastthread-1.0.7.gem (100%)
Building native extensions.  This could
take a while...
Fetching: daemon_controller-0.2.6.gem (100%)
Fetching: rack-1.3.2.gem (100%)
...
Successfully installed passenger-3.0.8
```

Then we can use the `passenger-install-nginx-module` command to actually compile an nginx for us.

```console
# passenger-install-nginx-module
Welcome to the Phusion Passenger Nginx
module installer, v3.0.8.
```

Then after following the installation wizard, you will have a complete, compiled nginx in `/opt/nginx`. All we need to do now is configure it for our application.

By default, there is only one monolithic nginx configuration file but we're going to break that down so we can manage an application's configuration separately. In order to do that, we're going to use a pattern that I originally saw in the Debian packaging of Apache by having two directories:

* `sites_available`, with all possible application configuration;
* `sites_enabled`, with only enabled applications.

The main `nginx.conf` is then instructed to include any configuration found in `sites_enabled` and that is merely a collection of symbolic links to configuration in `sites_available`.

```console
# cd /opt/nginx/conf
# mkdir sites_available sites_enabled
# vi nginx.conf
```

Now we just need to put our application configuration in `sites_available` and link to it from `sites_enabled` (this way you can easily disable applications without having to delete all their configuration).

```console
# cd sites_available
# vi mcp.conf
# ln -s \
> /opt/nginx/conf/sites_available/mcp.conf \
> /opt/nginx/conf/sites_enabled/mcp.conf
```

As we installed nginx via Passenger, we will also need to make sure that we can control the web server and start it up on boot by creating an `init.d` script. Let's say we already have a stock one that we use and put that into place...

```console
# vi /etc/init.d/nginx
```

Make it executable...

```console
# chmod +x /etc/init.d/nginx
```

As we are using Debian, we need to use `update-rc.d` to start nginx up on boot...

```console
# update-rc.d -f nginx defaults
```

And then finally we can start up nginx ourselves for the first time.

```console
# /etc/init.d/nginx start
Starting nginx: nginx
```

Our server is now totally set up and ready to go.

It's just a case of going back to our deployment tool of choice (say, Capistrano) and performing the usual first-time deploy procedure. So we do a `deploy:setup` to create the directories we need...

```console
$ cap deploy:setup
```

Do a quick `check` to make sure everything is OK...

```console
$ cap deploy:check
```

And then do our big first `deploy` (hoping that everything will work first time).

```console
$ cap deploy:cold
```

You might not think that's too bad if you've done it many times before and it's become second nature to you but there are a few big problems with setting up servers in this way.

* **It's not easily repeatable**: what if I want to run through the same process on a second server? What if a colleague of mine wants to run through the same process? Perhaps you only have one server but something has gone wrong and you need to re-do the process from scratch, how can you easily do that? Without writing down this procedure in some way, you have no canonical resource that describes how the server was set up and there is little audit trail for you to follow.

* **It's not consistent**: I just ran a series of commands and was content with their output but, let's say an hour has passed, how confident can I be that the system is still in the state that I left it? What if someone else has logged in and accidentally deleted that `authorized_keys` file or perhaps subtly changed permissions somewhere critical? There isn't really a good way for me to be sure about things until they start breaking which is less than ideal.

* **It's not portable**: earlier, I had to check to see what flags I needed to pass to `adduser` as it differs from platform to platform. When I installed the dependencies for RVM, I used `apt-get`; when I wanted to start nginx up on boot, I used `update-rc.d` all because I knew I was using Debian. What if I wanted to run the same process on a RedHat or CentOS machine where I'd have to use `yum` and `chkconfig` instead? More importantly, why do I have to care what the exact flags to pass to `adduser` are?

The other big problem is that all of this was done assuming that I could both SSH into a live server and also run commands as `root`; in a large organisation, that is extremely unlikely. I definitely do not have such authority and neither should I have so the real way this work would have to be done is to be described laboriously in a JIRA ticket. Perhaps I would write a list of instructions in English with a little justification for each command.

That brings me to the most important weakness of all: **people make mistakes**. If I end up writing a script in English describing the commands to run, what happens if a step gets missed out? What if my explanation is ambiguous and there is a misunderstanding about the order in which commands need to be run? You can get into a sticky situation quite quickly and not realise until much further down the process and it might not be obvious or trivial to rectify.

Perhaps there is a better way to do this. I would argue that there is and it's called configuration management.

## Enter Configuration Management

Firstly, what does the term mean? It's quite a dry title and obviously refers to the management of configuration but what is important to grasp is the oft-cited idea of "infrastructure as code". Some people describe [Cucumber](http://cukes.info/) as "executable documentation" in that it is both human-readable and executable by machine to verify your business requirements; I would argue that "infrastructure as code" is a similar idea. Imagine if you could describe your infrastructure not in an ambiguous language like English but a formal grammar with something like Chef or Puppet: it would both describe the state of your servers in an unambiguous way but could also be executed to ensure consistency.

How many times have you had to debug a problem with a system administrator by asking them to check the permissions or content of certain files? What if you could just state all these assumptions up front and in code?

There are two main solutions for configuration management in the Ruby community (obviously there are more but these are the two most popular at the moment): Opcode's Chef and Puppet Labs&rsquo; Puppet.

I'm going to be talking about and sharing examples written with Puppet because that's what I use in my day job. When I joined the company, there was already some existing Puppet infrastructure so it made sense to leverage that but I did actually start learning Chef before I found that out. I want to make it clear that it doesn't matter which tool you use; give both a go and see which you prefer but the key thing is to embrace configuration management in some form. Don't let the nuances of one put you off the concept as a whole. You will see Puppet examples from me but [Gareth Rushgrove will be showing examples with Chef][chef-vagrant].

Let's start with a little primer; if you've never seen Puppet before, let's do some simple examples to show you how you need to start thinking about things.

Firstly, Puppet revolves around the idea of resources and this is one such resource...

```ruby
user { 'henry':
  ensure     => present,
  uid        => '507',
  gid        => 'staff',
  shell      => '/bin/zsh',
  home       => '/home/henry',
  managehome => true,
}
```

This is written in the Puppet language which looks a little like Ruby but *isn't* Ruby. (There is a [Ruby DSL for Puppet](http://puppetlabs.com/blog/ruby-dsl/) but I'm only going to be using the original Puppet language.)

This resource is describing a user called Henry: it's ensuring that he exists, that he's got a certain user ID, that his primary group is "staff", that his preferred shell is ZSH, that his home directory is in the standard place and that we will create it for him if it doesn't already exist. Notice I'm not saying, "you must run `adduser`"; I'm simply saying "there's a user with these properties". By describing the user at this level, you can make one change, say, from `present` to `absent`, to remove his account from the system. By delegating the responsibility of *how* to actually achieve these things to Puppet, you are free to keep your configuration quite sparse.

How would you actually use this? Let's take that definition, save it in a file called `henry.pp` and then run the following command...

```console
$ sudo puppet apply henry.pp
```

What Puppet's going to do is look at your system, check for a user named Henry and, as he doesn't yet exist, create him.

```console
notice:
/Stage[main]//User[henry]/ensure: created
notice: Finished catalog run in 0.25 seconds
```

We can verify that everything has run successfully by having a look in `/etc/passwd`...

```console
$ grep henry /etc/passwd
henry:x:507:50::/home/henry:/bin/zsh
```

As we can see, the user has been created and with the properties we specified.

If someone now logs into the server and decides that Henry should be using Bash instead of ZSH...

```console
$ sudo chsh henry
Changing shell for henry.
New shell [/bin/zsh]: /bin/bash
Shell changed.
```

Then the next time you run Puppet it's actually going to look at the system and spot the discrepancy between our specification and the state of the system. Most importantly, it will attempt to resolve this issue itself...

```console
$ sudo puppet apply henry.pp
notice:
/Stage[main]//User[henry]/shell:
shell changed '/bin/bash' to '/bin/zsh'
```

Puppet is clever enough to just to make the appropriate changes to bring the system in-line with our specification. Notice that we didn't tell it to explicitly run `chsh` and that it didn't need to delete and recreate the user. This is the idea of consistency that was missing from the manual approach and also shows how powerful Puppet can be in enforcing system state.

As well as specifying users, Puppet has many different types of resource. The official documentation refers to three in particular as the "Trifecta":

```ruby
package { 'openssh-server':
  ensure => installed,
}
```

A `package` resource is simply a software package that you might install via `apt-get` on Debian, `yum` on RedHat, etc.

```ruby
file { '/etc/sudoers':
  ensure => present,
}
```

The `file` resource allows you to perform operations on the file system; this example simply ensures that a file at `/etc/sudoers` exists and will create one if not. This is actually a very powerful resource type and we will see more of it later.

```ruby
service { 'sshd':
  ensure => running,
}
```

The `service` resource describes long running processes like those you would manage with an `init.d` script; in this example, it just makes sure the process labelled `sshd` is running.

I've shown examples using `puppet apply` but, in real life, you would probably use a different approach altogether: by having a separate Puppet Master server and having your nodes all run the Puppet Agent, you would actually store your configuration on the Master and watch it be applied every 30 minutes by default on all nodes. This is how you can be reasonably confident of your systems&rsquo; consistency but to keep things simple, we're going to leave that out for now.

## The Better Way

So let's go back to our Rails application and go through its set up again but this time using Puppet.

Last time, I ran `adduser` and a group was created simultaneously but it's good to be more explicit about it. So let's state there is a group named `mcp` and then a user named `mcp` with that as its primary group and let's manage their home directory as well...

```ruby
group { 'mcp':
  ensure => present,
}

user { 'mcp':
  ensure     => present,
  gid        => 'mcp',
  home       => '/home/mcp',
  managehome => true,
}
```

One thing that is interesting to note here is that the user refers to the group we created above it. You might think that is due to Puppet executing things sequentially but that's not true: Puppet does not use the order of definitions to derive dependencies. Instead, when you write resources, you refer to them with a lowercase resource type such as `group`:

```ruby
group { 'mcp':
  ensure => present,
}
```

But if you then use title case such as `Group`:

```ruby
Group['mcp']
```

You are actually creating a reference to your resource which can then be used in other definitions like so:

```ruby
user { 'mcp':
  ensure  => present,
  require => Group['mcp'],
}
```

This explictly states that the user `mcp` will not be checked until the *group* `mcp` has been enforced. The reason we didn't do that earlier is because Puppet will *autorequire* a lot of obvious things (you can check this in the documentation) but it never hurts to be explicit with dependencies.

If you accidentally set up resources that depend on each other like so:

```ruby
user { 'mcp':
  ensure => present,
  require => Group['mcp'],
}

group { 'mcp':
  ensure => present,
  require => User['mcp'],
}
```

Puppet will actually spot the issue when you attempt to run it:

```console
err: Could not apply complete catalog:
Found dependency cycles in the following
relationships:
User[mcp] => Group[mcp], Group[mcp] => User[mcp];
try using the '--graph' option and open the '.dot'
files in OmniGraffle or GraphViz
```

This is because Puppet builds a [directed acyclic graph](http://en.wikipedia.org/wiki/Directed_acyclic_graph) of your resources and can actually output the whole thing as a `.dot` file as you can see in the output above.

Now that we have user and group, we need to set up our SSH keys. Previously, we had to create the `.ssh` folder, add our key to `authorized_keys` and make sure that the ownership and permissions were set correctly. With Puppet, you can forget all that and simply use the built-in `ssh_authorized_key` resource type:

```ruby
ssh_authorized_key { 'mcp-mudge':
  ensure => present,
  key    => 'AAAAB3NzaC1yc2EAAAAB...',
  type   => dsa,
  user   => 'mcp',
}
```

As for the directory structure: we created `apps`, `apps/mcp`, `apps/mcp/shared` and `apps/mcp/shared/config` so let's do the same using the `file` resource:

```ruby
file {
  '/home/mcp/apps':
    ensure => directory,
    owner  => 'mcp',
    group  => 'mcp';

  '/home/mcp/apps/mcp':
    ensure => directory,
    owner  => 'mcp',
    group  => 'mcp';

  '/home/mcp/apps/mcp/shared':
    ensure => directory,
    owner  => 'mcp',
    group  => 'mcp';

  '/home/mcp/apps/mcp/shared/config':
    ensure => directory,
    owner  => 'mcp',
    group  => 'mcp';
}
```

This makes sure that each path is a directory owned by `mcp`; you can make this more concise by listing multiple paths at once but I've kept each definition discrete here for clarity.

The next step is slightly more interesting: the management of sensitive configuration files. Last time we had someone trusted put the file in place for us; we can recreate that process again:

```ruby
file { '/home/mcp/apps/mcp/shared/config/database.yml':
  ensure => present,
  owner  => 'mcp',
  group  => 'mcp',
  source => 'puppet:///modules/mcp/database.yml',
}
```

The first part is clear enough but the `source` parameter is the interesting one. Without going into too much detail, as well as having manifests written in the Puppet language, you can also include other artefacts such as whole configuration files that will be copied into place. However, this example is no good as it assumes that I have the live `database.yml` to hand.

However, the `source` option is really quite powerful and allows you specify not just one but many paths for a particular file:

```ruby
file { '/some/config.yml':
  source => [
    'puppet:///confidential/config.yml',
    'puppet:///modules/mcp/config.yml'
  ],
}
```

When Puppet attempts to create this file, it will check each path in the `source` list until it finds one it can access. In this way, you can have a `confidential` file server that can only be accessed from the live servers: when you run this manifest there, it will simply fetch that version but when you run it anywhere else, it will fall through the second version.

However, this still isn't quite right as it assumes that you only have two types of servers: live and not. What if you have tiers such as staging or test? What you can actually do is use variable interpolation in the `source` paths like so:

```ruby
file { '/some/config.yml':
  source => [
    "puppet:///confidential/config.yml.$hostname",
    "puppet:///confidential/config.yml.$tier",
    'puppet:///modules/mcp/config.yml'
  ],
}
```

As `$hostname` will be the hostname of your server (e.g. `webserver1`) then you can have a file such as `config.yml.webserver1` and that will be used on that machine; if no such file exists, it will fall through to `config.yml.$tier` and `$tier` can be set as follows:

```ruby
$tier = 'test'
# => "puppet:///confidential/config.yml.test"

$tier = 'staging'
# => "puppet:///confidential/config.yml.staging"

$tier = 'live'
# => "puppet:///confidential/config.yml.live"
```

By simply setting a variable per tier, you can have several different configuration files but the same resource definition. This is the pattern that we are currently using at my job but there are still problems with it. The main being that you have redundant copies of configuration files when really the only thing that needs to be change between environments are usernames and passwords. When you are managing things like Java `.properties` files, it can get tiresome to make sure that any changes are rolled out to all versions of a particular file.

A better approach might be to extract the username and password out into variables...

```ruby
$db_username = 'bob'
$db_password = 'letmein'

file { '/some/database.yml':
  content => template('mcp/database.yml.erb'),
}
```

If you can then keep those variable declarations in a file only on the Puppet Master then you can make use of them in a template. Luckily, as well as the `source` parameter, Puppet supports specifying the exact contents of a file as a string with `content` and, if you use the `template` function, you can actually process an entire [ERB](http://www.ruby-doc.org/stdlib/libdoc/erb/rdoc/) template just like you might be used to in Rails. In this case, our `database.yml.erb` might look like this:

```erb
production:
  adapter: mysql
  username: <%= db_username %>
  password: <%= db_password %>
```

This means that I can be free to change the `adapter` in one place without worrying about the other versions of this file.

There seems to be a lot of different recommendations for how to approach this management of sensitive configuration ([`extlookup`](http://www.devco.net/archives/2009/08/31/complex_data_and_puppet.php), [External Node Classifiers](http://docs.puppetlabs.com/guides/external_nodes.html), etc.) and Chef has a built-in concept called [Encrypted Data Bags](http://wiki.opscode.com/display/chef/Encrypted+Data+Bags) for this purpose but I would be keen to see how other people are doing this so please feel free to comment below. *[NB: It seems the consensus is to use [Hiera](http://projects.puppetlabs.com/projects/hiera) along with an encrypted backend such as [hiera-gpg](https://github.com/crayfishx/hiera-gpg). Hiera is actually being made part of Puppet itself but for now you can use it by installing the [Hiera](http://rubygems.org/gems/hiera) and [Hiera-Puppet](http://rubygems.org/gems/hiera-puppet) gems.]*

Let's install RVM and Ruby. First, we need all the dependencies and we can just use `package` to do so:

```ruby
package { 'rvm-dependencies':
  ensure => installed,
  name   => [
    'curl',
    'git-core',
    'subversion',
    'build-essential',
    ...
  ],
}
```

The way that we installed RVM was very sequential: we ran a list of specific commands in a particular order. When writing manifests for Puppet, it's best not to think in terms of sequence but in terms of state and, most importantly, in a way that is idempotent.

Firstly, we need the RVM installer; as it is just a single script and to save fetching it from the internet, let's include it with our modules and use the `source` parameter we saw earlier to copy it into place with the right permissions and ownership...

```ruby
file { '/root/rvm-installer':
  ensure => present,
  owner  => 'root',
  group  => 'root',
  mode   => '0700',
  source => 'puppet:///modules/mcp/rvm',
}
```

Now we need to run the installer and, for that, we can use the `exec` resource which allows you to run any arbitrary command. This is discouraged when an alternative is available but we have no other choice in this situation...

```ruby
exec { 'install-rvm':
  command => '/root/rvm-installer --version 1.6.32',
  cwd     => '/root',
  unless  => 'grep 1.6.32 /usr/local/rvm/VERSION',
  path    => '/usr/bin:/usr/sbin:/bin:/sbin',
  require => Package['rvm-dependencies'],
}
```

You can see the `command` to run and the directory to run it from in `cwd` but don't forget that I said that Puppet will keep running your resources every 30 minutes and, by default, this would continually re-install RVM. This is what I meant when I said that resources must be idempotent: you must be able to run them multiple times without side effect. In order to stop this from happening, we can use the `unless` parameter to define a command that, should it return successfully, means that this resource doesn't need to be executed. The command that we are using is `grep` and we are checking to see that our particular version of RVM is installed; in this way, when RVM isn't installed at all, the command will fail and therefore the installer will run and if the version is out of date, it will also run, thereby seamlessly upgrading your installation. Also note the `require` dependency which ensures that RVM is not installed before its dependencies are satisfied.

Now we can do `rvm install ruby` in much the same way:

```ruby
exec { 'rvm install ruby-1.9.2-p290':
  creates => '/usr/local/rvm/rubies/ruby-1.9.2-p290',
  timeout => 1800,
  path    => '/usr/local/rvm/bin:/usr/bin:/usr/sbin:/bin:/sbin',
  require => File['install-rvm'],
}
```

Instead of using `unless` which runs any arbitrary command and checks its exit code, we can use `creates` which checks for the presence of a file. This resource will therefore only be installed if `/usr/local/rvm/rubies/ruby-1.9.2-p290` doesn't already exist. As compiling Ruby can take some time, we also bump up the default `timeout` so Puppet doesn't assume something has gone wrong.

Next is the installation of nginx and Passenger for which we will also use the `exec` resource.

```ruby
exec { 'install-passenger-3.0.8':
  command => 'rvm-shell ruby-1.9.2-p290 -c "gem install passenger -v3.0.8"',
  unless  => 'rvm-shell ruby-1.9.2-p290 -c "gem list passenger -v3.0.8 -i"',
  path    => '/usr/local/rvm/bin:/usr/bin:/usr/sbin:/bin:/sbin',
  timeout => 1800,
  require => Exec['rvm install ruby-1.9.2-p290'],
}
```

We need to always think about the two commands: one to run and one to check whether it has already been run. Here we are simply installing a gem but not if it is already installed (`gem list -i` just being something built into RubyGems).

Nginx is much the same:

```ruby
exec { 'install-nginx':
  command => 'rvm-shell ruby-1.9.2-p290 -c "passenger-install-nginx-module..."',
  creates => '...agents/nginx/PassengerHelperAgent',
  timeout => 1800,
  path    => '/usr/local/rvm/bin:/usr/bin:/usr/sbin:/bin:/sbin',
  require => Exec['install-passenger-3.0.8'],
}
```

From our experience, we know that when Passenger and nginx compile successfully, it results in `PassengerHelperAgent` being present in a certain directory so we can use this to detect whether nginx has been installed or not. I've truncated some of the paths to fit on the slides but the top command simply has flags to perform a headless install of Passenger and looks like so:

```console
$ rvm-shell ruby-1.9.2-p290 -c \
>  "passenger-install-nginx-module --auto \
>  --auto-download \
>  --prefix=/opt/nginx"
```

This is well-documented on the Passenger web site and just means that it will not prompt for user input when installing.

Finally, our nginx configuration uses the `file` resource:

```ruby
file {
  '/opt/nginx/conf/sites_available/mcp.conf':
    ensure => present,
    owner  => 'root',
    group  => 'root',
    source => 'puppet:///modules/mcp/mcp.conf';

  '/opt/nginx/conf/sites_enabled/mcp.conf':
    ensure => link,
    owner  => 'root',
    group  => 'root',
    target => '/opt/nginx/conf/sites_available/mcp.conf',
}
```

This just demonstrates that you can also manage symbolic links with Puppet as well and we could easily disable the site by changing `link` to `absent`.

Then we've got our `init.d` script which we just copy:

```ruby
file { '/etc/init.d/nginx':
  ensure => present,
  owner  => 'root',
  group  => 'root',
  mode   => '0755',
  source => 'puppet:///modules/mcp/nginx',
  require => Exec['install-nginx'];
}
```

Finally, we used `update-rc.d` to register our service previously but we can now use the `service` resource type to do that for us:

```ruby
service { 'nginx':
  ensure     => running,
  enable     => true,
  hasrestart => true,
  hasstatus  => true,
  subscribe  => File['/opt/nginx/conf/nginx.conf'],
  require => [
    File['/opt/nginx/conf/nginx.conf'],
    File['/etc/init.d/nginx']
  ],
}
```

This is quite powerful as it describes the functionality of the service (whether it supports restarting natively, whether it can report its own status, etc.) and also sets up a special type of dependency in the `subscribe` parameter. By subscribing to the nginx configuration file, this service will automatically reload when any change to the configuration is made. This means that the web server can be tweaked and dependent services seamlessly reloaded without any need to run `init.d` scripts. You can also see a `require` dependency with more than one resource showing that you can have multiple dependencies at once.

Now that is complete, you might be thinking that it is a lot of work and maybe you only have one server, so what's the point? I would simply ask if there was no part of that you have ever done twice; have you never had to create users or use the same directory structure more than once? If you have any sort of "best practices" for your server setup, would they not benefit from being documented in some way? What if that documentation took the form of a Puppet manifest or a Chef cookbook? If you have that then you have your one canonical source of information about your infrastructure, you can correct any mistakes in one place and watch it roll out across all your nodes and you can subject your infrastructure to normal code workflows: versioning, code review, etc. *[NB: versioning is something I neglected to mention during my presentation but it is important to mention now.]*

## Testing

Puppet is obviously very powerful and, as with anything that runs as `root`, the possibility for damage is great. Therefore, it is important to be able to test your Puppet manifests before they are applied to live servers.

Puppet ships with a `--noop` flag you can use with `puppet apply` that will effectively do a dry-run of your changes. If you are using the `file` resource, for example, it will show you a diff of the changes it would have made without actually modifying the original files. While this can be useful as a sanity check, it falls down when doing anything slightly more involved as it is not really possible for Puppet to predict what state your system will be in after installing new software or running an arbitrary `exec` resource.

A much more thorough way to test your configuration is to make use of [Vagrant][]. If you're not familiar with it, Vagrant is a RubyGem for managing virtual machines using [Oracle's VirtualBox](http://www.virtualbox.org/). Using this, you can effectively have one of your live servers set up as a virtual machine running on your development machine and then run your manifests against it. In this way you can see what effect your changes would have on a running system.

To make use of Puppet, you modify a file named `Vagrantfile` to point it at your modules and manifests:

```ruby
config.vm.provision :puppet do |puppet|
  puppet.module_path    = "modules"
  puppet.manifests_path = "manifests"
  puppet.manifest_file  = "mcp.pp"
end
```

Then it is simply a case of bringing up your virtual machine:

```console
$ bundle exec vagrant up
[default] Box natty was not found. Fetching box...
[default] Downloading with Vagrant::Downloaders::HTTP...
[default] Downloading box: http://mudge.name/downloads...
[default] Extracting box...
[default] Verifying box...
[default] Cleaning up downloaded box...
[default] Importing base box 'natty'...
[default] Matching MAC address for NAT networking...
[default] Clearing any previously set forwarded ports...
[default] Forwarding ports...
[default] -- ssh: 22 => 2222 (adapter 1)
[default] Creating shared folders metadata...
[default] Running any VM customizations...
[default] Booting VM...
[default] Waiting for VM to boot. This can take a few minutes.
```

The first time you run it, Vagrant will inspect your `Vagrantfile` to download a base box (a blank slate virtual machine, e.g. a freshly installed Ubuntu server) and then provision it with Puppet. Then you can tweak your manifests and run the following command to do another Puppet run:

```console
$ bundle exec vagrant provision
[default] Running provisioner: Vagrant::Provisioners::Puppet...
[default] Running Puppet with mcp.pp...
```

All of the examples in this presentation are actually available as a sample project with a `Gemfile`, `Vagrantfile` and all the modules and manifests required. Simply get it from [GitHub](https://github.com/mudge/managing_web_application_servers_with_puppet/tree/master/example), run `bundle` and then `bundle exec vagrant up` to download a base box I'm hosting on Dropbox and prepare a virtual machine for our `mcp` application including the user, SSH key (though it's just a fake key so you won't be able to log in with it), RVM, Ruby, nginx and Passenger as a demonstration of Puppet's power.

While that is extremely useful, it is just another method of visual inspection; what might be better is to actual test-drive your Puppet manifests with a tool like [Cucumber-Puppet](https://github.com/nistude/cucumber-puppet). That allows you to write Cucumber features for your infrastructure:

```gherkin
Feature: General catalog policy
  In order to ensure a host's catalog
  As a manifest developer
  I want all catalogs to obey some general rules

  Scenario Outline: Compile and verify catalog
    Given a node specified by "features/yaml/eg.yml"
    When I compile its catalog
    Then compilation should succeed
    And all resource dependencies should resolve

    Examples:
      | hostname  |
      | localhost |
```

This is just a sample feature from their web site and I admit that I haven't used this yet but it is definitely something I want to look into more closely. There are some exciting tools emerging for Chef regarding testing with minitest and my hope is that Puppet will also benefit from the enthusiasm in this area. *[NB: shortly after my talk, there was [an extensive post on testing Puppet on the Puppet Labs blog](http://puppetlabs.com/blog/testing-modules-in-the-puppet-forge/).]*

## Wrap-Up

You might be thinking that, as a developer, it is not really your job to worry about the maintenance of web servers but I would argue that being a developer doesn't stop once the specs pass on your machine: your job is to deliver your software all the way to the customer and therefore successfully onto live servers. There is this gathering movement of "devops" trying to bridge the gap between operations and development and I think it is an obvious idea to collaborate more: no one ever really benefited from operating entirely in a silo. It's a movement that has been picking up speed within our organisation and has definitely improved things from the dark days of throwing code and instructions over the wall and waiting for a ticket to come back with a minor misunderstanding or a simple missed step.

If you want to know more, Puppet Labs recently revamped all of their documentation so it is well worth reading ["Learning Puppet"][Learning Puppet].

You can follow me on Twitter, [@mudge](http://twitter.com/mudge): it's mostly pictures of coffee and cakes but occasionally some technical stuff.

[github.com/mudge](http://github.com/mudge) is where you'll find the source code to this presentation, it's called [`managing_web_application_servers_with_puppet`](http://github.com/mudge/managing_web_application_servers_with_puppet) and it's just a ShowOff presentation with the [`example` directory](https://github.com/mudge/managing_web_application_servers_with_puppet/tree/master/example) I mentioned earlier.

Thanks for listening.

  [LRUG August]: http://lrug.org/meetings/2011/07/18/august-2011-meeting/
  [Video]: http://skillsmatter.com/podcast/home/lrug-puppet/
  [NPG]: http://www.nature.com/
  [Nature]: http://www.nature.com/nature/
  [Linode]: http://www.linode.com/
  [Slicehost]: http://www.slicehost.com/
  [Heroku]: http://www.heroku.com/
  [Puppet]: http://www.puppetlabs.com/
  [Chef]: http://www.opscode.com/chef/
  [Capistrano]: https://github.com/capistrano/capistrano/wiki/
  [Rails]: http://www.rubyonrails.org/
  [Sinatra]: http://www.sinatrarb.com/
  [mcp]: http://en.wikipedia.org/wiki/Master_Control_Program_(Tron)
  [Vagrant]: http://vagrantup.com/
  [Learning Puppet]: http://docs.puppetlabs.com/learning/
  [Nature Wikipedia]: http://en.wikipedia.org/wiki/Nature_(journal)
  [RVM]: http://rvm.beginrescueend.com/
  [rbenv controversy]: http://www.rubyinside.com/rbenv-a-simple-new-ruby-version-management-tool-5302.html
  [nginx]: http://nginx.org/
  [Passenger]: http://www.modrails.com/
  [chef-vagrant]: http://skillsmatter.com/podcast/home/chef-vagrant
