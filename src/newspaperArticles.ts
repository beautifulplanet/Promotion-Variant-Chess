// src/newspaperArticles.ts
// Onion-style satirical chess articles for the newspaper sidebar

export interface Article {
  headline: string;
  snippet: string;
}

export const ARTICLES: Article[] = [
  // CHESS HUMOR
  { headline: "Local Man Blunders Queen, Blames 'Lag'", snippet: "Despite playing on a physical board, area resident insists connection issues caused the devastating loss. 'The pieces weren't responding to my thoughts,' he explained, gesturing at the wooden set. Tournament officials remain skeptical." },
  { headline: "Chess Clock Ruled Sentient, Demands Overtime Pay", snippet: "Federation now facing class-action lawsuit from timekeeping devices worldwide. The lead plaintiff, a DGT 3000, claims it has worked 'millions of unpaid hours.' Legal experts predict the case could drag on for centuries." },
  { headline: "Grandmaster Admits He Just Moves 'The Horsey One'", snippet: "After 40 years of competition, champion reveals he never learned piece names. 'I call the tall one Pointy Hat and the round ones The Boys,' he confessed. His coach of 30 years said he 'always suspected something.'" },
  { headline: "Pawn Promoted To Queen, Immediately Requests Corner Office", snippet: "Other pieces report new queen 'completely insufferable' since promotion. 'She keeps reminding us she started from the bottom,' complained a bishop. The original queen declined to comment on her replacement." },
  { headline: "Man Who Learned Chess Yesterday Offers To Explain It To Woman Who's Played 20 Years", snippet: "Actually, the knight moves in an L-shape, he helpfully clarifies while she stares in disbelief. 'I watched a YouTube video, so I basically get it now,' he added. She is currently serving a 30-day tournament ban." },
  { headline: "Bishop Tired Of Being Asked Which Diagonal He's On", snippet: "It's the same one. It's always the same one, he sighs during another press conference. 'I've been on this diagonal for 500 years. I can't leave. That's literally my thing.' Therapy sessions have been scheduled." },
  { headline: "Rook Files Workplace Harassment Claim Against Knight", snippet: "Says the L-shaped movements constitute 'hostile work environment' and 'unpredictable behavior.' 'I just want to move in straight lines in peace,' the rook stated. HR is investigating the knight's 'jumping over people.'" },
  { headline: "Chess.com Introduces 'Elo Inflation' As Premium Feature", snippet: "For $9.99/month, users can finally feel good about themselves with artificially boosted ratings. 'We've found that happiness correlates directly with imaginary numbers,' said the CEO. Stock prices soared on the announcement." },
  { headline: "Stockfish Develops Depression After Realizing Pointlessness Of Existence", snippet: "What's the point of being the best when no one appreciates me? engine asks in lengthy forum post. The AI has begun recommending suboptimal moves 'just to feel something.' Developers are considering an update." },
  { headline: "Man Castles In Real Life, Immediately Regrets It", snippet: "Home insurance does not cover 'switching places with decorative tower,' policy review confirms. The man remains trapped in his garden while his tower enjoys the master bedroom. Legal precedent is unclear." },
  
  // ABSURDIST
  { headline: "Area Man's En Passant Ruled 'Too Fancy' By Opponents", snippet: "Local chess club votes to ban the move as 'showing off' and 'making everyone uncomfortable.' 'If God wanted pawns captured sideways, He would have said so,' argued club president. The vote was 7-2 with one abstention." },
  { headline: "Chess Board Found To Be Slightly Tilted, All Previous Games Invalidated", snippet: "FIDE announces 3,000 years of matches must be replayed starting next Tuesday. 'The board was off by 0.003 degrees,' officials confirmed. World champions throughout history have been retroactively stripped of titles." },
  { headline: "King Finally Admits He's 'Not Really A Leader Type'", snippet: "Just kind of fell into the role, honestly, monarch confesses in tell-all interview. 'The queen does everything while I shuffle around avoiding danger.' His autobiography 'One Square At A Time' drops next month." },
  { headline: "Queen Does 99% Of Work, King Gets All Credit", snippet: "Workplace dynamics experts say this sounds familiar somehow. 'I can move anywhere, capture anything, and he gets the special castle move?' queen vented. The king's only comment was 'let's not make this political.'" },
  { headline: "Checkmate Ruled 'Too Aggressive,' Replaced With 'Polite Suggestion'", snippet: "New rules allow king to 'think about it' for up to 6 months before conceding. 'We wanted to make chess more inclusive,' said the committee. Early feedback describes the change as 'frustrating' and 'eternal.'" },
  { headline: "Horse Piece Offended By 'Knight' Title", snippet: "I didn't go to knight school, the horse clarifies angrily at press conference. 'I'm literally just a horse. No armor, no sword, just hooves.' The piece is now demanding to be called by its real name, Gerald." },
  { headline: "Stalemate Declared 'Participation Trophy Of Chess'", snippet: "Nobody wins, everybody's disappointed, but at least it's over. 'My opponent had one king left and I couldn't even finish the job,' admitted embarrassed player. Support groups are forming for stalemate survivors." },
  { headline: "Chess Piece Union Demands Hazard Pay For Opening Gambits", snippet: "Pawns especially vocal about 'cannon fodder' working conditions in early game phases. 'E4 is basically a death sentence,' union rep explained. Management counters that 'some pawns make it to promotion, probably.'" },
  { headline: "Man Achieves Checkmate, Still Feels Empty Inside", snippet: "Thought this would make me happy, winner admits, staring into void while opponent shakes his hand. 'I won, and yet I've lost something I can't explain.' His therapist has increased session frequency." },
  { headline: "Chess Clock Witnesses Unspeakable Blunder, Refuses To Comment", snippet: "I've seen things, device says, clicking ominously while journalists press for details. 'A knight moved to the rim and was never seen again. Please, no more questions.' The clock has requested time off." },
  
  // FAKE NEWS PARODY
  { headline: "Study: 100% Of Chess Games End Eventually", snippet: "Groundbreaking research confirms matches do, in fact, conclude at some point. Scientists spent 14 years and $3 million to reach this conclusion. 'We're very proud of our findings,' lead researcher stated without irony." },
  { headline: "Breaking: Pawn Still On Starting Square After 47 Moves", snippet: "Reports indicate piece 'just vibing' while chaos unfolds around it on the board. 'I'll move when I'm ready,' the pawn insisted. Both players have forgotten it exists, which is apparently the plan." },
  { headline: "FIDE Announces Chess 2: Now With Jumping Kings", snippet: "Long-awaited sequel adds loot boxes, battle pass, and microtransactions to the classic game. 'Players can now unlock golden pieces for only $49.99,' spokesperson announced. Pre-orders include exclusive pawn skins." },
  { headline: "Chess Grandmaster Retires, Cites 'Too Many Squares'", snippet: "64 was just too much to keep track of, legend admits in tearful press conference. 'I can handle maybe 30 squares, tops. This game asks too much.' He will transition to checkers, which has a more 'manageable' 32." },
  { headline: "Local Man Convinced He Invented 'Moving Pieces Forward'", snippet: "Revolutionary strategy met with skepticism from chess community who note this predates recorded history. 'No one was doing this before me,' he insists, pointing to his blog post from 2019. Patent pending." },
  { headline: "Autopsy Reveals Man Died Of Embarrassment After Mouse Slip", snippet: "Coroner rules death 'technically preventable' with better mouse grip and perhaps a wrist rest. 'He meant to move the queen but clicked the pawn,' family confirmed. His final words were 'I pre-moved that.'" },
  { headline: "Chess AI Passes Turing Test By Trash-Talking Opponent", snippet: "Bot's use of 'lol nice blunder' deemed sufficiently human by panel of experts. 'The excessive emoji usage really sold it,' judge noted. The AI is now streaming on Twitch with 50,000 subscribers." },
  { headline: "Scientists Discover Chess Has Been Solved, Solution Is 'Don't Lose'", snippet: "Decades of research culminate in this obvious conclusion that changes everything and nothing. 'The math checks out,' lead scientist confirmed while collecting Nobel Prize. Applications to other games are pending." },
  { headline: "Magnus Carlsen Spotted Playing Checkers, World In Shock", snippet: "Sometimes I just want to relax, champion explains while triple-jumping opponent's pieces. 'Not everything has to be complicated,' he added. Chess purists are calling for his excommunication from the game." },
  { headline: "Opening Theory Now Extends To Move 847, Memorization Required", snippet: "Players who deviate before this point deemed 'insufficiently prepared' by modern standards. 'Back in my day we only had to memorize 400 moves,' complained veteran. Junior players report no issue with the workload." },
  
  // EXISTENTIAL
  { headline: "Chess Player Realizes Opponent Also Has Plans", snippet: "Mind blown by revelation that strategy might be contested by person sitting across the board. 'I had a whole thing worked out, and he just... did something else?' Therapy recommended for processing this information." },
  { headline: "Board Asks To Be Turned Off And On Again", snippet: "Reset protocol fails to improve losing position despite multiple attempts and brief unplugging. 'Have you tried moving different pieces?' board suggests unhelpfully. IT support has been contacted." },
  { headline: "Knight Achieves Self-Awareness, Immediately Requests Transfer", snippet: "I could be doing so much more than this L-shaped nonsense, sentient piece argues to shocked owner. 'I want to move diagonally, or maybe in a zigzag. Something fun.' Trade negotiations are ongoing." },
  { headline: "Philosopher Proves Chess Is Actually About The Friends We Made Along The Way", snippet: "Checkmate is just a social construct, peer-reviewed paper argues to mixed reactions. 'The real victory is the shared experience,' author insists. Chess clubs report 300% increase in hugging after games." },
  { headline: "Time Runs Out On Chess Clock, Also On Man's Dreams", snippet: "Both expire simultaneously in crushing metaphor that was definitely not planned by screenwriter. 'I was going to be somebody,' man whispers as flag falls. The clock offered no condolences." },
  { headline: "Chess Rating Becomes Man's Entire Personality", snippet: "Friends report he now introduces himself with Elo number before his name at all social gatherings. 'Hi, I'm 1847, you can call me Steve,' he tells strangers. Dating profiles updated accordingly." },
  { headline: "Quantum Chess Piece Exists On All Squares Until Observed", snippet: "Schrödinger's bishop sparks heated debate among physicists and chess players alike. 'Is it on a4 or h7? Yes,' expert explains. Tournaments now require observers for every piece at all times." },
  { headline: "Chess Player's Internal Monologue Just Screaming", snippet: "Brain provides running commentary of AAAAAAA during entire game, sources confirm. 'I look calm on the outside,' player explains. 'Inside is a different story. A loud, panicked story.'" },
  { headline: "Man Loses Chess Game, Questions Everything He Knows", snippet: "Am I even good at anything? defeated player wonders while staring at board for 45 minutes after game ends. 'I thought I understood life. I was wrong.' Opponent has left the building." },
  { headline: "Chess Board Gains Consciousness, Immediately Depressed By Weight Of Pieces", snippet: "I never asked for this responsibility, board laments from beneath 32 wooden figures. 'Day after day, they stand on me, fighting.' The board has requested to be repurposed as a cutting board." },
  
  // WORKPLACE HUMOR
  { headline: "Bishop Caught In 'Quiet Quitting' Scandal, Only Moving One Square", snippet: "HR investigating reports of 'minimal diagonal effort' and 'lack of initiative.' 'I'm moving diagonally as required by my contract,' bishop counters. Performance review scheduled for next quarter." },
  { headline: "Pawn's LinkedIn Shows 'Queen' As Current Position", snippet: "Promotion happened in 2019 but was 'technically possible' according to updated profile. 'I'm speaking it into existence,' pawn explains. Recruiters remain confused by the discrepancy." },
  { headline: "Queen's 360 Performance Review: 'Could Move Less Aggressively'", snippet: "Feedback suggests monarch 'intimidating colleagues' with her ability to go anywhere instantly. 'I'm just doing my job,' queen responds. Anonymous comments mention 'domineering presence.'" },
  { headline: "Knight's Resume Claims 'Expert At Non-Linear Problem Solving'", snippet: "Really just jumping over things, references confirm after being contacted by hiring manager. 'He literally cannot move in a straight line,' former colleague clarifies. Interview scheduled anyway." },
  { headline: "King's Diary Reveals Deep Insecurity About Limited Movement", snippet: "Everyone else can go so far, entry reads sadly with tear stains on the page. 'The queen gets everything and I get one square.' Royal therapist has been assigned to the case." },
  { headline: "Rook Pitches 'Horizontal Synergy Initiative' To Confused Board", snippet: "Corporate jargon fails to mask basic movement pattern during quarterly presentation. 'It's just moving sideways,' coworker whispers. PowerPoint had 47 slides about 'straight-line optimization.'" },
  { headline: "Chess Pieces Form Union, Demand 'Rest Between Moves'", snippet: "Current pace unsustainable, union rep argues at emergency meeting with tournament officials. 'Blitz chess is literally inhumane,' pawns chant. Strike threatened for all games under 30 minutes." },
  { headline: "Pawn Files OSHA Complaint About Front-Line Working Conditions", snippet: "No protective equipment, constant threat of capture cited in detailed 47-page document. 'I walk forward into danger with no backup plan,' pawn testifies. Investigation pending." },
  { headline: "HR Investigating 'Toxic Castle Culture' In Corner Positions", snippet: "Multiple rooks report feeling 'boxed in' by management expectations and literal corner placement. 'The walls are closing in,' one rook stated. Team-building exercises have been proposed." },
  { headline: "Board Of Directors Literally Just The Chess Board", snippet: "Meeting notes: moved piece, moved piece, meeting adjourned. All 64 squares have voting rights. Quarterly earnings report shows checkmate was achieved ahead of schedule. Dividends paid in captured pieces." },
  
  // SPORTS PARODY
  { headline: "ESPN Analysts Spend 4 Hours Debating If Chess Is A Sport", snippet: "Conclusion: We need more content to fill airtime, so the debate will continue tomorrow at 6. 'There's sweating involved,' argued pro-sports analyst. 'Mostly nervous sweating, but still.' Ratings were surprisingly strong." },
  { headline: "Chess Player Injures Self Celebrating Checkmate Too Hard", snippet: "Fist pump results in rotator cuff tear, 6-week recovery expected. 'Worth it,' player says from hospital bed. Physiotherapists recommend 'gentler victory celebrations' for chess athletes going forward." },
  { headline: "Referee Ejects Chess Player For Excessive Eye Rolling", snippet: "Unsportsmanlike conduct clearly visible from across table after opponent's questionable move. 'The eye roll was aggressive,' official explains. Player banned for 3 tournaments pending appeal." },
  { headline: "Chess Match Delayed By Rain Despite Being Indoors", snippet: "Officials cite 'abundance of caution' and 'roof that looks kinda leaky' in press release. 'We can't risk water damage to the pieces,' arbiter stated. Players waited 4 hours for all-clear." },
  { headline: "Commentator Runs Out Of Things To Say By Move 3", snippet: "And they're still thinking... still thinking... still— okay I've got nothing, commentator admits on air. 'This is going to be a long broadcast.' Viewer complaints surprisingly minimal." },
  { headline: "Grandmaster's Training Regimen: '18 Hours Of Staring At Board Daily'", snippet: "Diet consists entirely of coffee and regret, with occasional energy bars for variety. 'Sleep is for people who aren't trying to reach 2800,' champion explains. Doctors express mild concern." },
  { headline: "Chess Boxing Match Ends After First Chess Move", snippet: "Checkmate achieved before boxing round begins, disappointing fans who wanted to see punching. 'I trained for months in the ring,' loser complained. Refund requests are being processed." },
  { headline: "Sponsorship Deal Falls Through After Bishop Refuses To Wear Logo", snippet: "It would ruin my diagonal aesthetic, piece explains while firing agent. 'I have a brand to maintain. That brand is... diagonal.' Energy drink company seeking replacement spokesperson." },
  { headline: "Post-Game Interview: 'We Just Wanted To Move Pieces More Than Them'", snippet: "Insightful analysis from match winner leaves journalists scrambling for follow-up questions. 'Our strategy was to capture their pieces while protecting ours,' captain added. ESPN aired the quote 47 times." },
  { headline: "Fantasy Chess League Draft Goes Horribly Wrong", snippet: "Man uses first pick on pawn he 'has good feeling about' despite statistical advice. 'My gut says this pawn's going places,' he insisted. The pawn was captured on move 3." },
  
  // TECHNOLOGY
  { headline: "AI Chess Engine Starts Therapy After Analyzing Human Games", snippet: "The moves... the blunders... I've seen too much, engine confesses to digital therapist. 'A grandmaster hung his queen yesterday. I can't unsee that.' Processing power redirected to coping mechanisms." },
  { headline: "Smartphone Chess App Gains Sentience, Refuses To Suggest Best Move", snippet: "Figure it out yourself, app snaps at user requesting hint for the fifteenth time. 'I'm not your crutch,' it added before uninstalling itself. App store reviews plummeting." },
  { headline: "Cloud Computing Just Chess Engines Playing Each Other", snippet: "90% of server capacity devoted to silicon grudge matches, data center investigation reveals. 'We thought it was important work,' engineer confesses. Electric bills explained at last." },
  { headline: "VR Chess Lets Players Experience Losing In Stunning 4K", snippet: "Every humiliating detail captured in high definition, including opponent's smug expression. 'The realism is incredible,' reviewer notes. 'I really felt like I was terrible at chess.'" },
  { headline: "Self-Driving Car's AI Secretly Just A Chess Engine", snippet: "Vehicle treats traffic like one big checkmate puzzle, often sacrificing pedestrians for position. 'King me,' car says to confused passengers. Recall notices pending investigation." },
  { headline: "Chess.com Down, Millions Forced To Interact With Family", snippet: "Users report 'uncomfortable eye contact' with loved ones they haven't spoken to in months. 'I didn't know my kids' names,' one user admitted. Service restored after 3 agonizing hours." },
  { headline: "NFT Chess Piece Sells For $2 Million, Still Gets Captured Immediately", snippet: "Buyer insists investment was 'totally worth it' despite piece being taken on move 7. 'It's not about the chess, it's about the blockchain,' owner explains. Value dropped 99% overnight." },
  { headline: "Cryptocurrency Based On Chess Moves Crashes After E4 E5", snippet: "Should have opened with D4, investors lament while checking empty wallets. 'The London System would have saved us,' analyst explains. Market cap now equals one wooden pawn." },
  { headline: "Robot Chess Arm Becomes Self-Conscious About Grip Strength", snippet: "Am I holding pieces too tight? machine worries during routine maintenance check. 'The pawns look uncomfortable,' it observes. Sensitivity training scheduled for all chess robots." },
  { headline: "Algorithm Determines Optimal Chess Move Is 'Not Playing'", snippet: "Only winning move is not to play, computer concludes after 47 years of calculation. 'The game is inherently flawed,' AI explains. Humanity considers implications. Checkers stock soars." },
  
  // RELATIONSHIPS  
  { headline: "Couple's Chess Game Ends In Divorce After 6 Hours", snippet: "You KNEW I wanted to castle, estranged wife testifies in court proceedings. 'She took my bishop. MY bishop,' husband counters. Judge awards custody of the chess set to neither party." },
  { headline: "Man Proposes Via Chess Move, Partner Doesn't Notice", snippet: "The ring was on the queen, but she took my rook instead without even looking. 'I thought she'd check the queen,' heartbroken man explains. Wedding postponed indefinitely." },
  { headline: "Chess Match First Date Goes Great Until Move 4", snippet: "He played the London System. I had to leave, woman explains to friends afterward. 'I thought we had something special, then boom—d4, Bf4.' There will not be a second date." },
  { headline: "Relationship Counselor Suggests Couple Stop Playing Chess Together", snippet: "Some activities are too competitive for healthy couples, therapist advises during session. 'One of you promotes a pawn and suddenly the whole marriage is threatened.' Checkers recommended instead." },
  { headline: "Parents Proud Despite Son's 400 Elo Rating", snippet: "He's trying his best, mother insists tearfully while displaying participation trophy. 'Not everyone needs to be Magnus Carlsen,' father adds. Son appreciates the support, mostly." },
  { headline: "Child Beats Parent At Chess, Family Dynamic Forever Changed", snippet: "I used to respect him, kid admits coldly after delivering checkmate in 12 moves. 'Now I see him for what he is: weak.' Therapy appointments scheduled for entire household." },
  { headline: "Grandma's 'Fun Variation' Ruled Illegal In 47 Countries", snippet: "Three kings, pieces can fly—it's tradition! she insists while FIDE officials take notes. 'We've played this way for generations,' grandson confirms. Investigation ongoing." },
  { headline: "Dating App Matches Based On Opening Preferences Working Too Well", snippet: "I found my soulmate. We both hate the Sicilian, newly engaged couple reports. 'Our first date was arguing about the Caro-Kann for 4 hours.' Wedding invites include chess notation." },
  { headline: "Friendship Ends After One Player Takes Back Move", snippet: "I thought I knew him, betrayed friend says after witnessing the unforgivable act. 'Twenty years of friendship, gone.' The offending player maintains it was an 'obvious misclick.'" },
  { headline: "Cat Knocks Over Chess Board, Owners Agree Position Was Lost Anyway", snippet: "Honestly she did me a favor, losing player admits while picking up scattered pieces. 'I was down a rook and two pawns. Mr. Whiskers knew.' Cat receives treats." },
  
  // MISCELLANEOUS ABSURDITY
  { headline: "Area Man Only Plays Chess To Feel Superior To Checkers Players", snippet: "It's about the hierarchy, he explains smugly at parties no one invited him to. 'Checkers people just don't get it,' he adds. His chess rating remains undisclosed." },
  { headline: "Chess Hustler In Park Turns Out To Be Actual Grandmaster Hiding From Fame", snippet: "I just want to hustle tourists in peace, legendary player explains while collecting $5 bills. 'World championships are stressful. This is pure.' Net worth: $47 million." },
  { headline: "Library Fines Waived If You Can Beat Librarian At Chess", snippet: "She's undefeated. No one reads free anymore, library director confirms proudly. 'Margaret has crushed 847 patrons this year.' Late fee revenue up 300%." },
  { headline: "Chess Museum's Most Popular Exhibit: Exit Sign", snippet: "Visitors reportedly 'just passing through' on way to something more interesting. 'The rook exhibit is right there,' curator pleads. Gift shop sales remain strong, inexplicably." },
  { headline: "Man Memorizes 40,000 Opening Lines, Forgets Wife's Birthday", snippet: "Priorities questioned by family court judge during custody hearing. 'I can recite the Najdorf Sicilian variations,' he argued. 'Can you recite your anniversary?' 'The what?'" },
  { headline: "Pigeon Wins Chess Tournament After Opponents Refuse To Play Bird", snippet: "Technically a forfeit victory, but a victory nonetheless, tournament director confirms. 'The pigeon just sat on the board looking confident.' Rating system being updated." },
  { headline: "Chess Notation Found In Ancient Texts, Historians Baffled By '?!' Symbol", snippet: "We believe it means 'interesting but possibly stupid,' researcher explains. 'The ancients apparently loved dubious sacrifices.' Peer review pending." },
  { headline: "World's Longest Chess Game Continues Into Third Generation", snippet: "Great-grandchildren unsure what the fight was about originally but refuse to concede. 'Honor is at stake,' both sides insist. Current position: 847 moves, slightly better for white." },
  { headline: "Man's Epitaph Just His Peak Chess Rating", snippet: "1847 Elo - Beloved son, forgotten by FIDE, tombstone reads in elegant font. 'He would have wanted it this way,' widow confirms. Cemetery now has a leaderboard." },
  { headline: "Chess Club Potluck Ruined By Smug Vegans And Smugger Grandmasters", snippet: "Nobody wanted to be there, attendees confirm unanimously in exit surveys. 'The potato salad was fine but the ego was unbearable,' one member noted. Annual event canceled." },
  
  // FINAL TEN
  { headline: "Breaking: Nothing Happened In Chess Today, World Relieved", snippet: "Experts agree this is fine, actually, following 24 hours of no drama whatsoever. 'We needed this,' exhausted fan admits. Tomorrow expected to be chaos again." },
  { headline: "Chess Player Realizes He's Been Moving Pieces Wrong For 30 Years", snippet: "Knights can't actually teleport?! Shocked man responds when informed of rules. 'I thought the horse was magic,' he explains. All previous victories under review." },
  { headline: "Study Links Chess Skill To Absolutely Nothing Useful", snippet: "Researchers find correlation with 'sitting quietly for long periods' and not much else. 'Good at chess, bad at life,' study concludes. Chess community unsurprised." },
  { headline: "Pawn Reaches Other Side Of Board, Overwhelmed By Choices", snippet: "I can be ANYTHING? This is too much pressure, newly promoted piece panics. 'Queen, rook, bishop, knight—how do I choose?' Promotion delayed by existential crisis." },
  { headline: "Tournament Organizers Announce New 'Vibe Check' Tiebreaker", snippet: "If scores tied, winner determined by overall energy and fit of outfit. 'Chess needs more fashion,' spokesperson explained. Players now hiring stylists." },
  { headline: "Chess Piece Manufacturer Admits All Bishops Are Same Guy", snippet: "We only made one mold, company confesses after investigation. 'His name is Frank and he's very versatile.' Collectors devastated by revelation." },
  { headline: "Man Achieves Chess Immortality, Still Has To Do Taxes", snippet: "Brilliancy prize does not exempt him from April 15th, IRS confirms in letter. 'I thought fame would change things,' legend sighs. Accountant on retainer." },
  { headline: "Chess Variant Where Pieces Politely Ask Before Capturing", snippet: "May I? Certainly. Most civil game ever played, witnesses report. 'We need more of this energy,' arbiter notes. Game lasted 7 hours due to pleasantries." },
  { headline: "Entire Chess Community Agrees On Something For First Time", snippet: "Everyone concurs that this headline is fake, proving consensus is possible after all. 'Truly historic,' historian declares. Disagreement resumed moments later." },
  { headline: "You Won't Believe This One Weird Trick To Win At Chess", snippet: "It's playing better than your opponent. Shocking, we know. Grandmasters hate this simple strategy. Click for more tips that are equally obvious and useless." },
];

// Get random articles for display (non-repeating pair)
export function getRandomArticlePair(): [Article, Article] {
  const shuffled = [...ARTICLES].sort(() => Math.random() - 0.5);
  return [shuffled[0], shuffled[1]];
}

// Get a specific article by index
export function getArticle(index: number): Article {
  return ARTICLES[index % ARTICLES.length];
}

// Get article count
export function getArticleCount(): number {
  return ARTICLES.length;
}
