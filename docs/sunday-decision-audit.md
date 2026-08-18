# The Sunday-decision audit

Audited 18 August 2026, against one question and no others: **can a stranger on
a phone decide whether to show up on Sunday?**

Everything below was checked on the running site at 390px wide — a normal
phone — and on the live unifygr.com where it mattered.

---

## What I found

### 1. The service time is invisible

The homepage never says when church is. Not once, in eight screens of
scrolling. The words "Sundays at 10am" do appear in the page's code, in exactly
one place: as a small grey subtitle inside a dropdown menu, under a heading
called "Encounter God."

The old Clover site this replaced had **SUNDAY @ 10a · 2777 KNAPP ST NE**
printed across the top of every single page. The rebuild dropped the one thing
the old site got right.

### 2. The menu is written in the church's language, not the visitor's

Tapping the menu on a phone gives five choices: **Encounter God**,
**Be Transformed**, **Change the World**, **Ministries**, **Give**.

Four of those five are the church's vision statement. A person who wants to
know what time the service starts has to guess that it lives under "Encounter
God." Nobody guesses that.

### 3. The useful links are on screen seven of eight

The homepage is 7,112 pixels tall — about 8.4 phone screens. The block
containing *Plan a Visit*, *What We Believe* and *Watch Sermons* starts around
6,000 pixels down. And when you get there, the cards say "Plan a Visit / OPEN"
— a label and a button, not an answer.

### 4. Nothing on the site tells a parent what happens to their kid

This is the biggest single gap, and the most annoying one, because **the answer
is already written.** Buried in the ministries data, verified by staff on
17 August, is this:

> Nursery through elementary on Sunday mornings… Your kids get their own space,
> their own teaching, and adults who know their names… Check in at the kids desk
> when you arrive.

That is exactly what a nervous parent needs, and it sits three taps deep inside
a directory of 117 ministries. Outside that record, the only mention of children
anywhere on the site is a staff member's job title.

### 5. Atmosphere is standing in front of the answers

- The homepage loads roughly **14MB** of media, including **four videos set to
  play automatically**. On a phone on cell data that is slow and expensive.
- Nine headings on the homepage, none of which contains a time, a place, or a
  fact. "Five commitments. One life." and "Three movements. One life." are two
  headings, thirty seconds apart, in the same shape.
- "One Body. One Witness." appears twice on the same page.
- The three vision pillars appear **four times** on the homepage: in the small
  print under the title, in the three cards below it, in the experience grid,
  and again as the menu's top level.
- Almost the entire page is invisible until JavaScript fades it in. If that
  fails, a visitor gets a headline and eight screens of black.

### 6. Things shipped to the public that were meant for the designer

- A **DAWN / BLUE HOUR** toggle sits in the header of the live site, in the spot
  where "Plan a Visit" should be on a phone. It switches between two hero image
  concepts. It is live right now on unifygr.com.
- `/enter` is a full-screen cinematic page — "Choose one. Break through." — with
  no header, no menu, and no way back to anything useful.
- `/happy-church`, a merchandise concept page with cartoon suns and bubble
  letters, is publicly reachable and has nothing to do with the rest of the site.

### 7. Smaller things that still cost you

- **The display typeface only works on Apple devices.** The whole site is set in
  "Iowan Old Style," which ships with macOS and iOS and nowhere else. Roughly
  half your visitors — every Android phone, every Windows PC — silently get
  Georgia instead. You have never seen your own site the way half your visitors
  see it.
- **Every sermon on the Watch page is called "Sunday Morning Service."** Eight of
  them. No topic, no speaker, no reason to click one over another — and this is
  the main way someone samples the teaching before coming.
- **The Ministries page opens with a manifesto about how the church curates
  ministry listings.** A visitor does not need the editorial policy.
- **The Plan a Visit page is titled "Encounter God"** and is thin: when, where,
  a connect card, and an app link. It does not cover parking, kids, music,
  length of the sermon, or what happens when you walk in.

---

## The plan, in priority order

**1. Put the service time in the header of every page.** Time and street
address, always on screen, never more than zero taps away. This is the single
highest-value change on the list and the old site already proved it works.

**2. Rewrite the menu in plain nouns.** Sunday · Watch · What we believe ·
Ministries · About us · Give. Every label is a word a stranger already knows.
The church's vision language moves inside "About us," where someone who is
already interested will find it.

**3. Make the homepage answer the question in its first screen.** Who we are in
one line, then when, where, how long, what to wear, and kids — above the fold on
a phone, with a directions button. Everything else follows.

**4. Build one page called Sunday that answers everything.** Absorb Plan a
Visit into it, and put the kids answer that already exists on it, in full.

**5. Say out loud what you cannot answer yet.** Six real questions have no
answer anywhere on the site: parking and which door, what the music is like,
how long the teaching runs, coffee and a place to take a loud baby, showing up
late, and accessibility. List them honestly with a phone number rather than
leaving a stranger to find out in the lobby.

**6. Cut the designer's controls out of the live site.** The DAWN / BLUE HOUR
toggle and the `/enter` page go.

**7. Use real photographs of these people.** The most persuasive image in this
whole audit was a YouTube thumbnail: a real person leading worship with the
lyrics up on the screen behind them. It does more for the decision than any of
the 56MB of generated art. The generated ambience is fine as a backdrop; it
should never be the evidence.

**8. Retire the autoplay videos and the 2.4MB background images.** Same feeling,
a fraction of the weight.

**9. Fix the typeface so it renders everywhere.** Self-host a real display face
rather than depending on one that only Apple ships.

**10. Give the sermons real titles.** Topic and speaker, so someone can pick one.

---

## What was built

The prototype on this branch does 1, 2, 3, 4, 5, 6, 8 and 9.

- The header carries **Sundays at 10am · 2777 Knapp St NE** on every page.
- The menu is six plain-language items, one tap each.
- The homepage answers the whole question in its first screen and is
  **4.7 phone screens long instead of 8.4**.
- `/sunday` is the new hub; `/visit` redirects to it so old links keep working.
- The six unanswered questions are listed on `/sunday`, with the office number.
- The hero toggle and `/enter` are gone.
- The homepage hero image is 18KB instead of 2.4MB, and no video autoplays.
- Fraunces is self-hosted, so the type looks the same on every device.

Items 7 and 10 need photographs and sermon titles — content, not code.
