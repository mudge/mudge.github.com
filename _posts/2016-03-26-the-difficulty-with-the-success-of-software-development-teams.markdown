---
layout: post
title: The difficulty with the success of software development teams
excerpt: Thoughts on improving the success of development teams following Scale Summit 2016.
---
Last Friday, I attended [Scale Summit][1] 2016, my fourth time at the conference formerly known as [Scale Camp][2]. I make no secret that it is [one of my favourite conferences][3] with its [open space technology format][4], the high calibre of attendees and its use of [Chatham House Rule][5].

I spent the morning participating in two sessions:

* "Breaking down barriers between teams"
* "Code sharing in large organisations"

[Richard Dallaway wrote up his notes][6] from the former and both [Anna Shipman][7] and [Barrie Bremner][8] have shared their thoughts on the latter.

As I've spent the past three years attempting to grow a software development company, there was a common theme between these two sessions that fascinated me:

> How do you measure the success of a software development team and, in turn, improve it?

The first session began with a discussion of how to encourage collaboration between teams (e.g. between different teams of developers, operations, product owners, etc.), break down organisational [silos][9] and consolidate tooling across an organisation.

The second session focussed on promoting code re-use within a large organisation, with the aim of reducing the amount of duplicated software built by separate teams.

Software development is rich with ideas and processes aiming to optimise efficiency and deliver better results, but has [a somewhat spotty history of applying these practices][10]. In such an environment, there is an ever-present risk of [cargo culting][11]:

> McConnell describes software development organizations that attempt to emulate more successful development houses, […] by slavishly following a [software development process][12] without understanding the reasoning behind it.

With this in mind, in both sessions my first question was similar:

* Why _should_ we break down the barriers between teams?
* Why _should_ we share code in a large organisation?

Without a clear motivation for using it, how can anyone be truly convinced of a practice? A team forced to collaborate without incentive to do so beyond "our managers told us to" seems unlikely to truly benefit. What's more, without clear reasoning, it's hard—if not impossible—to measure the success of any endeavour. Sure, the teams are talking more but why is that a good thing?

The push for increased collaboration between developers and operations staff lead to the [DevOps movement][13], which aimed to spread knowledge of and responsibility for the deployment software and its on-going maintenance. The pattern of developers "[throwing code over the wall][14]" to operations staff, who were suddenly responsible for its performance and uptime, contributed to antagonism between teams and increased both the risk and cost of failure.

Breaking down the barriers between these teams had some key goals in mind:

* Reduce the risk of failures when deploying software
* Reduce the time to recovery when failures do occur

We could similarly evaluate improving communication between product owners and developers, e.g.

* Reduce the amount of unnecessary software written [due to misunderstanding][15]
* Reduce the cost of software and ship higher value features in a more timely fashion, by sharing the complexity and risk of the backlog

However, choosing different evaluation criteria can have an unpredictable—and even damaging—effect:

> Some of the managers decided that it would be a good idea to track the progress of each individual engineer in terms of the amount of code that they wrote from week to week. They devised a form that each engineer was required to submit every Friday, which included a field for the number of lines of code that were written that week.

— Andy Hertzfeld, "[-2000 Lines Of Code][16]"

Incentivising developers to write _more_ code can accidentally reward those who write verbose software (often at the expense of maintainability). There are even stories of [how introducing a bounty for fixing bugs created a black market][17] within a company.

Not all incentives have such obvious (even if only in hindsight) side-effects. Discussion in the first session about consolidating tooling (specifically, continuous integration solutions) brought up a more difficult scenario: management want everyone to use the same tool in order to save paying for (and maintaining) multiple solutions to the same problem. What is the cost of forcing everyone to use the same tool? Does this accidentally reduce the [autonomy][18] of a team, coupling them to others in a way that might impede their progress? What if the teams' requirements differ in a way that you missed?

The benefits of code reuse should also be subject to the same scrutiny: as [Anna Shipman writes][7] (emphasis my own):

> The problem we are trying to solve is to reduce duplication of **work**, rather than specifically duplication of **code**. More generally, we do not want teams to waste time reinventing the wheel. We do not necessarily want "the best tool for the job", we want the most cost-effective tool, and that might be copying someone else's code, or the team solving the same, or similar, problem in a different way.

Perhaps using [services][19] would be a better way to share common functionality than reusing code itself?

Ultimately, these different attempts to improve teams were best described as a struggle between focussing on **outputs** and **means**.

The two are often confused: no one encouraging collaboration between teams does so without an implicit expectation that their mutual output will improve. No one attempting to consolidate tooling does so thinking that it will have a deleterious effect on users.

Without attempting to understand _both_ output and means, we are at risk of jeopardising, not improving, our chances of success.

[1]: http://www.scalesummit.org/
[2]: http://www.scalecamp.org.uk/
[3]: http://mudge.name/2014/03/22/a-summit-for-scaling.html
[4]: https://en.wikipedia.org/wiki/Open_Space_Technology
[5]: https://www.chathamhouse.org/about/chatham-house-rule
[6]: https://gist.github.com/d6y/c063ccadfea3a6800ffd
[7]: http://www.annashipman.co.uk/jfdi/code-sharing.html
[8]: https://github.com/bazbremner/scalesummit-2016-notes/blob/master/code_sharing.org
[9]: http://www.grammarphobia.com/blog/2013/04/silo.html
[10]: http://pragdave.me/blog/2014/03/04/time-to-kill-agile/
[11]: https://en.wikipedia.org/wiki/Cargo_cult_programming#Cargo_cult_software_engineering
[12]: https://en.wikipedia.org/wiki/Software_development_process "Software development process"
[13]: https://en.wikipedia.org/wiki/DevOps
[14]: http://c2.com/cgi/wiki?ThrownOverTheWall
[15]: https://en.wikipedia.org/wiki/Tree_swing_cartoon
[16]: http://www.folklore.org/StoryView.py?story=Negative_2000_Lines_Of_Code.txt
[17]: http://thedailywtf.com/articles/The-Defect-Black-Market
[18]: https://labs.spotify.com/2014/03/27/spotify-engineering-culture-part-1/
[19]: http://martinfowler.com/articles/microservices.html
  
