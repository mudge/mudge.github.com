---
layout: post
title: A Summit for Scaling
excerpt: >
  A summary of my time at 2014&rsquo;s Scale Summit: a performance and
  scalability unconference.
---
<img src="/i/scalesummit.jpg" width="200" height="200" alt="" class="pull-left">Yesterday, I attended [Scale Summit][]: "a performance and scalability
unconference" using the [Open Space Technology][] format. Scale Summit is the
successor to [Scale Camp][], an event organised by [Mich&aelig;l
Brunton-Spall][Michael Brunton-Spall] and previously held at [The Guardian][]
offices. Having attended Scale Camp in late 2012 and considering it to be one
of the most rewarding experiences of my career, it was without hesitation that
I signed up for its follow-up.

The quality of Scale Camp and Scale Summit is almost entirely dependent on
the attendees: the unconference format and [Chatham House Rule][] mean that
people are free to run open discussions and [Fishbowls][Fishbowl] and speak a
little more freely than they might elsewhere. For example, my highlight of
2012's Scale Camp was discussing [continuous delivery] with people I would
consider experts and even *pioneers* of that practice.

As Scale Summit is multi-track, I could not participate in all sessions but
thankfully other attendees such as [Philip Potter][], [Matthew
Cottingham][] and [Zac Stevens][] have also written up their notes.

## Real-Time Monitoring

My first session of the day was an open discussion on real-time monitoring and
the collection (and retention) of large amounts of metrics.

There was a general consensus that everyone is using [Graphite][] though
[Grafana][] piqued interest as an alternative dashboard and [Carbonate][]
suggested for rebalancing clusters.

There seemed to be a lot of people using [Sensu][] for monitoring (as well as
the usual crowd of [Zenoss][], [Ganglia][] and [Nagios][] users) though some
(including myself) have been experimenting with [Riemann][], particularly for
its ability to alert on event expiry. We currently use this at my day job to
detect when an integration with an external service has started misbehaving as
we can reasonably expect new data in a certain time period (e.g. a tweet every
10
minutes). Upon discussing this, it occurred to me that I could use this expiry
technique a lot more than I currently do as a very simple way of flagging
anomalies.

While discussing the resolution of metrics (e.g. every second, every 5
seconds, etc.), an interesting question was asked:

> When investigating an outage, has anyone ever had *too much* data?

It seems that collecting the right data is still difficult to predict so the
sensible approach seems to be [measuring everything][Measure Anything]. The
cost of doing so (particularly those wanting high resolution or retention of
data) can be high with one individual's monitoring server having "more cores
than my entire [server] farm".

Aside from [collectd][], there was some discussion around using [Diamond][] to
collect metrics largely due to it being written in [Python][] for companies
already using the programming language for their applications.

## Microservices in the Real World

During the day's introductions, quite a few people mentioned [Microservices][]
which I had heard little about so I decided to take part in an extremely
fast-paced Fishbowl discussion on the topic.

There was some disagreement on the exact definition of a microservice and some
took issue with Martin Fowler's insistence on HTTP as a transport or purely
using lines of code as a defining factor. The loose definition seemed to be
modelling applications as a collection of simple services responsible
for a single piece of functionality (e.g. translating place names). In this
regard, it seems remarkably similar to [service-oriented architecture][SOA]
(SOA) but with an emphasis on smaller services.

Many benefits were cited in terms of reducing complexity, affording diversity
of technologies and the ability for teams of one or two people to hold entire
services in their head (something that becomes unfeasible over time for
monolithic systems).

The importance of consistent practice was said to be paramount: consistent
documentation, clear ownership and predictable interfaces were all discussed.
One intriguing practice mentioned was that of having a standardised endpoint
that revealed the owner and current health of a system (with some parallels
being drawn to a [humans.txt][]). Even if ownership and responsibility for a
service is unclear, the size and simplicity of such systems might make them
easier to maintain.

While the benefits seemed appealing, I was more than a little concerned about
the effects this would have on teams and technology organisations as a whole.
One problem I have seen repeatedly across companies is that of information
siloes: where team members become segregated and shared knowledge of systems
is largely absent. I fear this model of many small services would encourage
siloes but the difficult question is whether this is a bad thing: perhaps it
is better for small teams to move fast at the cost of shared understanding? If
the benefits are to believed then services might be small and simple enough to
alleviate the dreaded [Bus factor][].

As an extreme example of this culture, the practice of allowing *competing*
services was touched upon: where teams can freely develop another version of a
service without collaboration and let client applications decide which they
prefer. The implications this environment would have on teams (where people
could simply supplant your work and openly duplicate effort)
makes me more than a little apprehensive.

I remain sceptical but it has encouraged me to consider pursuing SOA more
aggressively particularly considering success stories such as
[Songkick's][SOA Songkick].

## Visibility of Infrastructure

This discussion began with the problem of increasing awareness of
infrastructure within an organisation to help reduce the divide between
developers and operations but meandered around general visibility of
infrastructure for various stakeholders.

It was agreed that the problem with documentation is that it is almost always
out of date and there is little incentive to keep it updated. After some
suggestions of automatically deriving architectural diagrams from
infrastructure (using firewall rules to infer traffic between services or the
likes of [Zipkin][]), it was clear that human intervention is required. It was
suggested that diagramming the high level, logical flow of a system might last
longer than any including exact implementation details (the ultimate,
eternally correct diagram being a single circle with the word "System" in it).

After a slightly alarming diversion into the world of [Promise Theory][],
there was a discussion about tools for describing the relationships
between services beyond what is currently offered by the likes of
[Puppet][] and [Chef][] with [Ubuntu Juju][] suggested as a possible option.

When discussing the problem of service discovery, one architectural practice
that caught my attention was that of running [HAProxy][] on *all* servers and
having applications talk to `localhost` with the load balancer configuration
determining where services currently reside. A few people seemed to be using
this pattern (and some cited [Airbnb's Synapse][Synapse]) though the
difficulty of debugging network traffic and managing health checks coming from
every server were mentioned as downsides.

## Surviving a <abbr title="Distributed Denial of Service">DDoS</abbr> Attack

The discussion of this topic was obviously a little more sensitive than most
but the general recommendations were to use a content delivery network such as
[Fastly][] to immediate drop all attacks below [Layer 7][] and use services
such as [Prolexic][] and intrusion detection systems such as [Snort][].

Ultimately, the most sophisticated attacks are extremely difficult to
distinguish from normal user behaviour though these are fortunately rare with
most attacks being easy to detect. That said, there seemed to be no fully
automated way to deal with an attack and human intervention is currently
required.

## Linux Containers

The last and most popular session I attended was that on Linux containers with
[Docker][] being the impetus but [LXC][] and [Solaris Zones][] also being
discussed.

There was a lot of interest in the promise of containers as a way of providing
isolation with less of a performance penalty than fully virtual machines but
startlingly few people were using them in production. A few people were using
them during continuous integration and to build packages for multiple
operating systems extremely quickly but most people were still
experimenting.

The current best practice seemed to be using a container to run a single
process (e.g. one container for [nginx][] and one for [php-fpm][]) though it
wasn't explored what benefits this gives.

One appealing use of containers seemed to be encouraging the [Immutable
Server][] pattern where persistent data is separated from application servers
and configuration management is eschewed in favour of disposable instances:
e.g. if you want to upgrade a package, simply build a new container with the
change, spin it up and kill the old instances (this reminded me of [Adrian
Holovaty's move to AWS from Heroku][Holovaty]).

There was a brief discussion on service discovery in the face of many
containers with some success using [Hipache][] instead of using the
HAProxy/Synapse approach mentioned in the earlier "Visibility of
Infrastructure" session. For further production use, [Mesos][] and
[Marathon][] seemed to be the technologies to watch.

In general, everyone seemed quite excited about the potential of containers
but it is still very young with little tooling available. At the
very least, it made me want to join the cabal of people toying with Docker in
my spare time.

## Conclusions

In general, there was a strong theme of small, composable services (perhaps in
containers) and a particularly impressive demonstration of deploying an
application server in minutes to something resembling a private [Heroku][] by
using [Dokku][].

As with the last Scale Camp, it did feel like absolutely
everyone is using [AWS][] though there were some, like myself, with a mix of
hosting providers. Amongst those not entirely in the cloud, there was some
fondness for [OpenStack][].

Besides the aforementioned renewed vigor to pursue SOA, I was convinced by a
discussion between sessions to make better use of DNS as a means of
service discovery: e.g. instead of specifying the location of your MySQL
cluster by managing configuration files with Chef, simply hardcode the
location as `mysql.service` and then use an internal DNS server to resolve
that as needed (even allowing for test environments to resolve to a different
location). This separation of service location from application configuration
seems obvious but I have long coupled such things in the past and used
configuration management to work around it.

If you are at all interested in any of the above or just want to sit in a room
and hear tales of scaling woe, I heartily recommend attending the next Scale
Summit.

  [Heroku]: https://www.heroku.com
  [AWS]: http://aws.amazon.com
  [Holovaty]: http://www.holovaty.com/writing/aws-notes/
  [Immutable Server]: http://martinfowler.com/bliki/ImmutableServer.html
  [nginx]: http://nginx.org
  [php-fpm]: http://php-fpm.org
  [collectd]: http://collectd.org
  [Prolexic]: http://www.prolexic.com
  [Layer 7]: http://en.wikipedia.org/wiki/Application_layer
  [Fastly]: http://www.fastly.com
  [Puppet]: http://puppetlabs.com
  [Chef]: http://www.getchef.com
  [Zipkin]: http://twitter.github.io/zipkin/
  [SOA Songkick]: http://devblog.songkick.com/2012/07/27/service-oriented-songkick/
  [humans.txt]: http://humanstxt.org
  [Bus factor]: http://en.wikipedia.org/wiki/Bus_factor
  [SOA]: http://en.wikipedia.org/wiki/Service-oriented_architecture
  [Measure Anything]: http://codeascraft.com/2011/02/15/measure-anything-measure-everything/
  [Zenoss]: http://www.zenoss.com
  [Nagios]: http://www.nagios.org
  [Graphite]: http://graphite.wikidot.com
  [Carbonate]: https://github.com/jssjr/carbonate
  [Continuous delivery]: http://en.wikipedia.org/wiki/Continuous_delivery
  [Fishbowl]: http://en.wikipedia.org/wiki/Fishbowl_(conversation)
  [Open Space Technology]: http://en.wikipedia.org/wiki/Open_Space_Technology
  [Michael Brunton-Spall]: https://twitter.com/bruntonspall
  [The Guardian]: http://www.theguardian.com
  [Scale Summit]: http://www.scalesummit.org
  [Scale Camp]: http://www.scalecamp.org.uk
  [Chatham House Rule]: http://www.chathamhouse.org/about-us/chathamhouserule
  [Grafana]: http://grafana.org
  [Riemann]: http://riemann.io
  [Sensu]: http://sensuapp.org
  [Docker]: https://www.docker.io
  [Solaris Zones]: http://en.wikipedia.org/wiki/Solaris_Containers
  [LXC]: https://linuxcontainers.org
  [Prolexic]: http://www.prolexic.com
  [Ubuntu Juju]: https://juju.ubuntu.com
  [Microservices]: http://martinfowler.com/articles/microservices.html
  [Ganglia]: http://ganglia.sourceforge.net
  [Diamond]: https://github.com/BrightcoveOS/Diamond
  [Hipache]: https://github.com/dotcloud/hipache
  [Synapse]: https://github.com/airbnb/synapse
  [OpenStack]: https://www.openstack.org
  [Dokku]: https://github.com/progrium/dokku
  [Mesos]: http://mesos.apache.org
  [Marathon]: https://github.com/mesosphere/marathon
  [Promise Theory]: http://en.wikipedia.org/wiki/Promise_theory
  [Philip Potter]: https://gist.github.com/philandstuff/9684513
  [Matthew Cottingham]: http://words.volant.is/articles/notes-scale-summit/
  [HAProxy]: http://haproxy.1wt.eu
  [Python]: https://www.python.org
  [Snort]: http://www.snort.org
  [Zac Stevens]: http://www.cryptocracy.com/blog/2014/03/23/scale-summit-2014/
