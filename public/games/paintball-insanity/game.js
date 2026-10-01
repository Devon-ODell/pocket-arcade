// game.js — Paintball Insanity. A first-person paintball shooter ported from the Roblox game
// of the same name (video-games/paintball): its ballistics, markers, bot brain, squad tactics,
// Gauntlet rules, payout and chatter, on its Speedball field. The numbers are not retyped:
// DATA is generated from that project's own Data/*.json (see NOTES.md).
// Everything is paint. Nobody is hurt: players are hit, splattered, and out for the round.
// Contract (docs/GAME_CONTRACT.md): classic script, no DOM, no Math.random, no Date; every
// piece of state is plain JSON inside the state object.
(function () {
  'use strict';

  const CONFIG = /*CONFIG*/{"title": "Paintball Insanity", "tagline": "Five rounds. The field fills up."}/*END*/;
  const DATA = {"source":"Generated from the Roblox Paintball Insanity project, Data/*.json. Regenerate rather than edit.","markers":{"mechanical":{"displayName":"Ridgeline Mech","muzzleVelocity":130.0,"dragK":0.012,"roundsPerMinute":350,"autoFire":true,"firstShotSpreadDeg":0.35,"sustainedSpreadDeg":1.5,"spreadGrowthPerShotDeg":0.16,"spreadDecayPerSecondDeg":2.2,"movingSpreadMultiplier":2.4,"sprintingSpreadMultiplier":9.0,"crouchSpreadMultiplier":0.72,"hopperCapacity":180,"reloadSeconds":2.4,"loudness":0.6,"payoutMultiplier":1.0,"cost":0,"blurb":"Blowback mechanical. Cheap, honest, forgiving. Everything else is measured against it."},"electronic":{"displayName":"Vex Series-E","muzzleVelocity":124.0,"dragK":0.0125,"roundsPerMinute":780,"autoFire":true,"firstShotSpreadDeg":0.5,"sustainedSpreadDeg":2.6,"spreadGrowthPerShotDeg":0.19,"spreadDecayPerSecondDeg":1.6,"movingSpreadMultiplier":2.1,"sprintingSpreadMultiplier":9.0,"crouchSpreadMultiplier":0.78,"hopperCapacity":220,"reloadSeconds":2.9,"loudness":1.0,"payoutMultiplier":0.85,"cost":4200,"blurb":"Board-fed, force-fed, obnoxiously loud. Wins the room. Loses the treeline."},"pump":{"displayName":"Cardinal Pump","muzzleVelocity":148.0,"dragK":0.01,"roundsPerMinute":95,"autoFire":false,"firstShotSpreadDeg":0.12,"sustainedSpreadDeg":0.12,"spreadGrowthPerShotDeg":0.0,"spreadDecayPerSecondDeg":0.0,"movingSpreadMultiplier":2.9,"sprintingSpreadMultiplier":12.0,"crouchSpreadMultiplier":0.62,"hopperCapacity":60,"reloadSeconds":3.4,"loudness":0.35,"payoutMultiplier":1.75,"cost":7500,"blurb":"One ball, one cycle, one chance. Flattest arc on the field. Punishes every single thing you get wrong."}},"ballistics":{"gravity":9.81,"fixedStep":0.0166666667,"maxFlightTime":4.0,"maxRangeMetres":140.0,"hitbox":{"bodyWidthMetres":0.62,"bodyHeightMetres":1.8,"headTopMetres":1.75,"chestHeightMetres":1.32},"leadIterations":4},"tiers":[{"id":"rec","displayName":"Rec Ballers","marker":"mechanical","reactionTimeMs":450,"reactionJitterMs":140,"aimErrorDeg":4.0,"leadSolutionAccuracy":0.4,"leadJitter":0.22,"timeToSettleMs":600,"crosshairPrePlacement":0.0,"peekDiscipline":0.15,"burstLengthMin":2,"burstLengthMax":7,"burstRestMs":520,"repositionChance":0.15,"focusFireChance":0.05,"coordinationLevel":0.05,"hearingRadiusMetres":26,"visionRangeMetres":55,"visionConeDeg":105,"payoutMultiplier":1.0},{"id":"amateur","displayName":"Local League","marker":"mechanical","reactionTimeMs":320,"reactionJitterMs":95,"aimErrorDeg":2.4,"leadSolutionAccuracy":0.65,"leadJitter":0.16,"timeToSettleMs":400,"crosshairPrePlacement":0.35,"peekDiscipline":0.4,"burstLengthMin":2,"burstLengthMax":6,"burstRestMs":400,"repositionChance":0.32,"focusFireChance":0.3,"coordinationLevel":0.35,"hearingRadiusMetres":32,"visionRangeMetres":65,"visionConeDeg":110,"payoutMultiplier":1.6},{"id":"semipro","displayName":"Regional Semi-Pro","marker":"electronic","reactionTimeMs":230,"reactionJitterMs":60,"aimErrorDeg":1.3,"leadSolutionAccuracy":0.85,"leadJitter":0.09,"timeToSettleMs":260,"crosshairPrePlacement":0.7,"peekDiscipline":0.7,"burstLengthMin":3,"burstLengthMax":6,"burstRestMs":300,"repositionChance":0.5,"focusFireChance":0.6,"coordinationLevel":0.7,"hearingRadiusMetres":38,"visionRangeMetres":78,"visionConeDeg":115,"payoutMultiplier":2.6},{"id":"pro","displayName":"Pro Circuit","marker":"electronic","reactionTimeMs":170,"reactionJitterMs":35,"aimErrorDeg":0.6,"leadSolutionAccuracy":0.96,"leadJitter":0.05,"timeToSettleMs":180,"crosshairPrePlacement":0.95,"peekDiscipline":0.92,"burstLengthMin":3,"burstLengthMax":5,"burstRestMs":240,"repositionChance":0.68,"focusFireChance":0.85,"coordinationLevel":0.95,"hearingRadiusMetres":44,"visionRangeMetres":90,"visionConeDeg":120,"payoutMultiplier":4.2}],"squad":{"size":6,"roles":{"anchor":{"count":2,"holdsAngle":true,"advanceChance":0.05,"preferredRangeMetres":[18,45]},"flanker":{"count":2,"holdsAngle":false,"advanceChance":0.55,"preferredRangeMetres":[8,26]},"pressure":{"count":2,"holdsAngle":false,"advanceChance":0.35,"preferredRangeMetres":[12,32]}},"crossfireMinSeparationDeg":55,"crossfireRewardWeight":1.4,"focusFireWindowSeconds":2.5,"contactShareRadiusMetres":100,"contactShareDelayMs":{"rec":2200,"amateur":1100,"semipro":500,"pro":220}},"movement":{"walkSpeedMps":3.4,"sprintSpeedMps":6.0,"crouchSpeedMps":1.9,"peekDwellSeconds":{"min":0.55,"max":2.4},"repositionCooldownSeconds":4.0,"stopToShootDelayMs":120},"morale":{"thresholds":[{"atLeast":6,"state":"cocky"},{"atLeast":5,"state":"cocky"},{"atLeast":4,"state":"rattled"},{"atLeast":3,"state":"blaming"},{"atLeast":2,"state":"blaming"},{"atLeast":1,"state":"broken"}],"aimErrorPenaltyByState":{"cocky":1.0,"rattled":1.06,"blaming":1.14,"broken":1.25}},"match":{"rounds":{"count":5,"intermissionSeconds":7,"roundTimeLimitSeconds":200,"schedule":[{"round":1,"bots":4,"tierOffset":0,"payoutMultiplier":0.5},{"round":2,"bots":6,"tierOffset":0,"payoutMultiplier":0.7},{"round":3,"bots":8,"tierOffset":0,"payoutMultiplier":1.0},{"round":4,"bots":10,"tierOffset":1,"payoutMultiplier":1.4},{"round":5,"bots":12,"tierOffset":1,"payoutMultiplier":2.0}]},"respawnDelaySeconds":2.5,"warmupSeconds":3.0,"player":{"walkSpeedMps":4.2,"sprintSpeedMps":6.4,"crouchSpeedMps":2.1,"slideSpeedMps":7.6,"slideDurationSeconds":0.55,"slideCooldownSeconds":1.6,"leanOffsetMetres":0.55,"leanSpeed":6.0,"eyeHeightMetres":1.62,"crouchEyeHeightMetres":1.05,"fieldOfViewDeg":78,"sprintToFireRecoverySeconds":0.28},"melee":{"rangeMetres":2.4,"reachHeightMetres":2.0,"arcDegrees":110,"cooldownSeconds":1.0,"swingSeconds":0.45,"contactFraction":0.38},"respawn":{"unlimited":true,"invulnerabilitySeconds":1.0,"spawnAwayFromBotsMetres":16}},"economy":{"currency":{"name":"Field Fees","short":"FF"},"basePayout":220,"deathPenalty":{"decay":0.26,"floor":0.06},"accuracyBonus":{"threshold":0.18,"gain":0.85,"minShotsToQualify":12},"streakBonus":{"perElimination":0.04,"max":0.3},"flawlessBonus":1.5},"map":{"id":"speedball","displayName":"Speedball","teaches":["reactivity","flicking","targetSwitching"],"bounds":{"widthMetres":34,"lengthMetres":55,"heightMetres":9},"wallHeight":7,"engagementBand":{"minMetres":5,"targetMedianMetres":16,"maxMetres":34,"postureBias":{"range":1.0,"advance":1.0}},"volumes":[{"id":"centreBall","shape":"ball","x":0,"z":0,"hx":1.6,"hz":1.6,"top":3.15,"rot":0.785398,"color":"bunkerC"},{"id":"can_mid","shape":"can","x":8.5,"z":-6,"hx":1.0,"hz":1.0,"top":3.0,"rot":0.0,"color":"bunkerB"},{"id":"can_mid_mx","shape":"can","x":-8.5,"z":-6,"hx":1.0,"hz":1.0,"top":3.0,"rot":-0.0,"color":"bunkerB"},{"id":"can_mid_mz","shape":"can","x":8.5,"z":6,"hx":1.0,"hz":1.0,"top":3.0,"rot":-0.0,"color":"bunkerB"},{"id":"can_mid_mx_mz","shape":"can","x":-8.5,"z":6,"hx":1.0,"hz":1.0,"top":3.0,"rot":0.0,"color":"bunkerB"},{"id":"dorito_mid","shape":"dorito","x":3.5,"z":-11,"hx":1.3,"hz":1.3,"top":2.2,"rot":3.141593,"color":"bunkerA"},{"id":"dorito_mid_mx","shape":"dorito","x":-3.5,"z":-11,"hx":1.3,"hz":1.3,"top":2.2,"rot":-3.141593,"color":"bunkerA"},{"id":"dorito_mid_mz","shape":"dorito","x":3.5,"z":11,"hx":1.3,"hz":1.3,"top":2.2,"rot":-3.141593,"color":"bunkerA"},{"id":"dorito_mid_mx_mz","shape":"dorito","x":-3.5,"z":11,"hx":1.3,"hz":1.3,"top":2.2,"rot":3.141593,"color":"bunkerA"},{"id":"dorito_out","shape":"dorito","x":12.0,"z":-15,"hx":1.4,"hz":1.4,"top":2.2,"rot":3.141593,"color":"bunkerA"},{"id":"dorito_out_mx","shape":"dorito","x":-12.0,"z":-15,"hx":1.4,"hz":1.4,"top":2.2,"rot":-3.141593,"color":"bunkerA"},{"id":"dorito_out_mz","shape":"dorito","x":12.0,"z":15,"hx":1.4,"hz":1.4,"top":2.2,"rot":-3.141593,"color":"bunkerA"},{"id":"dorito_out_mx_mz","shape":"dorito","x":-12.0,"z":15,"hx":1.4,"hz":1.4,"top":2.2,"rot":3.141593,"color":"bunkerA"},{"id":"snake_a","shape":"snake","x":-13.5,"z":-19,"hx":2.75,"hz":0.7,"top":1.3,"rot":0.0,"color":"bunkerB"},{"id":"snake_a_mz","shape":"snake","x":-13.5,"z":19,"hx":2.75,"hz":0.7,"top":1.3,"rot":-0.0,"color":"bunkerB"},{"id":"snake_b","shape":"snake","x":-13.5,"z":-12,"hx":2.75,"hz":0.7,"top":1.3,"rot":0.0,"color":"bunkerB"},{"id":"snake_b_mz","shape":"snake","x":-13.5,"z":12,"hx":2.75,"hz":0.7,"top":1.3,"rot":-0.0,"color":"bunkerB"},{"id":"snake_c","shape":"snake","x":-13.5,"z":-5,"hx":2.75,"hz":0.7,"top":1.3,"rot":0.0,"color":"bunkerB"},{"id":"snake_c_mz","shape":"snake","x":-13.5,"z":5,"hx":2.75,"hz":0.7,"top":1.3,"rot":-0.0,"color":"bunkerB"},{"id":"snake_knuckle","shape":"can","x":-11.0,"z":-8.5,"hx":0.8,"hz":0.8,"top":2.4,"rot":0.0,"color":"bunkerC"},{"id":"snake_knuckle_mz","shape":"can","x":-11.0,"z":8.5,"hx":0.8,"hz":0.8,"top":2.4,"rot":-0.0,"color":"bunkerC"},{"id":"can_home","shape":"can","x":5.0,"z":-21,"hx":1.0,"hz":1.0,"top":3.0,"rot":0.0,"color":"bunkerB"},{"id":"can_home_mx","shape":"can","x":-5.0,"z":-21,"hx":1.0,"hz":1.0,"top":3.0,"rot":-0.0,"color":"bunkerB"},{"id":"can_home_mz","shape":"can","x":5.0,"z":21,"hx":1.0,"hz":1.0,"top":3.0,"rot":-0.0,"color":"bunkerB"},{"id":"can_home_mx_mz","shape":"can","x":-5.0,"z":21,"hx":1.0,"hz":1.0,"top":3.0,"rot":0.0,"color":"bunkerB"},{"id":"cornerStandup","shape":"standup","x":15.0,"z":-24,"hx":1.35,"hz":0.5,"top":2.8,"rot":0.523599,"color":"bunkerC"},{"id":"cornerStandup_mx","shape":"standup","x":-15.0,"z":-24,"hx":1.35,"hz":0.5,"top":2.8,"rot":-0.523599,"color":"bunkerC"},{"id":"cornerStandup_mz","shape":"standup","x":15.0,"z":24,"hx":1.35,"hz":0.5,"top":2.8,"rot":-0.523599,"color":"bunkerC"},{"id":"cornerStandup_mx_mz","shape":"standup","x":-15.0,"z":24,"hx":1.35,"hz":0.5,"top":2.8,"rot":0.523599,"color":"bunkerC"},{"id":"beam_low","shape":"brick","x":0,"z":-17,"hx":3.5,"hz":0.6,"top":1.2,"rot":0.0,"color":"bunkerA"},{"id":"beam_low_mz","shape":"brick","x":0,"z":17,"hx":3.5,"hz":0.6,"top":1.2,"rot":-0.0,"color":"bunkerA"}],"playerSpawn":[0,-25.5],"playerRespawns":[[0,-25.5],[-12,-24.0],[12,-24.0]],"botSpawns":[[0,25.5],[-6,24.5],[6,24.5],[-13,23.0],[13,23.0],[0,21.0]],"anchors":[{"id":"an_centreBall_far","x":1.8,"z":2.6,"faces":[0,-1],"roles":["anchor","pressure"]},{"id":"an_can_l","x":-8.5,"z":6.6,"faces":[0.2,-1],"roles":["anchor"]},{"id":"an_can_r","x":8.5,"z":6.6,"faces":[-0.2,-1],"roles":["anchor"]},{"id":"an_dorito_l","x":-3.5,"z":11.6,"faces":[0,-1],"roles":["pressure"]},{"id":"an_dorito_r","x":3.5,"z":11.6,"faces":[0,-1],"roles":["pressure"]},{"id":"an_snake_far","x":-13.5,"z":12.0,"faces":[0.3,-1],"roles":["flanker"]},{"id":"an_snake_mid","x":-13.5,"z":5.0,"faces":[0.4,-1],"roles":["flanker"]},{"id":"an_snake_near","x":-13.5,"z":-5.0,"faces":[0.6,-1],"roles":["flanker"]},{"id":"an_cornerStandup_l","x":-15.0,"z":24.0,"faces":[0.4,-1],"roles":["anchor"]},{"id":"an_cornerStandup_r","x":15.0,"z":24.0,"faces":[-0.4,-1],"roles":["anchor"]},{"id":"an_wide_r","x":12.0,"z":15.6,"faces":[-0.3,-1],"roles":["flanker","pressure"]},{"id":"an_wide_r_push","x":13.5,"z":2.0,"faces":[-0.5,-1],"roles":["flanker"]},{"id":"an_beam_far","x":0,"z":17.8,"faces":[0,-1],"roles":["pressure"]},{"id":"an_centreBall_near","x":-1.8,"z":-2.6,"faces":[0,-1],"roles":["pressure"]}],"navNodes":[[0,24],[-8,22],[8,22],[-14.36,21.89],[14.36,21.89],[0,18.45],[-12,17.25],[12,17.25],[-3.5,13.15],[3.5,13.15],[-13.5,13.55],[13.5,11],[-8.5,7.85],[8.5,7.85],[0,5],[-13.5,6.55],[13.5,4],[-4.5,0],[4.5,0],[0,3],[0,-3],[-13.5,-3.45],[13.5,-5],[-8.5,-7.85],[8.5,-7.85],[-3.5,-13.15],[3.5,-13.15],[0,-10],[-12,-17.25],[12,-17.25],[0,-18.45],[-14.36,-21.89],[14.36,-21.89],[0,-24],[-8,-22],[8,-22],[-13.5,-13.55],[13.5,13.55],[13.5,-13.55],[13.5,-11],[-13.5,11],[-13.5,-11],[0,-5],[-13.5,-6.55],[13.5,6.55],[13.5,-6.55],[13.5,-4],[-13.5,4],[-13.5,-4],[-13.5,3.45],[13.5,-3.45],[13.5,3.45],[13.5,5],[-13.5,-3.45],[-13.5,6.55],[0,10]],"watch":{"an_can_l":[0,-8],"an_can_r":[0,-8],"an_cornerStandup_l":[-13.5,0],"an_cornerStandup_r":[13.5,0],"an_centreBall_far":[0,-10]},"nav":{"linkRadius":14,"agentRadius":0.6,"probeHeight":1.1}},"colors":{"ground":[96,128,82],"bunkerA":[232,86,70],"bunkerB":[42,128,190],"bunkerC":[246,190,62],"netting":[38,44,52],"cream":[238,231,207],"ink":[28,38,44],"teal":[44,161,156],"amber":[221,168,74],"turf":[86,119,75],"bone":[224,214,196]},"chatter":{"roster":["Denny","Marcus","Oz","Reggie","Priya","Tuck","Brooks","Sal","Wheels","Coach","Junior","Big Mike"],"cooldownSeconds":{"min":3.5,"max":9.0},"maxLinesPerMinute":11,"banks":{"matchStart":["Alright, six on one. Try to make it last, would you?","Somebody actually paid to play against us today. Bless them.","New meat. {name}, you're on the snake, don't embarrass us.","Just one? Cool. Cool cool cool. Everybody go easy, we're on the clock.","One player. Six of us. {name}, do not make this interesting.","Junior says we should 'let them cook.' Junior, they are one person.","Everyone remember we're being watched. Somebody's paying for this.","Six on one. If this goes badly I'm walking into the pond.","{name} says he had a read on this. {name} has never had a read on anything.","Look alive. Or don't. It's a Tuesday."],"cocky":{"playerEliminated":["And that's the field. Thanks for coming out.","Ohhh, that was a nice one. That was a nice one.","Walk it off! Walk it off, you're fine!","That's just paint. You're fine. You're a little yellow, but you're fine.","Junior wants me to say they got 'cooked.' They got eliminated. Same thing. Grow up.","Respawn's that way. Take your time, we'll wait.","Somebody get their aura back for them, it fell off over here.","That is going in the group chat."],"botEliminated":["{name}'s out? {name}'s OUT? To that guy?","Okay, that's one. That's allowed. That's within tolerance.","Everybody stop laughing at {name}, he's had a long week.","{name} is fine. {name} is walking. {name} is walking very slowly.","One. Out of six. Statistically that's nothing. Statistically.","{name} says he 'let' them have it. Sure, {name}."],"taunt":["Take your time back there. We're not going anywhere.","I can hear your hopper. I can literally hear your hopper.","Anyone got eyes? No? Then they're hiding. They're hiding, everyone relax.","You know we can just wait, right? We have snacks. We brought snacks.","Junior, if you say 'holding this angle is crazy' one more time.","This is the most relaxed I have been all week and I want you to know that.","I'm not even aiming. I want that on the record. I'm not even aiming."]},"rattled":{"playerEliminated":["There. THERE. Okay. We're fine. We were always fine.","Got 'em. Everybody reset. Everybody reset, please.","Okay that took way too long and we all know it.","That's a hit. That counts. Don't look at how long it took.","Fine. Fine! We're fine. Junior, stop typing.","See? Six on one. Working as intended. Working perfectly."],"botEliminated":["That's two. That's two, and I don't love it.","{name}? Are you serious? You were BEHIND cover.","Down to {alive}. Tighten up. Tighten up!","{name} is out and I watched it happen and I still don't understand it.","Two. Two of us. Against the one. Say it out loud, it sounds worse.","Junior says we're 'so cooked.' Junior, speak English. ...but also yes."],"taunt":["Nobody peek. Nobody peek until we know where they are.","Does anyone have eyes on? Anyone? Hello?","I'm not scared, I'm being tactical. There's a difference.","Why is it quiet. I don't like when it's quiet.","Everyone stay calm. I am extremely calm. Look at me being calm.","Has anybody actually seen them, or are we all just guessing."]},"blaming":{"playerEliminated":["Oh NOW we hit something. Now. After all that.","Great. Fantastic. They respawn, by the way. That's how this works.","One. That's one. We need \u2014 how many is it? We need a lot.","Congratulations to whoever that was. Genuinely. Well done. Amazing.","That changes nothing and I want everybody to understand that."],"botEliminated":["{name}, that was YOUR angle. That was your one job.","Three of us. Three. Against one. I want that on the record.","Who let them get the high ground? Somebody let them get the high ground.","{name} is out. {name}. The one who does this every week.","I would like to formally say that I called this.","We are down to {alive} and Junior is still typing."],"taunt":["I'm not moving. You move. You've been on that bunker all game.","Whose idea was the six-on-one? Whose idea? I'd like a name.","We're getting picked apart by one guy and we're arguing about snacks.","Nobody is communicating. I'm communicating. I'm the only one communicating.","This is a team sport. Allegedly. Reportedly.","I pay for this. I want everyone to sit with that."]},"broken":{"playerEliminated":["...okay. Okay, one. One is something.","Cool. Now do it five more times, me.","Was anyone watching that? Anyone? No?","I got one. I got one and there's nobody left to tell."],"botEliminated":["It's just me.","...guys?","Right. Yeah. Of course.","So that's everyone. That's the whole team. Okay.","Junior's out. He'd have had a word for this."],"taunt":["I'm going to be honest with you, I've stopped trying to win.","You could just let me have this one. As a person.","I've been standing behind this bunker for a very long time.","My mother thinks I have a job.","I am thirty-four years old and I am hiding behind an inflatable.","Do you ever think about how we chose this? On purpose?","There's a sandwich in the truck. I'm thinking about the sandwich.","If you walk away right now we can both pretend this didn't happen.","I'd like to go home. Not in a sad way. Just, generally."]}},"roundStart":["Alright, {name}'s in. Round two. Try harder.","Reinforcements. Because apparently we need reinforcements.","Fresh legs. Fresh opinions. Same result, probably.","{name} is here now. {name} has thoughts. Nobody asked.","More of us this time. That has always worked before."],"roundWon":["That's the round. Everybody breathe.","Round's ours. Barely. Don't clap.","We won. Nobody look at how.","That's a round. Junior, you may speak."],"squadWipe":["All of us. That's all of us.","Okay so that's the entire team, then.","Nobody say anything. Nobody say one word.","We'll be reviewing that. At length. Forever."],"flawlessWipe":["...did they get hit once? Did they get hit even once?","I'd like to speak to whoever let them in the building.","Not one. Not a single one of us touched them.","Junior. Junior, what's the word. What's the word for this.","I want to be very clear that I did my best."],"callouts":{"contact":["Contact! {bearing}!","Eyes on, {bearing}!","There! {bearing}, moving!","I see 'em \u2014 {bearing}!"],"lostContact":["Lost 'em.","They broke off. Watch your side.","Gone. Everybody hold."],"reloading":["Reloading, cover me!","Dry! I'm dry!","Hopper's out, gimme a second."],"flanking":["Going wide, hold the front.","I'm rotating {bearing}.","Coming around. Don't shoot me, {name}."],"focusFire":["Everybody on them! Now!","Focus! Focus, they're pinned!","Right there, all of you, RIGHT THERE!"],"crossfire":["Crossfire's set. Make them move.","We've got both angles. Squeeze it.","They're boxed. Don't let them reset."],"melee":["Get off me! GET OFF -- okay you're out, walk it off.","Tank to the ribs. That's a hit. That's a legal hit.","You walked into ME. Genuinely, at some point that's on you.","Shoved. You're out. Do not tell {name} how that happened.","I didn't even shoot you. I want that on the record.","Skill issue, respectfully."]}},"gauntlet":{"displayName":"Gauntlet","subtitle":"Five rounds. The field fills up.","blurb":"Four of them, then six, eight, ten, twelve. Better players for the last two. Clear all five or the match ends where you stopped.","unlockRequires":null,"maps":["speedball","urban","woods","dustline"],"rules":"match.rounds","leaderboard":"time","integrated":true}};

  const W = 800, H = 450, DT = 1 / 60, DEG = Math.PI / 180;
  const MAP = DATA.map, PL = DATA.match.player, BAL = DATA.ballistics, HB = BAL.hitbox;
  const HALF_W = MAP.bounds.widthMetres / 2, HALF_L = MAP.bounds.lengthMetres / 2;
  const BODY_R = HB.bodyWidthMetres / 2;                 // 0.31 m: the hitbox and the body
  const BOT_EYE = HB.headTopMetres * 0.94, BOT_AIM = HB.chestHeightMetres;
  const CROUCH_H = 1.25, CROUCH_AIM = 0.85;              // a crouched body is shorter, and so is its chest
  const MARKER_ORDER = ['mechanical', 'electronic', 'pump'];
  const SENS = 0.0022;                                   // radians of turn per pixel of mouse movement
  const NEVER = -1e9;                                    // "long ago", finite so the state stays JSON

  // --- randomness: every draw comes from a seed kept in the state ----------------
  function rand(o, key) {                                // mulberry32
    let t = (o[key] = (o[key] + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function gauss(o, key) {                               // Box-Muller, as the Roblox Rng does
    const u = Math.max(1e-12, rand(o, key)), v = rand(o, key);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  const randInt = (o, key, a, b) => a + Math.floor(rand(o, key) * (b - a + 1));
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // --- vectors -------------------------------------------------------------------
  const v3 = (x, y, z) => ({ x, y, z });
  const add = (a, b) => v3(a.x + b.x, a.y + b.y, a.z + b.z);
  const sub = (a, b) => v3(a.x - b.x, a.y - b.y, a.z - b.z);
  const mul = (a, k) => v3(a.x * k, a.y * k, a.z * k);
  const len = (a) => Math.hypot(a.x, a.y, a.z);
  const unit = (a) => { const l = len(a) || 1; return v3(a.x / l, a.y / l, a.z / l); };
  const lerp3 = (a, b, t) => v3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
  const cross = (a, b) => v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
  const dirOf = (yaw, pitch) => v3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));

  // --- ballistics: Shared/Ballistics.luau, in metres and seconds -----------------
  // Quadratic drag linearised along the path, v(s) = v0 e^(-ks), with the closed-form drop
  // the Roblox authors fitted to their RK4 flight: under 1% error where naive g t^2/2 is 20% out.
  const specOf = (name) => { const m = DATA.markers[name]; return { v0: m.muzzleVelocity, k: m.dragK, g: BAL.gravity }; };
  function timeOfFlight(sp, s) {
    if (s <= 0) return 0;
    return sp.k < 1e-9 ? s / sp.v0 : (Math.exp(sp.k * s) - 1) / (sp.k * sp.v0);
  }
  function dropAt(sp, s) {
    const t = timeOfFlight(sp, s), u = sp.k * s;
    return u < 1e-6 ? 0.5 * sp.g * t * t : (sp.g * t * t / u) * (1 - (1 - Math.exp(-u)) / u);
  }
  // Launch direction through `target`: raise the aim point by the drop, re-measure, repeat.
  function aimDirection(sp, o, target) {
    let aim = target;
    for (let i = 0; i < BAL.leadIterations; i++) {
      const s = len(sub(aim, o));
      if (s < 1e-9 || sp.k * s >= 30) return null;       // beyond this there is no solution
      aim = v3(target.x, target.y + dropAt(sp, s), target.z);
    }
    const d = sub(aim, o);
    return len(d) < 1e-9 ? null : unit(d);
  }
  // Where to put the crosshair on a moving target: iterate time of flight against its
  // projected position, then lift for drop. The bots run this scaled by their skill.
  function solveLead(sp, o, tp, tv) {
    let t = len(sub(tp, o)) / sp.v0;
    for (let i = 0; i < BAL.leadIterations; i++) {
      const s = len(sub(add(tp, mul(tv, t)), o));
      if (sp.k * s >= 30) return null;
      t = timeOfFlight(sp, s);
    }
    const intercept = add(tp, mul(tv, t));
    const dir = aimDirection(sp, o, intercept);
    return dir ? add(o, mul(dir, len(sub(intercept, o)))) : null;
  }
  // The authoritative flight: one RK4 step of a = -k|v|v - g.
  function accel(vx, vy, vz, sp) {
    const s = Math.hypot(vx, vy, vz);
    return [-sp.k * s * vx, -sp.k * s * vy - sp.g, -sp.k * s * vz];
  }
  function rk4(b, sp, dt) {
    const a1 = accel(b.vx, b.vy, b.vz, sp);
    const v2 = [b.vx + a1[0] * dt / 2, b.vy + a1[1] * dt / 2, b.vz + a1[2] * dt / 2], a2 = accel(v2[0], v2[1], v2[2], sp);
    const v3_ = [b.vx + a2[0] * dt / 2, b.vy + a2[1] * dt / 2, b.vz + a2[2] * dt / 2], a3 = accel(v3_[0], v3_[1], v3_[2], sp);
    const v4 = [b.vx + a3[0] * dt, b.vy + a3[1] * dt, b.vz + a3[2] * dt], a4 = accel(v4[0], v4[1], v4[2], sp);
    b.x += (b.vx + 2 * v2[0] + 2 * v3_[0] + v4[0]) * dt / 6;
    b.y += (b.vy + 2 * v2[1] + 2 * v3_[1] + v4[1]) * dt / 6;
    b.z += (b.vz + 2 * v2[2] + 2 * v3_[2] + v4[2]) * dt / 6;
    b.vx += (a1[0] + 2 * a2[0] + 2 * a3[0] + a4[0]) * dt / 6;
    b.vy += (a1[1] + 2 * a2[1] + 2 * a3[1] + a4[1]) * dt / 6;
    b.vz += (a1[2] + 2 * a2[2] + 2 * a3[2] + a4[2]) * dt / 6;
  }
  // AimModel.rotate: turn a direction by yaw then pitch, in degrees, from an explicit basis.
  function rotateDir(d, yawDeg, pitchDeg) {
    const f = unit(d), up = Math.abs(f.y) > 0.99 ? v3(1, 0, 0) : v3(0, 1, 0);
    const r = unit(cross(f, up)), u = cross(r, f);
    const ya = yawDeg * DEG, pa = pitchDeg * DEG, cp = Math.cos(pa);
    return unit(add(add(mul(f, Math.cos(ya) * cp), mul(r, Math.sin(ya) * cp)), mul(u, Math.sin(pa))));
  }

  // --- the field: every bunker is one oriented box, for movement, sight and paint alike ---
  // (Shared/MapGeometry.luau: "player collision, bot line-of-sight and projectile blocking
  // are all the same shape"). The mirrored copies are already resolved in DATA.
  const VOL = MAP.volumes.map((v, i) => Object.assign({ i, c: Math.cos(v.rot), s: Math.sin(v.rot), R: Math.hypot(v.hx, v.hz) }, v));
  const toLocalX = (v, x, z) => (x - v.x) * v.c - (z - v.z) * v.s;
  const toLocalZ = (v, x, z) => (x - v.x) * v.s + (z - v.z) * v.c;
  const toWorld = (v, lx, lz) => [v.x + lx * v.c + lz * v.s, v.z - lx * v.s + lz * v.c];
  // Distance squared from a point to a segment, for the cheap reject before a box test.
  function segDist2(x0, z0, x1, z1, px, pz) {
    const dx = x1 - x0, dz = z1 - z0, l2 = dx * dx + dz * dz;
    const t = l2 > 0 ? clamp(((px - x0) * dx + (pz - z0) * dz) / l2, 0, 1) : 0;
    const qx = x0 + dx * t - px, qz = z0 + dz * t - pz;
    return qx * qx + qz * qz;
  }
  // Where the segment is inside the box's footprint, as [tIn, tOut] on 0..1, or null.
  function segBox(v, x0, z0, x1, z1, pad) {
    const ax = toLocalX(v, x0, z0), az = toLocalZ(v, x0, z0), bx = toLocalX(v, x1, z1), bz = toLocalZ(v, x1, z1);
    const hx = v.hx + pad, hz = v.hz + pad, dx = bx - ax, dz = bz - az;
    let t0 = 0, t1 = 1;
    if (Math.abs(dx) < 1e-12) { if (ax < -hx || ax > hx) return null; }
    else { let p = (-hx - ax) / dx, q = (hx - ax) / dx; if (p > q) { const w = p; p = q; q = w; } t0 = Math.max(t0, p); t1 = Math.min(t1, q); if (t0 > t1) return null; }
    if (Math.abs(dz) < 1e-12) { if (az < -hz || az > hz) return null; }
    else { let p = (-hz - az) / dz, q = (hz - az) / dz; if (p > q) { const w = p; p = q; q = w; } t0 = Math.max(t0, p); t1 = Math.min(t1, q); if (t0 > t1) return null; }
    return [t0, t1];
  }
  // Segment against a sphere and an upright cylinder, as fractions on 0..1 (or -1).
  function segSphere(x0, y0, z0, x1, y1, z1, cx, cy, cz, r) {
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0, fx = x0 - cx, fy = y0 - cy, fz = z0 - cz;
    const a = dx * dx + dy * dy + dz * dz, b = 2 * (fx * dx + fy * dy + fz * dz), c = fx * fx + fy * fy + fz * fz - r * r;
    if (c <= 0) return 0;
    const disc = b * b - 4 * a * c;
    if (a < 1e-12 || disc < 0) return -1;
    const t = (-b - Math.sqrt(disc)) / (2 * a);
    return t >= 0 && t <= 1 ? t : -1;
  }
  function segCylinder(x0, y0, z0, x1, y1, z1, cx, cz, r, h) {
    const dx = x1 - x0, dz = z1 - z0, fx = x0 - cx, fz = z0 - cz;
    const a = dx * dx + dz * dz, b = 2 * (fx * dx + fz * dz), c = fx * fx + fz * fz - r * r;
    if (a < 1e-12) return c <= 0 && y0 >= 0 && y0 <= h ? 0 : -1;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return -1;
    const sq = Math.sqrt(disc), t1 = (-b - sq) / (2 * a), t2 = (-b + sq) / (2 * a);
    if (t2 < 0 || t1 > 1) return -1;
    const ta = Math.max(0, t1), tb = Math.min(1, t2), ya = y0 + (y1 - y0) * ta, yb = y0 + (y1 - y0) * tb;
    if (ya >= 0 && ya <= h) return ta;
    if (ya > h && yb <= h) return ta + ((ya - h) / (ya - yb)) * (tb - ta);   // dropping in through the top
    return -1;
  }
  // The first bunker a 3D segment enters, as [fraction, volume index], or [-1, -1]. Cans are
  // cylinders and the centre ball a sphere; everything else is its box, below its top. A low
  // snake stops a crouched shot and lets a standing one sail over it.
  function firstHit(x0, y0, z0, x1, y1, z1) {
    let best = 2, bi = -1;
    for (const v of VOL) {
      if (segDist2(x0, z0, x1, z1, v.x, v.z) > v.R * v.R) continue;
      let t;
      if (v.shape === 'can') t = segCylinder(x0, y0, z0, x1, y1, z1, v.x, v.z, v.hx, v.top);
      else if (v.shape === 'ball') t = segSphere(x0, y0, z0, x1, y1, z1, v.x, v.top / 2, v.z, v.top / 2);
      else {
        const iv = segBox(v, x0, z0, x1, z1, 0);
        if (!iv) continue;
        const ya = y0 + (y1 - y0) * iv[0], yb = y0 + (y1 - y0) * iv[1];
        if (Math.min(ya, yb) >= v.top) continue;
        t = ya >= v.top ? iv[0] + ((ya - v.top) / (ya - yb)) * (iv[1] - iv[0]) : iv[0];
      }
      if (t >= 0 && t < best) { best = t; bi = v.i; }
    }
    return best <= 1 ? [best, bi] : [-1, -1];
  }
  const hasLOS = (a, b) => firstHit(a.x, a.y, a.z, b.x, b.y, b.z)[0] < 0;
  // Which way the surface faces where paint landed on a bunker.
  function normalAt(v, x, y, z) {
    if (v.shape === 'can') return y >= v.top - 0.02 ? v3(0, 1, 0) : unit(v3(x - v.x, 0, z - v.z));
    if (v.shape === 'ball') return unit(v3(x - v.x, y - v.top / 2, z - v.z));
    const lx = toLocalX(v, x, z), lz = toLocalZ(v, x, z);
    if (y >= v.top - 0.03) return v3(0, 1, 0);
    if (Math.abs(lx) / v.hx > Math.abs(lz) / v.hz) { const s = Math.sign(lx) || 1; return v3(v.c * s, 0, v.s * s); }
    const s = Math.sign(lz) || 1;
    return v3(-v.s * s, 0, v.c * s);
  }

  // Push a round body out of every bunker and keep it inside the netting.
  function resolveBody(e, r) {
    for (let pass = 0; pass < 2; pass++) {
      for (const v of VOL) {
        if ((e.x - v.x) ** 2 + (e.z - v.z) ** 2 > (v.R + r) ** 2) continue;
        const lx = toLocalX(v, e.x, e.z), lz = toLocalZ(v, e.x, e.z);
        const cx = clamp(lx, -v.hx, v.hx), cz = clamp(lz, -v.hz, v.hz);
        let nx = lx - cx, nz = lz - cz, d = Math.hypot(nx, nz);
        if (d >= r) continue;
        if (d < 1e-9) {                                     // centre inside the box: leave by the nearest face
          const ex = v.hx - Math.abs(lx), ez = v.hz - Math.abs(lz);
          if (ex < ez) { nx = Math.sign(lx) || 1; nz = 0; d = -ex; } else { nx = 0; nz = Math.sign(lz) || 1; d = -ez; }
        } else { nx /= d; nz /= d; }
        const push = r - d, w = toWorld(v, lx + nx * push, lz + nz * push);
        e.x = w[0]; e.z = w[1];
      }
    }
    e.x = clamp(e.x, -HALF_W + r, HALF_W - r);
    e.z = clamp(e.z, -HALF_L + r, HALF_L - r);
  }

  // --- navigation: MapGeometry.buildNav. Nodes within linkRadius are linked when a thin
  // probe at walking height clears every bunker, ignoring bunkers that contain either end
  // ("a node may legitimately sit hard against cover -- that is what a bunker position IS").
  const NAV_NODES = MAP.navNodes;
  const NAV = (() => {
    const n = NAV_NODES.length, edges = NAV_NODES.map(() => []), h = MAP.nav.probeHeight;
    const inside = NAV_NODES.map(([x, z]) => VOL.filter((v) => h < v.top && Math.abs(toLocalX(v, x, z)) <= v.hx && Math.abs(toLocalZ(v, x, z)) <= v.hz).map((v) => v.i));
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const [x0, z0] = NAV_NODES[i], [x1, z1] = NAV_NODES[j];
      if (Math.hypot(x1 - x0, z1 - z0) > MAP.nav.linkRadius) continue;
      let blocked = false;
      for (const v of VOL) {
        if (v.top <= h || inside[i].includes(v.i) || inside[j].includes(v.i)) continue;
        if (segDist2(x0, z0, x1, z1, v.x, v.z) > v.R * v.R) continue;
        if (segBox(v, x0, z0, x1, z1, 0)) { blocked = true; break; }
      }
      if (!blocked) { edges[i].push(j); edges[j].push(i); }
    }
    return edges;
  })();
  function nearestNode(x, z) {
    let best = 0, bd = 1e18;
    NAV_NODES.forEach(([nx, nz], i) => { const d = (nx - x) ** 2 + (nz - z) ** 2; if (d < bd) { bd = d; best = i; } });
    return best;
  }
  // A* over the nav graph, with ties broken by index so a path is the same every run.
  function findPath(from, to) {
    if (from === to) return [to];
    const g = { [from]: 0 }, came = {}, open = [from], closed = {};
    const hq = (i) => Math.hypot(NAV_NODES[i][0] - NAV_NODES[to][0], NAV_NODES[i][1] - NAV_NODES[to][1]);
    while (open.length) {
      let bi = 0;
      for (let k = 1; k < open.length; k++) {
        const a = g[open[k]] + hq(open[k]), b = g[open[bi]] + hq(open[bi]);
        if (a < b || (a === b && open[k] < open[bi])) bi = k;
      }
      const cur = open.splice(bi, 1)[0];
      if (cur === to) { const path = [to]; let c = to; while (came[c] !== undefined) { c = came[c]; path.unshift(c); } return path; }
      closed[cur] = true;
      for (const nb of NAV[cur]) {
        if (closed[nb]) continue;
        const ng = g[cur] + Math.hypot(NAV_NODES[nb][0] - NAV_NODES[cur][0], NAV_NODES[nb][1] - NAV_NODES[cur][1]);
        if (g[nb] === undefined || ng < g[nb]) { g[nb] = ng; came[nb] = cur; if (!open.includes(nb)) open.push(nb); }
      }
    }
    return null;
  }
  // MapGeometry.bearingDeg: which way round the target a position sits.
  const bearingDeg = (fx, fz, tx, tz) => Math.atan2(tx - fx, -(tz - fz)) / DEG;

  // --- tables ---------------------------------------------------------------------
  const TIERS = DATA.tiers, MARKERS = DATA.markers, SCHED = DATA.match.rounds.schedule, ROUNDS = DATA.match.rounds;
  const SQUAD = DATA.squad, MOVE = DATA.movement, MELEE = DATA.match.melee, CH = DATA.chatter, ECO = DATA.economy;
  const ROLE_ORDER = ['anchor', 'flanker', 'pressure'];
  // Anchors are authored at the bunker; stand on its covered side, away from where it faces.
  const ANCHORS = MAP.anchors.map((a) => {
    const f = Math.hypot(a.faces[0], a.faces[1]) || 1, e = { x: a.x, z: a.z };
    for (let k = 0; k < 40; k++) {
      const probe = { x: e.x, z: e.z };
      resolveBody(probe, BODY_R + 0.12);
      if (Math.hypot(probe.x - e.x, probe.z - e.z) < 1e-6) break;
      e.x -= (a.faces[0] / f) * 0.1; e.z -= (a.faces[1] / f) * 0.1;
    }
    return Object.assign({}, a, { x: e.x, z: e.z });
  });
  // Each tier wears its own jersey and shoots its own paint, so a glance says who is out there.
  const TIER_LOOK = [
    { jersey: [44, 161, 156], trim: [238, 231, 207], pants: [52, 60, 70], paint: [255, 140, 40] },
    { jersey: [124, 82, 196], trim: [246, 190, 62], pants: [44, 42, 60], paint: [250, 226, 60] },
    { jersey: [206, 58, 52], trim: [238, 231, 207], pants: [40, 38, 44], paint: [120, 240, 90] },
    { jersey: [34, 36, 42], trim: [221, 168, 74], pants: [26, 26, 30], paint: [70, 220, 255] },
  ];
  const PLAYER_PAINT = [255, 60, 172];
  const FIRE_BTN = { x: W - 92, y: H - 120, r: 50 };                 // touch only
  const RELOAD_BTN = { x: W - 190, y: H - 70, r: 30 };
  const CROUCH_BTN = { x: W - 44, y: H - 222, r: 28 };

  const moraleFor = (alive) => { for (const th of DATA.morale.thresholds) if (alive >= th.atLeast) return th.state; return 'broken'; };
  const wrapAng = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
  const tierFor = (base, offset) => Math.min(TIERS.length - 1, base + offset);
  const aliveBots = (s) => s.bots.filter((b) => b.alive);
  const now = (s) => s.clock;

  // --- chatter: Bots/Chatter.luau -----------------------------------------------------
  function fill(text, vars) { return text.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m)); }
  function drawIndex(s, key, n) {                       // a shuffle bag per pool, so lines do not repeat back to back
    let bag = s.chat.bags[key];
    if (!bag || !bag.length) { bag = []; for (let i = 0; i < n; i++) bag.push(i); }
    const pick = bag.splice(Math.floor(rand(s, 'crng') * bag.length), 1)[0];
    s.chat.bags[key] = bag;
    return pick;
  }
  function bearingWord(deg) {
    const a = ((((deg + 180) % 360) + 360) % 360) - 180;
    if (a >= -22.5 && a <= 22.5) return 'front';
    if (a > 22.5 && a <= 67.5) return 'front right';
    if (a > 67.5 && a <= 112.5) return 'right';
    if (a > 112.5 || a < -157.5) return 'behind';
    if (a < -22.5 && a >= -67.5) return 'front left';
    return 'left';
  }
  function say(s, kind, ctx) {
    const c = s.chat, t = now(s);
    if (!ctx.force) {
      if (t < c.quietUntil) return null;
      c.times = c.times.filter((x) => t - x < 60);
      if (c.times.length >= CH.maxLinesPerMinute) return null;
    }
    const alive = aliveBots(s).length;
    let pool;
    if (kind === 'matchStart') pool = CH.banks.matchStart;
    else if (kind === 'squadWipe' || kind === 'flawlessWipe' || kind === 'roundStart' || kind === 'roundWon') pool = CH[kind];
    else if (CH.callouts[kind]) pool = CH.callouts[kind];
    else pool = (CH.banks[moraleFor(alive)] || {})[kind];
    if (!pool || !pool.length) return null;
    const text = pool[drawIndex(s, kind + ':' + moraleFor(alive), pool.length)];
    let speaker = ctx.speaker;
    if (speaker === undefined || speaker < 0) {
      const pool2 = s.bots.filter((b) => b.alive || kind === 'squadWipe' || kind === 'flawlessWipe');
      speaker = pool2.length ? pool2[Math.floor(rand(s, 'crng') * pool2.length)].i : -1;
    }
    const who = speaker >= 0 && s.bots[speaker] ? s.bots[speaker].name : CH.roster[0];
    let subject = ctx.subject;
    if (!subject) {
      for (let k = 0; k < 6; k++) {
        const b = s.bots[Math.floor(rand(s, 'crng') * s.bots.length)];
        if (b && b.name !== who) { subject = b.name; break; }
      }
    }
    const line = { who, bot: speaker, t, kind, text: fill(text, { name: subject || who, alive: String(alive), bearing: ctx.bearing || 'front' }) };
    c.lines.push(line);
    if (c.lines.length > 6) c.lines.shift();
    c.times.push(t);
    c.quietUntil = t + CH.cooldownSeconds.min + rand(s, 'crng') * (CH.cooldownSeconds.max - CH.cooldownSeconds.min);
    return line;
  }

  // --- the player's body ------------------------------------------------------------
  const eyeHeight = (p) => PL.eyeHeightMetres + (PL.crouchEyeHeightMetres - PL.eyeHeightMetres) * p.crouch;
  const bodyHeight = (crouch) => HB.bodyHeightMetres + (CROUCH_H - HB.bodyHeightMetres) * crouch;
  const chestHeight = (crouch) => BOT_AIM + (CROUCH_AIM - BOT_AIM) * crouch;
  const leanShift = (p) => p.lean * PL.leanOffsetMetres;
  // Leaning moves the whole body sideways, eyes and hitbox together: a peek shows what it sees.
  const bodyX = (p) => p.x + Math.cos(p.yaw) * leanShift(p) * 0.7;
  const bodyZ = (p) => p.z - Math.sin(p.yaw) * leanShift(p) * 0.7;
  function eyeOf(p) {
    const l = leanShift(p);
    return v3(p.x + Math.cos(p.yaw) * l, eyeHeight(p) - Math.abs(p.lean) * 0.08, p.z - Math.sin(p.yaw) * l);
  }

  // --- match setup ------------------------------------------------------------------
  function newPlayer(x, z) {
    return {
      x, z, vx: 0, vz: 0, yaw: 0, pitch: -0.02, crouch: 0, lean: 0, sprinting: false, slideT: 0, slideCd: 0, sdx: 0, sdz: 0,
      alive: true, respawnAt: 0, invulnUntil: 0, hopper: 0, reloadUntil: 0, spread: 0, nextShot: 0, recoverUntil: 0,
      firePrev: false, crouchPrev: false, reloadPrev: false, meleePrev: false, swingAt: NEVER, meleeReady: 0,
      bob: 0, recoil: 0, outBy: '', outC: 0, lastHitT: NEVER, goggles: [],
    };
  }
  function assignRoles(s, count) {
    const queue = [];
    for (const r of ROLE_ORDER) for (let k = 0; k < SQUAD.roles[r].count; k++) queue.push(r);
    while (queue.length < count) queue.push(ROLE_ORDER[queue.length % ROLE_ORDER.length]);
    const used = {}, out = [];
    for (let i = 0; i < count; i++) {
      const role = queue[i], cands = [];
      ANCHORS.forEach((a, ai) => { if (a.roles.includes(role)) cands.push(ai); });
      let chosen = -1;
      for (let k = 0; k < 12; k++) {
        const pick = cands[randInt(s, 'rng', 0, cands.length - 1)];
        if (!used[pick]) { chosen = pick; break; }
        if (chosen < 0) chosen = pick;
      }
      used[chosen] = true;
      out.push({ role, anchor: chosen });
    }
    return out;
  }
  function spawnRound(s) {
    const entry = SCHED[s.round - 1], tier = tierFor(s.baseTier, entry.tierOffset), m = MARKERS[TIERS[tier].marker];
    const roles = assignRoles(s, entry.bots), spawns = MAP.botSpawns;
    s.bots = roles.map((r, i) => {
      const slot = i % spawns.length, reuse = Math.floor(i / spawns.length);
      let x = spawns[slot][0], z = spawns[slot][1];
      if (reuse > 0) { const ang = (i + 1) * 2.399963 + reuse; x += Math.cos(ang) * 1.5 * reuse; z += Math.sin(ang) * 1.5 * reuse; }
      return {
        i, name: CH.roster[(s.rosterAt + i) % CH.roster.length], role: r.role, anchor: r.anchor, tier,
        x, z, vx: 0, vz: 0, face: Math.PI, alive: true, outT: 0, outX: 0, splat: null,
        mode: 'moving', sees: false, acqT: NEVER, lastSeen: NEVER, fireAt: 0, heardT: NEVER, hx: 0, hz: 0,
        path: [], sprint: true, reposAt: 0, stuckT: 0, crouch: 0, peekUntil: 0, hideUntil: 0, stopAt: -1,
        burst: 0, restUntil: 0, nextShot: 0, hopper: m.hopperCapacity, reloadUntil: 0, swingAt: NEVER, meleeReady: 0, walk: 0,
      };
    });
    // The breakout: everyone sprints for their bunker at the whistle.
    for (const b of s.bots) routeTo(b, ANCHORS[b.anchor].x, ANCHORS[b.anchor].z, true);
    s.squad = { cx: 0, cz: 0, cvx: 0, cvz: 0, ct: NEVER, by: -1, focusUntil: NEVER, crossfire: false, tauntAt: 0 };
    s.balls = [];
    const p = s.player;
    Object.assign(p, newPlayer(MAP.playerSpawn[0], MAP.playerSpawn[1]), { hopper: MARKERS[s.marker].hopperCapacity, spread: MARKERS[s.marker].firstShotSpreadDeg });
    s.rs = { shots: 0, hits: 0, elims: 0, deaths: 0 };
    s.roundT = 0;
  }
  function startMatch(s) {
    s.phase = 'warmup'; s.phaseT = DATA.match.warmupSeconds; s.round = 1; s.rounds = [];
    s.rosterAt = randInt(s, 'rng', 0, CH.roster.length - 1);
    s.stats = { shots: 0, hits: 0, elims: 0, deaths: 0, streak: 0, longest: 0 };
    s.splats = [];
    spawnRound(s);
    say(s, 'matchStart', { force: true });
    s.fx.push({ k: 'sound', s: 'level' });
  }

  // --- movement for bots --------------------------------------------------------------
  function routeTo(b, x, z, sprint) {
    const from = nearestNode(b.x, b.z), to = nearestNode(x, z), path = findPath(from, to) || [];
    b.path = path.map((n) => [NAV_NODES[n][0], NAV_NODES[n][1]]);
    // Skip a first node that is behind us on the way.
    if (b.path.length > 1) {
      const [ax, az] = b.path[0], [bx, bz] = b.path[1];
      if (Math.hypot(bx - b.x, bz - b.z) < Math.hypot(bx - ax, bz - az)) b.path.shift();
    }
    b.path.push([x, z]);
    b.sprint = sprint; b.mode = 'moving'; b.stuckT = 0;
  }
  function occupied(s, ai, self) {
    const a = ANCHORS[ai];
    return s.bots.some((o) => o.alive && o !== self && (o.anchor === ai || Math.hypot(o.x - a.x, o.z - a.z) < 1.5));
  }
  // BotController.chooseDestination: range band for the role, spread out for a crossfire,
  // a little noise, and a preference for anchors built for the role.
  function chooseDestination(s, b, contact) {
    const tier = TIERS[b.tier], band = SQUAD.roles[b.role].preferredRangeMetres;
    let best = -1, bestScore = -1e9;
    ANCHORS.forEach((a, ai) => {
      if (ai === b.anchor || occupied(s, ai, b)) return;
      let score;
      if (!contact) {
        if (!a.roles.includes(b.role)) return;
        score = rand(s, 'rng');
      } else {
        const d = Math.hypot(a.x - contact.x, a.z - contact.z);
        const out = d < band[0] ? band[0] - d : d > band[1] ? d - band[1] : 0;
        score = 1 - Math.min(1, out / 25);
        const mine = bearingDeg(contact.x, contact.z, a.x, a.z);
        let sep = SQUAD.crossfireMinSeparationDeg;
        for (const o of s.bots) {
          if (!o.alive || o === b) continue;
          const diff = Math.abs(((mine - bearingDeg(contact.x, contact.z, o.x, o.z) + 540) % 360) - 180);
          sep = Math.min(sep, diff);
        }
        score += tier.coordinationLevel * SQUAD.crossfireRewardWeight * Math.min(1, sep / SQUAD.crossfireMinSeparationDeg);
        score += rand(s, 'rng') * 0.25 + (a.roles.includes(b.role) ? 0.35 : 0);
      }
      if (score > bestScore) { bestScore = score; best = ai; }
    });
    return best;
  }
  // What this bot knows about the player: its own eyes, its own ears, and the squad's
  // callouts once they have had time to travel (contactShareDelayMs by tier).
  function contactFor(s, b) {
    const t = now(s), tier = TIERS[b.tier];
    if (b.sees || t - b.lastSeen < 6) return { x: s.player.x, z: s.player.z, fresh: b.sees };
    if (t - b.heardT < 6) return { x: b.hx, z: b.hz, fresh: false };
    const q = s.squad, delay = SQUAD.contactShareDelayMs[tier.id] / 1000;
    if (q.by >= 0 && t - q.ct >= delay && t - q.ct < 6) return { x: q.cx, z: q.cz, fresh: false };
    return null;
  }
  function coverTopNear(x, z) {
    let top = 0;
    for (const v of VOL) {
      const lx = toLocalX(v, x, z), lz = toLocalZ(v, x, z);
      if (Math.max(Math.abs(lx) - v.hx, Math.abs(lz) - v.hz) < 1.0) top = Math.max(top, v.top);
    }
    return top;
  }

  function canSeePlayer(s, b, eyeY) {
    const p = s.player;
    if (!p.alive) return false;
    const tier = TIERS[b.tier], px = bodyX(p), pz = bodyZ(p), dx = px - b.x, dz = pz - b.z, d = Math.hypot(dx, dz);
    if (d > tier.visionRangeMetres) return false;
    if (d > 3 && Math.abs(wrapAng(Math.atan2(dx, dz) - b.face)) > (tier.visionConeDeg / 2) * DEG) return false;
    const eye = v3(b.x, eyeY, b.z);
    return hasLOS(eye, v3(px, chestHeight(p.crouch), pz)) || hasLOS(eye, v3(px, eyeHeight(p) + 0.08, pz));
  }

  // AimModel.solve: reaction and settle, a skill-scaled lead, then gaussian error in degrees.
  function botAim(s, b, muzzle, spec) {
    const p = s.player, tier = TIERS[b.tier], t = now(s);
    const settle = 1 + 2 * Math.max(0, 1 - (t - b.acqT) / (tier.timeToSettleMs / 1000));
    const morale = DATA.morale.aimErrorPenaltyByState[moraleFor(aliveBots(s).length)];
    const target = v3(bodyX(p), chestHeight(p.crouch), bodyZ(p));
    const lead = solveLead(spec, muzzle, target, v3(p.vx, 0, p.vz)) || target;
    const a = clamp(tier.leadSolutionAccuracy + gauss(s, 'rng') * tier.leadJitter, 0, 1.35);
    let dir = unit(sub(lerp3(target, lead, a), muzzle));
    const sigma = tier.aimErrorDeg * settle * morale;
    dir = rotateDir(dir, gauss(s, 'rng') * sigma, gauss(s, 'rng') * sigma);
    return dir;
  }
  function fireBall(s, own, o, dir, marker, col) {
    const m = MARKERS[marker];
    s.balls.push({ x: o.x, y: o.y, z: o.z, vx: dir.x * m.muzzleVelocity, vy: dir.y * m.muzzleVelocity, vz: dir.z * m.muzzleVelocity, px: o.x, py: o.y, pz: o.z, age: 0, own, m: marker, c: col, near: false });
    if (s.balls.length > 320) s.balls.shift();
  }

  function eliminatePlayer(s, b, how) {
    const p = s.player, t = now(s);
    p.alive = false; p.respawnAt = t + DATA.match.respawnDelaySeconds; p.outBy = b ? b.name : ''; p.outC = b ? b.tier : 0;
    p.lastHitT = t; p.vx = 0; p.vz = 0; p.slideT = 0; p.reloadUntil = 0;
    s.stats.deaths++; s.rs.deaths++; s.stats.streak = 0;
    p.goggles = [];
    const n = how === 'melee' ? 3 : 5 + randInt(s, 'rng', 0, 3);
    for (let k = 0; k < n; k++) p.goggles.push({ x: 0.2 + rand(s, 'rng') * 0.6, y: 0.15 + rand(s, 'rng') * 0.6, r: 0.05 + rand(s, 'rng') * 0.13, d: rand(s, 'rng') });
    if (how === 'melee') say(s, 'melee', { speaker: b ? b.i : -1, force: true });
    else say(s, 'playerEliminated', { speaker: b ? b.i : -1, force: rand(s, 'crng') < 0.7 });
    s.fx.push({ k: 'sound', s: 'die' }, { k: 'shake', m: 10 }, { k: 'flash', a: 0.35, c: '#' + (b ? TIER_LOOK[b.tier].paint : PLAYER_PAINT).map((v) => v.toString(16).padStart(2, '0')).join('') });
  }
  function eliminateBot(s, b, hitY, how) {
    const t = now(s);
    b.alive = false; b.outT = 0; b.outX = b.x >= 0 ? 1 : -1; b.path = []; b.sees = false;
    b.splat = { y: hitY, a: rand(s, 'rng') * 2 * Math.PI };
    s.stats.elims++; s.rs.elims++; s.stats.streak++;
    s.stats.longest = Math.max(s.stats.longest, s.stats.streak);
    s.hud.marker = t; s.hud.markerOut = true;
    const left = aliveBots(s).length;
    if (left > 0) {
      const others = aliveBots(s);
      say(s, 'botEliminated', { speaker: others[Math.floor(rand(s, 'crng') * others.length)].i, subject: b.name, force: rand(s, 'crng') < 0.55 });
    }
    s.fx.push({ k: 'sound', s: how === 'melee' ? 'thud' : 'hit', n: s.stats.streak }, { k: 'shake', m: 3 });
  }

  // --- one bot, one tick: Bots/BotController.luau --------------------------------------
  function stepBot(s, b) {
    const t = now(s), tier = TIERS[b.tier], p = s.player, m = MARKERS[tier.marker], spec = specOf(tier.marker);
    if (!b.alive) {                                        // hand up, walking to the sideline
      b.outT += DT;
      if (b.outT > 0.8) { b.x += b.outX * MOVE.walkSpeedMps * 0.8 * DT; b.face = b.outX > 0 ? Math.PI / 2 : -Math.PI / 2; b.walk += DT * 7; }
      return;
    }
    // Posture: a bot holding low cover ducks, then peeks for peekDwellSeconds.
    const low = b.mode === 'holding' && coverTopNear(b.x, b.z) < 1.9 && coverTopNear(b.x, b.z) > 0;
    if (low && !b.sees) {
      if (t >= b.peekUntil && t >= b.hideUntil) {
        if (b.crouch < 0.5) b.peekUntil = t + MOVE.peekDwellSeconds.min + rand(s, 'rng') * (MOVE.peekDwellSeconds.max - MOVE.peekDwellSeconds.min);
        else b.hideUntil = t + 1 + rand(s, 'rng') * 2.2;
      }
    }
    const wantCrouch = low && !b.sees && t >= b.peekUntil ? 1 : 0;
    b.crouch += clamp(wantCrouch - b.crouch, -DT * 5, DT * 5);
    const eyeY = BOT_EYE - 0.55 * b.crouch;

    // Sense.
    const saw = b.sees, sees = canSeePlayer(s, b, eyeY);
    if (sees) {
      b.lastSeen = t;
      if (!saw) {
        b.sees = true; b.acqT = t; b.mode = 'reacting';
        b.fireAt = t + Math.max(0.06, (tier.reactionTimeMs + gauss(s, 'rng') * tier.reactionJitterMs / 3) / 1000);
        const q = s.squad, fresh = t - q.ct > 2;
        q.cx = p.x; q.cz = p.z; q.ct = t; q.by = b.i;
        if (fresh) {
          const rel = wrapAng(Math.atan2(p.x - b.x, p.z - b.z) - b.face) / DEG;
          say(s, 'contact', { speaker: b.i, bearing: bearingWord(rel) });
          if (rand(s, 'rng') < tier.focusFireChance && t >= q.focusUntil) { q.focusUntil = t + SQUAD.focusFireWindowSeconds; say(s, 'focusFire', { speaker: b.i }); }
        }
        if (b.path.length) b.stopAt = t + MOVE.stopToShootDelayMs / 1000;
      } else if (t - s.squad.ct > 0.5) { s.squad.cx = p.x; s.squad.cz = p.z; s.squad.ct = t; s.squad.by = b.i; }
    } else if (b.sees && t - b.lastSeen > 1.5) {
      b.sees = false; b.mode = b.path.length ? 'moving' : 'holding';
      if (rand(s, 'rng') < 0.3) say(s, 'lostContact', { speaker: b.i });
    }
    if (b.mode === 'reacting' && t >= b.fireAt) b.mode = 'engaging';
    if (b.stopAt >= 0 && t >= b.stopAt) { b.path = []; b.stopAt = -1; }

    // Decide where to be.
    const contact = contactFor(s, b);
    if (!b.sees && !b.path.length && t >= b.reposAt) {
      const hasReason = !!contact;
      const willExpose = hasReason || rand(s, 'rng') > tier.peekDiscipline;
      let go = false;
      if (!contact) go = willExpose && rand(s, 'rng') < tier.repositionChance * DT;
      else if (willExpose) { go = rand(s, 'rng') < SQUAD.roles[b.role].advanceChance; b.reposAt = t + MOVE.repositionCooldownSeconds * (0.6 + rand(s, 'rng') * 0.8); }
      if (go) {
        const ai = chooseDestination(s, b, contact);
        if (ai >= 0) {
          b.anchor = ai; routeTo(b, ANCHORS[ai].x, ANCHORS[ai].z, !!contact);
          b.reposAt = t + MOVE.repositionCooldownSeconds;
          if (contact && b.role === 'flanker') say(s, 'flanking', { speaker: b.i, bearing: ANCHORS[ai].x < 0 ? 'left' : 'right' });
        }
      }
    }

    // Move.
    let moving = false;
    if (b.path.length) {
      const [tx, tz] = b.path[0], dx = tx - b.x, dz = tz - b.z, d = Math.hypot(dx, dz);
      if (d < 0.45) { b.path.shift(); if (!b.path.length) b.mode = b.sees ? b.mode : 'holding'; }
      else {
        const sp = (b.sprint ? MOVE.sprintSpeedMps : MOVE.walkSpeedMps) * (b.crouch > 0.5 ? MOVE.crouchSpeedMps / MOVE.walkSpeedMps : 1);
        const k = Math.min(1, (sp * DT) / d), ox = b.x, oz = b.z;
        b.x += dx * k; b.z += dz * k;
        resolveBody(b, BODY_R + 0.05);
        const moved = Math.hypot(b.x - ox, b.z - oz);
        b.vx = (b.x - ox) / DT; b.vz = (b.z - oz) / DT;
        b.stuckT = moved < sp * DT * 0.25 ? b.stuckT + DT : 0;
        if (b.stuckT > 1.2) { b.path.shift(); b.stuckT = 0; }
        b.walk += DT * (b.sprint ? 11 : 7.5);
        moving = true;
      }
    }
    if (!moving) { b.vx = 0; b.vz = 0; }
    if (!b.path.length && b.mode === 'moving') b.mode = 'holding';

    // Face: the player when seen, the contact when known, the path when running, else the anchor's watch.
    let want = b.face;
    if (b.sees || (contact && !moving)) want = Math.atan2((contact ? contact.x : p.x) - b.x, (contact ? contact.z : p.z) - b.z);
    else if (moving && b.path.length) want = Math.atan2(b.path[0][0] - b.x, b.path[0][1] - b.z);
    else {
      const a = ANCHORS[b.anchor], w = MAP.watch[a.id];
      want = Math.atan2(a.faces[0], a.faces[1]);
      if (w) want += wrapAng(Math.atan2(w[0] - b.x, w[1] - b.z) - want) * tier.crosshairPrePlacement;
    }
    b.face += clamp(wrapAng(want - b.face), -4.7 * DT, 4.7 * DT);

    // Melee: tank to the ribs when the player walks into reach.
    const pdx = bodyX(p) - b.x, pdz = bodyZ(p) - b.z, pd = Math.hypot(pdx, pdz);
    if (b.swingAt > NEVER && t >= b.swingAt) {
      b.swingAt = NEVER;
      if (p.alive && pd <= MELEE.rangeMetres && t >= p.invulnUntil) eliminatePlayer(s, b, 'melee');
    }
    if (p.alive && pd <= MELEE.rangeMetres && t >= b.meleeReady && Math.abs(wrapAng(Math.atan2(pdx, pdz) - b.face)) <= (MELEE.arcDegrees / 2) * DEG) {
      b.swingAt = t + MELEE.swingSeconds * MELEE.contactFraction; b.meleeReady = t + MELEE.cooldownSeconds;
    }

    // Shoot: only when stopped, only at what it sees.
    if (b.reloadUntil > 0 && t >= b.reloadUntil) { b.reloadUntil = 0; b.hopper = m.hopperCapacity; }
    if (moving || !b.sees || b.mode !== 'engaging' || b.reloadUntil > 0 || !p.alive) return;
    if (b.hopper <= 0) { b.reloadUntil = t + m.reloadSeconds; say(s, 'reloading', { speaker: b.i }); return; }
    if (t < b.restUntil || t < b.nextShot) return;
    if (b.burst <= 0) b.burst = randInt(s, 'rng', tier.burstLengthMin, tier.burstLengthMax);
    const muzzle = v3(b.x + Math.sin(b.face) * 0.45 + Math.cos(b.face) * 0.18, BOT_AIM + 0.1 - 0.4 * b.crouch, b.z + Math.cos(b.face) * 0.45 - Math.sin(b.face) * 0.18);
    const dir = rotateDir(botAim(s, b, muzzle, spec), gauss(s, 'rng') * m.firstShotSpreadDeg, gauss(s, 'rng') * m.firstShotSpreadDeg);
    fireBall(s, b.i, muzzle, dir, tier.marker, b.tier);
    b.hopper--; b.burst--; b.nextShot = t + 60 / m.roundsPerMinute;
    if (b.burst <= 0) b.restUntil = t + (tier.burstRestMs / 1000) * (t < s.squad.focusUntil ? 0.5 : 1);
  }

  // --- paintballs ----------------------------------------------------------------------
  function addSplat(s, sp) {
    s.splats.push(sp);
    if (s.splats.length > 220) s.splats.shift();
  }
  function stepBalls(s) {
    const p = s.player, t = now(s), keep = [];
    for (const ball of s.balls) {
      const spec = specOf(ball.m);
      ball.px = ball.x; ball.py = ball.y; ball.pz = ball.z;
      rk4(ball, spec, DT);
      ball.age += DT;
      const x0 = ball.px, y0 = ball.py, z0 = ball.pz, x1 = ball.x, y1 = ball.y, z1 = ball.z;
      let hitT = 2, what = null;
      const fh = firstHit(x0, y0, z0, x1, y1, z1);
      if (fh[0] >= 0 && fh[0] < hitT) { hitT = fh[0]; what = 'vol'; }
      if (y1 <= 0 && y0 > 0) { const tg = y0 / (y0 - y1); if (tg < hitT) { hitT = tg; what = 'ground'; } }
      const outX = Math.abs(x1) > HALF_W, outZ = Math.abs(z1) > HALF_L;
      if (outX || outZ) {
        const tn = outX ? (Math.sign(x1) * HALF_W - x0) / (x1 - x0) : (Math.sign(z1) * HALF_L - z0) / (z1 - z0);
        const yn = y0 + (y1 - y0) * tn;
        if (yn < DATA.map.wallHeight && tn < hitT) { hitT = tn; what = outX ? 'netx' : 'netz'; }
      }
      let hitBot = -1;
      if (ball.own < 0) {
        for (const b of s.bots) {
          if (!b.alive) continue;
          const tc = segCylinder(x0, y0, z0, x1, y1, z1, b.x, b.z, BODY_R, bodyHeight(b.crouch));
          if (tc >= 0 && tc < hitT) { hitT = tc; what = 'bot'; hitBot = b.i; }
        }
      } else if (p.alive && t >= p.invulnUntil) {
        const tc = segCylinder(x0, y0, z0, x1, y1, z1, bodyX(p), bodyZ(p), BODY_R, bodyHeight(p.crouch));
        if (tc >= 0 && tc < hitT) { hitT = tc; what = 'player'; }
      }
      // A near miss is how you learn where they are: log the whiz for the HUD and the policy.
      if (ball.own >= 0 && p.alive && !ball.near && what !== 'player') {
        const ex = bodyX(p), ez = bodyZ(p), d2 = segDist2(x0, z0, x1, z1, ex, ez);
        if (d2 < 1.5 * 1.5 && Math.abs(y1 - eyeHeight(p)) < 1.4) {
          ball.near = true;
          const src = s.bots[ball.own];
          if (src) { s.hud.whiz.push({ t, x: src.x, z: src.z, b: src.i }); if (s.hud.whiz.length > 6) s.hud.whiz.shift(); }
        }
      }
      if (!what) {
        if (ball.age < BAL.maxFlightTime && ball.y > -1 && Math.abs(ball.x) < 80 && Math.abs(ball.z) < 90) keep.push(ball);
        continue;
      }
      const hx = x0 + (x1 - x0) * hitT, hy = y0 + (y1 - y0) * hitT, hz = z0 + (z1 - z0) * hitT;
      const c = ball.c;
      const sp2 = Math.hypot(ball.vx, ball.vz) || 1, dxn = ball.vx / sp2, dzn = ball.vz / sp2;
      const r = 0.1 + rand(s, 'rng') * 0.08;
      if (what === 'bot') {
        if (ball.own < 0) { s.stats.hits++; s.rs.hits++; }
        eliminateBot(s, s.bots[hitBot], hy, 'paint');
      } else if (what === 'player') {
        eliminatePlayer(s, s.bots[ball.own], 'paint');
      } else if (what === 'ground') {
        addSplat(s, { x: hx, y: 0.01, z: hz, n: 0, dx: dxn, dz: dzn, r: r * 1.3, st: 1.4 + sp2 / 60, c, v: -1, s: rand(s, 'rng') });
      } else if (what === 'vol') {
        const nn = normalAt(VOL[fh[1]], hx, hy, hz);
        addSplat(s, { x: hx, y: hy, z: hz, n: 1, nx: nn.x, ny: nn.y, nz: nn.z, r, st: 1, c, v: fh[1], s: rand(s, 'rng') });
      } else {
        addSplat(s, { x: hx, y: hy, z: hz, n: 2, dx: what === 'netx' ? -Math.sign(x1) : 0, dz: what === 'netz' ? -Math.sign(z1) : 0, r, st: 1, c, v: -2, s: rand(s, 'rng') });
      }
      if (ball.own < 0 && what !== 'bot') s.fx.push({ k: 'sound', s: 'splat' });
    }
    s.balls = keep;
  }

  // --- the player, one tick ----------------------------------------------------------
  const inCircle = (pt, c) => pt && Math.hypot(pt.x - c.x, pt.y - c.y) <= c.r;
  function stepPlayer(s, input) {
    const p = s.player, t = now(s), k = input.keys || {}, m = MARKERS[s.marker];
    // Look: mouse through pointer lock, or a finger dragging on the right of the screen.
    if (input.stick) s.touch.on = true;
    if (input.look) { p.yaw += (input.look.dx || 0) * SENS; p.pitch -= (input.look.dy || 0) * SENS; }
    const pt = input.pointer;
    let touchFire = false, touchReload = false, touchCrouch = false;
    if (s.touch.on && pt && pt.down) {
      if (s.touch.id === 0) s.touch.id = inCircle(pt, FIRE_BTN) ? 1 : inCircle(pt, RELOAD_BTN) ? 2 : inCircle(pt, CROUCH_BTN) ? 3 : 4;
      if (s.touch.lx >= 0) { p.yaw += (pt.x - s.touch.lx) * 0.006; p.pitch -= (pt.y - s.touch.ly) * 0.006; }
      s.touch.lx = pt.x; s.touch.ly = pt.y;
      touchFire = s.touch.id === 1; touchReload = s.touch.id === 2; touchCrouch = s.touch.id === 3;
    } else { s.touch.lx = -1; s.touch.ly = -1; s.touch.id = 0; }
    if (touchCrouch && !s.touch.cHeld) s.touch.crouch = !s.touch.crouch;
    s.touch.cHeld = touchCrouch;
    p.yaw = wrapAng(p.yaw);
    p.pitch = clamp(p.pitch, -1.3, 1.3);
    p.recoil = Math.max(0, p.recoil - DT * 6);

    if (!p.alive) {
      if (t >= p.respawnAt && s.phase === 'live') respawnPlayer(s);
      return;
    }
    const frozen = s.phase !== 'live';
    const crouchHeld = !!(k.KeyC || k.ControlLeft || k.ControlRight) || s.touch.crouch;
    const sprintHeld = !!(k.ShiftLeft || k.ShiftRight);
    const fireHeld = s.touch.on ? touchFire : !!input.action;
    // Movement, relative to where you look.
    let mx = 0, mz = 0;
    if (input.stick) { mx = input.stick.x; mz = -input.stick.y; }
    else { mx = (input.right ? 1 : 0) - (input.left ? 1 : 0); mz = (input.up ? 1 : 0) - (input.down ? 1 : 0); }
    const ml = Math.hypot(mx, mz);
    if (ml > 1) { mx /= ml; mz /= ml; }
    const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw), rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
    let wx = fx * mz + rx * mx, wz = fz * mz + rz * mx;
    if (frozen) { wx = 0; wz = 0; }
    const firing = fireHeld && t >= p.nextShot && p.hopper > 0 && p.reloadUntil === 0;
    p.sprinting = sprintHeld && mz > 0.3 && !crouchHeld && p.slideT <= 0 && !firing && !frozen;
    if (crouchHeld && !p.crouchPrev && p.sprinting && p.slideCd <= 0) {   // sprint + crouch = slide
      p.slideT = PL.slideDurationSeconds; p.slideCd = PL.slideCooldownSeconds;
      const l = Math.hypot(wx, wz) || 1; p.sdx = wx / l; p.sdz = wz / l;
    }
    p.crouchPrev = crouchHeld;
    p.slideCd = Math.max(0, p.slideCd - DT);
    let tvx, tvz;
    if (p.slideT > 0) {
      p.slideT -= DT;
      const f = PL.slideSpeedMps * (0.55 + 0.45 * (p.slideT / PL.slideDurationSeconds));
      tvx = p.sdx * f; tvz = p.sdz * f;
      p.vx = tvx; p.vz = tvz;
    } else {
      const sp = p.sprinting ? PL.sprintSpeedMps : crouchHeld ? PL.crouchSpeedMps : PL.walkSpeedMps;
      tvx = wx * sp; tvz = wz * sp;
      const a = Math.min(1, DT * 11);
      p.vx += (tvx - p.vx) * a; p.vz += (tvz - p.vz) * a;
    }
    if (p.sprinting) p.recoverUntil = t + PL.sprintToFireRecoverySeconds;
    p.x += p.vx * DT; p.z += p.vz * DT;
    resolveBody(p, BODY_R + 0.05);
    for (const b of s.bots) {                                // bodies do not overlap
      if (!b.alive) continue;
      const dx = p.x - b.x, dz = p.z - b.z, d = Math.hypot(dx, dz), min = BODY_R * 2 + 0.1;
      if (d < min && d > 1e-6) { p.x = b.x + (dx / d) * min; p.z = b.z + (dz / d) * min; }
    }
    const speed = Math.hypot(p.vx, p.vz);
    p.bob += speed * DT * 1.9;
    p.crouch += clamp((crouchHeld || p.slideT > 0 ? 1 : 0) - p.crouch, -DT * 7, DT * 7);
    const leanWant = (k.KeyE ? 1 : 0) - (k.KeyQ ? 1 : 0);
    p.lean += clamp(leanWant - p.lean, -PL.leanSpeed * DT, PL.leanSpeed * DT);

    // Reload.
    const reloadHeld = !!k.KeyR || touchReload;
    if (p.reloadUntil > 0 && t >= p.reloadUntil) { p.reloadUntil = 0; p.hopper = m.hopperCapacity; s.fx.push({ k: 'sound', s: 'pick' }); }
    if (((reloadHeld && !p.reloadPrev && p.hopper < m.hopperCapacity) || (fireHeld && p.hopper <= 0)) && p.reloadUntil === 0 && !frozen) {
      p.reloadUntil = t + m.reloadSeconds;
    }
    p.reloadPrev = reloadHeld;

    // Melee: F or V.
    const meleeHeld = !!(k.KeyF || k.KeyV);
    if (meleeHeld && !p.meleePrev && t >= p.meleeReady && !frozen) { p.swingAt = t + MELEE.swingSeconds * MELEE.contactFraction; p.meleeReady = t + MELEE.cooldownSeconds; }
    p.meleePrev = meleeHeld;
    if (p.swingAt > NEVER && t >= p.swingAt) {
      p.swingAt = NEVER;
      for (const b of s.bots) {
        if (!b.alive) continue;
        const dx = b.x - p.x, dz = b.z - p.z;
        if (Math.hypot(dx, dz) <= MELEE.rangeMetres && Math.abs(wrapAng(Math.atan2(dx, dz) - p.yaw)) <= (MELEE.arcDegrees / 2) * DEG) {
          eliminateBot(s, b, 1.2, 'melee'); break;
        }
      }
    }

    // Fire.
    const moving = speed > 0.6;
    p.spread = Math.max(m.firstShotSpreadDeg, p.spread - m.spreadDecayPerSecondDeg * DT);
    const canCycle = m.autoFire || !p.firePrev;
    if (fireHeld && canCycle && !frozen && t >= p.nextShot && t >= p.recoverUntil && p.hopper > 0 && p.reloadUntil === 0 && p.swingAt === NEVER) {
      const mult = (p.slideT > 0 ? m.movingSpreadMultiplier * 1.6 : moving ? m.movingSpreadMultiplier : 1) * (p.crouch > 0.5 ? m.crouchSpreadMultiplier : 1);
      const cone = p.spread * mult, ang = rand(s, 'rng') * 2 * Math.PI, r = cone * Math.sqrt(rand(s, 'rng'));
      const dir = rotateDir(dirOf(p.yaw, p.pitch), r * Math.cos(ang), r * Math.sin(ang));
      const eye = eyeOf(p);
      fireBall(s, -1, v3(eye.x + dir.x * 0.3, eye.y - 0.06, eye.z + dir.z * 0.3), dir, s.marker, -1);
      p.hopper--; p.nextShot = t + 60 / m.roundsPerMinute; p.recoil = Math.min(1, p.recoil + (m.autoFire ? 0.35 : 1));
      p.spread = Math.min(m.sustainedSpreadDeg, p.spread + m.spreadGrowthPerShotDeg);
      s.stats.shots++; s.rs.shots++;
      s.fx.push({ k: 'sound', s: 'shot' });
      // The ears: every bot inside hearing radius x marker loudness now knows where you are.
      for (const b of s.bots) {
        if (b.alive && Math.hypot(b.x - p.x, b.z - p.z) <= TIERS[b.tier].hearingRadiusMetres * m.loudness) { b.heardT = t; b.hx = p.x; b.hz = p.z; }
      }
    }
    p.firePrev = fireHeld;
  }
  function respawnPlayer(s) {
    const p = s.player, alive = aliveBots(s);
    let best = MAP.playerRespawns[0], bestD = -1;
    for (const r of MAP.playerRespawns) {
      let d = 1e9;
      for (const b of alive) d = Math.min(d, Math.hypot(b.x - r[0], b.z - r[1]));
      if (d >= DATA.match.respawn.spawnAwayFromBotsMetres) { best = r; break; }
      if (d > bestD) { bestD = d; best = r; }
    }
    const keep = { yaw: 0, pitch: -0.02, goggles: p.goggles, outBy: p.outBy, outC: p.outC, lastHitT: p.lastHitT };
    Object.assign(p, newPlayer(best[0], best[1]), keep, { hopper: MARKERS[s.marker].hopperCapacity, spread: MARKERS[s.marker].firstShotSpreadDeg, invulnUntil: now(s) + DATA.match.respawn.invulnerabilitySeconds });
    p.yaw = Math.atan2(-best[0] * 0.3, 20);
  }

  // --- the squad between bots: crossfire, taunts --------------------------------------
  function stepSquad(s) {
    const t = now(s), p = s.player, alive = aliveBots(s);
    const bearings = alive.filter((b) => b.sees).map((b) => bearingDeg(p.x, p.z, b.x, b.z));
    let active = false;
    for (let i = 0; i < bearings.length && !active; i++) for (let j = i + 1; j < bearings.length; j++) {
      if (Math.abs(((bearings[i] - bearings[j] + 540) % 360) - 180) >= SQUAD.crossfireMinSeparationDeg) { active = true; break; }
    }
    if (active && !s.squad.crossfire) say(s, 'crossfire', {});
    s.squad.crossfire = active;
    if (t >= s.squad.tauntAt) {
      s.squad.tauntAt = t + 9 + rand(s, 'crng') * 9;
      if (alive.length && t - s.squad.ct > 3) say(s, 'taunt', {});
    }
  }

  // --- payout: Economy/Payout.luau computeMatch ------------------------------------------
  function payout(s) {
    const mk = MARKERS[s.marker].payoutMultiplier;
    let subtotal = 0, cleared = 0;
    for (const r of s.rounds) if (r.cleared) { subtotal += ECO.basePayout * TIERS[r.tier].payoutMultiplier * mk * r.mult; cleared++; }
    const st = s.stats, all = cleared === ROUNDS.count;
    const death = st.deaths <= 0 ? 1 : ECO.deathPenalty.floor + (1 - ECO.deathPenalty.floor) * Math.exp(-ECO.deathPenalty.decay * st.deaths);
    const ab = ECO.accuracyBonus, rate = st.shots > 0 ? st.hits / st.shots : 0;
    const acc = st.shots < ab.minShotsToQualify || rate <= ab.threshold ? 1 : 1 + (ab.gain * (rate - ab.threshold)) / (1 - ab.threshold);
    const streak = 1 + Math.min(ECO.streakBonus.max, Math.max(0, st.longest - 1) * ECO.streakBonus.perElimination);
    const flawless = all && st.deaths === 0 ? ECO.flawlessBonus : 1;
    return { subtotal, death, acc, streak, flawless, cleared, total: Math.floor(subtotal * death * acc * streak * flawless + 0.5) };
  }

  // --- the match clock ------------------------------------------------------------------
  function endMatch(s) {
    s.phase = 'done'; s.over = true;
    const pay = payout(s);
    s.final = pay;
    const prog = s.prog;
    prog.ff += pay.total; prog.matches++;
    prog.best = Math.max(prog.best, pay.total);
    if (pay.cleared === ROUNDS.count) {
      prog.cleared = Math.max(prog.cleared, s.baseTier + 1);
      s.fx.push({ k: 'sound', s: 'win' });
    }
  }
  function stepMatch(s) {
    const t = now(s);
    if (s.phase === 'warmup') {
      s.phaseT -= DT;
      if (s.phaseT <= 0) { s.phase = 'live'; s.fx.push({ k: 'sound', s: 'clear' }); }
    } else if (s.phase === 'live') {
      s.roundT += DT;
      if (!aliveBots(s).length) {
        const entry = SCHED[s.round - 1];
        s.rounds.push({ cleared: true, tier: tierFor(s.baseTier, entry.tierOffset), mult: entry.payoutMultiplier, time: s.roundT, deaths: s.rs.deaths });
        say(s, s.rs.deaths === 0 ? 'flawlessWipe' : 'squadWipe', { force: true, speaker: s.bots[s.bots.length - 1].i });
        s.fx.push({ k: 'sound', s: 'clear' }, { k: 'flash', a: 0.25, c: '#ffffff' });
        s.phase = s.round >= ROUNDS.count ? 'final' : 'intermission';
        s.phaseT = s.phase === 'final' ? 4 : ROUNDS.intermissionSeconds;
        s.balls = [];
      } else if (s.roundT >= ROUNDS.roundTimeLimitSeconds) {
        const entry = SCHED[s.round - 1];
        s.rounds.push({ cleared: false, tier: tierFor(s.baseTier, entry.tierOffset), mult: entry.payoutMultiplier, time: s.roundT, deaths: s.rs.deaths });
        say(s, 'roundWon', { force: true });
        s.phase = 'final'; s.phaseT = 4;
      }
    } else if (s.phase === 'intermission') {
      s.phaseT -= DT;
      if (s.phaseT <= 0) {
        s.round++;
        s.rosterAt = (s.rosterAt + 1) % CH.roster.length;
        spawnRound(s);
        s.phase = 'warmup'; s.phaseT = DATA.match.warmupSeconds;
        say(s, 'roundStart', { force: true, subject: s.bots[s.bots.length - 1].name });
      }
    } else if (s.phase === 'final') {
      s.phaseT -= DT;
      if (s.phaseT <= 0) endMatch(s);
    }
    void t;
  }

  // --- title screen: pick a marker (buy it with Field Fees) and a starting tier ---------
  const CARD = (i) => ({ x: 64 + i * 230, y: 150, w: 212, h: 168 });
  const TIER_BTN = (i) => ({ x: 148 + i * 128, y: 334, w: 120, h: 32 });
  const START_BTN = { x: W / 2 - 120, y: 382, w: 240, h: 46 };
  const inRect = (pt, r) => pt && pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h;
  const owns = (s, name) => s.prog.owned.includes(name);
  const tierOpen = (s, i) => i <= s.prog.cleared;
  function startState(s) {                                   // what the START button does right now
    const name = MARKER_ORDER[s.menu.marker], cost = MARKERS[name].cost || 0;
    if (owns(s, name)) return 'play';
    return s.prog.ff >= cost ? 'buy' : 'locked';
  }
  function pressStart(s) {
    const name = MARKER_ORDER[s.menu.marker], st = startState(s);
    if (st === 'locked') { s.fx.push({ k: 'sound', s: 'thud' }); return; }
    if (st === 'buy') { s.prog.ff -= MARKERS[name].cost; s.prog.owned.push(name); s.fx.push({ k: 'sound', s: 'level' }); return; }
    s.marker = name; s.baseTier = s.menu.tier;
    s.prog.marker = name; s.prog.tier = s.menu.tier;
    startMatch(s);
  }
  function stepTitle(s, input) {
    const mn = s.menu, k = input.keys || {};
    const edge = (name, on) => { const was = mn.held[name]; mn.held[name] = on; return on && !was; };
    if (edge('l', input.left)) mn.marker = (mn.marker + 2) % 3;
    if (edge('r', input.right)) mn.marker = (mn.marker + 1) % 3;
    if (edge('u', input.up)) mn.tier = Math.min(TIERS.length - 1, mn.tier + 1);
    if (edge('d', input.down)) mn.tier = Math.max(0, mn.tier - 1);
    ['Digit1', 'Digit2', 'Digit3'].forEach((c, i) => { if (edge(c, !!k[c])) mn.marker = i; });
    while (!tierOpen(s, mn.tier)) mn.tier--;
    const pt = input.pointer;
    if (input.actionPressed) {
      if (pt) {
        for (let i = 0; i < 3; i++) if (inRect(pt, CARD(i))) { mn.marker = i; s.fx.push({ k: 'sound', s: 'pick' }); }
        for (let i = 0; i < TIERS.length; i++) if (inRect(pt, TIER_BTN(i)) && tierOpen(s, i)) { mn.tier = i; s.fx.push({ k: 'sound', s: 'pick' }); }
        if (inRect(pt, START_BTN)) pressStart(s);
      } else pressStart(s);
    }
    s.orbit += DT * 0.07;
  }

  // --- the Game API ---------------------------------------------------------------------
  function init(seed, progress) {
    const pr = progress && typeof progress === 'object' ? progress : {};
    const owned = Array.isArray(pr.owned) ? pr.owned.filter((n) => MARKERS[n]) : [];
    if (!owned.includes('mechanical')) owned.unshift('mechanical');
    const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
    const prog = {
      ff: Math.max(0, Math.floor(num(pr.ff, 0))), owned, cleared: clamp(Math.floor(num(pr.cleared, 0)), 0, TIERS.length - 1),
      matches: Math.max(0, Math.floor(num(pr.matches, 0))), best: Math.max(0, Math.floor(num(pr.best, 0))),
      marker: MARKERS[pr.marker] && owned.includes(pr.marker) ? pr.marker : 'mechanical', tier: 0,
    };
    prog.tier = clamp(Math.floor(num(pr.tier, 0)), 0, prog.cleared);
    const s = {
      rng: seed >>> 0 || 1, crng: (seed * 2654435761) >>> 0 || 7, brng: (seed * 40503 + 11) >>> 0 || 3,
      tick: 0, clock: 0, over: false, phase: 'title', phaseT: 0, orbit: (seed % 360) * DEG,
      prog, menu: { marker: MARKER_ORDER.indexOf(prog.marker), tier: prog.tier, held: {} },
      marker: prog.marker, baseTier: prog.tier, round: 0, rounds: [], roundT: 0, rosterAt: 0,
      player: newPlayer(MAP.playerSpawn[0], MAP.playerSpawn[1]), bots: [], balls: [], splats: [],
      squad: { cx: 0, cz: 0, cvx: 0, cvz: 0, ct: NEVER, by: -1, focusUntil: NEVER, crossfire: false, tauntAt: 0 },
      chat: { lines: [], times: [], quietUntil: 0, bags: {} },
      stats: { shots: 0, hits: 0, elims: 0, deaths: 0, streak: 0, longest: 0 }, rs: { shots: 0, hits: 0, elims: 0, deaths: 0 },
      hud: { marker: NEVER, markerOut: false, whiz: [] }, touch: { on: false, lx: -1, ly: -1, id: 0, crouch: false, cHeld: false },
      ai: { target: -1, seenAt: 0, aimAt: 0, yaw: 0, pitch: 0, path: [], repath: 0, goal: 0 },
      final: null, fx: [],
    };
    return s;
  }

  function step(s, input) {
    s.fx = [];
    s.tick++;
    input = input || {};
    if (s.over) return s;
    if (s.phase === 'title') { stepTitle(s, input); return s; }
    s.clock += DT;
    stepPlayer(s, input);
    if (s.phase === 'live') {
      for (const b of s.bots) stepBot(s, b);
      for (let i = 0; i < s.bots.length; i++) for (let j = i + 1; j < s.bots.length; j++) {   // bots do not overlap either
        const a = s.bots[i], b = s.bots[j];
        if (!a.alive || !b.alive) continue;
        const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), min = BODY_R * 2 + 0.1;
        if (d < min && d > 1e-6) { const push = (min - d) / 2; a.x -= (dx / d) * push; a.z -= (dz / d) * push; b.x += (dx / d) * push; b.z += (dz / d) * push; }
      }
      stepSquad(s);
    } else {
      for (const b of s.bots) if (!b.alive) stepBot(s, b);
    }
    stepBalls(s);
    s.hud.whiz = s.hud.whiz.filter((w) => s.clock - w.t < 2.5);
    stepMatch(s);
    return s;
  }

  // --- a casual human for the headless playtest: Sim/Policies.luau `human` ----------------
  // Nearest visible bot, a 0.34 s reaction spent getting low, then fire with 70% of the lead
  // a perfect solver would give and 2.4 degrees of hand. With nobody in sight it advances
  // bunker to bunker toward the far end, the way a new player pushes up the field.
  function bot(s) {
    const input = { left: false, right: false, up: false, down: false, action: false, actionPressed: false, pointer: null, stick: null, look: { dx: 0, dy: 0 }, keys: {} };
    if (s.phase === 'title') { input.actionPressed = s.tick % 20 === 19; return input; }
    if (s.over) return input;
    const p = s.player, ai = s.ai, t = s.clock;
    if (!p.alive) { ai.target = -1; ai.path = []; return input; }
    const turn = (yaw, pitch) => {
      const dy = clamp(wrapAng(yaw - p.yaw), -12 * DEG, 12 * DEG), dp = clamp(pitch - p.pitch, -8 * DEG, 8 * DEG);
      input.look = { dx: dy / SENS, dy: -dp / SENS };
      return Math.max(Math.abs(wrapAng(yaw - p.yaw)), Math.abs(pitch - p.pitch));
    };
    const eye = eyeOf(p), m = MARKERS[s.marker];
    let best = -1, bd = 1e9;
    for (const b of s.bots) {
      if (!b.alive) continue;
      const dx = b.x - p.x, dz = b.z - p.z, d = Math.hypot(dx, dz);
      if (d > 60) continue;
      const shotAt = s.hud.whiz.some((w) => w.b === b.i) || (s.squad.by === b.i && t - s.squad.ct < 1);
      if (Math.abs(wrapAng(Math.atan2(dx, dz) - p.yaw)) > 70 * DEG && !shotAt) continue;
      if (!hasLOS(eye, v3(b.x, chestHeight(b.crouch), b.z)) && !hasLOS(eye, v3(b.x, BOT_EYE - 0.55 * b.crouch, b.z))) continue;
      if (d < bd) { bd = d; best = b.i; }
    }
    if (best !== ai.target) { ai.target = best; ai.seenAt = t; ai.aimAt = 0; }
    if ((p.hopper <= 0 || (best < 0 && p.hopper < m.hopperCapacity * 0.4)) && p.reloadUntil === 0) input.keys.KeyR = true;
    const follow = (path, gx, gz, sprint) => {
      if (!path.length || t >= ai.repath) {
        const nodes = findPath(nearestNode(p.x, p.z), nearestNode(gx, gz)) || [];
        ai.path = nodes.map((n) => [NAV_NODES[n][0], NAV_NODES[n][1]]);
        ai.repath = t + 2;
      }
      while (ai.path.length && Math.hypot(ai.path[0][0] - p.x, ai.path[0][1] - p.z) < 1.3) ai.path.shift();
      return ai.path.length ? ai.path[0] : null;
    };
    if (best >= 0) {
      const b = s.bots[best], target = v3(b.x, chestHeight(b.crouch), b.z);
      if (t >= ai.aimAt) {
        const lead = solveLead(specOf(s.marker), eye, target, v3(b.vx, 0, b.vz)) || target;
        let dir = unit(sub(lerp3(target, lead, 0.7), eye));
        dir = rotateDir(dir, gauss(s, 'brng') * 2.4, gauss(s, 'brng') * 2.4);
        ai.yaw = Math.atan2(dir.x, dir.z); ai.pitch = Math.asin(clamp(dir.y, -1, 1)); ai.aimAt = t + 0.18;
      }
      const err = turn(ai.yaw, ai.pitch);
      if (bd > 26) {                                   // too far to trade: walk up on them, marker up
        const wp = follow(ai.path, b.x, b.z, false);
        if (wp) {
          const rel = wrapAng(Math.atan2(wp[0] - p.x, wp[1] - p.z) - p.yaw);
          input.up = Math.cos(rel) > 0.38; input.down = Math.cos(rel) < -0.38;
          input.right = Math.sin(rel) > 0.38; input.left = Math.sin(rel) < -0.38;
        }
      } else {
        ai.path = [];
        const low = v3(p.x, PL.crouchEyeHeightMetres, p.z);
        if (hasLOS(low, target)) input.keys.KeyC = true;
      }
      if (t - ai.seenAt >= 0.34 && err < 2.5 * DEG) input.action = m.autoFire || s.tick % 2 === 0;
      return input;
    }
    const whiz = s.hud.whiz.length ? s.hud.whiz[s.hud.whiz.length - 1] : null;
    if (whiz && t - whiz.t < 1.2) { turn(Math.atan2(whiz.x - p.x, whiz.z - p.z), -0.02); return input; }
    // Advance to contact.
    const goals = MAP.botSpawns, goal = goals[ai.goal % goals.length];
    if (Math.hypot(goal[0] - p.x, goal[1] - p.z) < 8) { ai.goal++; ai.path = []; }
    const g = goals[ai.goal % goals.length], wp = follow(ai.path, g[0], g[1], true);
    if (wp) {
      const err = turn(Math.atan2(wp[0] - p.x, wp[1] - p.z), -0.02);
      input.up = err < 50 * DEG;
      if (err < 25 * DEG && p.reloadUntil === 0) input.keys.ShiftLeft = true;
    }
    return input;
  }

  function metrics(s) {
    const pay = s.final || payout(s), st = s.stats;
    return {
      score: pay.total, rounds_cleared: pay.cleared, eliminations: st.elims, deaths: st.deaths,
      accuracy: st.shots ? Math.round((st.hits / st.shots) * 1000) / 1000 : 0, shots: st.shots,
      won: pay.cleared === ROUNDS.count ? 1 : 0, longest_streak: st.longest,
    };
  }
  function progress(s) {
    const p = s.prog;
    return { ff: p.ff, owned: p.owned.slice(), cleared: p.cleared, matches: p.matches, best: p.best, marker: p.marker, tier: p.tier };
  }
  // Pointer lock only while there is a field to look at; the menus keep the cursor.
  function pointerLook(s, at) {
    if (s.over) return false;
    if (s.phase === 'title') return !!at && inRect(at, START_BTN) && startState(s) === 'play';
    return true;
  }
  const touchStick = (s, at) => s.phase !== 'title' && !s.over && (!at || at.x < W * 0.42);

  // ======================================================================================
  // Rendering: flat-shaded polygons through a pinhole camera, painter-sorted, the way a
  // Roblox place looks (smooth plastic parts, sun from one side). Nothing below changes state.
  // ======================================================================================
  const FOCAL = H / 2 / Math.tan((PL.fieldOfViewDeg / 2) * DEG);
  const NEAR = 0.05;
  const SUN = unit(v3(-0.45, 0.85, -0.35));
  const FOG = [196, 216, 230];
  const C = DATA.colors;
  const hash = (i) => { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
  const css = (c, a) => (a === undefined ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`);
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const scaleC = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
  const paintOf = (c) => (c < 0 ? PLAYER_PAINT : TIER_LOOK[c].paint);
  function lit(col, n, dist) {
    const l = Math.max(0, n.x * SUN.x + n.y * SUN.y + n.z * SUN.z);
    const k = 0.6 + 0.45 * l, f = clamp((dist - 18) / 150, 0, 0.55);
    return css(mix(scaleC(col, k), FOG, f));
  }

  function makeCam(e, yaw, pitch) {
    const f = dirOf(yaw, pitch), r = v3(Math.cos(yaw), 0, -Math.sin(yaw));
    return { e, f, r, u: cross(f, r), yaw, pitch };
  }
  function cam3(c, x, y, z) {
    const dx = x - c.e.x, dy = y - c.e.y, dz = z - c.e.z;
    return [dx * c.r.x + dz * c.r.z, dx * c.u.x + dy * c.u.y + dz * c.u.z, dx * c.f.x + dy * c.f.y + dz * c.f.z];
  }
  const SX = (p) => W / 2 + (p[0] / p[2]) * FOCAL, SY = (p) => H / 2 - (p[1] / p[2]) * FOCAL;
  // Clip a camera-space polygon to the near plane and trace it; false if nothing is left.
  function trace(ctx, cp) {
    let q = cp, behind = 0;
    for (const p of cp) if (p[2] < NEAR) behind++;
    if (behind === cp.length) return false;
    if (behind) {
      q = [];
      for (let i = 0; i < cp.length; i++) {
        const a = cp[i], b = cp[(i + 1) % cp.length], ain = a[2] >= NEAR, bin = b[2] >= NEAR;
        if (ain) q.push(a);
        if (ain !== bin) { const t = (NEAR - a[2]) / (b[2] - a[2]); q.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR]); }
      }
      if (q.length < 3) return false;
    }
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    const xs = [], ys = [];
    for (const p of q) { const x = SX(p), y = SY(p); xs.push(x); ys.push(y); if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    if (maxX < -40 || minX > W + 40 || maxY < -40 || minY > H + 40) return false;
    ctx.beginPath();
    ctx.moveTo(xs[0], ys[0]);
    for (let i = 1; i < xs.length; i++) ctx.lineTo(xs[i], ys[i]);
    ctx.closePath();
    return true;
  }
  function poly(ctx, c, pts, fill, stroke, lw) {        // pts: flat [x, y, z, x, y, z, ...] in world metres
    const cp = [];
    for (let i = 0; i < pts.length; i += 3) cp.push(cam3(c, pts[i], pts[i + 1], pts[i + 2]));
    if (!trace(ctx, cp)) return false;
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
    return true;
  }
  function line3(ctx, c, x0, y0, z0, x1, y1, z1) {      // adds to the current path
    let a = cam3(c, x0, y0, z0), b = cam3(c, x1, y1, z1);
    if (a[2] < NEAR && b[2] < NEAR) return;
    if (a[2] < NEAR) { const t = (NEAR - a[2]) / (b[2] - a[2]); a = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR]; }
    if (b[2] < NEAR) { const t = (NEAR - b[2]) / (a[2] - b[2]); b = [b[0] + (a[0] - b[0]) * t, b[1] + (a[1] - b[1]) * t, NEAR]; }
    ctx.moveTo(SX(a), SY(a)); ctx.lineTo(SX(b), SY(b));
  }

  // --- static meshes, built once from the same volumes the rules use ---------------------
  function faceOf(pts, col, centre) {
    const a = v3(pts[0], pts[1], pts[2]), b = v3(pts[3], pts[4], pts[5]), c = v3(pts[6], pts[7], pts[8]);
    let n = unit(cross(sub(b, a), sub(c, a)));
    let mx = 0, my = 0, mz = 0; const k = pts.length / 3;
    for (let i = 0; i < pts.length; i += 3) { mx += pts[i]; my += pts[i + 1]; mz += pts[i + 2]; }
    const m = v3(mx / k, my / k, mz / k);
    if ((m.x - centre.x) * n.x + (m.y - centre.y) * n.y + (m.z - centre.z) * n.z < 0) n = mul(n, -1);
    return { p: pts, n, c: col, m };
  }
  function buildMesh(v) {
    const faces = [], base = C[v.color], trim = C.cream, dark = scaleC(base, 0.86);
    const W3 = (lx, y, lz) => { const w = toWorld(v, lx, lz); return [w[0], y, w[1]]; };
    const centreAt = (lx, y, lz) => { const w = toWorld(v, lx, lz); return v3(w[0], y, w[1]); };
    const quad = (a, b, c2, d, col, ctr) => faces.push(faceOf([...a, ...b, ...c2, ...d], col, ctr));
    if (v.shape === 'can') {                           // an upright inflatable cylinder with a trim band
      const N = 16, bands = [[0, 0.36, base], [0.36, 0.5, trim], [0.5, 1, base]], ctr = centreAt(0, v.top / 2, 0);
      for (let i = 0; i < N; i++) {
        const a0 = (i / N) * 2 * Math.PI, a1 = ((i + 1) / N) * 2 * Math.PI, r = v.hx;
        for (const [y0, y1, col] of bands) {
          quad(W3(Math.cos(a0) * r, y0 * v.top, Math.sin(a0) * r), W3(Math.cos(a1) * r, y0 * v.top, Math.sin(a1) * r),
            W3(Math.cos(a1) * r, y1 * v.top, Math.sin(a1) * r), W3(Math.cos(a0) * r, y1 * v.top, Math.sin(a0) * r), col, ctr);
        }
      }
      const cap = [];
      for (let i = 0; i < N; i++) cap.push(...W3(Math.cos((i / N) * 2 * Math.PI) * v.hx * 0.96, v.top, Math.sin((i / N) * 2 * Math.PI) * v.hx * 0.96));
      faces.push(faceOf(cap, dark, ctr));
    } else if (v.shape === 'ball') {                   // a beach-ball of gores in two colours
      const R = v.top / 2, rings = 9, segs = 16, ctr = v3(v.x, R, v.z);
      for (let i = 0; i < rings; i++) {
        const t0 = (i / rings) * Math.PI, t1 = ((i + 1) / rings) * Math.PI;
        for (let j = 0; j < segs; j++) {
          const p0 = (j / segs) * 2 * Math.PI, p1 = ((j + 1) / segs) * 2 * Math.PI;
          const P = (t, p) => [v.x + Math.sin(t) * Math.cos(p) * R, R + Math.cos(t) * R, v.z + Math.sin(t) * Math.sin(p) * R];
          const col = Math.floor(j / 2) % 2 ? C.bunkerA : C.bunkerC;
          if (i === 0) faces.push(faceOf([...P(t0, p0), ...P(t1, p1), ...P(t1, p0)], col, ctr));
          else if (i === rings - 1) faces.push(faceOf([...P(t0, p0), ...P(t0, p1), ...P(t1, p0)], col, ctr));
          else quad(P(t0, p0), P(t0, p1), P(t1, p1), P(t1, p0), col, ctr);
        }
      }
    } else if (v.shape === 'dorito') {                 // a peaked inflatable: straight skirt, sloped roof
      const s = 0.34, ky = v.top * 0.45, ctr = centreAt(0, v.top / 2, 0);
      const B = [[-v.hx, -v.hz], [v.hx, -v.hz], [v.hx, v.hz], [-v.hx, v.hz]];
      for (let i = 0; i < 4; i++) {
        const [ax, az] = B[i], [bx, bz] = B[(i + 1) % 4];
        quad(W3(ax, 0, az), W3(bx, 0, bz), W3(bx, ky, bz), W3(ax, ky, az), i % 2 ? base : dark, ctr);
        quad(W3(ax, ky, az), W3(bx, ky, bz), W3(bx * s, v.top, bz * s), W3(ax * s, v.top, az * s), i % 2 ? base : dark, ctr);
        quad(W3(ax, ky - 0.18, az), W3(bx, ky - 0.18, bz), W3(bx, ky, bz), W3(ax, ky, az), trim, ctr);
      }
      faces.push(faceOf([...W3(-v.hx * s, v.top, -v.hz * s), ...W3(v.hx * s, v.top, -v.hz * s), ...W3(v.hx * s, v.top, v.hz * s), ...W3(-v.hx * s, v.top, v.hz * s)], base, ctr));
    } else {                                           // snake, brick, standup: a rounded prism in air cells
      const hz = v.hz, t = v.top, round = v.shape === 'standup' ? 0.06 : Math.min(0.45, hz * 0.6);
      const prof = [[-hz, 0], [hz, 0], [hz, t - round], [hz - round * 0.45, t - round * 0.2], [0, t], [-hz + round * 0.45, t - round * 0.2], [-hz, t - round]];
      const cells = v.shape === 'standup' ? 1 : Math.max(1, Math.round((2 * v.hx) / 1.1));
      for (let k = 0; k < cells; k++) {
        const x0 = -v.hx + ((2 * v.hx) / cells) * k, x1 = x0 + (2 * v.hx) / cells, ctr = centreAt((x0 + x1) / 2, t / 2, 0);
        const col = k % 2 ? dark : base;
        for (let i = 0; i < prof.length; i++) {
          const [az, ay] = prof[i], [bz, by] = prof[(i + 1) % prof.length];
          if (ay === 0 && by === 0) continue;
          quad(W3(x0, ay, az), W3(x0, by, bz), W3(x1, by, bz), W3(x1, ay, az), v.shape === 'standup' && ay > t * 0.55 && ay < t * 0.75 ? trim : col, ctr);
        }
        if (v.shape === 'standup') { quad(W3(x0 - 0.001, t * 0.55, -hz - 0.01), W3(x1 + 0.001, t * 0.55, -hz - 0.01), W3(x1, t * 0.72, -hz - 0.01), W3(x0, t * 0.72, -hz - 0.01), trim, ctr); quad(W3(x0, t * 0.55, hz + 0.01), W3(x1, t * 0.55, hz + 0.01), W3(x1, t * 0.72, hz + 0.01), W3(x0, t * 0.72, hz + 0.01), trim, ctr); }
        for (const [xe, end] of [[x0, k === 0], [x1, k === cells - 1]]) {
          if (!end) continue;
          const cap = [];
          for (const [pz, py] of prof) cap.push(...W3(xe, py, pz));
          faces.push(faceOf(cap, col, ctr));
        }
      }
    }
    return faces;
  }
  const MESH = VOL.map(buildMesh);
  // Soft shadows: the footprint smeared away from the sun.
  function hull(pts) {
    pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }
  const SHADOW = VOL.map((v) => {
    const foot = [];
    if (v.shape === 'can' || v.shape === 'ball') for (let i = 0; i < 16; i++) foot.push([v.x + Math.cos((i / 16) * 2 * Math.PI) * v.hx, v.z + Math.sin((i / 16) * 2 * Math.PI) * v.hx]);
    else for (const [lx, lz] of [[-v.hx, -v.hz], [v.hx, -v.hz], [v.hx, v.hz], [-v.hx, v.hz]]) foot.push(toWorld(v, lx, lz));
    const ox = (-SUN.x / SUN.y) * v.top * 0.55, oz = (-SUN.z / SUN.y) * v.top * 0.55;
    const all = foot.concat(foot.map(([x, z]) => [x + ox, z + oz]));
    const h = hull(all), out = [];
    for (const [x, z] of h) out.push(x, 0.004, z);
    return out;
  });
  // The world outside the netting: a treeline, pit tents, a scoreboard tower.
  const TREES = [];
  for (let i = 0; i < 84; i++) {
    const a = (i / 84) * 2 * Math.PI + hash(i) * 0.05, r = 62 + hash(i + 99) * 26;
    TREES.push({ x: Math.cos(a) * r * 0.85, z: Math.sin(a) * r, h: 9 + hash(i + 7) * 8, w: 3.2 + hash(i + 3) * 2.6, c: hash(i + 5) });
  }
  const PROPS = [];
  function propBox(x0, y0, z0, x1, y1, z1, col) {
    const ctr = v3((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), f = [];
    const P = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]];
    for (const q of [[0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7], [4, 5, 6, 7]]) f.push(faceOf(q.flatMap((i) => P[i]), col, ctr));
    return f;
  }
  function tent(x, z, col) {
    const f = [], s = 1.6, h0 = 2.3, h1 = 3.1, ctr = v3(x, 2.4, z);
    const cs = [[-s, -s], [s, -s], [s, s], [-s, s]];
    for (let i = 0; i < 4; i++) {
      const [ax, az] = cs[i], [bx, bz] = cs[(i + 1) % 4];
      f.push(faceOf([x + ax, h0, z + az, x + bx, h0, z + bz, x, h1, z], i % 2 ? col : scaleC(col, 0.85), ctr));
      f.push(faceOf([x + ax, h0 - 0.28, z + az, x + bx, h0 - 0.28, z + bz, x + bx, h0, z + bz, x + ax, h0, z + az], C.cream, ctr));
      f.push(...propBox(x + ax * 0.97 - 0.04, 0, z + az * 0.97 - 0.04, x + ax * 0.97 + 0.04, h0, z + az * 0.97 + 0.04, [60, 64, 70]));
    }
    return { x, z, f };
  }
  PROPS.push(tent(-22, -9, C.teal), tent(-22, 6, C.amber), tent(22, -3, C.bunkerA), tent(22, 12, C.teal));
  PROPS.push({ x: 0, z: 34, board: true, f: [...propBox(-5, 3.2, 33.6, 5, 7.4, 34.2, [34, 40, 48]), ...propBox(-0.3, 0, 33.8, 0.3, 3.2, 34.1, [70, 74, 80])] });
  PROPS.push({ x: -26, z: -20, f: propBox(-29, 0, -24, -25, 1.0, -21, [120, 86, 60]) });
  PROPS.push({ x: 26, z: 20, f: propBox(25, 0, 18, 29, 1.0, 22, [120, 86, 60]) });
  const CLOUDS = [];
  for (let i = 0; i < 14; i++) CLOUDS.push({ a: hash(i + 300) * 2 * Math.PI, e: 0.08 + hash(i + 301) * 0.22, s: 0.06 + hash(i + 302) * 0.07 });

  // --- the bot model: an R6-style rig of boxes --------------------------------------------
  // Parts are [cx, cy, cz, hw, hh, hd, pivotY, pitch, colour] in the bot's frame: +x right, +z forward.
  function botParts(b) {
    const L = TIER_LOOK[b.tier], cr = b.alive ? b.crouch : 0, walking = Math.hypot(b.vx, b.vz) > 0.2 || (!b.alive && b.outT > 0.8);
    const swing = walking ? Math.sin(b.walk) * 0.7 : 0, drop = 0.5 * cr, legH = 0.4 - 0.15 * cr;
    const hip = 0.8 - drop, glove = [34, 34, 38], mask = [38, 40, 46];
    const parts = [
      [-0.11, hip - legH, 0.08 * cr, 0.1, legH, 0.1, hip, swing - cr * 0.9, L.pants],
      [0.11, hip - legH, -0.05 * cr, 0.1, legH, 0.1, hip, -swing + cr * 0.4, L.pants],
      [0, hip + 0.31, 0, 0.23, 0.31, 0.12, hip, 0, L.jersey],
      [0, hip + 0.37, 0.001, 0.235, 0.05, 0.125, hip, 0, L.trim],
      [0, hip + 0.8, 0, 0.15, 0.15, 0.15, hip, 0, mask],
    ];
    const sh = hip + 0.58;
    if (b.alive) {
      parts.push([0.32, sh - 0.25, 0.17, 0.085, 0.085, 0.3, sh, 0, L.jersey], [-0.26, sh - 0.25, 0.2, 0.085, 0.085, 0.28, sh, 0, L.jersey]);
      parts.push([0.12, sh - 0.2, 0.52, 0.045, 0.06, 0.34, sh, 0, [30, 30, 34]], [0.12, sh - 0.04, 0.3, 0.11, 0.1, 0.13, sh, 0, [240, 240, 236]]);
      parts.push([0.12, sh - 0.27, 0.1, 0.06, 0.06, 0.2, sh, 0, [70, 74, 82]]);
    } else {                                         // out: hand up, marker pointed at the ground
      parts.push([0.32, sh + 0.3, 0, 0.085, 0.3, 0.085, sh, 0, L.jersey], [0.32, sh + 0.62, 0, 0.09, 0.07, 0.09, sh, 0, glove]);
      parts.push([-0.32, sh - 0.3, 0, 0.085, 0.3, 0.085, sh, 0, L.jersey], [-0.32, sh - 0.66, 0.12, 0.045, 0.06, 0.3, sh - 0.66, 0.9, [30, 30, 34]]);
    }
    return parts;
  }
  function boxFaces(b, part, cy) {
    const [px, py, pz, hw, hh, hd, pivY, pitch, col] = part;
    const cs = Math.cos(b.face), sn = Math.sin(b.face), cp = Math.cos(pitch), spn = Math.sin(pitch);
    // local corner -> pitch about the pivot (around local x) -> yaw -> world
    const toW = (x, y, z) => {
      const ry = pivY + (y - pivY) * cp - z * spn, rz = (y - pivY) * spn + z * cp;
      return [b.x + x * cs + rz * sn, ry + cy, b.z - x * sn + rz * cs];
    };
    const P = [];
    for (const [sx2, sy2, sz2] of [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1], [-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]]) P.push(toW(px + sx2 * hw, py + sy2 * hh, pz + sz2 * hd));
    const ctr = toW(px, py, pz), c3 = v3(ctr[0], ctr[1], ctr[2]), out = [];
    for (const q of [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]) out.push(faceOf(q.flatMap((i) => P[i]), col, c3));
    return { c: c3, faces: out, front: [P[6], P[7], P[3], P[2]] };
  }

  // --- paint on things ---------------------------------------------------------------------
  function splatPoly(ctx, c, sp, dist) {
    let t1, t2, n;
    if (sp.n === 0) { n = v3(0, 1, 0); t1 = v3(sp.dx, 0, sp.dz); t2 = v3(-sp.dz, 0, sp.dx); }
    else {
      n = v3(sp.nx, sp.ny, sp.nz);
      t1 = Math.abs(n.y) > 0.9 ? v3(1, 0, 0) : unit(cross(n, v3(0, 1, 0)));
      t2 = cross(n, t1);
    }
    const col = paintOf(sp.c), K = dist < 20 ? 10 : 7, pts = [], ox = sp.x + n.x * 0.012, oy = sp.y + n.y * 0.012, oz = sp.z + n.z * 0.012;
    for (let k = 0; k < K; k++) {
      const a = (k / K) * 2 * Math.PI, rr = sp.r * (0.7 + 0.6 * hash(sp.s * 1000 + k));
      const u = Math.cos(a) * rr * sp.st, w = Math.sin(a) * rr;
      pts.push(ox + t1.x * u + t2.x * w, oy + t1.y * u + t2.y * w, oz + t1.z * u + t2.z * w);
    }
    const fill = css(mix(scaleC(col, 0.82), FOG, clamp((dist - 18) / 150, 0, 0.5)));
    poly(ctx, c, pts, fill);
    if (dist < 22) {
      const hl = [];
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * 2 * Math.PI, rr = sp.r * 0.42;
        const u = Math.cos(a) * rr * sp.st - sp.r * 0.12, w = Math.sin(a) * rr - sp.r * 0.1;
        hl.push(ox + n.x * 0.003 + t1.x * u + t2.x * w, oy + n.y * 0.003 + t1.y * u + t2.y * w, oz + n.z * 0.003 + t1.z * u + t2.z * w);
      }
      poly(ctx, c, hl, css(mix(col, [255, 255, 255], 0.25)));
      if (sp.n !== 0 && Math.abs(n.y) < 0.6) {         // a drip running down a wall
        const dl = sp.r * (1 + 2.5 * hash(sp.s * 77)), dw = sp.r * 0.16, off = (hash(sp.s * 31) - 0.5) * sp.r;
        const bx = ox + t1.x * off, bz = oz + t1.z * off;
        poly(ctx, c, [bx - t1.x * dw, oy, bz - t1.z * dw, bx + t1.x * dw, oy, bz + t1.z * dw, bx + t1.x * dw * 0.6, oy - dl, bz + t1.z * dw * 0.6, bx - t1.x * dw * 0.6, oy - dl, bz - t1.z * dw * 0.6], fill);
      }
    }
  }
  function distTo(c, x, y, z) { return Math.hypot(x - c.e.x, y - c.e.y, z - c.e.z); }
  function volDist(c, v) {
    if (v.shape === 'can' || v.shape === 'ball') return Math.max(0, Math.hypot(v.x - c.e.x, v.z - c.e.z) - v.hx);
    const lx = toLocalX(v, c.e.x, c.e.z), lz = toLocalZ(v, c.e.x, c.e.z);
    return Math.hypot(Math.max(0, Math.abs(lx) - v.hx), Math.max(0, Math.abs(lz) - v.hz));
  }
  function drawFaces(ctx, c, faces, edge) {
    for (const f of faces) {
      if ((f.m.x - c.e.x) * f.n.x + (f.m.y - c.e.y) * f.n.y + (f.m.z - c.e.z) * f.n.z >= 0) continue;
      poly(ctx, c, f.p, lit(f.c, f.n, distTo(c, f.m.x, f.m.y, f.m.z)), edge, 0.7);
    }
  }
  function drawBot(ctx, c, s, b) {
    const parts = botParts(b).map((pt) => boxFaces(b, pt, 0));
    parts.sort((a, z) => distTo(c, z.c.x, z.c.y, z.c.z) - distTo(c, a.c.x, a.c.y, a.c.z));
    for (const pt of parts) drawFaces(ctx, c, pt.faces, 'rgba(0,0,0,0.18)');
    // Goggles: a lens on the front of the mask, catching the sky.
    const head = boxFaces(b, [0, 0.8 - 0.5 * (b.alive ? b.crouch : 0) + 0.83, 0.151, 0.12, 0.05, 0.001, 0, 0, [0, 0, 0]], 0);
    const fw = v3(Math.sin(b.face), 0, Math.cos(b.face));
    if ((head.c.x - c.e.x) * fw.x + (head.c.z - c.e.z) * fw.z < 0) {
      const q = head.front;
      poly(ctx, c, [...q[0], ...q[1], ...q[2], ...q[3]], b.alive ? css(mix(TIER_LOOK[b.tier].trim, [40, 60, 80], 0.45)) : 'rgb(60,60,66)', 'rgba(0,0,0,0.6)', 1);
    }
    if (b.splat) {                                     // where the paint landed
      const a = b.face + b.splat.a, y = clamp(b.splat.y, 0.3, 1.7);
      const n = v3(Math.sin(a), 0, Math.cos(a));
      if ((b.x - c.e.x) * n.x + (b.z - c.e.z) * n.z < 0.2) {
        splatPoly(ctx, c, { n: 1, nx: n.x, ny: 0, nz: n.z, x: b.x + n.x * (BODY_R - 0.06), y, z: b.z + n.z * (BODY_R - 0.06), r: 0.2, st: 1, c: -1, s: b.i + 0.37 }, distTo(c, b.x, y, b.z));
      }
    }
  }
  function drawBall(ctx, c, ball) {
    const a = cam3(c, ball.x, ball.y, ball.z);
    if (a[2] < NEAR) return;
    const x = SX(a), y = SY(a);
    if (x < -10 || x > W + 10 || y < -10 || y > H + 10) return;
    const col = paintOf(ball.c), r = Math.max(1.3, (0.0086 * FOCAL) / a[2] * 2.2);
    const b0 = cam3(c, ball.px - (ball.x - ball.px) * 1.5, ball.py - (ball.y - ball.py) * 1.5, ball.pz - (ball.z - ball.pz) * 1.5);
    if (b0[2] > NEAR) {
      ctx.strokeStyle = css(col, 0.35); ctx.lineWidth = r * 1.3;
      ctx.beginPath(); ctx.moveTo(SX(b0), SY(b0)); ctx.lineTo(x, y); ctx.stroke();
    }
    ctx.fillStyle = css(mix(col, [255, 255, 255], 0.2));
    ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.fill();
  }

  function drawSky(ctx, c) {
    const hy = H / 2 + Math.tan(c.pitch) * FOCAL;
    const g = ctx.createLinearGradient(0, hy - FOCAL * 1.6, 0, hy);
    g.addColorStop(0, 'rgb(64,128,206)'); g.addColorStop(0.7, 'rgb(142,190,232)'); g.addColorStop(1, 'rgb(206,226,240)');
    ctx.fillStyle = g; ctx.fillRect(-W, -H, W * 3, hy + H);
    for (const cl of CLOUDS) {
      const d = v3(Math.cos(cl.e) * Math.sin(cl.a), Math.sin(cl.e), Math.cos(cl.e) * Math.cos(cl.a));
      const q = cam3(c, c.e.x + d.x * 1000, c.e.y + d.y * 1000, c.e.z + d.z * 1000);
      if (q[2] < 50) continue;
      const x = SX(q), y = SY(q), r = cl.s * FOCAL;
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      ctx.ellipse(x, y, r * 1.6, r * 0.45, 0, 0, 2 * Math.PI);
      ctx.ellipse(x - r * 0.6, y - r * 0.25, r * 0.7, r * 0.45, 0, 0, 2 * Math.PI);
      ctx.ellipse(x + r * 0.5, y - r * 0.35, r * 0.8, r * 0.55, 0, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.fillStyle = css([74, 104, 64]);
    ctx.fillRect(-W, hy, W * 3, H * 2);
    const hz = ctx.createLinearGradient(0, hy - 2, 0, hy + 26);
    hz.addColorStop(0, css(FOG, 0.9)); hz.addColorStop(1, css(FOG, 0));
    ctx.fillStyle = hz; ctx.fillRect(-W, hy - 2, W * 3, 28);
  }
  function drawGround(ctx, c) {
    // Mowed turf in 5 m bands, the sideline apron, the centre line.
    poly(ctx, c, [-HALF_W - 4, 0, -HALF_L - 4, HALF_W + 4, 0, -HALF_L - 4, HALF_W + 4, 0, HALF_L + 4, -HALF_W - 4, 0, HALF_L + 4], css(mix([128, 112, 86], FOG, 0.12)));
    const bands = Math.round(MAP.bounds.lengthMetres / 5);
    for (let i = 0; i < bands; i++) {
      const z0 = -HALF_L + (i * MAP.bounds.lengthMetres) / bands, z1 = z0 + MAP.bounds.lengthMetres / bands;
      const d = Math.abs((z0 + z1) / 2 - c.e.z);
      poly(ctx, c, [-HALF_W, 0, z0, HALF_W, 0, z0, HALF_W, 0, z1, -HALF_W, 0, z1], css(mix(i % 2 ? C.ground : C.turf, FOG, clamp((d - 18) / 150, 0, 0.5))));
    }
    const chalk = 'rgba(240,240,232,0.85)';
    poly(ctx, c, [-HALF_W, 0.002, -0.09, HALF_W, 0.002, -0.09, HALF_W, 0.002, 0.09, -HALF_W, 0.002, 0.09], chalk);
    for (const zz of [-HALF_L + 3, HALF_L - 3]) poly(ctx, c, [-4, 0.002, zz - 0.06, 4, 0.002, zz - 0.06, 4, 0.002, zz + 0.06, -4, 0.002, zz + 0.06], chalk);
  }
  function drawNetting(ctx, c, s) {
    const top = DATA.map.wallHeight, walls = [
      [-HALF_W, -HALF_L, HALF_W, -HALF_L], [HALF_W, -HALF_L, HALF_W, HALF_L], [HALF_W, HALF_L, -HALF_W, HALF_L], [-HALF_W, HALF_L, -HALF_W, -HALF_L],
    ];
    for (const [x0, z0, x1, z1] of walls) {
      poly(ctx, c, [x0, 0, z0, x1, 0, z1, x1, top, z1, x0, top, z0], css(C.netting, 0.13));
      poly(ctx, c, [x0, 0, z0, x1, 0, z1, x1, 0.55, z1, x0, 0.55, z0], css(mix(C.netting, FOG, 0.15)));
    }
    ctx.strokeStyle = css(C.netting, 0.3); ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (const [x0, z0, x1, z1] of walls) {
      const L = Math.hypot(x1 - x0, z1 - z0), n = Math.round(L / 1.25);
      for (let i = 1; i < n; i++) { const t = i / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t; line3(ctx, c, x, 0.55, z, x, top, z); }
      for (let y = 1.3; y < top; y += 0.9) line3(ctx, c, x0, y, z0, x1, y, z1);
    }
    ctx.stroke();
    ctx.strokeStyle = css([44, 48, 54]); ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (const [x0, z0, x1, z1] of walls) {
      const L = Math.hypot(x1 - x0, z1 - z0), n = Math.round(L / 5.5);
      for (let i = 0; i < n; i++) { const t = i / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t; line3(ctx, c, x, 0, z, x, top + 0.3, z); }
      line3(ctx, c, x0, top, z0, x1, top, z1);
    }
    ctx.stroke();
    for (const sp of s.splats) if (sp.v === -2) {
      const d = distTo(c, sp.x, sp.y, sp.z);
      if (d < 50) splatPoly(ctx, c, { n: 1, nx: sp.dx, ny: 0, nz: sp.dz, x: sp.x, y: sp.y, z: sp.z, r: sp.r, st: 1, c: sp.c, s: sp.s }, d);
    }
  }
  function drawTree(ctx, c, t) {
    const d = distTo(c, t.x, t.h / 2, t.z), r = c.r;
    const g = mix(mix([38, 78, 46], [58, 96, 52], t.c), FOG, clamp((d - 18) / 150, 0, 0.62));
    poly(ctx, c, [t.x - r.x * 0.25, 0, t.z - r.z * 0.25, t.x + r.x * 0.25, 0, t.z + r.z * 0.25, t.x + r.x * 0.2, 2.2, t.z + r.z * 0.2, t.x - r.x * 0.2, 2.2, t.z - r.z * 0.2], css(mix([80, 60, 44], FOG, 0.4)));
    for (const [y0, y1, w] of [[1.6, t.h * 0.72, t.w], [t.h * 0.4, t.h, t.w * 0.72]]) {
      poly(ctx, c, [t.x - r.x * w, y0, t.z - r.z * w, t.x + r.x * w, y0, t.z + r.z * w, t.x, y1, t.z], css(g));
    }
  }

  // The scoreboard behind the far end: a 10 x 4.2 m face, drawn with an affine map of its corners.
  function drawBoard(ctx, c, s) {
    const z = 33.59, tl = cam3(c, -5, 7.4, z), tr = cam3(c, 5, 7.4, z), bl = cam3(c, -5, 3.2, z);
    if (c.e.z >= z || tl[2] < 1 || tr[2] < 1 || bl[2] < 1) return;
    const x0 = SX(tl), y0 = SY(tl), ux = (SX(tr) - x0) / 400, uy = (SY(tr) - y0) / 400, vx = (SX(bl) - x0) / 168, vy = (SY(bl) - y0) / 168;
    ctx.save();
    ctx.transform(ux, uy, vx, vy, x0, y0);
    ctx.fillStyle = 'rgb(18,22,28)'; ctx.fillRect(8, 8, 384, 152);
    ctx.fillStyle = css(PLAYER_PAINT); ctx.fillRect(8, 8, 384, 10);
    txt(ctx, 'PAINTBALL', 200, 62, 40, '#fff', 'center', 900);
    txt(ctx, 'INSANITY', 200, 108, 46, css(PLAYER_PAINT), 'center', 900);
    const left = s.bots.filter((b) => b.alive).length;
    txt(ctx, s.round ? `ROUND ${s.round}   ·   ${left} LEFT` : DATA.map.displayName.toUpperCase(), 200, 146, 22, css(C.amber), 'center', 800);
    ctx.restore();
  }

  function renderWorld(ctx, s, c) {
    drawSky(ctx, c);
    drawGround(ctx, c);
    ctx.fillStyle = 'rgba(24,36,20,0.26)';
    SHADOW.forEach((sh, i) => { if (volDist(c, VOL[i]) < 80) poly(ctx, c, sh, ctx.fillStyle); });
    for (const b of s.bots) {
      if (Math.abs(b.x) > HALF_W) continue;
      const pts = [];
      for (let k = 0; k < 8; k++) { const a = (k / 8) * 2 * Math.PI; pts.push(b.x + Math.cos(a) * 0.42 + 0.12, 0.004, b.z + Math.sin(a) * 0.34 + 0.1); }
      poly(ctx, c, pts, 'rgba(24,36,20,0.3)');
    }
    for (const sp of s.splats) if (sp.v === -1) { const d = distTo(c, sp.x, 0, sp.z); if (d < 55) splatPoly(ctx, c, sp, d); }
    // Outside the netting, far to near.
    const outside = TREES.map((t) => ({ d: distTo(c, t.x, 0, t.z), t })).concat(PROPS.map((p) => ({ d: distTo(c, p.x, 1, p.z), p })));
    for (const b of s.bots) if (Math.abs(b.x) > HALF_W) outside.push({ d: distTo(c, b.x, 1, b.z), b });
    outside.sort((a, b) => b.d - a.d);
    for (const o of outside) {
      if (o.t) drawTree(ctx, c, o.t);
      else if (o.p) { drawFaces(ctx, c, o.p.f, 'rgba(0,0,0,0.15)'); if (o.p.board) drawBoard(ctx, c, s); }
      else drawBot(ctx, c, s, o.b);
    }
    drawNetting(ctx, c, s);
    // Inside: bunkers, bodies and paint in flight, far to near.
    const items = [];
    VOL.forEach((v, i) => items.push({ d: volDist(c, v), v: i }));
    for (const b of s.bots) if (Math.abs(b.x) <= HALF_W) items.push({ d: Math.max(0, distTo(c, b.x, c.e.y, b.z) - BODY_R), b });
    for (const ball of s.balls) items.push({ d: distTo(c, ball.x, ball.y, ball.z), ball });
    items.sort((a, b) => b.d - a.d);
    for (const it of items) {
      if (it.ball) { drawBall(ctx, c, it.ball); continue; }
      if (it.b) { drawBot(ctx, c, s, it.b); continue; }
      drawFaces(ctx, c, MESH[it.v], it.d < 30 && VOL[it.v].shape !== 'ball' ? 'rgba(0,0,0,0.1)' : null);
      for (const sp of s.splats) {
        if (sp.v !== it.v) continue;
        if ((sp.x - c.e.x) * sp.nx + (sp.y - c.e.y) * sp.ny + (sp.z - c.e.z) * sp.nz >= 0) continue;
        const d = distTo(c, sp.x, sp.y, sp.z);
        if (d < 60) splatPoly(ctx, c, sp, d);
      }
    }
  }

  // --- 2D helpers --------------------------------------------------------------------------
  const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
  function txt(ctx, str, x, y, size, col, align, weight, stroke) {
    ctx.font = `${weight || 700} ${size}px ${FONT}`;
    ctx.textAlign = align || 'left'; ctx.textBaseline = 'alphabetic';
    if (stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(2, size / 5); ctx.strokeStyle = stroke; ctx.strokeText(str, x, y); }
    ctx.fillStyle = col; ctx.fillText(str, x, y);
  }
  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }
  function wrap(ctx, str, maxW, size, weight) {
    ctx.font = `${weight || 600} ${size}px ${FONT}`;
    const words = str.split(' '), lines = [];
    let cur = '';
    for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
    if (cur) lines.push(cur);
    return lines;
  }
  const commas = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const clock = (sec) => { const t = Math.max(0, Math.ceil(sec)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
  function blob(ctx, x, y, r, seed, col) {               // a soft paint blot: a smooth curve through wobbling points
    const K = 9, pts = [];
    for (let k = 0; k < K; k++) { const a = (k / K) * 2 * Math.PI, rr = r * (0.8 + 0.34 * hash(seed * 131 + k)); pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
    ctx.fillStyle = col;
    ctx.beginPath();
    const mid = (i) => [(pts[i % K][0] + pts[(i + 1) % K][0]) / 2, (pts[i % K][1] + pts[(i + 1) % K][1]) / 2];
    const m0 = mid(0);
    ctx.moveTo(m0[0], m0[1]);
    for (let k = 1; k <= K; k++) { const m = mid(k); ctx.quadraticCurveTo(pts[k % K][0], pts[k % K][1], m[0], m[1]); }
    ctx.fill();
  }
  function drip(ctx, x, y, w, len, col) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y); ctx.lineTo(x - w * 0.35, y + len); ctx.arc(x, y + len, w * 0.35, Math.PI, 0, true); ctx.lineTo(x + w / 2, y); ctx.fill();
    ctx.beginPath(); ctx.arc(x, y + len + w * 0.1, w * 0.55, 0, 2 * Math.PI); ctx.fill();
  }

  // --- the marker in your hands ---------------------------------------------------------------
  // View-space meshes share a forward (+z) barrel axis. Perspective makes the
  // muzzle recede toward the reticle instead of presenting a side-on silhouette.
  function markerMesh(kind) {
    const faces = [], body = kind === 'electronic' ? [52, 150, 170] : kind === 'pump' ? [36, 38, 42] : [70, 74, 82];
    const dark = [28, 32, 38], steel = [135, 147, 157], glove = [36, 39, 44];
    const box = (x0, y0, z0, x1, y1, z1, col) => {
      faces.push(...propBox(x0, y0, z0, x1, y1, z1, col));
      faces.push(faceOf([x0,y0,z0, x0,y0,z1, x1,y0,z1, x1,y0,z0], col, v3((x0+x1)/2,(y0+y1)/2,(z0+z1)/2)));
    };
    const tube = (x, y, z0, z1, radius, col) => {
      const centre = v3(x, y, (z0 + z1) / 2), cap = [];
      for (let i = 0; i < 12; i++) {
        const a = i * Math.PI / 6, b = (i + 1) * Math.PI / 6;
        const ax = x + Math.cos(a) * radius, ay = y + Math.sin(a) * radius;
        const bx = x + Math.cos(b) * radius, by = y + Math.sin(b) * radius;
        faces.push(faceOf([ax,ay,z0, bx,by,z0, bx,by,z1, ax,ay,z1], col, centre));
        cap.push(ax, ay, z0);
      }
      faces.push(faceOf(cap, scaleC(col, .65), centre));
    };
    const oval = (x, y, z, rx, ry, rz, col) => {
      const centre = v3(x,y,z), point = (a,b) => [x+rx*Math.cos(a)*Math.cos(b),y+ry*Math.sin(b),z+rz*Math.sin(a)*Math.cos(b)];
      for(let row=0;row<6;row++)for(let i=0;i<12;i++){
        const a=i*Math.PI/6,b=(i+1)*Math.PI/6,lo=-Math.PI/2+row*Math.PI/6,hi=lo+Math.PI/6;
        faces.push(faceOf([...point(a,lo),...point(b,lo),...point(b,hi),...point(a,hi)],col,centre));
      }
    };
    // Forearms stay below the sight line and meet the forward and rear grips.
    const arm = (near, far, width, col) => {
      const centre = v3((near[0]+far[0])/2,(near[1]+far[1])/2,(near[2]+far[2])/2);
      const ring = (p,w) => [[p[0]-w,p[1]-w,p[2]],[p[0]+w,p[1]-w,p[2]],[p[0]+w,p[1]+w,p[2]],[p[0]-w,p[1]+w,p[2]]];
      const a=ring(near,width),b=ring(far,width*.65);
      for(let i=0;i<4;i++){const j=(i+1)%4;faces.push(faceOf([...a[i],...a[j],...b[j],...b[i]],col,centre));}
    };
    arm([-.34,-.52,.30],[-.035,-.12,1.02],.095,[34,38,43]);
    arm([.23,-.53,.29],[.04,-.19,.62],.10,[34,38,43]);
    box(-.085,-.175,.92,.045,-.045,1.075,glove);
    box(.00,-.25,.57,.10,-.105,.72,glove);
    box(.005,-.22,.55,.075,-.055,.73,dark);
    tube(.02,-.12,.32,.56,.082,steel);               // air tank behind the receiver
    box(-.068,-.045,.54,.068,.052,1.035,body);
    box(-.056,.052,.58,.056,.066,1.01,mix(body,[255,255,255],.3));
    box(-.027,.067,.63,.027,.081,.99,dark);          // sight rail follows the barrel
    const muzzle = kind === 'pump' ? 1.95 : kind === 'electronic' ? 1.86 : 1.76;
    tube(0,0,1.02,muzzle,.023,dark);
    tube(0,0,1.035,1.13,.032,steel);
    tube(0,0,muzzle-.075,muzzle,.027,[52,59,64]);
    if(kind==='electronic')box(.069,-.015,.67,.073,.025,.8,[45,205,160]);
    if(kind==='pump'){
      tube(0,-.014,1.1,1.34,.046,[128,82,46]);
      for(let i=0;i<5;i++)tube(0,-.014,1.11+i*.045,1.12+i*.045,.048,dark);
      box(.02,.058,.73,.067,.24,.775,[67,73,80]);
    }else{
      box(.025,.055,.68,.075,.15,.75,dark);
      oval(.085,.225,.72,kind==='electronic'?.145:.13,.095,.185,kind==='electronic'?[35,44,51]:[62,70,80]);
      tube(.085,.225,.535,.552,.062,dark);           // rear loader lid
    }
    return faces;
  }
  const MARKER_MESH = Object.fromEntries(MARKER_ORDER.map(kind => [kind, markerMesh(kind)]));

  function drawViewmodel(ctx, s) {
    const p=s.player,t=s.clock,m=MARKERS[s.marker];
    if(!p.alive)return;
    const moveK=Math.min(1,Math.hypot(p.vx,p.vz)/4);
    const reload=p.reloadUntil>0?Math.sin(clamp(1-(p.reloadUntil-t)/m.reloadSeconds,0,1)*Math.PI):0;
    const swing=p.swingAt>NEVER?Math.sin(clamp((t-p.swingAt)/DATA.match.melee.swingSeconds,0,1)*Math.PI):0;
    const camera=makeCam(v3(-.34+Math.sin(p.bob)*.007*moveK,
      .32+Math.abs(Math.cos(p.bob))*.006*moveK-p.recoil*.014+p.crouch*.006,
      p.recoil*.018),0,0);
    ctx.save();
    ctx.translate(W*.72,H*.93);
    ctx.rotate((p.sprinting?.22:0)+reload*.38-swing*.22);
    ctx.translate(0,(p.sprinting?24:0)+reload*75-swing*20);
    ctx.translate(-W*.72,-H*.93);
    // Sort a fresh face list, never the cached mesh or the simulation state.
    const faces=MARKER_MESH[s.marker].slice();
    const pump=s.marker==='pump',x=pump?.043:.085,y=pump?.076:.2,z=pump?.723:.533,w=pump?.016:.041,h=pump?.14:.028;
    const windowFace=(height,col,depth)=>faceOf([x-w,y,depth,x+w,y,depth,x+w,y+height,depth,x-w,y+height,depth],col,v3(x,y,depth+.01));
    faces.push(windowFace(h,[16,20,27],z));
    const fraction=clamp(p.hopper/m.hopperCapacity,0,1);
    if(fraction>0)faces.push(windowFace(h*fraction,PLAYER_PAINT,z-.002));
    faces.sort((a,b)=>distTo(camera,b.m.x,b.m.y,b.m.z)-distTo(camera,a.m.x,a.m.y,a.m.z));
    drawFaces(ctx,camera,faces,'rgba(8,14,20,0.3)');
    ctx.restore();
  }

  // --- HUD ---------------------------------------------------------------------------------
  function currentSpread(s) {
    const p = s.player, m = MARKERS[s.marker], speed = Math.hypot(p.vx, p.vz);
    const mult = (p.sprinting ? m.sprintingSpreadMultiplier : p.slideT > 0 ? m.movingSpreadMultiplier * 1.6 : speed > 0.6 ? m.movingSpreadMultiplier : 1) * (p.crouch > 0.5 ? m.crouchSpreadMultiplier : 1);
    return p.spread * mult;
  }
  function drawCrosshair(ctx, s) {
    const p = s.player, t = s.clock;
    if (!p.alive || (s.phase !== 'live' && s.phase !== 'warmup')) return;
    const gap = 5 + Math.tan(currentSpread(s) * DEG) * FOCAL, cx = W / 2, cy = H / 2, len = 7;
    ctx.lineCap = 'round';
    for (const [w, col] of [[4, 'rgba(0,0,0,0.55)'], [2, 'rgba(255,255,255,0.95)']]) {
      ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath();
      ctx.moveTo(cx - gap - len, cy); ctx.lineTo(cx - gap, cy); ctx.moveTo(cx + gap, cy); ctx.lineTo(cx + gap + len, cy);
      ctx.moveTo(cx, cy - gap - len); ctx.lineTo(cx, cy - gap); ctx.moveTo(cx, cy + gap); ctx.lineTo(cx, cy + gap + len);
      ctx.stroke();
    }
    ctx.fillStyle = css(PLAYER_PAINT); ctx.fillRect(cx - 1, cy - 1, 2, 2);
    const since = t - s.hud.marker;
    if (since < 0.45) {                                  // hit marker
      const a = 1 - since / 0.45, r0 = 9 + since * 20, r1 = r0 + 9;
      ctx.strokeStyle = `rgba(255,70,90,${a})`; ctx.lineWidth = 3; ctx.beginPath();
      for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { ctx.moveTo(cx + dx * r0 * 0.7, cy + dy * r0 * 0.7); ctx.lineTo(cx + dx * r1 * 0.7, cy + dy * r1 * 0.7); }
      ctx.stroke();
      const last = s.bots.filter((b) => !b.alive).sort((a2, b2) => a2.outT - b2.outT)[0];
      if (last) txt(ctx, `${last.name.toUpperCase()} IS OUT${s.stats.streak > 1 ? `  ×${s.stats.streak}` : ''}`, cx, cy + 46, 15, `rgba(255,255,255,${a})`, 'center', 900, `rgba(0,0,0,${a * 0.6})`);
    }
    for (const w of s.hud.whiz) {                        // where that just came from
      const age = t - w.t;
      if (age > 1.3) continue;
      const ang = wrapAng(Math.atan2(w.x - p.x, w.z - p.z) - p.yaw);
      ctx.strokeStyle = `rgba(255,190,60,${0.9 * (1 - age / 1.3)})`; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(cx, cy, 78, ang - Math.PI / 2 - 0.22, ang - Math.PI / 2 + 0.22); ctx.stroke();
    }
    if (t < p.invulnUntil) txt(ctx, 'SPAWN PROTECTED', cx, cy + 70, 12, 'rgba(255,255,255,0.8)', 'center', 800, 'rgba(0,0,0,0.5)');
  }
  function drawHud(ctx, s, ui) {
    const p = s.player, m = MARKERS[s.marker], t = s.clock, tierIx = s.bots.length ? s.bots[0].tier : s.baseTier;
    // Top centre: round, clock, who is left.
    const left = aliveBots(s).length;
    ctx.fillStyle = 'rgba(14,18,24,0.72)'; rrect(ctx, W / 2 - 150, 8, 300, 50, 10); ctx.fill();
    txt(ctx, `ROUND ${s.round}/${ROUNDS.count}`, W / 2 - 138, 28, 13, '#fff', 'left', 900);
    txt(ctx, TIERS[tierIx].displayName.toUpperCase(), W / 2 - 138, 44, 10, css(TIER_LOOK[tierIx].paint), 'left', 800);
    const remain = ROUNDS.roundTimeLimitSeconds - s.roundT;
    txt(ctx, clock(s.phase === 'warmup' ? ROUNDS.roundTimeLimitSeconds : remain), W / 2 + 138, 36, 22, remain < 30 && s.phase === 'live' && s.tick % 30 < 15 ? '#ff6a5a' : '#fff', 'right', 900);
    const n = s.bots.length, pw = Math.min(10, 130 / n);
    for (let i = 0; i < n; i++) {
      const b = s.bots[i], x = W / 2 - (n * pw) / 2 + i * pw + pw / 2 + 4, y = 64;
      ctx.fillStyle = b.alive ? css(TIER_LOOK[b.tier].jersey) : 'rgba(255,255,255,0.18)';
      ctx.beginPath(); ctx.arc(x, y + 4, pw * 0.36, 0, 2 * Math.PI); ctx.fill();
      if (!b.alive) { ctx.fillStyle = css(PLAYER_PAINT); ctx.beginPath(); ctx.arc(x + 1, y + 3, pw * 0.22, 0, 2 * Math.PI); ctx.fill(); }
    }
    txt(ctx, `${left} LEFT`, W / 2 + 108, 74, 10, 'rgba(255,255,255,0.75)', 'right', 800);
    // Top right: what this match is worth so far.
    const pay = payout(s);
    ctx.fillStyle = 'rgba(14,18,24,0.72)'; rrect(ctx, W - 176, 8, 166, 50, 10); ctx.fill();
    txt(ctx, `${commas(pay.total)} ${ECO.currency.short}`, W - 20, 32, 18, css(C.amber), 'right', 900);
    txt(ctx, `×${pay.death.toFixed(2)} deaths  ×${pay.acc.toFixed(2)} acc`, W - 20, 48, 10, 'rgba(255,255,255,0.7)', 'right', 700);
    if (ui && ui.rank) {
      txt(ctx, `LV ${ui.rank.level}`, W - 170, 74, 10, '#fff', 'left', 900, 'rgba(0,0,0,0.5)');
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(W - 140, 68, 124, 5);
      ctx.fillStyle = css(PLAYER_PAINT); ctx.fillRect(W - 140, 68, 124 * ui.rank.part, 5);
    }
    // Top left: the squad talking.
    let y = 24;
    for (const line of s.chat.lines) {
      const age = t - line.t;
      if (age > 9) continue;
      const a = age > 7.5 ? (9 - age) / 1.5 : 1;
      const b = s.bots[line.bot], col = b ? css(TIER_LOOK[b.tier].paint) : css(C.amber);
      const lines = wrap(ctx, line.text, 214, 12, 600);
      ctx.fillStyle = `rgba(14,18,24,${0.6 * a})`; rrect(ctx, 8, y - 14, 232, 16 + lines.length * 15, 7); ctx.fill();
      ctx.globalAlpha = a;
      txt(ctx, line.who, 16, y, 11, col, 'left', 900);
      lines.forEach((l, k) => txt(ctx, l, 16, y + 14 + k * 15, 12, '#f4f4f0', 'left', 600));
      ctx.globalAlpha = 1;
      y += 22 + lines.length * 15;
      if (y > 210) break;
    }
    // Bottom left: marker and hopper.
    ctx.fillStyle = 'rgba(14,18,24,0.72)'; rrect(ctx, 10, H - 64, 214, 54, 10); ctx.fill();
    txt(ctx, m.displayName.toUpperCase(), 22, H - 44, 11, 'rgba(255,255,255,0.75)', 'left', 800);
    txt(ctx, String(p.hopper), 22, H - 18, 24, p.hopper < m.hopperCapacity * 0.15 ? '#ff6a5a' : '#fff', 'left', 900);
    txt(ctx, `/ ${m.hopperCapacity}`, 24 + String(p.hopper).length * 15, H - 18, 12, 'rgba(255,255,255,0.6)', 'left', 700);
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(110, H - 30, 100, 6);
    if (p.reloadUntil > 0) {
      const k = 1 - (p.reloadUntil - t) / m.reloadSeconds;
      ctx.fillStyle = css(C.amber); ctx.fillRect(110, H - 30, 100 * k, 6);
      txt(ctx, 'RELOADING', 110, H - 38, 10, css(C.amber), 'left', 900);
    } else {
      ctx.fillStyle = css(PLAYER_PAINT); ctx.fillRect(110, H - 30, 100 * (p.hopper / m.hopperCapacity), 6);
      txt(ctx, p.slideT > 0 ? 'SLIDE' : p.sprinting ? 'SPRINT' : p.crouch > 0.5 ? 'CROUCHED' : p.lean ? (p.lean > 0 ? 'LEAN R' : 'LEAN L') : '', 110, H - 38, 10, 'rgba(255,255,255,0.7)', 'left', 900);
    }
    if (p.hopper === 0 && p.reloadUntil === 0 && p.alive) txt(ctx, 'PRESS R TO RELOAD', W / 2, H / 2 + 90, 14, '#ff6a5a', 'center', 900, 'rgba(0,0,0,0.6)');
  }
  function drawBubbles(ctx, s, c) {
    for (const line of s.chat.lines) {
      const b = s.bots[line.bot];
      if (!b || s.clock - line.t > 3.4) continue;
      const q = cam3(c, b.x, 2.2, b.z);
      if (q[2] < 0.5 || q[2] > 60) continue;
      if (!hasLOS(c.e, v3(b.x, 1.6, b.z))) continue;
      const x = SX(q), y = SY(q), lines = wrap(ctx, line.text, 170, 11, 600);
      const w = Math.min(190, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 16), h = lines.length * 13 + 10;
      if (x < -w || x > W + w || y < -h) continue;
      ctx.fillStyle = 'rgba(255,255,255,0.92)'; rrect(ctx, x - w / 2, y - h - 8, w, h, 8); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x - 6, y - 9); ctx.lineTo(x + 6, y - 9); ctx.lineTo(x, y - 1); ctx.fill();
      lines.forEach((l, k) => txt(ctx, l, x, y - h + 6 + k * 13, 11, '#1c262c', 'center', 600));
    }
  }
  function drawGoggles(ctx, s) {
    const p = s.player, t = s.clock;
    if (p.alive && t - p.lastHitT > 1.2) return;
    const fade = p.alive ? 1 - (t - p.lastHitT) / 1.2 : 1;
    const col = p.outBy ? TIER_LOOK[p.outC].paint : PLAYER_PAINT;
    ctx.globalAlpha = fade;
    const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.85);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.7)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    p.goggles.forEach((g, k) => {
      const x = g.x * W, y = g.y * H, r = g.r * H;
      const run = Math.min(1, (t - p.lastHitT) * 0.9 + 0.15);
      for (let d = 0; d < 2; d++) drip(ctx, x + (hash(k * 9 + d) - 0.5) * r * 1.1, y + r * 0.3, r * (0.16 + 0.1 * hash(k * 5 + d)), r * (0.6 + 2.2 * hash(k * 7 + d)) * run, css(col, 0.88));
      blob(ctx, x, y, r, k + g.d, css(col, 0.92));
      blob(ctx, x - r * 0.25, y - r * 0.25, r * 0.38, k + 5, css(mix(col, [255, 255, 255], 0.35), 0.75));
      for (let d = 0; d < 4; d++) { const a = hash(k * 13 + d) * 2 * Math.PI, rr = r * (1.25 + 0.6 * hash(k * 17 + d)); blob(ctx, x + Math.cos(a) * rr, y + Math.sin(a) * rr, r * (0.07 + 0.1 * hash(k * 19 + d)), k * 3 + d, css(col, 0.9)); }
    });
    ctx.globalAlpha = 1;
    if (!p.alive) {
      txt(ctx, 'YOU\'RE HIT', W / 2, H / 2 - 10, 38, '#fff', 'center', 900, 'rgba(0,0,0,0.7)');
      txt(ctx, p.outBy ? `${p.outBy} got you` : 'Out', W / 2, H / 2 + 18, 16, 'rgba(255,255,255,0.9)', 'center', 700, 'rgba(0,0,0,0.6)');
      if (s.phase === 'live') txt(ctx, `Back in ${Math.max(0, p.respawnAt - t).toFixed(1)}`, W / 2, H / 2 + 44, 14, css(C.amber), 'center', 800, 'rgba(0,0,0,0.6)');
    }
  }
  function drawTouch(ctx, s) {
    if (!s.touch.on || s.phase === 'title' || s.over) return;
    const btn = (b, label, on) => {
      ctx.fillStyle = on ? 'rgba(255,60,172,0.45)' : 'rgba(255,255,255,0.14)';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 2 * Math.PI); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; ctx.stroke();
      txt(ctx, label, b.x, b.y + 5, 12, '#fff', 'center', 900);
    };
    btn(FIRE_BTN, 'FIRE', s.touch.id === 1); btn(RELOAD_BTN, 'R', s.touch.id === 2); btn(CROUCH_BTN, s.touch.crouch ? 'STAND' : 'DUCK', s.touch.crouch);
  }

  // --- screens ---------------------------------------------------------------------------------
  function logo(ctx, x, y, size) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(-0.04);
    txt(ctx, 'PAINTBALL', 0, 0, size * 0.62, '#fff', 'center', 900, 'rgba(10,14,20,0.9)');
    txt(ctx, 'INSANITY', 0, size * 0.72, size, css(PLAYER_PAINT), 'center', 900, 'rgba(10,14,20,0.95)');
    [[-size * 1.9, 0.5], [-size * 0.95, 0.9], [-size * 0.1, 0.4], [size * 1.25, 0.75], [size * 2.0, 0.55]].forEach(([dx, l], k) => drip(ctx, dx, size * 0.7, size * 0.1, size * l, css(PLAYER_PAINT)));
    blob(ctx, size * 2.45, -size * 0.25, size * 0.16, 3, css(TIER_LOOK[1].paint));
    blob(ctx, -size * 2.5, size * 0.1, size * 0.12, 8, css(TIER_LOOK[3].paint));
    ctx.restore();
  }
  function statBar(ctx, x, y, label, k, col) {
    txt(ctx, label, x, y + 7, 9, 'rgba(255,255,255,0.65)', 'left', 800);
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x + 62, y, 118, 7);
    ctx.fillStyle = col; ctx.fillRect(x + 62, y, 118 * clamp(k, 0.04, 1), 7);
  }
  function drawTitle(ctx, s) {
    const o = s.orbit, eye = v3(Math.sin(o) * 30, 10, Math.cos(o) * 40);
    renderWorld(ctx, s, makeCam(eye, Math.atan2(-eye.x, -eye.z), -Math.atan2(eye.y - 1, Math.hypot(eye.x, eye.z)) * 0.8));
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(8,12,20,0.55)'); g.addColorStop(0.35, 'rgba(8,12,20,0.2)'); g.addColorStop(1, 'rgba(8,12,20,0.85)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    logo(ctx, W / 2, 62, 56);
    txt(ctx, DATA.gauntlet.subtitle, W / 2, 132, 13, 'rgba(255,255,255,0.85)', 'center', 700, 'rgba(0,0,0,0.5)');
    txt(ctx, `${commas(s.prog.ff)} ${ECO.currency.short}`, W - 18, 28, 18, css(C.amber), 'right', 900, 'rgba(0,0,0,0.6)');
    txt(ctx, ECO.currency.name.toUpperCase(), W - 18, 42, 9, 'rgba(255,255,255,0.7)', 'right', 800);
    MARKER_ORDER.forEach((name, i) => {
      const m = MARKERS[name], r = CARD(i), sel = s.menu.marker === i, own = owns(s, name);
      const lift = sel ? -4 : 0;
      ctx.fillStyle = sel ? 'rgba(22,26,36,0.94)' : 'rgba(22,26,36,0.78)'; rrect(ctx, r.x, r.y + lift, r.w, r.h, 12); ctx.fill();
      if (sel) { ctx.strokeStyle = css(PLAYER_PAINT); ctx.lineWidth = 3; ctx.stroke(); }
      txt(ctx, `${i + 1}`, r.x + r.w - 14, r.y + lift + 22, 11, 'rgba(255,255,255,0.4)', 'right', 900);
      txt(ctx, m.displayName, r.x + 14, r.y + lift + 24, 16, '#fff', 'left', 900);
      txt(ctx, `${m.autoFire ? 'Full auto' : 'Pump'} · ${m.roundsPerMinute} rpm · pays ×${m.payoutMultiplier}`, r.x + 14, r.y + lift + 40, 10, 'rgba(255,255,255,0.7)', 'left', 700);
      wrap(ctx, m.blurb, r.w - 28, 10, 500).slice(0, 3).forEach((l, k) => txt(ctx, l, r.x + 14, r.y + lift + 58 + k * 13, 10, 'rgba(255,255,255,0.85)', 'left', 500));
      const sy = r.y + lift + 104;
      statBar(ctx, r.x + 14, sy, 'VELOCITY', (m.muzzleVelocity - 100) / 50, css(C.teal));
      statBar(ctx, r.x + 14, sy + 13, 'RATE', m.roundsPerMinute / 800, css(C.amber));
      statBar(ctx, r.x + 14, sy + 26, 'CONTROL', 1 - m.sustainedSpreadDeg / 3, css(PLAYER_PAINT));
      statBar(ctx, r.x + 14, sy + 39, 'HOPPER', m.hopperCapacity / 220, 'rgb(200,200,210)');
      if (!own) {
        ctx.fillStyle = 'rgba(8,10,14,0.55)'; rrect(ctx, r.x, r.y + lift, r.w, r.h, 12); ctx.fill();
        txt(ctx, `🔒 ${commas(m.cost)} ${ECO.currency.short}`, r.x + r.w / 2, r.y + lift + r.h / 2 + 6, 16, s.prog.ff >= m.cost ? css(C.amber) : 'rgba(255,255,255,0.85)', 'center', 900, 'rgba(0,0,0,0.6)');
      }
    });
    TIERS.forEach((tr, i) => {
      const r = TIER_BTN(i), sel = s.menu.tier === i, open = tierOpen(s, i);
      ctx.fillStyle = sel ? css(TIER_LOOK[i].jersey) : 'rgba(22,26,36,0.8)'; rrect(ctx, r.x, r.y, r.w, r.h, 8); ctx.fill();
      if (sel) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
      txt(ctx, open ? tr.displayName : `🔒 ${tr.displayName}`, r.x + r.w / 2, r.y + 21, 12, open ? '#fff' : 'rgba(255,255,255,0.4)', 'center', 800);
    });
    txt(ctx, 'STARTING TIER — rounds 4 and 5 play one tier up. Clear all five to unlock the next.', W / 2, 326, 10, 'rgba(255,255,255,0.7)', 'center', 700);
    const st = startState(s), name = MARKER_ORDER[s.menu.marker], pulse = 0.5 + 0.5 * Math.sin(s.tick * 0.1);
    ctx.fillStyle = st === 'play' ? css(mix(PLAYER_PAINT, [255, 255, 255], pulse * 0.15)) : st === 'buy' ? css(C.amber) : 'rgba(80,84,94,0.9)';
    rrect(ctx, START_BTN.x, START_BTN.y, START_BTN.w, START_BTN.h, 12); ctx.fill();
    txt(ctx, st === 'play' ? `PLAY ${DATA.gauntlet.displayName.toUpperCase()}` : st === 'buy' ? `BUY — ${commas(MARKERS[name].cost)} ${ECO.currency.short}` : `NEED ${commas(MARKERS[name].cost)} ${ECO.currency.short}`, W / 2, START_BTN.y + 30, 18, '#fff', 'center', 900, 'rgba(0,0,0,0.35)');
    txt(ctx, 'WASD move · mouse aim · click fire · Shift sprint · C crouch (sprint+C slides) · Q/E lean · R reload · F shove', W / 2, H - 8, 10, 'rgba(255,255,255,0.6)', 'center', 600);
    if (s.prog.matches) txt(ctx, `Best payout ${commas(s.prog.best)} ${ECO.currency.short} · ${s.prog.matches} matches`, 16, H - 8, 10, 'rgba(255,255,255,0.6)', 'left', 600);
  }
  function banner(ctx, big, small, col) {
    ctx.fillStyle = 'rgba(10,14,20,0.62)'; ctx.fillRect(0, H * 0.3, W, 92);
    txt(ctx, big, W / 2, H * 0.3 + 52, 40, col || '#fff', 'center', 900, 'rgba(0,0,0,0.6)');
    if (small) txt(ctx, small, W / 2, H * 0.3 + 78, 14, 'rgba(255,255,255,0.85)', 'center', 700);
  }
  function drawPhase(ctx, s) {
    const entry = SCHED[s.round - 1];
    if (s.phase === 'warmup') {
      const tier = TIERS[tierFor(s.baseTier, entry.tierOffset)];
      banner(ctx, `ROUND ${s.round}`, `${entry.bots} ${tier.displayName} · ${Math.ceil(s.phaseT)}…`, css(PLAYER_PAINT));
      if (s.round === 1 && !s.touch.on) txt(ctx, 'Click the field to lock your aim · Esc to pause', W / 2, H * 0.3 + 116, 12, 'rgba(255,255,255,0.8)', 'center', 700, 'rgba(0,0,0,0.5)');
    } else if (s.phase === 'intermission') {
      const r = s.rounds[s.rounds.length - 1], next = SCHED[s.round], nt = TIERS[tierFor(s.baseTier, next.tierOffset)];
      ctx.fillStyle = 'rgba(10,14,20,0.9)'; rrect(ctx, W / 2 - 190, 100, 380, 200, 14); ctx.fill();
      txt(ctx, r.deaths === 0 ? 'FLAWLESS' : 'ROUND CLEARED', W / 2, 142, 28, r.deaths === 0 ? css(C.amber) : '#fff', 'center', 900);
      const rows = [['Time', clock(r.time)], ['Eliminations', String(s.rs.elims)], ['Times hit', String(s.rs.deaths)], ['Accuracy', s.rs.shots ? `${Math.round((100 * s.rs.hits) / s.rs.shots)}%` : '—']];
      rows.forEach(([a, b], k) => { txt(ctx, a, W / 2 - 150, 176 + k * 22, 13, 'rgba(255,255,255,0.7)', 'left', 700); txt(ctx, b, W / 2 + 150, 176 + k * 22, 13, '#fff', 'right', 900); });
      txt(ctx, `Next: ${next.bots} ${nt.displayName} in ${Math.ceil(s.phaseT)}`, W / 2, 284, 13, css(TIER_LOOK[tierFor(s.baseTier, next.tierOffset)].paint), 'center', 900);
    } else if (s.phase === 'final') {
      const r = s.rounds[s.rounds.length - 1];
      if (r.cleared) banner(ctx, 'GAUNTLET CLEARED', 'All five rounds. Nobody left standing.', css(C.amber));
      else banner(ctx, 'TIME', `Round ${s.round} ran out. The match ends here.`, '#ff6a5a');
    }
  }
  function drawResults(ctx, s) {
    const f = s.final, st = s.stats, won = f.cleared === ROUNDS.count;
    ctx.fillStyle = 'rgba(8,12,20,0.82)'; ctx.fillRect(0, 0, W, H);
    txt(ctx, won ? 'GAUNTLET CLEARED' : `ROUND ${s.rounds.length} — OUT OF TIME`, W / 2, 58, 32, won ? css(C.amber) : '#fff', 'center', 900);
    txt(ctx, `${MARKERS[s.marker].displayName} · ${TIERS[s.baseTier].displayName} start`, W / 2, 80, 12, 'rgba(255,255,255,0.7)', 'center', 700);
    const x0 = W / 2 - 230;
    s.rounds.forEach((r, k) => {
      const x = x0 + k * 94;
      ctx.fillStyle = r.cleared ? css(TIER_LOOK[r.tier].jersey) : 'rgba(255,255,255,0.1)'; rrect(ctx, x, 100, 86, 50, 8); ctx.fill();
      txt(ctx, `R${k + 1}`, x + 43, 120, 12, '#fff', 'center', 900);
      txt(ctx, r.cleared ? clock(r.time) : 'TIME', x + 43, 140, 12, 'rgba(255,255,255,0.85)', 'center', 700);
    });
    const rows = [
      ['Cleared rounds', `${commas(f.subtotal)} ${ECO.currency.short}`],
      [`Hit ${st.deaths} times`, `×${f.death.toFixed(2)}`],
      [`Accuracy ${st.shots ? Math.round((100 * st.hits) / st.shots) : 0}% (${st.hits}/${st.shots})`, `×${f.acc.toFixed(2)}`],
      [`Longest streak ${st.longest}`, `×${f.streak.toFixed(2)}`],
      ['Flawless', f.flawless > 1 ? `×${f.flawless}` : '—'],
    ];
    rows.forEach(([a, b], k) => { txt(ctx, a, W / 2 - 200, 184 + k * 24, 14, 'rgba(255,255,255,0.75)', 'left', 700); txt(ctx, b, W / 2 + 200, 184 + k * 24, 14, '#fff', 'right', 900); });
    ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(W / 2 - 200, 304, 400, 2);
    txt(ctx, 'PAYOUT', W / 2 - 200, 336, 18, '#fff', 'left', 900);
    txt(ctx, `${commas(f.total)} ${ECO.currency.short}`, W / 2 + 200, 338, 28, css(C.amber), 'right', 900);
    txt(ctx, `Wallet ${commas(s.prog.ff)} ${ECO.currency.short}`, W / 2, 372, 13, 'rgba(255,255,255,0.8)', 'center', 700);
    const next = MARKER_ORDER.find((n) => !owns(s, n));
    if (next) txt(ctx, s.prog.ff >= MARKERS[next].cost ? `You can buy the ${MARKERS[next].displayName} now.` : `${commas(MARKERS[next].cost - s.prog.ff)} ${ECO.currency.short} to the ${MARKERS[next].displayName}.`, W / 2, 392, 12, css(C.teal), 'center', 800);
    if (won && s.baseTier + 1 < TIERS.length) txt(ctx, `${TIERS[s.baseTier + 1].displayName} unlocked.`, W / 2, 410, 12, css(C.amber), 'center', 800);
    txt(ctx, 'Space or tap to go again', W / 2, H - 14, 12, 'rgba(255,255,255,0.6)', 'center', 700);
  }

  function render(s, ctx, ui) {
    ctx.save();
    if (s.phase === 'title') { drawTitle(ctx, s); ctx.restore(); return; }
    const p = s.player, eye = eyeOf(p), speed = Math.hypot(p.vx, p.vz);
    if (p.alive) eye.y += Math.sin(p.bob * 2) * 0.035 * Math.min(1, speed / 4);
    else eye.y = Math.max(0.5, eye.y - 0.4);
    const cam = makeCam(eye, p.yaw, p.pitch + p.recoil * 0.012);
    ctx.save();
    ctx.translate(W / 2, H / 2); ctx.rotate(-p.lean * 0.1); ctx.translate(-W / 2, -H / 2);
    renderWorld(ctx, s, cam);
    ctx.restore();
    drawBubbles(ctx, s, cam);
    if (!s.over) {
      drawViewmodel(ctx, s);
      drawCrosshair(ctx, s);
      drawGoggles(ctx, s);
      drawHud(ctx, s, ui);
      drawPhase(ctx, s);
      drawTouch(ctx, s);
    } else drawResults(ctx, s);
    if (ui && ui.paused && !s.over) {
      ctx.fillStyle = 'rgba(8,12,20,0.6)'; ctx.fillRect(0, 0, W, H);
      txt(ctx, 'PAUSED', W / 2, H / 2, 36, '#fff', 'center', 900);
      txt(ctx, 'Click to resume', W / 2, H / 2 + 26, 13, 'rgba(255,255,255,0.8)', 'center', 700);
    }
    ctx.restore();
  }

  globalThis.Game = {id: "paintball-insanity",
    guide: {
  "version": 1,
  "summary": "Existing five-round gauntlet: 4/6/8/10/12 opponents, 200s each; later rounds raise tier.",
  "goal": "Eliminate all opponents in each of five rounds before their clocks expire.",
  "lose": "A round times out; a single player hit is not a run loss.",
  "rules": [
    "Existing five-round gauntlet: 4/6/8/10/12 opponents, 200s each; later rounds raise tier. Player gets hit/respawns and loses payout; eliminated bots stay out. Clear rounds earns Field Fees, clear gauntlet unlocks next starting tier. Three marker tradeoffs already exist."
  ],
  "controls": [
    {
      "action": "Move / aim / fire",
      "keyboard": "WASD / mouse / click",
      "touch": "Move pad / aim drag / FIRE"
    },
    {
      "action": "Sprint / crouch-slide",
      "keyboard": "Shift / C",
      "touch": "DUCK; use existing movement controls"
    },
    {
      "action": "Reload",
      "keyboard": "R",
      "touch": "R"
    },
    {
      "action": "Lean / shove",
      "keyboard": "Q/E / F",
      "touch": "No dedicated touch lean/shove controls"
    }
  ],
  "firstSteps": [
    "Choose a marker and start a round.",
    "Move behind cover, aim, fire and reload when safe."
  ],
  "tips": [
    "A hit causes a respawn, not instant run loss; use cover and watch the round clock."
  ],
  "modes": []
},

    title: CONFIG.title, width: W, height: H, autoJuice: false,
    pointerLook, touchStick, progress,
    keys: ['ShiftLeft', 'ShiftRight', 'KeyC', 'ControlLeft', 'ControlRight', 'KeyR', 'KeyQ', 'KeyE', 'KeyF', 'KeyV', 'Digit1', 'Digit2', 'Digit3'],
    init, step, bot, metrics, render,
    rules: { DATA, timeOfFlight, dropAt, aimDirection, solveLead, payout, hasLOS, eyeOf, firstHit, NAV, ANCHORS },
  };
})();
