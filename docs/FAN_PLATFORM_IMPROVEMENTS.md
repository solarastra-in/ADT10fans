# Fan platform improvements

What was built in this round, and the next ideas worth doing, roughly in order of value for fans during the 2026 season.

## Built

**Play and win**

- **Pick XI** (fantasy cricket):
  - 100 credits, roles and team limits, captain/vice-captain.
  - Scored automatically from the scorecard.
  - Private leagues with join codes.
  - Season and per-match standings, "most picked" and "selected by" on match and player pages.
  - Lock reminders and personal result messages.
- **Daily games:** Guess the Player (mystery player from the six squads) and Super Over (six balls, two wickets, a daily target). Outcomes are decided on the server, so they can't be gamed from the browser.
- **Predictions and instant quizzes**, with answers hidden until settlement.
- **Prize catalogue:** fans spend points without losing leaderboard rank. Claim codes, stock limits, team-only prizes, refunds on cancellation.
- **Prize draws:** free entry, optional team and minimum-points rules, and a published seed so anyone can re-check the winner.
- **Badges, daily check-in streaks, invite-a-friend rewards** (paid only after the friend first plays, so fake sign-ups earn nothing).

**Fan base and discussion**

- **Fan Wars:** every fan's points count for the team they back. Fans can switch team once per season.
- **Fan base page:** fans per team, active this week, countries, top fans, newest fans.
- **Forum:**
  - Topics, team and match threads, reactions, upvotes.
  - Editing for 24 hours.
  - Reports that hide a post after three until a moderator reviews it, plus locking and pinning.
  - A daily cap on forum points so it isn't spammed.
- **Polls** on the forum, team and match pages.

**Content**

- **Only confirmed official accounts:**
  - The league: YouTube, X, Instagram, Facebook, TikTok.
  - UAE Bulls: YouTube, X, Instagram, Threads.
  - Arabian Aces: X, Instagram, Threads, Facebook, TikTok, LinkedIn.
  - Other teams show none until their accounts are confirmed.
- **YouTube videos play in the page.** Each channel also has a "latest uploads" player.
- **X posts** come from the public timeline when X allows it; otherwise the X embed is shown.
- **Other platforms** use their own embeds or a profile card, and only load when tapped.
- **Feed health** for admins shows what each account returned on its last pull.
- **News** from Google News with a Bing fallback, linked to the publishers.

**Matchday**

- **Live scores** from CricketData once a fixture is linked: score, toss, result, scorecard, top scorer, sixes. Completing a match scores Pick XI and sends the result.
- **Fan Spaces:** watch parties with capacity, QR passes and phone-camera door check-in.

**Reach**

- **SEO:** every page has its own address, server-rendered content, structured data and a sitemap.
- **Arabic, Hindi and Urdu**, with right-to-left layout.
- **Team officials:** each franchise can run its own page, accounts, posts, polls, forum and fan notifications without touching anything else.

**Added in the scale, SEO and fan engagement pass**

- **Player cards:** tap any player for this season's real figures (from scorecards on the site) and verified links to ESPNcricinfo, Cricbuzz, Wikipedia and their own social accounts. These links also go into the page's `sameAs` structured data, which is how search engines tie the page to the player.
- **Skill games**, all generated from the real squads and this season's figures, the same for every fan each day:
  - *Squad Connections:* sixteen players, four hidden groups (team, role, batting or bowling style, signing). 60 points.
  - *Cricket Grid:* a 3×3 grid of team × trait; rarer correct answers score more, as in the Immaculate Grid. 90 points.
  - *Stat Wars:* 60 seconds of "who has more?" on this season's numbers, +3 / −1 with a time bonus.
  - *Duels:* challenge a friend to the same Stat Wars questions; the higher score wins 15 points.
- **Fan wall and Fan of the Day:** fans post photos and moments, react and report; the organisers approve photos and pick a Fan of the Day for points and a notification.

## Game ideas (researched, not built yet)

Skill and knowledge games that suit cricket fans, alone or against each other:

1. **Ball-by-ball predictor (live, head-to-head):** before each delivery, pick dot / single / boundary / wicket; streaks score. Needs the ball-by-ball feed.
2. **Over-par chase:** given a real match situation from this season (runs needed, balls left, batters in), pick the batting order and shot plan; scored against what actually happened.
3. **Scorecard detective:** a real scorecard from this season with names hidden; work out the players from their figures.
4. **Auction room:** a timed draft against friends from the real squad, with each player's real credits; best combined points over the next match wins.
5. **Higher or lower streak:** like Stat Wars but endless, one stat at a time; daily leaderboard of the longest streak.
6. **Team-of-the-week challenge:** after each match round, guess the official team of the week.
7. **Captaincy calls:** in a live match, pick who bowls the next over; points if the over goes for fewer runs than the match rate.
8. **Weekly league for duels:** a ladder where fans challenge the fan just above them.

## Next ideas

1. **Live match centre during play:** ball-by-ball commentary and a win-probability bar from CricketData's ball-by-ball endpoint, with live Pick XI points updating as the match goes.
2. **Pick XI contests with prizes per match:** a small prize for the best lineup of each match (using the existing prize catalogue), and head-to-head challenges between friends in a private league.
3. **Prediction streaks and season-long picks:** champion, top run-scorer and most sixes, locked before match 1 and settled at the end of the season.
4. **Matchday check-in at the stadium:** a code shown on the big screen or at Fan Spaces earns bonus points and a "was there" badge.
5. **Weekly Fan Wars rewards:** the team with the most active fans that week unlocks a perk for all its fans (for example a draw only they can enter).
6. **Player follow and alerts:** fans follow players and get a push notification when one of them hits a fifty or takes three wickets.
7. **Short video highlights wall:** YouTube Shorts and TikTok clips from the official accounts in a swipeable phone feed.
8. **Creator watch-alongs:** schedule creator streams in the Growth section and show them on match pages while the match is live.
9. **Translated push notifications** in each fan's chosen language. Notification text is currently written once, in English.
10. **Moderator tools:** a list of muted words, temporary mutes for repeat offenders, and an appeal button for hidden posts.
