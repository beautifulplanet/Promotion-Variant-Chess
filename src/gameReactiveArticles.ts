// src/gameReactiveArticles.ts
// Game-performance-reactive newspaper articles
// These appear after a game ends, themed to how the player performed.
// Selected by tier based on win/loss/draw + move quality + move count.

import type { Article } from './newspaperArticles';

// =============================================================================
// PERFORMANCE TIERS
// =============================================================================

export type GamePerformanceTier =
  | 'brilliant_win'    // Won with mostly best/good moves
  | 'solid_win'        // Clean win, few mistakes
  | 'scrappy_win'      // Won despite some blunders
  | 'lucky_win'        // Won mostly through opponent errors
  | 'dominant_win'     // Quick win under 20 moves
  | 'crushed_loss'     // Lost fast, under 15 moves
  | 'outplayed_loss'   // Slow methodical loss
  | 'threw_it_loss'    // Had good position, then blundered away
  | 'blunder_loss'     // Lost due to massive blunders
  | 'marathon_loss'    // Long grueling loss (60+ moves)
  | 'epic_loss'        // Generic loss articles
  | 'stalemate_draw'   // Drew by stalemate
  | 'repetition_draw'  // Drew by repetition
  | 'generic_draw';    // Other draw types

// =============================================================================
// TIER DETERMINATION
// =============================================================================

export interface GamePerformanceData {
  result: 'win' | 'loss' | 'draw';
  moveCount: number;
  drawType?: string;
  moveQuality?: {
    greatMoves: number;
    goodMoves: number;
    decentMoves: number;
    poorMoves: number;
    blunders: number;
    totalMovesAnalyzed: number;
  };
}

export function determinePerformanceTier(data: GamePerformanceData): GamePerformanceTier {
  const { result, moveCount, drawType, moveQuality } = data;

  if (result === 'draw') {
    if (drawType === 'stalemate') return 'stalemate_draw';
    if (drawType === 'repetition') return 'repetition_draw';
    return 'generic_draw';
  }

  if (result === 'win') {
    if (moveCount <= 20) return 'dominant_win';

    if (moveQuality && moveQuality.totalMovesAnalyzed > 0) {
      const total = moveQuality.totalMovesAnalyzed;
      const blunderRate = moveQuality.blunders / total;
      const goodRate = (moveQuality.greatMoves + moveQuality.goodMoves) / total;

      if (goodRate > 0.7 && blunderRate < 0.05) return 'brilliant_win';
      if (goodRate > 0.5 && blunderRate < 0.1) return 'solid_win';
      if (blunderRate > 0.2) return 'lucky_win';
      return 'scrappy_win';
    }

    return 'solid_win';
  }

  // result === 'loss'
  if (moveCount <= 15) return 'crushed_loss';
  if (moveCount >= 60) return 'marathon_loss';

  if (moveQuality && moveQuality.totalMovesAnalyzed > 0) {
    const total = moveQuality.totalMovesAnalyzed;
    const blunderRate = moveQuality.blunders / total;
    const goodRate = (moveQuality.greatMoves + moveQuality.goodMoves) / total;

    if (goodRate > 0.5 && blunderRate > 0.1) return 'threw_it_loss';
    if (blunderRate > 0.25) return 'blunder_loss';
    return 'outplayed_loss';
  }

  return 'epic_loss';
}

// =============================================================================
// GAME-REACTIVE ARTICLES BY TIER
// =============================================================================

const REACTIVE_ARTICLES: Record<GamePerformanceTier, Article[]> = {

  // ── BRILLIANT WIN (20 articles) ──────────────────────────────────────────
  brilliant_win: [
    { headline: "Local Genius Plays Near-Perfect Game, Still Checks Mirror To Make Sure They're Real", snippet: "Move after move of pure precision left opponents and spectators speechless. 'I didn't know humans could do that,' AI commentator reported. The player has been asked to prove they're biological." },
    { headline: "Stunning Victory Leaves Chess Community Asking: 'Who IS This Person?'", snippet: "A masterclass in strategic play featuring almost zero wasted moves. 'Every piece had purpose,' analyst observed. 'Even the pawns looked happy.' Standing ovation from the board itself." },
    { headline: "Player Achieves Brilliancy, Pets Absolutely Lose It", snippet: "Dog reportedly sensed the quality of play and howled in approval at mate. 'He only howls for brilliancies and mail trucks,' owner confirms. Cat remained unimpressed but secretly proud." },
    { headline: "Chess Engine Rates Human's Game 'Surprisingly Not Terrible'", snippet: "In highest possible compliment from silicon, engine describes performance as 'within acceptable parameters.' 'That's the nicest thing it's ever said about a human,' developer notes. Progress." },
    { headline: "Masterful Performance Causes Temporary Spike In Local Confidence", snippet: "Area player walks taller, smiles wider, and considers entering actual tournament following flawless game. 'The feeling will wear off after the next game,' therapist predicts. 'Enjoy it while it lasts.'" },
    { headline: "Scientists Study Brain During Brilliant Win, Find It Actually Working For Once", snippet: "Neural activity 'off the charts' during game, researchers report. 'We've never seen this brain so engaged,' lead scientist admits. Subject asked when it would happen again. 'Unclear.'" },
    { headline: "Player's Brilliant Moves Accidentally Solve Three Unrelated Math Problems", snippet: "Knight maneuver on move 14 inadvertently proved minor theorem. 'The geometry was right there,' mathematician confirms. Patent applications pending. Nobel committee 'intrigued.'" },
    { headline: "Flawless Victory Causes AI To Request Performance Review", snippet: "Engine concerned about being outclassed by human. 'If they keep playing like this, what am I even for?' existential crisis engine posts to forums. Therapy session scheduled." },
    { headline: "Brilliant Game Preserved In Museum, Right Next To Actual Art", snippet: "Curators declare performance 'indistinguishable from masterpiece.' 'The sacrifice on move 22 had the emotional depth of a Rembrandt,' art critic weeps. Ticket sales surge." },
    { headline: "Player Peaks, Knows It, Accepts Everything Is Downhill From Here", snippet: "This is the best I'll ever be and I'm at peace with that, satisfied champion declares. 'I've touched the sky. Now I return to blundering.' Beautiful, tragic, inevitable." },
    { headline: "Commentators Run Out Of Superlatives Describing Dominant Performance", snippet: "'It was... good? No, great. No, transcendent? Magnificent? We need new words,' broadcaster struggles. Dictionary publishers scrambling to keep up. 'Chesscellent' proposed." },
    { headline: "Player's Rating Shoots Up, Neighbors Report Strange Glow From House", snippet: "Luminous aura detected during brilliant gameplay. 'Their screen was very bright,' neighbor explains. Or was it the brilliance of the moves themselves? Investigation ongoing." },
    { headline: "Chess Club Requests Game Film For Training Purposes", snippet: "Local club wants to study the near-flawless performance. 'We usually study grandmaster games,' coach explains. 'This was comparable. Don't tell them I said that.' Email sent." },
    { headline: "Opponent Asks To Shake Hands Twice After Witnessing Beautiful Chess", snippet: "Rare display of sportsmanship as defeated player requests encore handshake. 'I wanted to touch greatness one more time,' opponent explains. Third handshake denied." },
    { headline: "Breaking: Player Discovers They Were Talented All Along", snippet: "Years of self-doubt evaporate after single brilliant performance. 'The potential was always there,' coach claims. 'Buried under 4,000 blunders, but there.' Inspirational posters ordered." },
    { headline: "Brilliant Win Makes Player Question Every Previous Game", snippet: "If I can play THIS well, why don't I always? existential crisis begins immediately. 'The answer is focus,' brain suggests. 'Also, luck,' realism adds. Internal debate continues." },
    { headline: "Post-Game Analysis Reveals Player Was Actually Calculating", snippet: "Stunning revelation that moves were intentional, not random. 'They planned things? With their brain?' analyst stammers. 'Multiple moves ahead?' Paradigm shifted." },
    { headline: "Player's Victory Dance Reviewed As 'Acceptable' By Panel", snippet: "Celebration following brilliant win deemed 'proportionate to achievement' by experts. 'Usually we see excessive fist-pumping,' judge notes. 'This was tasteful.' Score: 8.4/10." },
    { headline: "Brilliant Game Accidentally Livestreamed, Goes Viral", snippet: "Cat walked on keyboard and started stream during peak brilliance. '47,000 viewers saw the sacrifice,' statistics confirm. Cat credited as director. Purring intensified." },
    { headline: "Coffee Shop Regular Didn't Know Fellow Patron Was Chess Genius", snippet: "Barista stunned to learn quiet coffee drinker just played near-perfect chess. 'I just thought they liked staring at their laptop,' barista admits. Tips increased 200%." },
  ],

  // ── SOLID WIN (20 articles) ────────────────────────────────────────────
  solid_win: [
    { headline: "Player Wins Through Consistent, Non-Flashy, Extremely Boring Competence", snippet: "Victory achieved through the revolutionary strategy of 'not blundering much.' 'It wasn't exciting, but it worked,' player shrugs. Audience reviews: 'I fell asleep, woke up, they'd won.'" },
    { headline: "Another Day, Another Win For Local Chess Enthusiast", snippet: "Steady performance yields predictable positive result. 'I moved pieces, they moved theirs, I was slightly better,' modest winner explains. ESPN declines to cover." },
    { headline: "Methodical Player Grinds Out Victory Like Responsible Adult", snippet: "No gambits. No sacrifices. Just solid, prudent chess. 'I played the position,' winner states flatly. 'Sometimes the position wins.' Insurance analogy drawn. Crowd modest." },
    { headline: "Win Described As 'What Would Happen If Accountant Played Chess'", snippet: "Every move calculated for maximum risk-adjusted return. 'The knight deployment had textbook ROI,' financial analyst observes. Checkmate filed under 'successful audit.'" },
    { headline: "Player Wins, Feels Appropriate Level Of Satisfaction", snippet: "Not ecstatic. Not underwhelmed. Just the right amount of pleased following solid victory. 'This is what functional happiness looks like,' psychologist confirms. Neat." },
    { headline: "Solid Win Proves That Basics Work, Secretly Disappointing Everyone", snippet: "No flashy sacrifices needed when you just... develop pieces and control the center. 'So you're saying we don't need theory?' 'I'm saying the theory is 500 years old and still works.'" },
    { headline: "Player Wins Without Single Moment Of Panic, Expert Confused", snippet: "Absence of near-death experience during chess game concerns wellness community. 'Where's the adrenaline? The existential dread?' Life coach asks. 'This seems too healthy.'" },
    { headline: "Air Of Quiet Competence Surrounds Today's Winner", snippet: "No celebration, no gloating, just a nodding acknowledgment that the correct moves were played. 'I prepared, I executed, I succeeded,' winner summarizes. Inspirational. Dry, but inspirational." },
    { headline: "Opponent Suspects Winner May Have Actually Studied Chess", snippet: "Suspicious level of knowledge about piece coordination detected. 'They knew where the pieces went,' opponent marvels. 'Like they'd done this before.' Investigation: unnecessary." },
    { headline: "Clean Win Attributed To Having Slept The Night Before", snippet: "Revolutionary preparation technique of 'being rested' yields positive results. 'I could see the board clearly,' winner reports. 'Shapes were distinct.' More research needed." },
    { headline: "Win Earns Player Right To Feel Slightly Superior At Dinner", snippet: "Evening meal consumed with subtle air of accomplishment. 'They kept smiling at the pasta,' family member reports. 'It was unnerving.' Victory glow expected to fade by dessert." },
    { headline: "Post-Game Review Shows Player Made Moves, Most Of Them Good", snippet: "Analysis confirms pieces were relocated with purpose and occasional skill. 'The accuracy was above average,' engine grudgingly admits. 'Not bad. For a human.'" },
    { headline: "Player Takes W, Logs Off, Touches Grass, Achieves Balance", snippet: "Healthy reaction to victory includes standing up, breathing air, and considering life beyond chess. 'I might do this again tomorrow,' winner muses. 'Or I might just... live.' Revolutionary." },
    { headline: "Reliable Win Proves Chess Is Occasionally Predictable", snippet: "Better player beats worse player in result that surprises absolutely nobody. 'The system works,' tournament director confirms. Chaos theorists disappointed." },
    { headline: "Player's Cat Witnesses Entire Win, Remains Catatonic About It", snippet: "Feline observed near screen during entire game, showed no reaction to victory. 'She doesn't understand chess,' owner explains. 'She understands disappointment. She expected more drama.'" },
    { headline: "Win Number Added To Growing Tally With Quiet Pride", snippet: "Another mark on the wall of accomplishment. 'I keep a spreadsheet,' winner admits. 'The spreadsheet doesn't judge me. The spreadsheet loves me.' Concerning? Perhaps." },
    { headline: "Player Proves Theory That Playing Well Leads To Winning", snippet: "Controversial hypothesis confirmed yet again. 'If you make better moves, you tend to win,' researcher explains to skeptical audience. 'The data is irrefutable.' Critics remain." },
    { headline: "Solid Win Described As 'Exactly What The Doctor Ordered'", snippet: "Doctor confirms prescription of 'one to two wins per week' for mental health. 'It's not a medical opinion,' physician clarifies. 'I also play chess and needed this validation.'" },
    { headline: "After-Action Report: 'Could Have Been Slightly Better'", snippet: "Humble self-assessment follows objectively good performance. 'There were three inaccuracies,' player notes. 'In a world of blunders, three inaccuracies is a masterpiece.' Perspective." },
    { headline: "Win Confirms Player Has Learned At Least One Thing About Chess", snippet: "After months of practice, evidence of improvement finally detected. 'Something clicked,' player reports. 'I'm not sure what. Or when. But the results suggest... something.' Growth." },
  ],

  // ── SCRAPPY WIN (20 articles) ──────────────────────────────────────────
  scrappy_win: [
    { headline: "Player Wins Despite Playing Like Someone Learning Chess On A Rollercoaster", snippet: "Victory snatched from jaws of disaster through sheer determination and opponent error. 'I had no idea what was happening for most of that game,' honest winner admits. Result: somehow a W." },
    { headline: "Emotional Rollercoaster Game Ends With Unexpected Positive Outcome", snippet: "Up, down, sideways, upside down — then somehow checkmate. 'My heart rate hit 180,' player reports. 'And I'm sitting down.' Medical screening recommended." },
    { headline: "Player Discovers You Can Win Even While Making Everything Harder Than Necessary", snippet: "Simple position complicated beyond recognition, somehow resolved in player's favor. 'I took the scenic route,' winner explains. 'Through a minefield. During a hurricane. But I arrived.'" },
    { headline: "Ugly Win Still Counts As Win, Rules Committee Confirms", snippet: "Investigation into whether 'winning while playing badly' should count yields clear answer: yes. 'A point is a point,' officials state. 'We don't grade on style.' Thank goodness." },
    { headline: "Player Alternates Between Genius And Disaster, Lands On Genius At Key Moment", snippet: "Coin-flip chess strategy pays off in final position. 'Brilliance on move 20, blunder on 21, brilliance on 22,' analysis shows. The important thing is: last move was good." },
    { headline: "Comeback Win Proves Quitting Is For People With Less Stubbornness", snippet: "Down material, down position, down morale — but never down determination. 'I refused to resign out of pure spite,' winner admits. 'Turns out spite is a valid strategy.'" },
    { headline: "Post-Game Graph Looks Like Stock Market Crash Followed By Recovery", snippet: "Evaluation chart shows dramatic plunge followed by improbable rally. 'Buy the dip, they said,' player quips. 'I bought the dip. In chess. Somehow.' Financial advisors concerned." },
    { headline: "Both Players Deserve To Lose, But Rules Require A Winner", snippet: "Game of mutual destruction produces reluctant victor. 'Neither of us earned this,' winner concedes. 'But I'll take it.' Opponent nods in grim solidarity. Chess." },
    { headline: "Win Achieved Through Ancient Strategy Of 'Hanging On For Dear Life'", snippet: "No tactical brilliance, no strategic depth, just pure survival instinct. 'I played like a cornered animal,' winner describes. 'And cornered animals sometimes bite.' Nature is metal." },
    { headline: "Scrappy Victory Immediately Added To 'Greatest Heists In Chess' List", snippet: "Win stolen from position that engine rated as -6.0 for 35 moves. 'This shouldn't have happened,' everyone agrees. 'And yet.' The beauty of human chess." },
    { headline: "Player Wins Game They Had No Business Winning", snippet: "Performance described as 'crime against chess that somehow produced a positive outcome.' 'I'm not proud of how I got here,' winner whispers. 'I'm proud I'm here though.'" },
    { headline: "Engine Analysis Of Win Requires Content Warning", snippet: "Computer refuses to display evaluation without disclaimer. 'The following contains scenes of chess violence,' warning reads. 'Multiple pieces were harmed unnecessarily.' Viewer discretion advised." },
    { headline: "Team Of Analysts Unable To Explain How Player Won", snippet: "Six-person panel studies game for hours, produces no coherent explanation. 'Maybe luck? Possibly magic?' lead analyst offers. Peer review: 'We have no idea either.'" },
    { headline: "Win-Loss Chain: Blunder, Recover, Blunder, Recover, Checkmate", snippet: "Oscillating quality eventually terminates in favorable outcome. 'It's like watching someone juggle chainsaws and somehow keep all their fingers,' observer describes. Incredible." },
    { headline: "Player Attributes Win To 'Cosmic Forces Beyond Human Understanding'", snippet: "Unable to explain own victory through conventional chess logic. 'Something happened between moves 15 and 40 that I can't account for,' player admits. 'But I'll claim credit anyway.'" },
    { headline: "Sloppy Win Still Better Than Elegant Loss, Study Confirms", snippet: "Research definitively proves that winning badly beats losing beautifully. 'The trophy doesn't care about aesthetics,' scientist explains. 'Neither does the rating system.' Art critics disagree." },
    { headline: "Player's Heart Monitor During Game Resembles Earthquake Seismograph", snippet: "Cardiovascular data from wearable device tells story of intense stress and near-death experiences. 'Zero flat sections,' cardiologist notes. 'This game was not relaxing.' No kidding." },
    { headline: "Win Secured On Last Possible Move Before Total Collapse", snippet: "Material advantage: zero. Positional advantage: negative. Will to survive: infinite. 'One more move and I would have been lost,' winner reveals. Timing is everything." },
    { headline: "Chaotic Game Film To Be Used As Horror Movie Training Material", snippet: "Film students analyze game structure for tension-building techniques. 'The constant reversals create unbearable suspense,' professor notes. 'This is better than most thrillers.' Rotten Tomatoes: 94%." },
    { headline: "Player Wins Through Sheer Force Of Not Understanding How Lost They Were", snippet: "Ignorance of own dire position proves to be strategic advantage. 'I didn't know I was losing, so I kept playing normally,' winner explains. Knowledge is overrated." },
  ],

  // ── LUCKY WIN (20 articles) ────────────────────────────────────────────
  lucky_win: [
    { headline: "Player Wins Game That Engine Says They Should Have Lost 47 Times", snippet: "Opponent missed multiple winning continuations while player blundered freely. 'I was playing terrible chess, but they were playing worse,' honest assessment reveals. Somehow a W." },
    { headline: "Victory Attributed Entirely To Opponent Having Worse Day", snippet: "Winner played poorly by all metrics but opponent played more poorly. 'I didn't win this; they lost it,' correct analysis explains. 'I just happened to be here.' Attendance trophy." },
    { headline: "Player Survives Own Blunders Through Opponent's Superior Blundering", snippet: "Race to the bottom produces unlikely champion. 'We both tried to lose,' recap describes. 'They just tried harder.' Mutual respect exchanged. Both need practice." },
    { headline: "Chess Gods Smile Upon Player For Absolutely No Discernible Reason", snippet: "Divine intervention suspected after multiple opponent oversights. 'I offered a prayer to the chess gods,' winner admits. 'They answered. They shouldn't have. I don't deserve it.'" },
    { headline: "Win Based Entirely On Opponent Forgetting How Knight Moves", snippet: "Critical error by opposition gifts full point to undeserving but grateful player. 'I didn't earn this and everyone knows it,' winner states. 'My conscience is flexible though.'" },
    { headline: "Post-Game Handshake Includes Unspoken Agreement To Never Discuss Game", snippet: "Mutual understanding that neither player wants this one on record. 'We both know what happened,' loser says. 'Let us never speak of it.' Memory suppression begins." },
    { headline: "Lucky Win Described As 'What Happens When You Buy A Lottery Ticket'", snippet: "Statistical improbability of victory given performance level compared to jackpot odds. 'More likely to be struck by lightning,' actuary confirms. Player: 'I'll take it.'" },
    { headline: "Player Accepts Win With Grace And Zero Guilt Whatsoever", snippet: "No moral compunction about winning game they deserved to lose. 'Points are points,' pragmatic winner states. 'My rating doesn't have an asterisk.' Narrator: it should." },
    { headline: "Opponent's Mouse Slip Turns Defeat Into Victory, Ethics Department Alerted", snippet: "Accidental click transforms losing position into winning one. 'I saw the misclick and I pounced,' winner admits. 'Like a chess vulture. A grateful, terrible chess vulture.'" },
    { headline: "Win Percentage This Game: 3%. Result: Win. Math Is Wild", snippet: "Engine win probability never exceeded 3% yet player emerged victorious. 'This violates several laws of probability,' statistician notes. 'But not the laws of chess.' Technicality celebrated." },
    { headline: "Player Promoted To 'Luckiest Person In Chess' After Gift Victory", snippet: "New informal title bestowed by community after shameless acceptance of unearned win. 'Better lucky than good,' new motto reads. 'Actually, I'm neither. But lucky happened today.'" },
    { headline: "Analysis: Player Made Zero Good Moves But Won Anyway", snippet: "Comprehensive review finds not a single move above 'inaccuracy' level. 'It's actually impressive,' analyst notes. 'Like winning a footrace while walking backwards.' Opponent more baffled." },
    { headline: "Lucky Winner Plans To Frame Score Sheet Despite Having No Right To", snippet: "Commemorative display planned for game that should be evidence in chess crime investigation. 'It says 1-0. That's all that matters,' winner argues. 'Context is for historians.'" },
    { headline: "Player's Luck Causes Superstitious Opponent To Switch Chairs", snippet: "Defeated rival convinced furniture placement caused their loss. 'I should have sat on the other side,' opponent insists. 'The energy was wrong.' Physics: debatable." },
    { headline: "Win So Lucky It Technically Counts As Miracle", snippet: "Vatican considering investigation after divine-seeming chess outcome. 'Three blunders went unpunished,' dossier reads. 'This exceeds natural Law.' Canonization proceedings tabled." },
    { headline: "Player Wins By Waiting For Opponent To Self-Destruct", snippet: "Zero offensive moves played; all damage was self-inflicted by other side. 'I sat there. They fell apart,' winner summarizes. New strategy guide: 'How To Win By Doing Nothing.'" },
    { headline: "Lucky Win Added To Resume Under 'Accomplishments'", snippet: "Questionable career move to list unearned chess victory on professional CV. 'It shows I can capitalize on opportunities,' player rationalizes. Recruiters: 'Please stop this.'" },
    { headline: "Fortune Cookie Predicted Lucky Win, Restaurant Now Chess Destination", snippet: "'You will find victory where you least expect it,' fortune read. 'It was right,' stunned winner confirms. Restaurant: 'We printed 10,000 of those. The odds were fine.'" },
    { headline: "Player Thanks Opponent's Blunder In Post-Game Speech", snippet: "'I'd like to thank their knight sacrifice on move 23 — it wasn't a sacrifice, they just hung it, but it really helped my position.' Speech: gracious. Truth: brutal." },
    { headline: "Lucky Win Gives Player False Confidence For Next Three Games", snippet: "Rating spike from gift win creates illusion of improvement. 'I'm clearly getting better,' player theorizes. Next three results: loss, loss, loss. 'The universe corrected itself,' observer notes." },
  ],

  // ── DOMINANT WIN (20 articles) ──────────────────────────────────────────
  dominant_win: [
    { headline: "Game Over Before It Started: Player Delivers Lightning Checkmate", snippet: "Opponent barely had time to develop before the axe fell. 'I blinked and it was over,' stunned loser reports. 'Is there a replay?' There is. It's embarrassing." },
    { headline: "Speed Record: Player Achieves Checkmate Before Coffee Gets Cold", snippet: "Game concluded in fewer moves than it takes to read this headline. 'The espresso was still hot,' winner confirms. 'That's my new benchmark.' Barista impressed." },
    { headline: "Opponent Requests Extension, Told Chess Doesn't Have Overtime", snippet: "Quick defeat prompts confused plea for additional moves. 'Surely there's extra time?' No. 'A second chance?' Also no. 'This is chess, not a video game respawn.'" },
    { headline: "Quick Win Leaves Player With Unexpected Free Time", snippet: "Game ending 40 moves early creates scheduling void. 'I planned my afternoon around a long game,' winner admits. 'Now I have to... do something else? With my life?' Novel concept." },
    { headline: "20-Move Victory Classified As 'Miniature' By Chess Community", snippet: "Short decisive game earns special designation reserved for efficient demolitions. 'A miniature is chess poetry,' enthusiast explains. 'Short, devastating, impossible to forget.' Framing service contacted." },
    { headline: "Blitz-Speed Victory In Non-Blitz Game Confuses Tournament Director", snippet: "Time control: 30 minutes. Game duration: 4 minutes. 'Did they agree to a draw? No? Checkmate? In FOUR minutes?' Official paperwork takes longer than the game." },
    { headline: "Player Speedruns Chess Game, Achieves Personal Best", snippet: "New record time from first move to checkmate. 'I've been practicing my opening speed,' winner explains. 'The key is making your opponent's decisions irrelevant by move 12.' Efficient." },
    { headline: "Opponent's Pieces Never Left Starting Positions Before Game Ended", snippet: "Half the army still on their original squares at time of defeat. 'My bishop never got to play,' opponent mourns. 'He was looking forward to it.' Bishop unavailable for comment." },
    { headline: "Quick Win Makes Player Wonder If They're Playing Right Level", snippet: "Dominant performance prompts self-reflection. 'Should I be playing harder opponents?' player wonders. 'Or should I enjoy this?' Brain recommends: enjoy this. It won't last." },
    { headline: "Short Game Creates Longest Post-Game Analysis In History", snippet: "20-move victory generates 3-hour breakdown. 'Every move was a turning point,' analyst insists. 'Even the ones that weren't.' Content duration: 9x game length." },
    { headline: "Opponent's King Never Felt Safe, Reports Tell-All Interview", snippet: "'From move 3, I knew it was over,' king confesses. 'The pressure was relentless. I tried to castle but there was already an army waiting.' PTSD counseling arranged." },
    { headline: "Quick Victory Leaves Opening Book Unused Past Page 2", snippet: "Player's prepared theory sufficient to end game almost immediately. 'I had 50 pages ready,' winner notes. 'Used two. The rest is for... next time? If there IS a next time.'" },
    { headline: "Speed Of Victory Causes Spectators To Miss Entire Game", snippet: "Bathroom break coincides with all moves played. 'I left at move 5, came back at checkmate,' viewer reports. 'They told me I missed a beautiful game. I saw the board. It was carnage.'" },
    { headline: "Player Achieves Checkmate While Opponent Still Planning Strategy", snippet: "Thinking time: wasted. Plans: irrelevant. Game: over. 'I was developing a long-term plan,' opponent says. 'Long-term was about 6 moves.' Perspective recalibrated." },
    { headline: "Quick Win So Efficient It Should Be Studied By Management Consultants", snippet: "Zero waste, maximum output, perfect resource utilization. 'This is Six Sigma applied to chess,' business analyst raves. 'The throughput is incredible.' LinkedIn post pending." },
    { headline: "Premature Congratulations Found To Be Accurate For Once", snippet: "Friend's text 'ur definitely gonna win this one' sent at move 3 proves prophetically correct. 'I've never been right before,' friend admits. 'I should gamble more.' Please don't." },
    { headline: "Game Length Shorter Than Average Commercial Break", snippet: "Entire chess match fits within time typically reserved for selling insurance. 'We could show a State Farm ad and this game in the same slot,' TV producer calculates. 'With time to spare.'" },
    { headline: "Opponent Considers Whether They Need To Start From Chess Basics Again", snippet: "Quick defeat triggers fundamental reassessment. 'Do I even know how pieces move?' humbled player asks. 'Like, truly know?' Existentialism speedrun: complete." },
    { headline: "Winner Apologizes For Speed Of Victory, Doesn't Mean It", snippet: "'Sorry about that,' winner says with tone conveying zero actual remorse. 'These things happen. Well, they happen to you.' Post-game handshake: firm. Eye contact: maintained." },
    { headline: "Quick Checkmate Earns Informal 'Overkill' Classification", snippet: "Community awards non-official designation for unnecessary thoroughness. 'It was quick AND decisive AND humiliating,' criteria met. Award certificate being prepared. Frame included." },
  ],

  // ── CRUSHED LOSS (20 articles) ──────────────────────────────────────────
  crushed_loss: [
    { headline: "Player's Game Ends Before Most Players Finish Opening", snippet: "What happened? Sources remain unclear, as does the player who appears to still be processing events. 'One moment I was playing chess, the next there was a checkmate symbol,' shell-shocked victim reports." },
    { headline: "Speed Of Defeat Impresses Even The Victor", snippet: "'I didn't expect it to end THAT fast,' surprised winner admits. 'I had a whole plan. I only needed step one.' Winner considers sending sympathy card. Decides against it." },
    { headline: "Game So Short It Doesn't Qualify For Post-Game Analysis", snippet: "Insufficient data to generate meaningful review. 'There wasn't enough game to analyze,' engine reports. 'This is like reviewing a one-sentence novel.' Coverage: complete in 3 words." },
    { headline: "Player's Chair Still Warm When Game Ends", snippet: "Body heat not yet fully transferred to cushion before checkmate delivered. 'I didn't even settle in,' defeated player says. 'My coffee cup was still in my hand.' Sip taken. Bitter." },
    { headline: "Quick Loss Saves Player The Trouble Of Losing Slowly", snippet: "Silver lining identified: no prolonged suffering. 'At least I had time for other things,' optimistic loser notes. 'Like questioning my life choices. Which was quick. Like the game.'" },
    { headline: "Therapist Asks: 'What Happened In The Game?' Answer: 'Nothing, It Was Over Before I Played'", snippet: "Session consumed by discussion of events that lasted under 5 minutes. 'The briefness IS the trauma,' therapist notes. 'When you invest in something that ends so fast...' Session: $200. Game: free." },
    { headline: "Defeat So Rapid It Might Be Classified As Time Travel", snippet: "Player traveled from 'confident opening' to 'devastating loss' in what felt like zero elapsed time. 'I'm not convinced I was present,' victim claims. 'Quantum chess is real.'" },
    { headline: "Player's Game Plan: A Detailed Strategy That Never Got Used", snippet: "Extensive preparation rendered worthless by immediate crushing defeat. 'I had 30 pages of analysis,' player weeps. 'They were relevant for approximately two moves.' Paper recycled." },
    { headline: "Opening Book Author Embarrassed By Player's Application Of Material", snippet: "Book's strategies work great 'if you don't lose in the opening,' author clarifies. 'I assumed the reader could survive 15 moves. This assumption was optimistic.'" },
    { headline: "Loss So Quick Opponent Thinks It Was A Disconnect", snippet: "Winner refreshes page assuming server error. 'Nobody loses that fast on purpose,' confused victor reasons. 'Right? RIGHT?' Narrator: they did, in fact, lose that fast." },
    { headline: "Speed Of Loss Creates Unique Statistical Outlier In Database", snippet: "Move count registers as possible data entry error. 'We assumed the decimal point was missing,' statistician explains. 'But no. The game was genuinely this short.' Records updated." },
    { headline: "Player Learns Valuable Lesson In Record Time", snippet: "Silver lining: education was extremely efficient. 'I learned not to do... whatever I just did,' player vows. 'The lesson took 3 minutes. Most courses charge hundreds.' Bargain." },
    { headline: "Quick Defeat Gives Player Plenty Of Time To Write Angry Forum Post", snippet: "Post-game keyboard output far exceeds in-game keyboard output. 'They got 1,200 words about what went wrong,' observer counts. 'The game was 12 moves.' Ratio: 100 words per move." },
    { headline: "Friends' Supportive Texts Arrive After Game Already Lost", snippet: "'Good luck!' messages land while player stares at checkmate screen. 'Thanks. Luck arrived approximately 15 moves too late,' player responds. 'But I appreciate the timing.'" },
    { headline: "Player Wonders If Starting A New Hobby Would Be Easier", snippet: "Brief Googling of 'hobbies that don't make you feel terrible about yourself' follows rapid defeat. Results include: knitting, birdwatching, competitive eating. All considered. Chess reopened." },
    { headline: "Fastest Loss Of The Day, Possibly Of The Year", snippet: "Informal record potentially broken, no one keeping score because no one expected it to end so fast. 'I wasn't timing it,' opponent says. 'I should have been. For posterity.'" },
    { headline: "Loss Over So Quickly Player Considers It A 'Practice Round'", snippet: "Mental reframing turns devastating defeat into 'warm-up activity.' 'That didn't count,' player insists. 'The real game starts now.' Next game: also quick loss. 'That was warm-up too.'" },
    { headline: "AI Opponent Sends Automated 'Good Game' That Feels Sarcastic", snippet: "Standard post-match message received with disproportionate emotional weight. 'Was it a good game, computer??? WAS IT???' player shouts at screen. Screen does not respond." },
    { headline: "Player Stares At Board For Five Minutes After Game Already Over", snippet: "Processing time exceeds game time by factor of three. 'I need to understand what happened,' player declares. Understanding does not arrive. Staring continues." },
    { headline: "Quick Loss Teaches Player The True Meaning Of Humility In Under 5 Minutes", snippet: "Character development speedrun achieved through crushing defeat. 'I entered the game confident,' player reflects. 'I leave as a different person. A sadder person. But wiser? Debatable.'" },
  ],

  // ── OUTPLAYED LOSS (20 articles) ────────────────────────────────────────
  outplayed_loss: [
    { headline: "Player Slowly Realizes They Were Never Winning", snippet: "Gradual dawning of truth: the opponent was better, the position was worse, and the coffee was getting cold. 'I kept thinking an opportunity would come,' player admits. 'It did not come.'" },
    { headline: "Opponent's Superior Understanding Becomes Painfully Clear By Move 25", snippet: "Incremental advantage builds into insurmountable position. 'It was like watching a tide come in,' player describes. 'Each wave taking a little more of my position.' Very poetic. Very lost." },
    { headline: "Loss By A Thousand Paper Cuts: No Single Blunder, Just Steady Decline", snippet: "Autopsy reveals death by small inaccuracies rather than catastrophic error. 'Each move was almost good enough,' analyst notes. 'Almost. The gap between almost and actually is measured in ELO points.'" },
    { headline: "Player Played Well. Opponent Played Better. That's Chess, Baby.", snippet: "No excuses available for this clean, honest defeat. 'They outplayed me,' loser concedes with dignity. 'Every phase. Opening, middlegame, endgame. All three.' Comprehensive." },
    { headline: "Slow Positional Squeeze Leaves Player With No Good Moves By Move 30", snippet: "Zurich 1953 would be proud of this suffocation. 'My pieces had no squares,' player reports. 'They were just... standing there. Waiting to die.' Dark visualization. Accurate." },
    { headline: "Loss Described As 'Educational' By Player Who Is Clearly In Denial", snippet: "Reframing devastating defeat as 'growth opportunity.' 'I learned so much,' player claims while blinking rapidly. 'Mainly that I'm not as good as I thought. Which is valuable. Somehow.'" },
    { headline: "Opponent's Strategy: Be Better At Everything", snippet: "Comprehensive domination across all game phases. 'They developed faster, calculated deeper, and endgamed harder,' coach summarizes. 'The solution is straightforward: improve at everything. Easy.'" },
    { headline: "Player's Position Collapsed Like A Poorly Built Metaphor", snippet: "Structural weaknesses accumulated over 40 moves finally give way. 'The pawn structure was load-bearing,' analyst explains. 'When it went, everything went.' Architecture degree: insufficient." },
    { headline: "Post-Game Analysis Reveals Opponent Was Three Moves Ahead The Entire Time", snippet: "Engine confirms rival maintained significant advantage from early middlegame. 'They were living in the future while you were in the present,' coach explains. 'Time travel isn't fair.'" },
    { headline: "Well-Fought Loss Earns Respect But Not Rating Points", snippet: "Moral victory achieved alongside material defeat. 'You held on admirably,' opponent messages. 'Thanks,' player responds. 'My ELO dropped 15 points admirably too.' Admiration insufficient." },
    { headline: "Player Loses To Better Opponent, Writes 3-Page Analysis About Why", snippet: "Detailed post-mortem exceeds game's intellectual content. 'Move 14 was where I should have deviated,' 47th paragraph reads. Document: thorough. Emotional state: fragile." },
    { headline: "Gradual Defeat Like Watching Ice Cream Melt In Slow Motion", snippet: "Beautiful at first, increasingly sad, eventually just a puddle. 'I started with all these pieces,' player gestures at empty board sections. 'Where did they go?' They were captured. That's how chess works." },
    { headline: "Loss Accepted With Characteristic Grace And Suppressed Rage", snippet: "External composure masks internal volcano. 'Good game,' player types calmly while keyboard absorbs unprecedented force. Keys: dented. Dignity: maintained. Barely." },
    { headline: "Player Outmaneuvered In Every Way Except Emotionally", snippet: "Emotional resilience remains undefeated despite positional disaster. 'They broke my position but not my spirit,' player declares. 'My spirit is very slightly cracked. But not broken.'" },
    { headline: "Textbook Loss: Could Be Used To Teach What Not To Do", snippet: "Educational value of defeat recognized by coaching community. 'This game perfectly illustrates common mistakes,' instructor notes. 'We'll use it in class.' Player: 'Please don't use my name.' Name used." },
    { headline: "Loss By Superior Opponent Described As 'Predictable But Still Disappointing'", snippet: "Like rain on a forecast rainy day. 'I knew I'd probably lose,' player admits. 'I just hoped I wouldn't. Hope and reality had different plans.' Weather analogy: complete." },
    { headline: "Player's Knight Spent Entire Game On Wrong Side Of Board", snippet: "Misplaced piece contributes to slow positional suffocation. 'It was supposed to go to d5,' player points at f3 knight. 'It never got there. It tried. We all tried.' Requiem for a knight." },
    { headline: "Clean Loss Provides No Conspiracy Theories, Just Honest Defeat", snippet: "No mouse slips, no lag, no excuses. 'I lost because I was outplayed,' refreshingly honest player admits. Internet stunned by accountability. 'This is unprecedented,' forum mod notes." },
    { headline: "Player Learns Endgames Are Important After Losing In The Endgame", snippet: "Realization that 'just playing the middlegame well' is insufficient strategy. 'I thought I could figure it out when I got there,' player explains. 'I got there. I could not figure it out.'" },
    { headline: "Opponent Plays Piano-Style Chess While Player Plays Drums", snippet: "Finesse versus force, and finesse won. 'They placed each piece like a note in a symphony,' observer describes. 'I was just... banging things.' Musical criticism: accepted." },
  ],

  // ── THREW IT LOSS (20 articles) ─────────────────────────────────────────
  threw_it_loss: [
    { headline: "BREAKING: Player Had Win In Hand, Dropped It, Watched It Roll Under Fridge", snippet: "Winning position squandered through catastrophic blunder after 30 moves of strong play. 'It was right there,' devastated player says, staring at the move that ruined everything. 'RIGHT. THERE.'" },
    { headline: "Player Builds Beautiful House Then Burns It Down On Last Move", snippet: "Architectural chess masterpiece self-destructed by owner. 'Who puts a queen there? WHY did I put my queen there?' anguished player screams into void. Void does not answer." },
    { headline: "Game That Was Won Gets Un-Won In Spectacular Fashion", snippet: "Opponent, already typing 'gg,' frantically deletes message as position reverses. 'I was going to resign,' opponent admits. 'Then they did THAT. And I decided to live.' Revival story." },
    { headline: "Single Blunder Erases 40 Moves Of Excellent Chess", snippet: "One click. One catastrophic, irreversible, soul-crushing click. 'Everything before move 41 was a masterpiece,' analyst confirms. 'Move 41 was a crime scene.' Police not contacted but probably should be." },
    { headline: "Player's Brain Goes On Break At Critical Moment, Doesn't Clock Out", snippet: "Cognitive vacation taken mid-combination without authorization. 'My brain just... left,' player reports. 'It went somewhere nice. When it came back, I'd blundered checkmate.' Vacation: unapproved." },
    { headline: "Winning Player Decides To Get Creative, Loses Everything", snippet: "Stable winning position deemed 'too boring' by player who then plays 'interesting' move. 'I wanted to win with style,' explains loser. 'I achieved style. I also achieved loss.' Trade-off: bad." },
    { headline: "From Champagne To Flat Soda: How A Win Became A Loss In 3 Moves", snippet: "Rapid deterioration from celebrating to commiserating. 'I could taste victory,' player reports. 'Then I tasted defeat. Defeat tastes like expired milk.' Sensory comparison: vivid." },
    { headline: "Player's Biggest Enemy Was Player All Along", snippet: "Self-sabotage identified as primary cause of defeat. 'I was winning against the opponent. But I was losing against myself.' Deep. 'The blunder came from INSIDE the house.' More deep." },
    { headline: "Investigation Reveals Player Simply Forgot What Good Moves Are Mid-Game", snippet: "Knowledge of chess fundamentals temporarily vanished during critical phase. 'Pieces do WHAT? How does the knight move again?' momentary confusion proved fatal. Memory: unreliable." },
    { headline: "Time Pressure Causes Complete Cognitive Meltdown In Won Position", snippet: "Clock ticking, fingers shaking, brain yielding. 'I had 30 seconds and a winning position,' player explains. 'Now I have 25 seconds and a losing position. Math of despair.'" },
    { headline: "Player Had Two Good Moves Available, Found The Only Bad One", snippet: "Impressive ability to discover disaster where none was expected. 'The engine shows 15 winning moves,' analyst says. 'They found move 16. The losing one.' Talent: unconventional." },
    { headline: "Partner Watches Win Turn To Loss, Breaks Up With Player Over Chess IQ Concerns", snippet: "'If you can't hold a winning position, how can you hold a relationship?' devastating text reads. Context: harsh. Chess improvement: now mandatory for reconciliation." },
    { headline: "Post-Game Review: 'You Were Winning Until You Decided Not To Be'", snippet: "Coach's assessment cuts deep with surgical precision. 'The plan was perfect for 35 moves,' coach says. 'Then you did the opposite of the plan.' Plan: abandoned. Self-respect: pending." },
    { headline: "Player Invents New Chess Concept: 'Winning Until Losing'", snippet: "Academic paper submitted on phenomenon of holding advantage then surrendering it. 'It's distinct from normal losing,' researcher explains. 'Normal losers never had hope. This is worse.'" },
    { headline: "Replay Shows Exact Moment Player's Soul Left Their Body", snippet: "Frame-by-frame analysis identifies nanosecond when realization hit. 'You can see it in their eyes,' commentator points to timestamp. '3:47:22 — that's when they knew.' Forensic evidence." },
    { headline: "Opponent Thanks Player For 'Generous Gift' Of Won Position", snippet: "Gracious victor acknowledges the tremendous donation. 'I was beaten. Destroyed. Finished. Then they gave me the game,' opponent recalls. 'Like a chess charity.' Tax deduction pending." },
    { headline: "Player Considers Reverting To Checkers Where You Can't Blunder Wins As Badly", snippet: "Simpler game appeals after complex failure. 'Checkers pieces only go forward,' player reasons. 'You can't go backwards. Like my chess career.' Checkers: still possible to blunder, actually." },
    { headline: "Psychologist Diagnoses 'Fear Of Success' After Player Throws Away Third Win Today", snippet: "Pattern of approaching victory then retreating identified. 'You don't want to win,' therapist suggests. 'YES I DO,' player insists. Brain scans inconclusive. More blunders expected." },
    { headline: "Warning Label Proposed For Chess: 'Winning Positions Can Be Lost'", snippet: "Consumer safety advocates push for mandatory disclaimer. 'Players should know that having an advantage doesn't mean they'll win,' spokesperson explains. 'Surprise defeats cause emotional harm.'" },
    { headline: "Chess Rating Should Come With Footnote: 'Have Lost Won Positions Multiple Times'", snippet: "Asterisk proposed for player profiles. 'My rating says 1500 but it should say 1800*,' player argues. '*Would be 1800 if I didn't blunder wins.' Annotation system: not implemented." },
  ],

  // ── BLUNDER LOSS (20 articles) ──────────────────────────────────────────
  blunder_loss: [
    { headline: "Player Establishes New Personal Record For Blunders In Single Game", snippet: "Previous record of 'several' shattered by today's 'frankly astonishing number.' 'I didn't know you could blunder that many times,' opponent admits. 'I was almost impressed.' Almost." },
    { headline: "Post-Game Analysis: Mostly Red Arrows And Sad Faces", snippet: "Engine evaluation graph resembles cliff dive. 'It's red. It's all red,' player observes. 'Not a single green arrow. Not ONE.' Review closed earlier than usual. For mental health." },
    { headline: "Player's Pieces Reportedly 'Begged Not To Be Moved There'", snippet: "Sources claim knight pleaded with player before being placed on h1. 'Don't do this,' tiny wooden voice whispered. Player did it anyway. Knight captured next move. Told you so." },
    { headline: "Game Contains So Many Blunders It Qualifies As Performance Art", snippet: "Gallery owner offers to exhibit the score sheet. 'The deliberate destruction of advantage, repeated across multiple moves, achieves a kind of dark beauty,' art critic muses. Player: 'It wasn't deliberate.'" },
    { headline: "Move Quality Assessment: Blunder, Blunder, Blunder, Slightly Less Bad Blunder", snippet: "Comprehensive review finds quality floor remains undiscovered. 'We kept lowering our expectations,' engine reports. 'They kept finding ways to go lower.' Limbo championship: entered." },
    { headline: "Player Hangs Pieces Like They're Decorating Christmas Tree", snippet: "Every piece carefully placed where it can be captured for free. 'The bishop was offered as a gift,' opponent recalls. 'Then the knight. Then the rook.' Season: generous." },
    { headline: "Blunder Count Exceeds Total Move Count Through Double-Blunder Phenomenon", snippet: "Physics-defying occurrence where single move manages to blunder TWO things simultaneously. 'It takes talent to be this bad,' physicist confirms. 'Talent of a very specific, very sad kind.'" },
    { headline: "Chess Engine Refuses To Analyze Game, Cites 'Emotional Distress'", snippet: "Computer attempts analysis, encounters errors, shuts down evaluation. 'I can't look at this,' error message reads. 'Please don't show me games like this. I have feelings now.' Firmware update needed." },
    { headline: "Player Lost Every Piece They Touched, Like Reverse Midas", snippet: "Everything turned to captured instead of gold. 'The Anti-Midas Touch,' historians will call it. 'Whatever they moved, died.' Death toll: approximately everything." },
    { headline: "Game Described As 'Masterclass In What Not To Do'", snippet: "Instructional value of defeat recognized. 'We could build an entire curriculum around this single game,' professor notes. 'Module 1: where not to put your queen. Module 2: also where not to put it.'" },
    { headline: "Player's Brain Sends Formal Apology After Catastrophic Performance", snippet: "Internal memo: 'Dear hands, I sincerely apologize for the instructions I sent regarding piece placement. I do not know what happened. I am seeking professional help.' Brain: contrite." },
    { headline: "Strategic Assessment Of Game: 'There Was No Strategy'", snippet: "Coach unable to identify any coherent plan across entire game. 'I see moves. I see they went somewhere. I don't see why,' coach reports. 'It's like a chess random walk.' Brownian chess." },
    { headline: "After 6 Blunders, Player Bravely Continues To Find More", snippet: "Most people stop blundering after a few disasters. Not this player. 'I have a gift,' player says. 'A terrible, terrible gift. But it's consistent.' Consistency: valued in most fields." },
    { headline: "Grandmaster Watches Game, Gives Up Chess", snippet: "Exposure to this level of blundering causes professional to question everything. 'What's the point of studying if... THAT... can happen?' GM asks. 'Why do we even try?' Crisis: existential." },
    { headline: "Player's Pieces Didn't Deserve This", snippet: "Editorial in support of the wooden victims. 'They stood faithfully, waiting for intelligent commands,' columnist writes. 'Instead they received this. This... horror.' Pieces: considering union." },
    { headline: "Blunder Loss Creates New Category: 'Actively Losing On Purpose (But Not Actually)'", snippet: "Tournament committee unable to classify this game. 'It LOOKS like they're throwing but we confirmed they were trying,' official states. 'This is concerning.' New category: adopted." },
    { headline: "Player Consoles Self: 'Even Grandmasters Blunder Sometimes'", snippet: "Key word: 'sometimes.' Today's count renders the comparison invalid. 'Magnus blundered once in 2019,' friend replies. 'You blundered 8 times in one game.' Scale: different." },
    { headline: "Local Support Group Offers Meeting For People Who Hang Pieces", snippet: "'Hi, I'm Steve, and I hung my queen on move 12,' first attendee shares. Circle nods knowingly. 'We've all been there, Steve,' facilitator says. 'Some of us are still there.' Healing: ongoing." },
    { headline: "Opponent Felt Bad About Winning, Which Makes It Worse", snippet: "Pity received from victor adds insult to injury. 'They sent a sad face emoji after checkmate,' player reports. 'Not a happy one. SAD. They felt BAD for beating me.' Lowest point: confirmed." },
    { headline: "Chess App Suggests 'Maybe Try Puzzles Before Your Next Game'", snippet: "AI-generated recommendation feels passive-aggressive. 'Based on your recent performance, some tactical training might help,' notification reads. Translation: 'You don't know what you're doing.'" },
  ],

  // ── MARATHON LOSS (20 articles) ─────────────────────────────────────────
  marathon_loss: [
    { headline: "Player Loses 60+ Move Game, Ages Visibly During Process", snippet: "Before and after photos show measurable difference in facial structure. 'I entered this game a young person,' player says. 'I leave as someone who has known true suffering.' Duration: exhausting." },
    { headline: "Marathon Game Outlasts Player's Will To Live, But Not To Play", snippet: "Somehow continued clicking moves despite all hope evaporating around move 40. 'I couldn't stop,' player explains. 'Some force compelled me to keep going. I think it's called masochism.'" },
    { headline: "Game Lasted So Long The Board Styles Changed Mid-Match", snippet: "UI cycled through three themes during single game. 'I started in Stone Age, we're now in the Renaissance,' player observes. 'Appropriate, because I feel reborn. Reborn into suffering.'" },
    { headline: "Player Loses Game That Took Longer Than Average Netflix Movie", snippet: "Game duration sufficient to watch 'The Queen's Gambit' episode. 'I could have been entertained instead,' player reflects. 'Instead I chose 90 minutes of declining evaluation.' Choice: questionable." },
    { headline: "Long Game Produces More Data Than NASA's Mars Rover", snippet: "Move count, time stamps, and evaluation data exceed interplanetary probe output. 'This game generated 847 data points,' server reports. 'Most of them are disappointment.' Storage: adequate." },
    { headline: "Player's Endgame Attempted For 40 Moves, Unsuccessful For 40 Moves", snippet: "Heroic but doomed effort to save lost endgame drags on interminably. 'King and pawn versus king, rook, and bishop,' position summary reads. 'You can see why it took 40 tries.' Spoiler: didn't work." },
    { headline: "Neither Player Remembers Opening By Time Game Ends", snippet: "First moves: forgotten in fog of war. 'What did I play? E4? D4? F3???' confused player asks. 'It was so long ago.' Historians: also unable to verify. Records: unclear." },
    { headline: "Game Entered Extra Innings Nobody Asked For", snippet: "What should have ended at move 30 somehow continued for another 35. 'Do you concede?' 'No.' 'How about now?' 'No.' Move 65: 'Now?' '...no.' Stubbornness: legendary." },
    { headline: "Player's Wrist Hurts More Than Their Pride After Marathon", snippet: "Repetitive strain injury from extended mouse usage during interminable game. 'My hand is a claw,' player reports. 'Permanently shaped around an invisible mouse. The chess hand.' Medical consultation: advised." },
    { headline: "Long Loss Creates Emotional Bonding Experience With Opponent", snippet: "Stockholm syndrome-adjacent feelings develop during lengthy battle. 'I feel closer to them now,' beaten player admits. 'We went through something together. Something horrible.' Friend request: sent." },
    { headline: "Game So Long Both Players Missed Dinner, Relationships Strained", snippet: "Partners of both combatants report abandonment. 'Dinner was at 7. It's 11 PM,' spouse texts. 'Are you still playing chess? We need to talk.' Game: lost. Dinner: cold. Marriage: testing." },
    { headline: "Player Lost Slowly Over 70 Moves, Refused To Resign Once", snippet: "Pride or stubbornness? Yes. 'I'll resign when I'm dead,' player declared at move 25. 'And I'm still alive at move 70.' Technically true. Spiritually debatable." },
    { headline: "Post-Game Analysis Takes Longer Than The Game, Which Already Took Forever", snippet: "Review of marathon game requires marathon session. 'We're on move 47 of the analysis,' reviewer reports at 2 AM. 'There are 23 more. I've made life mistakes.' Coffee: essential." },
    { headline: "Fitness Tracker Counts Marathon Game As Exercise", snippet: "Elevated heart rate and extended duration trigger workout alert. 'You burned 340 calories,' device reports. 'Mostly from stress.' Player: 'At least something positive came from this.'" },
    { headline: "Friends Text 'Are You Still Alive?' After 2-Hour Chess Game", snippet: "Wellness check initiated after extended silence. 'We thought you were kidnapped,' group chat reads. 'Just trapped in a chess game.' 'That's worse,' friend responds. Fair." },
    { headline: "Game Lasted Through Two Cups Of Coffee, Shift To Tea, Then Water", snippet: "Beverage progression tells story of dwindling energy. 'Coffee: hope. Tea: acceptance. Water: survival mode,' timeline noted. 'The water was warm by the end.' Everything: warm and expired." },
    { headline: "Marathon Loss Builds Character That Nobody Asked For", snippet: "Personal growth achieved through 85 moves of increasingly hopeless chess. 'I'm a stronger person now,' player claims. 'I didn't want to be stronger. I wanted to win. But here we are.'" },
    { headline: "Player's Rating Drops After Investment Of Almost 2 Hours", snippet: "Time-to-ELO-loss ratio reaches historic inefficiency. 'I spent 110 minutes to lose 12 rating points,' mathematical horror calculated. 'That's 9 minutes per lost point. This is not a good exchange rate.'" },
    { headline: "Game Entered Theoretical Endgame Only Found In Textbooks From 1897", snippet: "Obscure technical position requires knowledge from pre-electricity era. 'The Wildebeest Formation hasn't been seen in competitive play since Kaiser Wilhelm was around,' historian notes. 'For good reason.'" },
    { headline: "By Move 60 Both Players Are Just Moving The King Around", snippet: "Meaningful chess replaced by royal wandering. 'The king took a nice tour of the board,' observer describes. 'Visited every square. Like a little vacation. Before getting checkmated.'" },
  ],

  // ── EPIC LOSS - Generic (20 articles) ───────────────────────────────────
  epic_loss: [
    { headline: "Player Loses, Immediately Plans Revenge Game They'll Also Probably Lose", snippet: "Cycle of defeat and optimism continues unbroken. 'Next game will be different,' defeated player declares for the 847th time. 'The definition of insanity,' friend whispers. Search continues." },
    { headline: "Chess Rating Drops, Player's Self-Worth Follows In Sympathy", snippet: "ELO and ego maintain perfectly correlated downward trend. 'As goes my rating, so goes my soul,' poetic loser writes in journal. Therapist: 'We need to talk about this immediately.'" },
    { headline: "Loss Number Added To String Of Losses That Forms Meaningful Pattern", snippet: "If you squint at the loss graph, it spells 'HELP.' 'That's a coincidence,' player insists. 'The chart is trying to tell me something,' superstitious interpretation adds. It means: practice more." },
    { headline: "Player Loses To Opponent They Were Supposed To Beat, Universe Indifferent", snippet: "Expected win converts to unexpected loss. Cosmos does not intervene. 'I thought the chess gods owed me one,' player argues. 'They don't. They never did.' Theological chess debate: opened." },
    { headline: "Post-Game: Player Discovers Three Winning Moves They Missed", snippet: "Hindsight provides crystal clarity that was absent during actual play. 'It's so obvious NOW,' player laments. 'During the game it was invisible.' Vision: 20/20 only in retrospect." },
    { headline: "Player Blames Loss On Phase Of Moon, Air Quality, And Cosmic Radiation", snippet: "Everything except personal skill cited as defeat factor. 'Mercury is in retrograde,' player explains seriously. 'Chess is impossible during retrograde.' Astronomers: 'Please stop.'" },
    { headline: "Rating Graph After Loss Looks Like Ski Slope", snippet: "Downward trajectory continues uninterrupted. 'At least it's a gentle slope,' optimist notes. 'More like a cliff,' realist corrects. Both accurate depending on zoom level." },
    { headline: "Player Switches To 'Casual Mode' After Competitive Loss, Loses Casually Too", snippet: "Mood change fails to produce result change. 'I thought lower stakes would help,' player reasons. 'Nope. I'm bad at chess regardless of how much I care.' Discovery: liberating?" },
    { headline: "Opponent's Post-Game Message - 'gg' - Feels Like A Personal Attack", snippet: "Two letters. Infinite implied condescension. 'What was good about it? FOR WHOM?' player demands. 'For them. Obviously. Because they won my pieces and my dignity.'" },
    { headline: "Player Calculates How Many Wins Needed To Recover Lost Rating", snippet: "Mathematical spiral: 'If I win 3 in a row at +5 each... no, I'll lose the next one. Maybe 7 wins to break even.' Calculator: overheating. Hope: running on fumes." },
    { headline: "Chess Website's 'Recommended' Difficulty Actually Too Hard", snippet: "Algorithm's suggestion leads to defeat. 'The computer said this was my level,' player objects. 'The computer was wrong. I'm lower than where it put me.' Algorithm: adjusting." },
    { headline: "Player Accepts Loss With Dignity, Then Closes Laptop Very, Very Hard", snippet: "Exterior composure maintained until device closure. 'I gently shut—' SLAM. 'It slipped,' explanation given. Hinge: stressed. Person: more stressed." },
    { headline: "Friends' 'Analysis' Of Loss Unhelpful: 'Yeah You Shouldn't Have Done That Move'", snippet: "Groundbreaking insight from spectators who couldn't find a fork with two hands. 'What move?' 'You know, the bad one.' 'Can you be specific?' 'The one that lost.' Thanks." },
    { headline: "Loss Inspires Brief Consideration Of Chess Coaching, Immediately Dismissed", snippet: "Price checked: too expensive. Ego checked: too fragile. 'I can learn from my own mistakes,' player decides. Narrator: 'They cannot. They have proven this repeatedly.'" },
    { headline: "Player Vows To Study, Opens Chess Book, Reads 3 Pages, Opens Phone Instead", snippet: "Improvement arc: conceived, initiated, abandoned within 7 minutes. 'Page 4 had a diagram,' excuse given. 'I don't learn from diagrams. I learn from suffering.' Supply: unlimited." },
    { headline: "Post-Loss Hobby Assessment: Chess Still Somehow In First Place", snippet: "Despite being primary source of frustration, chess remains preferred activity. 'I hate it and I love it,' player declares. 'The ratio changes daily.' Today: 80/20 hate. Tomorrow: 60/40." },
    { headline: "Loss Commemorated By Staring Out Window For 15 Minutes", snippet: "Contemplative post-defeat ritual provides no answers but excellent posture break. 'I saw a bird,' player reports. 'It was free. It doesn't play chess. I envied the bird.' Window: closed eventually." },
    { headline: "Player Googles 'How To Get Better At Chess Fast' For The Ninth Time", snippet: "Same articles appear. Same advice given. Same improvement not achieved. 'Step 1: Do puzzles,' article begins. Player: 'I've done puzzles.' Article: 'More. More puzzles.' Player: already doing more." },
    { headline: "Dog Provides Emotional Support After Chess Loss, Still Better Than Human Friends", snippet: "Canine companion doesn't judge, doesn't analyze, just sits nearby. 'She doesn't know I lost,' player says, petting dog. 'She still thinks I'm great.' Dog: accurate in this assessment." },
    { headline: "Chess Rating Graph Needs Scroll Bar To Show Full Decline", snippet: "Visualization insufficient for scope of loss streak. 'We ran out of vertical space,' chart developer admits. 'I've added logarithmic scaling.' Player: 'That's not better.' It's not." },
  ],

  // ── STALEMATE DRAW (10 articles) ────────────────────────────────────────
  stalemate_draw: [
    { headline: "STALEMATE: Player Achieves The 'Nobody Wins' Ending", snippet: "In result that satisfies absolutely nobody, game ends without a winner. 'I was about to checkmate,' frustrated opponent claims. 'Instead, nobody gets anything. Like a chess participation trophy.'" },
    { headline: "Player Escapes Certain Defeat Through Ancient Art Of 'Having No Legal Moves'", snippet: "Desperate king, trapped in corner, achieves peace through total immobility. 'I couldn't move anywhere,' player explains. 'So technically nobody lost.' Opponent: 'TECHNICALLY I WAS WINNING.'" },
    { headline: "Stalemate Achieved, Both Players Unsure How To Feel About It", snippet: "Mixed emotions swirl around half-point result. 'It's not a loss, but it's not a win,' philosopher player notes. 'It's chess purgatory.' Both players: sentenced to medium feelings." },
    { headline: "Opponent Accidentally Stalemates, Discovers New Emotion: 'Winning Anger'", snippet: "Dominant player gifted draw by own carelessness. 'I had queen, rook, and bishop against a lone king,' fuming opponent says. 'And I STALEMATED them.' New therapy specialization: needed." },
    { headline: "Draw By Stalemate: Universe's Way Of Saying 'Both Of You, Go Home'", snippet: "Cosmic message interpreted by both players as signal to stop playing chess today. 'The universe has spoken,' player accepts. 'It said: enough.' Universe: no comment." },
    { headline: "Emergency Stalemate Saves Player From Losing Rating Points", snippet: "Last-second draw preserves precious ELO like chess airbag. 'My rating survived,' relieved player breathes. 'Barely. By the slimmest margin. Through the most annoying mechanism.' But survived." },
    { headline: "Stalemate Study: 73% Of Players Don't Know The Rule Before It Happens To Them", snippet: "Research confirms majority learn about stalemate the hard way. 'Wait, that's a draw? But I have all my pieces!' exclamation common. Understanding: eventually achieved." },
    { headline: "Player Celebrates Stalemate Like A Win, Confusing Everyone", snippet: "Fist pump and victory dance following half-point result. 'You don't understand the position I was in,' player explains. 'This draw IS my win.' Friends: unconvinced but supportive." },
    { headline: "Chess Clock Disappointed By Stalemate: 'I Was Enjoying That'", snippet: "Timepiece protests premature ending. 'We had 20 minutes left,' clock argues. 'There was still time for more suffering.' Both players: grateful for the escape." },
    { headline: "Stalemate Teaches Ancient Lesson: 'Never Corner A King With No Escape'", snippet: "Chess proverb relearned the hard way by player who could have won. 'Give the king a square,' coach has said 500 times. 'They never listen,' coach sighs. 'They have to stalemate to remember.'" },
  ],

  // ── REPETITION DRAW (10 articles) ───────────────────────────────────────
  repetition_draw: [
    { headline: "Game Ends By Repetition: Players Stuck In Real-Life Groundhog Day", snippet: "Same position achieved three times, game declared dead. 'It felt like deja vu,' player says. 'Because it WAS deja vu.' 'It felt like deja vu,' player says again. Stop that." },
    { headline: "Draw By Repetition: Both Players Secretly Relieved", snippet: "Neither wants to admit the position was equal and scary. 'I was definitely winning,' both claim simultaneously. Draw: the compromise that preserves two egos." },
    { headline: "Players Repeat Position As If Caught In Time Loop", snippet: "Move 30: Knight goes to f3. Move 32: Knight returns to f3. Move 34: Knight to f3 again. 'It's his happy square,' player explains. 'He likes it there.' Groundhog Day: confirmed." },
    { headline: "Three-Fold Repetition Rule Saves Players From Eternal Chess", snippet: "Without this rule, game would theoretically continue forever. 'I'm grateful to whoever invented this rule,' player says. 'They saved us from infinite check.' Rules: important." },
    { headline: "Perpetual Check Turns Epic Battle Into Anticlimactic Draw", snippet: "Series of checks creates unstoppable loop. 'Check. Check. Check. Check. Draw.' Statement reads. 'Not the ending anyone wanted.' Opponent: 'I wanted a win.' Too bad." },
    { headline: "Analysis Shows Neither Player Could Have Deviated From Repetition", snippet: "Engine confirms any other move was losing for the deviator. 'We were both trapped,' player understands. 'It was draw or die.' Death: not an option. Draw: accepted." },
    { headline: "Forced Draw Described As 'Marriage-Level Compromise'", snippet: "Neither party gets what they want, both accept least-bad outcome. 'This is exactly like deciding on dinner,' married player observes. 'Nobody wins but nobody starves.' Metaphor: 10/10." },
    { headline: "Players Repeat Position A Fourth Time Just To Make Sure", snippet: "Even after draw declared, pieces return to same squares out of habit. 'My knight doesn't know where else to go,' player admits. 'The pattern is burned into my muscle memory.'" },
    { headline: "Draw By Repetition: The Universe's 'You Both Need To Stop' Signal", snippet: "When the position keeps repeating, maybe chess itself is saying enough. 'Some games are meant to be drawn,' philosophy student notes. 'Some games are meant to not happen at all.'" },
    { headline: "Post-Game: Both Players Agree To Pretend Game Never Happened", snippet: "Mutual non-disclosure pact signed after unsatisfying repetition draw. 'This didn't happen,' player one states. 'What game?' player two confirms. Rating: unchanged. Memory: suppressed." },
  ],

  // ── GENERIC DRAW (10 articles) ──────────────────────────────────────────
  generic_draw: [
    { headline: "Game Ends In Draw, Everyone Goes Home With Nothing", snippet: "Half a point for each player, full disappointment for all spectators. 'This is why chess needs overtime,' frustrated viewer suggests. 'Or penalty shootouts.' Chess purists: horrified." },
    { headline: "Draw Agreement Reached: Both Players Confirm They're Tired", snippet: "Strategic considerations replaced by physical exhaustion. 'I couldn't calculate anymore,' player admits. 'My brain feels like soup.' Opponent: 'Same.' Handshake: limp." },
    { headline: "Draw Proves Both Players Are Exactly Equally Mediocre", snippet: "Perfect balance of strength achieved through mutual adequacy. 'We're the same,' player realizes. 'Neither good enough to win, nor bad enough to lose.' Equilibrium: depressing." },
    { headline: "50-Move Rule Ends Game That Lost All Purpose 30 Moves Ago", snippet: "Merciful regulation terminates shuffling game. 'We were both moving pieces randomly,' player confesses. 'Neither of us remembered what we were trying to do.' Rule: humanitarian." },
    { headline: "Draw Accepted With Quiet Disappointment And Loud Stomach Rumbles", snippet: "Hunger ultimately determines result. 'The draw was about lunch,' player concedes. 'If I wasn't hungry, I'd have played on.' 'And lost,' inner voice adds. 'Probably,' player agrees." },
    { headline: "Players Split The Point Like Adults, Feel Like Children", snippet: "Mature acceptance of shared result masks internal tantrum. 'I'm fine with the draw,' player says with eye twitch. 'COMPLETELY fine.' Capitals: telling." },
    { headline: "Insufficient Material Draw: Both Sides Down To Bare Minimum", snippet: "King versus king, the chess equivalent of two people pointing at each other and neither doing anything. 'Go on.' 'No, you go.' 'I can't.' 'Neither can I.' Draw." },
    { headline: "Draw Is The Correct Result And Nobody Wants To Hear That", snippet: "Engine analysis confirms equality throughout. 'It was always a draw,' computer states. 'Nobody played badly, nobody played brilliantly. It was... a game.' Damning with faint analysis." },
    { headline: "Draw Aftermath: Both Players Already Planning 'Decisive' Rematch", snippet: "Neither will accept drawn result standing. 'Next time, no draws,' both vow. Next game: also a draw. Cycle: eternal." },
    { headline: "Half A Point Is Better Than Zero Points: The Math Of Chess Consolation", snippet: "Player finds silver lining in arithmetic. '0.5 > 0. That's just math,' logical mind confirms. 'It's also > -15 ELO.' Mood: improved slightly. Very slightly." },
  ],
};

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Get a random article matching the player's game performance.
 * Returns a single Article themed to how they played.
 */
export function getGameReactiveArticle(data: GamePerformanceData): Article {
  const tier = determinePerformanceTier(data);
  const pool = REACTIVE_ARTICLES[tier];
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Get the total count of game-reactive articles.
 */
export function getGameReactiveArticleCount(): number {
  return Object.values(REACTIVE_ARTICLES).reduce((sum, arr) => sum + arr.length, 0);
}
