---
layout: post
title: Managing Web Application Servers with Puppet
summary: A transcript of my August 2011 LRUG presentation regarding configuration management and Puppet.
---
*At the [August 2011 meeting of the London Ruby User Group][LRUG August], I delivered a presentation titled "Managing Web Application Servers with Puppet". You can watch a video of [the whole presentation and the Q & A session on the Skills Matter web site][Video] but for those of you who prefer to read, here is an unedited transcript:*

<p class="centre"><a href=//skillsmatter.com/podcast/home/lrug-puppet/><img src=/i/screengrab.png alt=></a></p>

My name's Paul Mucur and I'm going to be talking about managing web application servers with [Puppet][].

So, first of all, who am I? I've been a Ruby developer since, well, late 2006 basically and I currently work for the [Nature Publishing Group][NPG] and, if you don't know, they basically publish [Nature][] which is a scientific journal; it's been going around 140 years but I don't really work on the journal side; I work for their Web Applications team building basically mainly [Rails][] apps, a couple [Sinatra][] bits and pieces; on sort of stuff for the scientific community and it's quite a large organisation so in our structure, you know, we're the Rails dev team but then the actual sysadmins are not only not in the office but they're actually in a totally different time zone and I want to talk a bit about how we try to mitigate problems with regards to, like, having that huge separation.

So who is this talk for? Really, it's people not unlike myself (unsurprisingly): so developers. Maybe you've already deployed an application to live; maybe you have a personal project that you've put to a [Linode][] or a [Slicehost][], something like that. Basically you're still having to deploy to servers, you're not lucky enough to be on [Heroku][], for example. And maybe you've heard of Puppet, maybe you've heard of [Chef][], maybe you've had a little play around and you want to know a bit more about it and you're open to the idea that I might convince you that there is a better way to set up servers than just running a load of commands as `root`.

So what I'm going to be talking about is I'm going to take a Rails application -- just because it touches on quite a lot of things that is quite useful syadmin-wise and hopefully you're all familiar with the, you know, the standard set up - and I'm just going to take that; we're going to run through how we would set that up normally, going to talk about maybe some problems with doing it like that and then offer an alternative and look at configuration management and specifically Puppet as a better way of doing things.

What I'm *not* going to talk about is the nitty-gritty of how to set up Puppet, so you can kind of install it from a package manager but we're just going to take it as read that you've got Puppet, you can use it and that's kind of what we're going to do. Also I'm not talking about using Puppet as a replacement for your normal deployment workflow: so we're still going to be using [Capistrano][]. This is for infrastructure, basically.

So, let's introduce our Rails application. So, because I'm a geek and because it will fit on slides, it's just going to be called "[mcp][]" and it's just your normal, bog standard Rails application. So we'll have a little look at it...

{% highlight console %}
$ ls mcp
Capfile      config       log
Gemfile      config.ru    public
Gemfile.lock db           script
README       doc          spec
Rakefile     features     tmp
app          lib          vendor
{% endhighlight %}

And, yep, just standard: it's got loads of specs, it's been set up with Capistrano but it hasn't been deployed yet and it's now ready to go to its first server.

So we'll run our specs...

{% highlight console %}
$ bundle exec rspec spec
................

Finished in 0.00816 seconds
Many, many examples, 0 failures
{% endhighlight %}

And everything is fantastic: everything works. So let's get a server prepared like it might be staging or live but this is the first time that it's basically leaving your dev machine.

So first up, let's make some assumptions: let's say you've already got a server, you don't have to worry about buying it and let's say you've got an SSH account, you can log in and you can run commands as `root` because you're setting it up.

So we're going to log into the server...

{% highlight console %}
$ ssh mudge@server1
Last login: Mon Aug  1 21:08:06 2011 from 123-45-67-89.
{% endhighlight %}

And everything is fine. That's great.

So first up, we've got a couple of patterns that we like to use so we want to kind of separate applications by user so this is an application called "mcp" so we'll use an "mcp" user and we like to like keep the application in its home directory so we'll have an apps folder and we're going to manage some config and stuff like that.

So first up, I can't quite remember on this machine how- what flags we have to pass to `adduser` so I'll have a little look.

{% highlight console %}
$ /usr/sbin/adduser -h
adduser [--home DIR] [--shell SHELL]
[--no-create-home] [--uid ID] [--firstuid ID]
[--lastuid ID] [--gecos GECOS]
[--ingroup GROUP | --gid ID]
[--disabled-password] [--disabled-login]
[--encrypt-home] USER
   Add a normal user
{% endhighlight %}

Looks like on this one we don't need to- sometimes you have to pass `-m` to create a home directory; this one it looks like it's going to do that for us by default so we can just go ahead now and I'm going to drop into a root prompt just to make it easy on the slides and we're going to add this user.

{% highlight console %}
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
{% endhighlight %}

And all is great. It's going to bring across a group as well for us, we can fill out a little bit of information and everything is fine and dandy.

Next up, we're going to have to deal with SSH keys: so we're going to be deploying with Capistrano and we don't really want to be passing around passwords so we're going to use a public key. If you're not familiar with this, basically what you can do is: you have a `.ssh` directory in a home directory and you have an `authorized_keys` file which is just a list of keys that are allowed to access that account. But there are a few kind of gotchas: we've got to make sure permissions are just right so we're going to make this directory but we've got to make sure it's made with a certain mode so only the user- so that a specific user can access it...

{% highlight console %}
# mkdir -m 700 ~mcp/.ssh
{% endhighlight %}

And then we're going to add our key to the `authorized_keys` file and, because I'm running as `root` as well, we've just got to make sure that we `chown` it to the right user.

{% highlight console %}
# vi ~mcp/.ssh/authorized_keys
# chmod 600 ~mcp/.ssh/authorized_keys
# chown -R mcp: ~mcp/.ssh
{% endhighlight %}

So, pretty standard stuff here: we're just going to say only that user can read those files. So that's fine, now, now the SSH keys are set up.

Next: directories. So we want to have a certain structure and if you're not familiar with how Capistrano creates sort of directories, you kind of have a `releases` directory with timestamped versions of your project, you have a `shared` directory which kind of persists across deploys and you actually have a `current` symlink to the latest version. And that `shared` directory is ideal for putting things like `database.yml`s in; your sort of config that will persist and can be copied in by your Capistrano tasks.

So let's just create that directory, we want to have- because we've only got one app, we call it "mcp", we're going to put it in the home directory and it's just going to be `shared/config`.

{% highlight console %}
# mkdir -p ~mcp/apps/mcp/shared/config
{% endhighlight %}

That's fine. And then we're just going to make sure it's owned by the right user because obviously we're doing everything as `root`.

{% highlight console %}
# chown -R mcp: ~mcp/apps
{% endhighlight %}

Now, now comes a bit of a tricky bit. So, I'm a developer in a large organisation so ideally I'm not allowed to see live usernames and passwords for things like the database so I don't have the keys to do that. So let's say someone else has that information; all I can do is maybe give them a `database.yml` with "FILL IN THE BLANKS HERE" and they can actually then go in and put that file in place. So they're going to just SSH in and they're going to put the file there and then I can use that in my deploy.

{% highlight console %}
# cd ~mcp/apps/mcp/shared/config
# vi database.yml
{% endhighlight %}

Again, make sure that the user and everything is right.

{% highlight console %}
# chown mcp: database.yml
{% endhighlight %}

So next up, we want Ruby on our machine because I'm a Ruby dev and we want to use it. So I'm going to use RVM to do it. And this kind of- a point of contention but let's just say we want to use that and that's fine.

So what we need to do is first of all there's some dependencies we need before we can think about installing RVM. So I'm on a Debian box so I need to use `apt-get` on this one; I'm going to install curl and git and Subversion so we can get it. That'll run and that's fine.

{% highlight console %}
# apt-get install curl git-core subversion
Reading package lists... Done
Building dependency tree
Reading state information... Done
{% endhighlight %}

And then next up, we want to install RVM. Now you can do a one-liner to install RVM but because we're on a production machine, we want to be a bit pickier; all we're going to do is download the RVM installer which you can just get from the website and that's just a single Bash script.

{% highlight console %}
# cd /root
# curl -s \
> https://rvm.beginrescueend.com/install/rvm \
> -o rvm-installer
{% endhighlight %}

We're going to make that executable...

{% highlight console %}
# chmod +x rvm-installer
{% endhighlight %}

And then we're going to install a known good version of RVM. So we're just going to say, yeah, version 1.6.32 which is the latest one when I was writing these slides and that will install to `/usr/local` because I'm running as root...

{% highlight console %}
# ./rvm-installer --version 1.6.32
Installation of RVM to /usr/local/rvm is
complete.
{% endhighlight %}

And so now we have an RVM to play with.

Next up, we need to get a load of dependencies if we want to install Rubies and compile Rubies. So we just get these from RVM and now we can just basically use `apt-get` to install all those dependencies.

{% highlight console %}
# apt-get install build-essential bison \
> openssl libreadline6 libreadline6-dev \
> zlib1g zlib1g-dev libssl-dev libyaml-dev \
> libsqlite3-0 libsqlite3-dev sqlite3 \
> libxml2-dev libxslt-dev autoconf \
> libc6-dev ncurses-dev libcurl4-openssl-dev
Reading package lists... Done
Building dependency tree
Reading state information... Done
{% endhighlight %}

So that's all fine.

And now once we've got all those, we can finally install our Ruby and we're lucky enough to be using the latest version of 1.9.2 so we'll do that and that's going to download Ruby, any dependencies it needs, compile it and then we'll have that to play with.

{% highlight console %}
# rvm install 1.9.2-p290
Installing Ruby from source to:
/usr/local/rvm/rubies/ruby-1.9.2-p290, this
may take a while depending on your cpu(s)...
Install of ruby-1.9.2-p290 - #complete 
{% endhighlight %}

So, final piece of the puzzle: we like to use nginx and Passenger for serving our applications, pretty straightforward stuff so what we want to do here is we're going to `source` RVM because we need to use that for switching environments, choosing the Ruby we want.

{% highlight console %}
# source /usr/local/rvm/scripts/rvm
{% endhighlight %}

We're going to use Ruby 1.9.2...

{% highlight console %}
# rvm use 1.9.2-p290
Using /usr/local/rvm/gems/ruby-1.9.2-p290
{% endhighlight %}

And then we're going to install Passenger and we're just going to install a specific version that we want to use and then that's going to get the gems for us, compile any extensions we need...

{% highlight console %}
# gem install passenger -v3.0.8
Fetching: fastthread-1.0.7.gem (100%)
Building native extensions.  This could
take a while...
Fetching: daemon_controller-0.2.6.gem (100%)
Fetching: rack-1.3.2.gem (100%)
...
Successfully installed passenger-3.0.8
{% endhighlight %}

And then we basically use the `passenger-install-nginx-module` command to actually compile an nginx for us.

{% highlight console %}
# passenger-install-nginx-module
Welcome to the Phusion Passenger Nginx
module installer, v3.0.8.
{% endhighlight %}

And you just go through that wizard, I'm sure many of you have seen it and that's fine and now we have nginx installed and all we need to do now is configure it.

So we're going to go into the nginx config and then let's use a pattern that I think I saw it with Debian and Apache where basically what you do is you have a directory called `sites_available` and you put all your config there because traditionally in nginx you might just have one monolithic config; it's quite nice to break those out into separate applications and then what we need to do is tell the nginx config to actually look in this `sites_enabled` directory for configs and what you do is, when you want to enable a site you just link it in.

{% highlight console %}
# cd /opt/nginx/conf
# mkdir sites_available sites_enabled
# vi nginx.conf
{% endhighlight %}

So what we're going to do is go into this `sites_available`, we're actually going to put our config for our application in there and then we're just going to link that up so basically we can keep it nice and tidy, we can have all the available configs in one folder but actually just link in the ones you want on.

{% highlight console %}
# cd sites_available
# vi mcp.conf
# ln -s \
> /opt/nginx/conf/sites_available/mcp.conf \
> /opt/nginx/conf/sites_enabled/mcp.conf
{% endhighlight %}

And then final piece of the puzzle, we need an nginx `init.d` script to actually start it up at boot and to manage it and because we installed it via Passenger so it won't have one. So let's just say we've just got a stock one or we download it from the internet...

{% highlight console %}
# vi /etc/init.d/nginx
{% endhighlight %}

Make that executable...

{% highlight console %}
# chmod +x /etc/init.d/nginx
{% endhighlight %}

We're on Debian so we want to set it up to run at boot so we use `update-rc.d`...

{% highlight console %}
# update-rc.d -f nginx defaults
{% endhighlight %}

And then finally we can start up nginx.

{% highlight console %}
# /etc/init.d/nginx start
Starting nginx: nginx
{% endhighlight %}

Now our server is totally set up and ready to go.

And then it's just a case of going back to our deployment tool of choice (we use Capistrano; we actually Webistrano which is a web front-end to Capistrano) and it's just a case of doing your usual steps. So we do a `deploy:setup` to create the directories you need...

{% highlight console %}
$ cap deploy:setup
{% endhighlight %}

Do a quick `check`, make sure everything is OK...

{% highlight console %}
$ cap deploy:check
{% endhighlight %}

And then you can do your big first `deploy`; hopefully everything works and everything is fantastic.

{% highlight console %}
$ cap deploy:cold
{% endhighlight %}

So, you know, that wasn't too bad if you've done it many times it's kind of second nature to you. I kind of want to say that there are a couple of big problems with doing stuff like this.

The first is that it's not easily repeatable; I mean, fine, I just did that and maybe I've done it loads of times so I know how to do it but what if I want to run that on a second server? Or what if a colleague of mine wants to do the same thing on a different server? Or maybe you've only got one server and something's gone wrong, you want to wipe it back down, how do you do it again? I mean is it a case of you write all this down in a little script? I mean, there isn't really a canonical resource that you can go to and say "oh, this is how we set up a machine; this is how we did it" unless maybe you've got some audit trail when you're logging commands.

The other problem is it's not consistent. What I mean by this is: I just ran a load of commands and when they were done I just knew that they'd been run but, OK, half an hour's passed: how do I know that it's still like that? How do I that someone hasn't logged in, maybe they've accidentally installed a new package, maybe they've uninstalled a gem, maybe some permissions got messed up. I mean I have no real way to be confident that stuff is as I left it unless things start blowing up which is less than ideal.

It's not really portable either because you saw how I was faffing with that `adduser` command: I couldn't remember on this machine whether I needed to do `-m` or not and that's because I had to worry about the specific platform. I used `apt-get`, I used `update-rc.d` which are Debian and Ubuntu things but what if it's a RedHat box? You know, that uses `yum` instead or `up2date` and I could argue why do you have to care about that level of detail?

The other *really* big problem here is I had `sudo` access- I mean I had SSH access to start with and I had `sudo` access to a live machine. That's never really going to happen; hopefully that's a problem that a lot of you have. I definitely can't log into live servers so the way that I would actually do this in real life is maybe I'd have a ticket in JIRA that has a big load of instructions that says "you must run these commands" and maybe a little bit of explanation as to why you should do it.

The biggest thing of all really is: people make mistakes. If I'm doing this, if I'm writing a big script in English, saying "you must run these commands", what if someone just misses a step or misunderstands something, maybe they do it in the wrong order? I mean, you can get into a really sticky situation if you miss one step out, maybe you won't realise until further down the chain that stuff has gone wrong and trying to unpick that is a total nightmare. So really there's just too much room for error here.

So maybe there's a better way. I would argue that there is and it's configuration management.

First of all, what does that mean? It's quite a dry title, the management of configuration. What it's really about is, you might see this quote bandied around quite a lot: which is this idea of "Infrastructure as code". So I've been trying to think of the way to best sort of explain this: you know how some people say Cucumber is executable documentation? This is a similar sort of thing, if you could actually describe your entire- all your assumptions about a system, the permissions, the software you've got installed. If you could describe it not in an ambiguous language like English but actually some formal grammar, say something like Chef or Puppet then what you have there is one canonical resource. You can look at this file and say "I know exactly how this machine is set up". You've quite clearly described at quite a high level how things should be. There's kind of a, there's a thing about making these assumptions like how many times have you gone to a sysadmin and said "oh, can you just check the permissions on this file?" or "can you tell me what's in this config file?". What if you could just lay that all out and have it written down?

So there are two big solutions -- obviously there are many more -- but the two big ones in the Ruby community anyway are Opscodes' Chef and there's Puppet Labs' Puppet. Now I'm going to be talking about Puppet and using examples in Puppet and the only reason I do that is because that's what I use in my day job. It just so happened that when I joined they already had Puppet infrastructure there; I actually started learning Chef first but then discovered that actually we had Puppet running all the servers so that's the only reason I use it. I want to make it clear that it doesn't matter; there was a discussion on the mailing list last week about oh, should I use Chef or Puppet? I say get a feel for the different things that you want but the key sell is you should try configuration management: don't let the nuances of one put you off. I mean this talk is going to be about Puppet but Gareth's going to be talking about Chef so you can kind of get an idea of how the things work but generally just buy in to the idea of configuration management in the first place.

So we're going to start off with a little primer; so if you're never seen Puppet before and kind of describe how you have to think about things. So first up, Puppet kind of revolves around the idea of resources and this is one such resource:

{% highlight ruby %}
user { 'henry':
  ensure     => present,
  uid        => '507',
  gid        => 'staff',
  shell      => '/bin/zsh',
  home       => '/home/henry',
  managehome => true,
}
{% endhighlight %}

This is written in the Puppet language which looks a bit like Ruby but isn't Ruby. There is a Ruby DSL for Puppet but I'm not going to be talking about that, I'm going to be talking about the original Puppet language. So what this is, I'm saying there's a user called Henry, let's make sure he's present, he's got a certain user ID, his primary group is "staff", he likes to use ZSH, home directory in a standard place and we're going to manage his home directory which just means we'll create it if it doesn't already exist. Now notice I'm not saying "oh, you must run `adduser`", I'm saying "there's a user", I'm describing at a higher level, you don't need to worry about the nitty-gritty. You're just, with one change, one word, I could change `present` to `absent` and then Puppet would have to manage removing that user and there's kind of a real power in sort of delegating that responsibility of how to do stuff by describing things at this high level.

So how would you actually use this? Let's take that definition, we'll save it in a file called `henry.pp` then what you can do is run:

{% highlight console %}
$ sudo puppet apply henry.pp
{% endhighlight %}

What Puppet's going to do is look at your system and it's going to say "right, is there a user called Henry? No, so I need to create one."

{% highlight console %}
notice:
/Stage[main]//User[henry]/ensure: created
notice: Finished catalog run in 0.25 seconds
{% endhighlight %}

And it's going to create one. Then what you can do is, we have a little look on the system, have a look in the `passwd` file:

{% highlight console %}
$ grep henry /etc/passwd
henry:x:507:50::/home/henry:/bin/zsh
{% endhighlight %}

And, yep, user "Henry" has been created and he's got the attributes we've been talking about, everything's fine and dandy.

Now where the power comes in is if someone now logs into the system and says "ZSH? This guy should be using Bash!" so he's going to change the shell from ZSH to Bash...

{% highlight console %}
$ sudo chsh henry
Changing shell for henry.
New shell [/bin/zsh]: /bin/bash
Shell changed.
{% endhighlight %}

Then the next time you run Puppet it's actually going to look at the system and say "right, user Henry exists; ah yeah, he does but something's not quite right here, we've said that he should be using ZSH and he's using Bash."

{% highlight console %}
$ sudo puppet apply henry.pp
notice:
/Stage[main]//User[henry]/shell:
shell changed '/bin/bash' to '/bin/zsh'
{% endhighlight %}

So Puppet's clever enough to just make that little fix and this is the consistency thing I was talking about. By describing everything in this state, it allows Puppet to do stuff that's quite powerful; we didn't tell it "oh you must run `chsh` to fix his shell", we just said "look, this is what his shell should be, it's up to you to make sure the system is in the state that I've described."

So Puppet, the documentation- the official documentation refers to "the Trifecta"; the three core resource types that you might use.

So the first is a `package`:

{% highlight ruby %}
package { 'openssh-server':
  ensure => installed,
}
{% endhighlight %}

So this is a thing something like, you know, when I did `apt-get` so you can just say "yeah, make sure that the package `openssh-server` is installed" and it will be different on each operating system that you use.

The next is a `file` type:

{% highlight ruby %}
file { '/etc/sudoers':
  ensure => present,
}
{% endhighlight %}

So this is just saying that make sure the file `sudoers` exists; this one's really quite powerful, we'll see some more with that.

And you've got a `service`:

{% highlight ruby %}
service { 'sshd':
  ensure => running,
}
{% endhighlight %}

So that's something that you might run with an `init.d` script; just say, yeah, make sure `sshd` is running.

So those are kind of the three core ones.

Now, I've kind of been a bit cheeky really, I've said that you use `puppet apply` but in real life you wouldn't. You would actually have a Puppet Master which is a central node and has all the config for all your servers and all your nodes actually talk to the Master every half an hour by default to make sure they're OK. That's where the consistency thing comes in as actually every half hour, it's going to keep re-applying your catalogue but just to simplify things we're going to leave that out.

So let's go back to our Rails application. So, remember `mcp`? Let's try to do it again but instead of doing it all with commands, let's try and do it in Puppet.

So, first up: last time I ran `adduser` and the group kind of came along for free but it's quite good to be more explicit about it. So we're going to say, "right, there's a group `mcp`, make sure that's present and there's a user `mcp`, make sure they're present, primary group is `mcp`, let's manage their home directory." 

{% highlight ruby %}
group { 'mcp':
  ensure => present,
}

user { 'mcp':
  ensure     => present,
  gid        => 'mcp',
  home       => '/home/mcp',
  managehome => true,
}
{% endhighlight %}

Now one thing that's kind of interesting here is notice that the user uses the group from the first one. You might think, "oh well, it's probably, probably executing sequentially" but it's not: Puppet doesn't have any concept of order so I should probably mention something about the order of stuff. So one of the things you could do when you're writing resources is, you use this kind of lowercase notation, you say:

{% highlight ruby %}
group { 'mcp':
  ensure => present,
}
{% endhighlight %}

But then if you use this sort of title case (capital G for Group there):

{% highlight ruby %}
Group['mcp']
{% endhighlight %}

That's kind of a reference to your resource which means that you can refer to resources all over the place. So that means that what we could have done is said:

{% highlight ruby %}
user { 'mcp':
  ensure  => present,
  require => Group['mcp'],
}
{% endhighlight %}

What that's doing is it won't try to create the user, it won't look at that until the group is there. Now the reason we didn't have to do that is because Puppet will autorequire certain things; that's in the documentation but, you know, you could be explicit about it; there's no harm in it.

If you try to do something a bit funky where you say the user depends on the group and the group depends on the user:

{% highlight ruby %}
user { 'mcp':
  ensure => present,
  require => Group['mcp'],
}

group { 'mcp':
  ensure => present,
  require => User['mcp'],
}
{% endhighlight %}

What actually will happen is when you try to do a Puppet run, it's going to blow up:

{% highlight console %}
err: Could not apply complete catalog:
Found dependency cycles in the following
relationships:
User[mcp] => Group[mcp], Group[mcp] => User[mcp];
try using the '--graph' option and open the '.dot'
files in OmniGraffle or GraphViz
{% endhighlight %}

Puppet's going to say, "ah, you've got a cyclical dependency" and that's because Puppet actually builds a directed acyclic graph in the background of all your resources. As you can see here, you can actually pass `--graph` and get a crazy graph basically of all your resources and how they are related. So that's quite powerful, you can immediately sort of sanity check stuff like that.

Right, so SSH keys: you remember we had that `.ssh` folder, we had to make sure the permissions were right, add it to a certain file, well forget that because Puppet has a built-in one for that so no big deal there:

{% highlight ruby %}
ssh_authorized_key { 'mcp-mudge':
  ensure => present,
  key    => 'AAAAB3NzaC1yc2EAAAAB...',
  type   => dsa,
  user   => 'mcp',
}
{% endhighlight %}

We just say, "have a comment `mcp-mudge`, put my key in there, what type it is" and in this way you can kind of selectively add and remove keys and it just manages the file for you.

Directories: so you remember we created `apps`, `apps/mcp`, `apps/mcp/shared` and `apps/mcp/shared/config`? We'll just do those, straightforward, we'll just use the `file` resource:

{% highlight ruby %}
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
{% endhighlight %}

Make sure that `apps` is a directory owned by `mcp` and the group `mcp` and you just keep doing it for each. You can actually make this a bit terser, you can put all the files in one array but I've just kept it kind of explicit here and it's a thing in the style guide, I quite like having one place you can look and it's quite clear what's going on. And there you can change stuff on an individual directory level.

So now something a bit more interesting: so the sensitive config problem now you remember last time we had someone who was trusted who put the `database.yml` in place? We can kind of do that here:

{% highlight ruby %}
file { '...config/database.yml':
  ensure => present,
  owner  => 'mcp',
  group  => 'mcp',
  source => 'puppet:///modules/mcp/database.yml',
}
{% endhighlight %}

I've truncated the filename here so that it fits on but you can describe that `database.yml` and say "right, yeah, the owner `mcp`, group `mcp`" and the `source`: it's something that looks a bit like a URL. I'm not going to go into too much detail about this but what you can do is as well as describe the state of your system in terms of infrastructure, you can also have kind of artefacts and config files in with all your modules and therefore you can put stuff there. But this is no good because I'm not allowed to see the live config so this is no good because that means that I've got it.

But the `source` option is actually really powerful in Puppet. It doesn't just take one path, you can actually give it multiple:

{% highlight ruby %}
file { '/some/config.yml':
  source => [
    'puppet:///confidential/config.yml',
    'puppet:///modules/mcp/config.yml'
  ],
}
{% endhighlight %}

And what it will do is it will just go through until it gets one that it can actually access. So the first one we've got here is `confidential/config.yml` and what you can do is on your Puppet Master you can set up sort of confidential file server mountpoints basically and what we can say is actually only the live servers can access that version. So if you run it on the live server, it's going to go "right, `confidential/config.yml`? No problem, that's the one I'm going to use" and then if you run it on a dev machine or staging, any other tier, it will just say "well, I can't access that file so I'm going to the next one" and you can have a fallback option and that's great. But it's still not quite right because that assumes you've got one live password and then everything else and sometimes you've got to separate even further so we have test, staging and live are different tiers. And what you can do is actually use interpolation, you can use variables in Puppet:

{% highlight ruby %}
file { '/some/config.yml':
  source => [
    "puppet:///confidential/config.yml.$hostname",
    "puppet:///confidential/config.yml.$tier",
    'puppet:///modules/mcp/config.yml'
  ],
}
{% endhighlight %}

What you can say here is `config.yml.$hostname` and `$hostname` will be something like `webserver1` and therefore if someone puts a file in `confidential` directory called `config.yml.webserver1`: that's the one it'll use. If it doesn't find it, it's going to drop down to the `$tier` and the `$tier` will be something like this:

{% highlight ruby %}
$tier = 'test'
# => "puppet:///confidential/config.yml.test"

$tier = 'staging'
# => "puppet:///confidential/config.yml.staging"

$tier = 'live'
# => "puppet:///confidential/config.yml.live"
{% endhighlight %}

You just set a variable, you say `test` so it'll look for `config.yml.test`; `staging`, `config.yml.staging`; `live`, `config.yml.live`. This is the kind of pattern that we're using at the moment but there are kind of problems with this approach and that's the whole fact that I give the whole config file to someone else to manage when really the root of the problem is I'm just not allowed to see the username and password. So if you've got stuff like- we manage Java `.properties` files and you can add loads of properties and therefore the sysadmin guys have to manage adding those to each version of the file that you've got which isn't an ideal situation. So a better approach might be to do something like this:

{% highlight ruby %}
$db_username = 'bob'
$db_password = 'letmein'

file { '/some/database.yml':
  content => template('mcp/database.yml.erb'),
}
{% endhighlight %}

Where you specify a variable, say it's like hidden in a file that we're not allowed to see and therefore you can just use it in a template and Puppet just natively supports this `content` which means you can put any string in here but it's got a `template` function that actually just renders ERB templates just like you might be used to in Rails. So our `database.yml.erb` might just look like this:

{% highlight erb %}
production:
  adapter: mysql
  username: <%= db_username %>
  password: <%= db_password %>
{% endhighlight %}

So, you know, I can change my `adapter` to `mysql2` if I wanted: it's not really, it's not a sensitive thing to do; that's my job as a developer but the database username and password I can just abstract away so that's something that we might be looking into.

I just- brief word though: there seems to be loads of different solutions for this: so there's `extlookup`, external node classifiers and I'd be really keen to talk to people here that are using Puppet and wondering how they're managing this problem. Chef seems to have a thing built-in called encrypted databags that can do this sort of natively, basically storing special sensitive configuration but I'm not sure how- what the best way is in Puppet but I just thought I'd talk about it.

So OK, back to it: installing RVM and Ruby. So this one's a bit more interesting because first of all, yeah, dependencies, that's fine, we're just going to use that `package` resource and say "right, we need all these dependencies before we start working on RVM."

{% highlight ruby %}
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
{% endhighlight %}

But the way that we installed RVM was very sequential: we said "run these commands" and when you're thinking about writing manifests for Puppet they need to be sort of more about state and what they need to be most importantly is idempotent. So I'm going to talk a bit about that. So first of all, we downloaded the RVM installer. To save going to the network, it's just a single Bash script, we're going to chuck it in our modules and we're going to say, "right, let's make sure the RVM installer's there, got the right permissions" and straightforward, nothing too exciting there:

{% highlight ruby %}
file { '/root/rvm-installer':
  ensure => present,
  owner  => 'root',
  group  => 'root',
  mode   => '0700',
  source => 'puppet:///modules/mcp/rvm',
}
{% endhighlight %}

But next up, this is a bit more interesting: so, you've got something called the `exec` resource that allows you to just run any, arbitrary command, now this is discouraged where possible but in this case we have to run an installer, there's nothing we can really do about it.

{% highlight ruby %}
exec { 'install-rvm':
  command => '/root/rvm-installer --version 1.6.32',
  cwd     => '/root',
  unless  => 'grep 1.6.32 /usr/local/rvm/VERSION',
  path    => '/usr/bin:/usr/sbin:/bin:/sbin',
  require => Package['rvm-dependencies'],
}
{% endhighlight %}

So we're going to- you can see the `command` there, `rvm-installer` and the same version but don't forget I said that Puppet will keep running every half hour, you don't want to keep re-installing RVM every half hour so you need to think about that: this is that whole idempotency thing. You need to kind of design your resources so that they can be run multiple times without any bad side effects so what you can do is you see this `unless` option here? And so what Puppet will do, it'll actually check that, it's going to run that command and what this is going to do is look for the version number in this file; if this file doesn't exist, it's going to blow up and it's going to install RVM and what's quite nice is if you want to change- like, upgrade your version of RVM you can just change one of these numbers and therefore that check will no longer be true and it's also going to upgrade your RVM seamlessly. So and you can see a `require` there as well which is the whole graphing thing I talked about. So pretty straightforward.

Now we can do `rvm install ruby` in much the same way:

{% highlight ruby %}
exec { 'rvm install ruby-1.9.2-p290':
  creates => '/usr/local/rvm/rubies/ruby-1.9.2-p290',
  timeout => 1800,
  path    => '/usr/local/rvm/bin:/usr/bin...',
  require => File['install-rvm'],
}
{% endhighlight %}

Instead of using `unless` which was "run any arbitrary command and make sure if its returned 0 or not", we can use `creates`, which just looks for a file. So what's going on here is we're saying when Ruby is installed it actually creates that directory, so if that directory exists you don't need to do anything. And there's just a couple of things here like it's going to take a while to compile Ruby so we just bump up the `timeout` and things like that.

Now nginx and Passenger which was the last piece so this is very similar stuff: we're going to be using the `exec` resource here as well. So installing Passenger:

{% highlight ruby %}
exec { 'install-passenger-3.0.8':
  command => 'rvm-shell ... -c "gem install pas..."',
  unless  => 'rvm-shell ... -c "gem list passen..."',
  path    => '/usr/local/rvm/bin:/usr/bin:...',
  timeout => 1800,
  require => Exec['rvm install ruby-1.9.2-p290'],
}
{% endhighlight %}

Basically we just need to think about the pairing, we need to say "here's a command to run but not if this other command comes back true" so obviously too big for the slide so on the next slide I'll expand those two commands:

{% highlight console %}
$ rvm-shell ruby-1.9.2-p290 -c \
> "gem install passenger -v3.0.8"

$ rvm-shell ruby-1.9.2-p290 -c \
> "gem list passenger -v3.0.8 -i"
{% endhighlight %}

That's all we're doing; we just, through `rvm-shell`, we're saying we're going to install Passenger 3.0.8 unless that command comes back true and that's just a thing built into RubyGems to check if a version is installed or not; it'll return 0 if everything's OK and some other exit code if it doesn't.

Nginx, very similar:

{% highlight ruby %}
exec { 'install-nginx':
  command => 'rvm-shell ... -c "passenger-..."',
  creates => '...agents/nginx/PassengerHelperAgent',
  timeout => 1800,
  path    => '/usr/local/rvm/bin:/usr/bin:...',
  require => Exec['install-passenger-3.0.8'],
}
{% endhighlight %}

From our experience, we know that when nginx compiles- sorry, the whole Passenger-nginx thing compiles successfully, you get this `PassengerHelperAgent`. Sometimes, if stuff goes wrong, you'll still have nginx there so you- that's why we're quite specific about that and the top command is just:

{% highlight console %}
$ rvm-shell ruby-1.9.2-p290 -c \
>  "passenger-install-nginx-module --auto \
>  --auto-download \
>  --prefix=/opt/nginx"
{% endhighlight %}

You can look this up in the Passenger docs basically for doing a headless install; that'll just- so it won't prompt you for any input.

Final little bit here:

{% highlight ruby %}
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
    target => '/opt/nginx/c...vailable/mcp.conf',
}
{% endhighlight %}

We've got our configuration, so we going to use `mcp.conf`, pull that from our `source` and then just to show that you can do symlinks as well. It does everything and if you wanted to disable a web site, you could just flip that from `link` to `absent` and that'd be a way of kind of documenting that you disabled a web site.

And then we've got our `init.d` script which we just copy:

{% highlight ruby %}
file { '/etc/init.d/nginx':
  ensure => present,
  owner  => 'root',
  group  => 'root',
  mode   => '0755',
  source => 'puppet:///modules/mcp/nginx',
  require => Exec['install-nginx'];
}
{% endhighlight %}

Nothing too fancy here. And then that whole `update-rc.d` thing, obviously that was only for Ubuntu or Debian; we just do it with this:

{% highlight ruby %}
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
{% endhighlight %}

So this is quite powerful, what this is saying is you can describe the kind of things that your service can do and this `subscribe` line is quite interesting: so what that will do is look at your `nginx.conf` and if there's any changes it will automatically refresh your nginx, do a reload basically. So in that way you can kind of make changes and seamlessly have them go out live, you can also see a multiple `require` so this kind of stuff is possible as well, you can basically say "well, only do this once both those things are true or in place."

So that's pretty great, that's the same thing that you had before but you might be saying "ah, that's a lot of work, I've only got one server" but are you saying that you've never done that twice? You've never created a user, you've never- maybe you've got a little pattern that you use. Basically, by writing it down once, you've got basically repeatable, you've got that consistency, you've got that one canonical resource where you can check this stuff works, you can make sure that "oh yeah, I forgot that needs to have a certain permission", just put it in one place and let that run over all your nodes. There's just so much benefit basically from writing this down once but you can also do some real damage: it runs as `root` obviously so you can obviously do a lot of damage if you have `root` in general so you need to make sure that this stuff works. So: testing is a big thing.

So one of the things you can do is, Puppet has a built-in thing, you can just pass `--noop` when you do an `apply` and that's basically going to do a dry run. It's going to a sort of fake, a pretend run. This is kind of good if you want to make changes to config files, what this will do is give you a `diff` of the changes it would've made but it's still quite limited because there isn't really a good way for it to predict what's going to happen if you've installed a gem or a package. If you're doing anything with `exec` there's no real way for Puppet to, you know, pretend to have done it. So it's quite limited but it's a nice thing to have in your toolbox basically.

What's more interesting is Vagrant and using Vagrant. So -- great logo -- Gareth's going to talk a bit more about this so I won't talk- dwell on it too much. If you're not familiar with Vagrant, it's a RubyGem for managing virtual machines with Oracle's VirtualBox and what you can basically do is have a fake live node on your machine so let's say you run, you know, RedHat in production; you could have like a little VM of a server and then you can use Puppet to provision it locally. You can test stuff out on there, see if stuff blows up; I mean, it's really great, really quite powerful.

You have a thing called a `Vagrantfile` and you just have- it has built-in support for provisioning with Puppet and with Chef and you can just have stuff set up like this:

{% highlight ruby %}
config.vm.provision :puppet do |puppet|
  puppet.module_path    = "modules"
  puppet.manifests_path = "manifests"
  puppet.manifest_file  = "mcp.pp"
end
{% endhighlight %}

And then it's just a case of going in, doing:

{% highlight console %}
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
{% endhighlight %}

That's going to look at the `Vagrantfile`, you have a base box which is basically your base VM; so something like a clean Ubuntu server or something like that. It's going to set everything up for you and then it's going to provision it with Puppet and if you want to toy around, make a change then you can make a change to your manifest and then just run a simple:

{% highlight console %}
$ bundle exec vagrant provision
[default] Running provisioner: Vagrant::Provisioners::Puppet...
[default] Running Puppet with mcp.pp...
{% endhighlight %}

And it's going to re-run. Now, all the stuff I've been talking about in this presentation is- I've actually created a kind of sample project which has a `Vagrantfile` in it and it has all the manifests we've gone through including some more stuff and it's on GitHub under the source code of this presentation just in an `example` directory. So you should be able to just go in there, basically install Vagrant, there's a `Gemfile` as well so do `bundle` and do a `vagrant up` and it should download a base box that I've created just hosted on Dropbox and then it will just provision it. It should do exactly what we just did: it should create a user called `mcp`, it should put all the stuff in place, create the SSH keys, you know, RVM, Ruby, nginx, Passenger, all that stuff should be set up with one command and that's basically how powerful it can be.

Now that's all well and good but that does smell a bit like just visual inspection which it is. So a better approach would be maybe to use something like Cucumber-Puppet which basically allows you to write Cucumber features to test your infrastructure:

{% highlight gherkin %}
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
{% endhighlight %}

This is just from their sample web site. I must admit I haven't really used this much, it's something I definitely want to use a bit more. I know that there's some really exciting stuff happening with Chef actually with minitest and stuff like that so I'm hoping that Puppet's going to come along as well.

Kind of the final word I want to say about this is you might think "it's not really my job, I don't set up servers" but I would sort of argue that as a developer your job doesn't end at "the specs pass on my machine": you need to get it all the way to the customer, to production, to the world wide web if that's where you're delivering to and this whole- I know the term might be contentious, the idea of "devops"; the idea that no one really benefits from being really siloed: "they're your servers, deal with it". Like "make the config work, I mean I don't know about the permissions you've got there." I mean, if you could actually state your assumptions up front in an unambiguous, formal way then everyone sort of benefits and you can collaborate and it's something that is really picking up speed within our organisation and it's been great and it's made it so much easier to deal with people that are, yeah like, five hours away so it's been really good.

So, for further resources: basically Puppet Labs recently revamped all of their documentation and they've got this ["Learning Puppet"][Learning Puppet] and they actually have a VMware image you can play with which is quite cool. [Vagrant][] as well, I know Gareth's going to talk a bit more about that, definitely check that out, it's fantastic.

You can follow me on Twitter, @mudge: it's mostly pictures of coffee and cakes but occasionally some technical stuff.

[github.com/mudge](http://github.com/mudge) is where you'll find the source code to this presentation, it's just called [`managing_web_application_servers_with_puppet`](http://github.com/mudge/managing_web_application_servers_with_puppet) so it's just a ShowOff presentation and in there you've got that [`example` directory](https://github.com/mudge/managing_web_application_servers_with_puppet/tree/master/example) which has the stuff that I was talking about.

I do have a personal site that has two articles on it, there might be a third after this, we'll see.

And that's it!

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
