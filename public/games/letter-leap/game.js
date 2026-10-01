(function () {
  'use strict';
  const W=480,H=720,GOAL=28,CELL=54,X0=51,JUMP=10;
  const PLAYER_FX_Y=390;   // the camera keeps the player's lane at a fixed band; its centre
  const WORDS=['ash','bay','cat','dew','elm','fern','glow','hill','iris','jade','kite','leaf','moss','nest','oak','pond','reed','sun','tide','vale','wave','yarn'];
  const KEYS=['qwertyuiop','asdfghjkl','zxcvbnm'];
  function rand(s){s.rng=(Math.imul(s.rng,1664525)+1013904223)>>>0;return s.rng/4294967296;}
  function init(seed){
    const s={rng:seed>>>0,tick:0,phase:'ready',over:false,won:false,row:0,x:X0+3*CELL,
      checkpoint:0,lives:3,score:0,typed:'',choices:[],lanes:[],jump:0,fromX:0,
      flash:0,invulnerable:0,remaining:120*60,letters:0,errors:0,words:0,combo:0,
      bestRow:0,deaths:0,botNext:0,botWord:'',botLastRow:-1,fx:[]};
    for(let row=0;row<=GOAL+4;row++){
      const k=row%7,type=k===0||k===3?'grass':k===4?'river':'road';
      s.lanes.push({type,speed:(rand(s)>.5?1:-1)*(type==='river'?.27:.50+row*.008),
        offset:rand(s)*280,period:type==='river'?218:230+rand(s)*65,
        width:type==='river'?163:48+rand(s)*26,color:row%3});
    }
    chooseWords(s);return s;
  }
  function chooseWords(s){
    const col=Math.max(0,Math.min(7,Math.round((s.x-X0)/CELL)));
    const columns=[col-1,col,col+1].filter(n=>n>=0&&n<8),pool=WORDS.slice();
    s.choices=columns.map(col=>{const n=Math.floor(rand(s)*pool.length);return {col,word:pool.splice(n,1)[0]};});
    s.typed='';s.botWord='';s.botLastRow=s.row;
  }
  function positions(lane,after=0){
    const offset=((lane.offset+lane.speed*after)%lane.period+lane.period)%lane.period;
    const out=[];for(let x=offset-lane.period;x<W+lane.period;x+=lane.period)out.push(x);return out;
  }
  function safe(lane,x,after=0){
    if(lane.type==='grass')return true;
    const objects=positions(lane,after);
    return lane.type==='river'?objects.some(p=>x-11>p&&x+11<p+lane.width):!objects.some(p=>x+12>p&&x-12<p+lane.width);
  }
  function fx(s,e){if(s.fx.length<40)s.fx.push(e);}
  function loseLife(s){
    s.lives--;s.deaths++;s.combo=0;s.flash=28;
    fx(s,{k:'shake',m:15});fx(s,{k:'flash',a:0.38,c:'#ff5470'});
    fx(s,{k:'burst',x:s.x,y:PLAYER_FX_Y,n:16,c:'#ff5470',spd:4});fx(s,{k:'sound',s:'hit'});
    if(s.lives<=0){s.over=true;s.phase='over';return;}
    s.row=s.checkpoint;s.x=X0+3*CELL;s.jump=0;s.invulnerable=75;chooseWords(s);
  }
  function type(s,letters){
    for(const char of letters){
      if(char==='\b'){s.typed=s.typed.slice(0,-1);continue;}
      if(!/^[a-z]$/.test(char))continue;
      const candidate=s.typed+char;
      if(s.choices.some(o=>o.word.startsWith(candidate))){s.typed=candidate;s.letters++;}
      else{s.errors++;s.flash=12;s.combo=0;}
    }
  }
  function readyChoice(s){return s.choices.find(o=>o.word===s.typed);}
  function touchKey(p){
    for(let row=0;row<3;row++){
      const letters=KEYS[row],width=43,x0=(W-letters.length*width)/2,y=532+row*42;
      if(p.y>=y&&p.y<y+38){const col=Math.floor((p.x-x0)/width);if(col>=0&&col<letters.length)return letters[col];}
    }
    if(p.x>390&&p.y>=616&&p.y<654)return '\b';
    return '';
  }
  function step(s,input){
    if(s.over)return s;const i=input||{};s.tick++;s.fx.length=0;   // the shell drains it each tick
    if(s.phase==='ready'){if(i.actionPressed){s.phase='play';}return s;}
    s.remaining--;s.flash=Math.max(0,s.flash-1);s.invulnerable=Math.max(0,s.invulnerable-1);
    for(const lane of s.lanes)lane.offset=(lane.offset+lane.speed+lane.period)%lane.period;
    if(s.remaining<=0){s.over=true;s.phase='over';return s;}
    if(s.jump){
      s.jump--;
      if(!s.jump){
        if(!safe(s.lanes[s.row],s.x)&&!s.invulnerable){loseLife(s);return s;}
        if(s.lanes[s.row].type==='grass')s.checkpoint=s.row;
        if(s.row>=GOAL){s.won=true;s.over=true;s.phase='over';s.score+=Math.floor(s.remaining/60)*3;fx(s,{k:'confetti'});fx(s,{k:'sound',s:'win'});return s;}
        chooseWords(s);
      }
      return s;
    }
    const lane=s.lanes[s.row];
    if(lane.type==='river')s.x+=lane.speed;
    if((s.x<18||s.x>W-18||!safe(lane,s.x))&&!s.invulnerable){loseLife(s);return s;}
    let hop=!!i.actionPressed,letters=typeof i.text==='string'?i.text.toLowerCase():'';
    if(i.pointer&&i.actionPressed){letters+=touchKey(i.pointer);hop=i.pointer.y>=665;}
    type(s,letters);
    const choice=readyChoice(s);
    if(hop&&choice){
      s.fromX=s.x;s.x=X0+choice.col*CELL;s.row++;s.jump=JUMP;
      s.bestRow=Math.max(s.bestRow,s.row);s.words++;s.combo++;
      const gain=10+choice.word.length*2+Math.min(s.combo,10);
      s.score+=gain;s.typed='';
      fx(s,{k:'burst',x:s.x,y:PLAYER_FX_Y,n:9,c:'#9dff3a',spd:2.8});
      fx(s,{k:'ring',x:s.x,y:PLAYER_FX_Y,max:30,c:'#9dff3a'});
      fx(s,{k:'pop',x:s.x,y:PLAYER_FX_Y-26,t:`+${gain}`,c:'#9dff3a',size:16+Math.min(12,s.combo)});
      fx(s,{k:'combo',n:s.combo});fx(s,{k:'sound',s:'pick',n:Math.min(12,s.combo)});
    }
    return s;
  }
  function bot(s){
    if(s.phase==='ready')return {actionPressed:true};
    if(s.jump||s.tick<s.botNext)return {};
    const selected=readyChoice(s);
    if(selected){
      s.botNext=s.tick+4;
      if(safe(s.lanes[s.row+1],X0+selected.col*CELL,JUMP+4) &&
         safe(s.lanes[s.row+1],X0+selected.col*CELL,JUMP+50))return {actionPressed:true};
      return {};
    }
    if(!s.botWord||!s.choices.some(o=>o.word===s.botWord)){
      // Choose a destination using the visible traffic, then type through normal inputs.
      let best=s.choices[0],value=-1;
      for(const o of s.choices){
        const arrival=o.word.length*10+JUMP;
        const score=(safe(s.lanes[s.row+1],X0+o.col*CELL,arrival)?2:0)+
          (safe(s.lanes[s.row+1],X0+o.col*CELL,arrival+50)?2:0)+rand(s);
        if(score>value){best=o;value=score;}
      }
      s.botWord=best.word;
    }
    s.botNext=s.tick+8+Math.floor(rand(s)*7);
    if(s.typed&&!s.botWord.startsWith(s.typed))return {text:'\b'};
    if(rand(s)<.035)return {text:'x'};
    return {text:s.botWord[s.typed.length]||''};
  }
  function box(c,x,y,w,h,color,r=0){c.fillStyle=color;c.beginPath();if(r)c.roundRect(x,y,w,h,r);else c.rect(x,y,w,h);c.fill();}
  function text(c,t,x,y,size=16,color='#203c38',align='center'){c.fillStyle=color;c.font=`${size>=23?'850':'650'} ${size}px system-ui`;c.textAlign=align;c.fillText(t,x,y);}
  function circle(c,x,y,r,color){c.fillStyle=color;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();}
  function frog(c,x,y,t){
    c.save();c.translate(x,y);c.scale(1+Math.sin(t*.3)*.025,1);
    box(c,-17,12,34,6,'#142d342f',5);box(c,-15,-5,30,23,'#346958',8);
    circle(c,-13,11,7,'#82b66d');circle(c,13,11,7,'#82b66d');box(c,-14,-15,28,29,'#a4d881',9);
    circle(c,-9,-13,8,'#a4d881');circle(c,9,-13,8,'#a4d881');circle(c,-9,-15,4,'#f6f7cc');circle(c,9,-15,4,'#f6f7cc');
    circle(c,-9,-16,2,'#233e35');circle(c,9,-16,2,'#233e35');box(c,-10,6,20,9,'#df8663',3);box(c,-5,8,10,5,'#f4deb7',1);c.restore();
  }
  function render(s,c,ui){
    box(c,0,0,W,H,'#eee8d9');box(c,0,0,W,106,'#224e46');
    text(c,'LETTER LEAP',24,39,27,'#f9edce','left');text(c,'RIVERSIDE POST',25,62,11,'#a6c6ae','left');
    text(c,String(s.score).padStart(3,'0'),455,42,29,'#f0c783','right');
    text(c,`${Math.ceil(s.remaining/60)}s  ·  ${s.lives} hearts`,455,65,13,'#dae4cf','right');
    box(c,24,82,432,6,'#153f37',3);box(c,24,82,432*s.bestRow/GOAL,6,'#e3bc79',3);
    const jumpY=s.jump?Math.sin((JUMP-s.jump)/JUMP*Math.PI)*18:0;
    const camera=s.row-(s.jump?s.jump/JUMP:0);
    c.save();c.beginPath();c.rect(16,106,448,320);c.clip();
    for(let row=Math.max(0,s.row-2);row<=Math.min(s.lanes.length-1,s.row+6);row++){
      const lane=s.lanes[row],y=362-(row-camera)*56;
      if(y>426||y+56<106)continue;
      const color=lane.type==='grass'?'#94b98a':lane.type==='river'?'#64a5aa':'#52656a';
      box(c,16,y,448,56,color);box(c,16,y,448,2,'#ffffff1a');if(lane.type==='road'){box(c,16,y,448,4,'#a4ad96');box(c,16,y+52,448,4,'#a4ad96');}
      if(lane.type==='road'){
        for(let x=25;x<W;x+=48)box(c,x,y+26,22,3,'#d4cfb766',1);
        for(const x of positions(lane)){
          box(c,x+3,y+15,lane.width,31,'#243b4044',7);box(c,x,y+9,lane.width,30,['#e8ab70','#d2bc91','#b9ccd0'][lane.color],7);
          box(c,x+12,y+13,lane.width-24,17,'#284850',4);box(c,lane.speed>0?x+lane.width-5:x+2,y+13,3,6,'#fff1be');
          box(c,lane.speed>0?x+lane.width-5:x+2,y+29,3,6,'#fff1be');
        }
      }else if(lane.type==='river'){
        for(let x=22;x<W;x+=45){box(c,x+(s.tick*.2)%20,y+43,18,2,'#d5f1e355',2);box(c,x+12-(s.tick*.1)%16,y+4,9,1,'#e4f1db55');}
        for(const xx of [22,450]){circle(c,xx,y+35,8,'#42887d');c.strokeStyle='#87b9a0';c.lineWidth=1;c.beginPath();c.moveTo(xx,y+35);c.lineTo(xx+5,y+30);c.stroke();}
        for(const x of positions(lane)){box(c,x,y+8,lane.width,36,'#946c50',15);box(c,x+8,y+15,lane.width-16,5,'#cca67888',3);box(c,x+20,y+30,lane.width-40,3,'#533f3555',2);circle(c,x+15,y+26,12,'#c49b6e');c.strokeStyle='#8c684e';c.lineWidth=1;c.beginPath();c.arc(x+15,y+26,7,0,Math.PI*2);c.stroke();box(c,x+34,y+23,25,2,'#644e3f66',1);}
      }else{
        for(let n=0;n<12;n++){const xx=25+n*39,yy=y+9+(n%3)*13;
          box(c,xx,yy,2,6,'#648e65');box(c,xx-3,yy+2,3,2,'#719e70');
          if(n%3===0){circle(c,xx,yy-1,3,'#f1ddac');circle(c,xx,yy-1,1,'#c69452');}}
        for(const xx of [18,453]){box(c,xx,y+11,3,22,'#6c9269');box(c,xx-2,y+8,7,8,'#ba9e63',2);}
        if(row%7===0){box(c,21,y+4,5,40,'#ecdfc1');box(c,26,y+4,25,16,'#cd7959',2);}
        if(row===GOAL)text(c,'POST OFFICE',240,y+32,20,'#244e43');
      }
    }
    const drawX=s.jump?s.fromX+(s.x-s.fromX)*(1-s.jump/JUMP):s.x;
    if(!s.invulnerable||s.tick%10<6)frog(c,drawX,389-jumpY,s.tick);
    c.restore();
    box(c,16,426,448,96,'#faf5e7',13);
    const armed=readyChoice(s);
    text(c,s.flash?'Missed a letter — keep going!':armed?'WORD READY · WAIT FOR A GAP':`TYPE YOUR NEXT HOP  ·  ${s.bestRow} / ${GOAL}`,240,448,11,s.flash?'#b95544':'#547065');
    s.choices.forEach((o,n)=>{
      const width=132,gap=12,x=(W-s.choices.length*(width+gap)+gap)/2+n*(width+gap),active=s.typed&&o.word.startsWith(s.typed);
      box(c,x,460,width,46,active?'#28594c':'#e3e9d6',10);
      text(c,(o.col<Math.round((s.x-X0)/CELL)?'↖ ':o.col>Math.round((s.x-X0)/CELL)?'↗ ':'↑ ')+o.word,x+width/2,489,21,active?'#fff0c6':'#345446');
      if(active){box(c,x+10,499,(width-20)*s.typed.length/o.word.length,3,'#e7bb76',2);}
    });
    KEYS.forEach((letters,row)=>{
      const x0=(W-letters.length*43)/2;
      [...letters].forEach((ch,col)=>{const x=x0+col*43,y=532+row*42;box(c,x+1,y+3,40,36,'#b9bdad',7);box(c,x+1,y,40,35,'#fffcf1',7);text(c,ch.toUpperCase(),x+21,y+24,17);});
    });
    box(c,395,616,66,35,'#ded9c8',7);text(c,'⌫',428,640,23);
    box(c,20,665,440,40,armed?'#28594c':'#d4d8c6',10);text(c,armed?'SPACE / TAP TO HOP':'FINISH A WORD, THEN SPACE TO HOP',240,691,13,armed?'#fff1cb':'#5c7166');
    if(s.phase==='ready'){
      box(c,34,143,412,239,'#fbf5e8f5',22);text(c,'The town is moving.',240,181,26);text(c,'Type your way through.',240,213,24,'#587c54');
      text(c,'1  Type a word to choose your next tile.',240,250,15);text(c,'2  Watch the traffic. Space makes you hop.',240,278,15);text(c,'Ride logs. Reach the post office. Three hearts.',240,307,13,'#62766a');
      box(c,76,326,328,39,'#28594c',11);text(c,'TAP / SPACE TO START',240,352,15,'#fff1cb');
    }
    if(s.over){
      box(c,34,148,412,259,'#faf5e8f5',23);text(c,s.won?'SPECIAL DELIVERY!':s.remaining<=0?'POST CLOSED':'TIME FOR A BREATHER',240,189,24);
      text(c,String(s.score),240,248,55,'#416d53');text(c,`${s.bestRow} / ${GOAL} lanes  ·  ${s.words} words`,240,281,17);
      const acc=s.letters+s.errors?Math.round(100*s.letters/(s.letters+s.errors)):100;
      text(c,`${acc}% accuracy · Best ${Math.max(s.score,ui&&ui.best||0)}`,240,312,14,'#62766a');
      box(c,77,345,326,40,'#28594c',11);text(c,'TAP / SPACE TO TRY AGAIN',240,372,14,'#fff1cb');
    }
  }
  globalThis.Game={id: "letter-leap",
    guide: {
  "version": 1,
  "summary": "Type a destination word, then hop onto its column in the next lane.",
  "goal": "Reach lane 28 before the timer expires.",
  "lose": "Lose three lives or run out of time.",
  "rules": [
    "Type a destination word, then hop onto its column in the next lane. Avoid traffic and land on river logs; grass checkpoints. Reach lane 28 within 120s, with three lives. Current word pool/lane families are small."
  ],
  "controls": [
    {
      "action": "Type / edit",
      "keyboard": "Letters / Backspace",
      "touch": "On-screen keyboard"
    },
    {
      "action": "Hop",
      "keyboard": "Space / Enter after the word",
      "touch": "Hop button"
    },
    {
      "action": "Pause",
      "keyboard": "Escape; P types a letter",
      "touch": "Use the pause control"
    }
  ],
  "firstSteps": [
    "Type the word above a safe destination.",
    "Wait for a safe traffic/log window, then hop."
  ],
  "tips": [
    "Finishing a word does not guarantee safe timing; check the destination before pressing hop."
  ],
  "modes": []
},
    title:'Letter Leap',width:W,height:H,inputMode:'typing',init,step,bot,render,
    metrics:s=>({score:s.score,rows:s.bestRow,words:s.words,letters:s.letters,errors:s.errors,
      accuracy:s.letters+s.errors?s.letters/(s.letters+s.errors):1,won:s.won?1:0,deaths:s.deaths}),
    rules:{safe,positions,type,readyChoice,touchKey,goal:GOAL}};
})();
