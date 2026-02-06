---
# the default layout is 'page'
icon: fas fa-info-circle
order: 4
description: "Eugene Leontev - Ruby Engineer specializing in high-load backends, performance audits, and backend architecture from scratch. Based in Tbilisi, Georgia."
---

# Eugene Leontev - Ruby Engineer

**Location:** Tbilisi, Georgia  
**LinkedIn:** [linkedin.com/in/eugeneleontev](https://www.linkedin.com/in/eugeneleontev/)  
**GitHub:** [github.com/madmatvey](https://github.com/madmatvey)  
**Blog:** [madmatvey.github.io](https://madmatvey.github.io/)  

## About Me

Hello. My name is Eugene Leontev. I'm a Ruby engineer with a background in high-load systems, performance audits, and backend architecture from scratch. I consider myself an engineer not from my first commercial project, but much earlier—from the habit of understanding how systems work and bringing tasks to a working result, even if it means stepping outside the formal boundaries of a role.

Before commercial development, I worked as a sound engineer at a radio station and concert hall: I designed recordings, assembled multi-channel setups, negotiated with venues and teams, solved problems from idea to implementation, and did quite a bit of soldering :)) This experience strongly influenced my engineering style: taking full responsibility, not "piece by piece."

In commercial development, my main focus is complex backend systems where performance, data correctness, and resilience under load matter.

## Key Projects & Achievements

### Performance Optimization: Mobile Backend

One notable case is a mobile backend handling ~1 million requests per day on a key endpoint. Average response time was ~250ms, leading to UX degradation and additional infrastructure costs. I conducted a performance audit (New Relic, PgHero, EXPLAIN ANALYZE), identified bottlenecks in queries, added partial indexes, carefully denormalized data, and simplified JOIN chains. Results:
- Average response time dropped to ~20ms
- PostgreSQL load stabilized
- The company stopped spending ~$600/month on excess resources

I later documented this experience in an article: [Optimizing SQL Queries or Tracking Dangerous Criminals](https://madmatvey.github.io/posts/sql-optimization-or-criminal-tracking/) (~31k views on Habr).

### Legacy Code & Uncertainty: Fintech Project

Another important part of my experience is working with uncertainty and legacy code. In a fintech project, I dealt with code that generated legally incorrect calculations in documents. After refactoring and strengthening tests, the system became predictable, and lawyers stopped doing manual checks and trusted the automation.

### TRC-20 USDT Wallet: Event-Driven Architecture

I designed an event-driven architecture with background jobs (Sidekiq), accounted for strict external API limits (15 rps), and ensured processing of up to ~1 million transactions per day without system degradation. The project was launched from scratch in ~3 months and scaled without architectural rewrites.

## What I'm Passionate About

I'm particularly drawn to:
- **Backend architecture from scratch** — designing systems that scale and maintain
- **Performance audits and PostgreSQL work** — finding bottlenecks and optimizing queries
- **Reducing uncertainty** — through communication with business and users
- **Stabilizing and "bringing to reason"** existing codebases

## My Approach to Work

I'm a proponent of "be your own manager": documenting important decisions in text, working asynchronously, explaining trade-offs, and taking responsibility for imperfect but conscious decisions. I prefer documentation in tests and auto-generated artifacts, with key architectural decisions in brief text notes.

## Open Source & Community

- **Gasfree SDK** — Ruby library for gasless TRC-20 transactions: [github.com/madmatvey/gasfree_sdk](https://github.com/madmatvey/gasfree_sdk)
- **Jekyll Crypto Donations** — Jekyll plugin for crypto donations: [github.com/madmatvey/jekyll-crypto-donations](https://github.com/madmatvey/jekyll-crypto-donations)
- **Technical Articles** — [madmatvey.github.io](https://madmatvey.github.io/) (including the SQL optimization article with ~31k views)
- [**Menhausen App**](https://t.me/menhausen_app_bot/app) — Telegram Mini App for mental health support: [github.com/imfineapp/menhausen_app](https://github.com/imfineapp/menhausen_app)
- **Workshops & Talks** — Internal and public presentations (Thinknetica workshop: [github.com/thinknetica/workshop_ruby_dev_with_ai](https://github.com/thinknetica/workshop_ruby_dev_with_ai))

## Location & Availability

I currently live in **Tbilisi, Georgia**. I haven't been in or worked from Russia since 2022. I'm comfortable with PST overlap. Relocation to Portugal is not a priority; in the near future, I'm planning to move to **LATAM**.

## Personal Background

Originally from Siberia, Russia. Before 2015, I was a radio DJ, sound producer, musician, and entrepreneur. I moved to Samara in 2015 and to Tbilisi, Georgia in early 2022, where I am today. Gamarjoba, genatsvale! მადლობა რომ კითხულობთ ამას!

I have a work permit as an individual entrepreneur in 🇬🇪 Georgia.

## Hobbies

- **Sailing** — Albert Einstein had a hobby of driving a sailboat. It [helped him to understand how the universe works](https://www.abc.net.au/news/2017-11-25/how-a-love-of-sailing-helped-einstien-explain-the-universe/9190970). I have a license to captain a sailboat for recreational purposes. [Here is the sailing school](https://www.seanation.com/school) I chose and warmly recommend to those who want to really learn how to sail a sailboat, not just get a captain's license. I've also written about [parallels between sailing and product development](https://madmatvey.github.io/posts/sailing-through-product-development/).

- **Music** — Playing guitar can stimulate creativity and provide a relaxing break from work. Sometimes I make short videos of me playing guitar, [here's one of them](https://www.ultimate-guitar.com/shot/madmatvey/669363136).

- **DJ Streaming** — Sometimes on the weekends I stream live, play deejay live mix on my YouTube channel [Lazy Beat](https://www.youtube.com/@lazybeatdjs). Subscribe, give me likes!

## CV

Feel free to [download my CV](/assets/Eugene_Leontev_CV_RoR.25.pdf)

## Donate Me

{% crypto_donations I'm on a mission to fulfill my lifelong dream of buying a sailboat and relocating to live in the ocean. Your support can make this dream a reality! Any contribution, big or small, is deeply appreciated and will bring me one step closer to my adventure on the open seas. Thank you for your generosity! %}


