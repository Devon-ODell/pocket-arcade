(function(){
'use strict';
  const W=480,H=720;
  function rand(s){s.rng=(Math.imul(s.rng,1664525)+1013904223)>>>0;return s.rng/4294967296;}
  // The bot draws from its own stream so its driving never shifts the game's rng.
  function botRand(b){b.rng=(Math.imul(b.rng,1664525)+1013904223)>>>0;return b.rng/4294967296;}
  function botSeed(seed){const r={rng:((seed>>>0)^0x85ebca6b)>>>0};r.line=(botRand(r)-0.5)*0.07;r.dead=0.035+botRand(r)*0.03;r.wobble=0.04+botRand(r)*0.09;r.period=140+Math.floor(botRand(r)*70);r.hold=75+Math.floor(botRand(r)*40);r.think=0;r.err=0;return r;}
  function sfx(s,name){if(s.fx&&s.fx.length<20)s.fx.push({k:'sound',s:name});}
  // Tracks are editable data. Curves are functions of race distance, not rendering time.
  const TRACKS=[{name:'Clover Circuit',length:7200,bend:.55,sky:'#143b47',grass:'#32634d',road:'#454658'},{name:'Amber Ridge',length:8200,bend:.85,sky:'#503b50',grass:'#876547',road:'#514855'},{name:'Moonroot Pass',length:9000,bend:1.1,sky:'#202d51',grass:'#384c67',road:'#43455d'}];
  const CONFIG={maxSpeed:690,acceleration:190,brake:380,offroadSpeed:250,laps:3};
  function curve(s,offset=0){const track=TRACKS[s.track],p=((s.distance+offset)%track.length)/track.length;return Math.sin(p*Math.PI*6)*track.bend;}
  function startRace(s){s.distance=0;s.speed=0;s.x=0;s.lap=1;s.raceTicks=0;s.boost=0;s.charge=0;s.drifting=false;// Rival pace is drawn from the seeded rng, so a seed is a different race rather than
    // the same one replayed: sometimes a rival is genuinely quicker than you.
    const pace=()=>0.93+rand(s)*0.15;
    s.rivals=[{name:'Pip',distance:30+rand(s)*40,speed:612*pace(),x:-.6},{name:'Fern',distance:70+rand(s)*40,speed:645*pace(),x:.55},{name:s.track===2?'Mossjaw':'Moss',distance:100+rand(s)*45,speed:(668+s.track*9)*pace(),x:0}];s.wait=0;}
  function init(seed,progress){const s={rng:seed>>>0,bot:botSeed(seed),tick:0,over:false,won:false,score:0,track:0,points:0,races:0,boosts:0,offroad:0,collisions:0,lastPlace:0,fx:[],unlocked:progress&&progress.unlocked||1};startRace(s);return s;}
  function step(s,input){if(s.over)return s;s.tick++;if(s.fx)s.fx.length=0;if(s.wait){if(--s.wait===0){if(s.track===2){s.over=true;s.won=s.points>=18;}else{s.track++;startRace(s);}}return s;}s.raceTicks++;const i=input||{};let direction=(i.right?1:0)-(i.left?1:0),drift=!!i.action,brake=!!i.down;
    if(i.pointer&&i.pointer.down){const p=i.pointer;if(p.y>620){if(p.x<260)direction=p.x<130?-1:1;if(p.x>300)drift=true;}else direction=p.x<210?-1:p.x>270?1:0;}
    const percent=s.speed/CONFIG.maxSpeed,old=s.distance;s.speed=Math.min(CONFIG.maxSpeed+(s.boost?190:0),Math.max(0,s.speed+(brake?-CONFIG.brake:CONFIG.acceleration)/60));s.x+=direction*.027*percent*(drift?1.35:1)-curve(s)*.011*percent*percent;s.x=Math.max(-1.65,Math.min(1.65,s.x));
    if(Math.abs(s.x)>1){s.offroad++;s.speed=Math.max(CONFIG.offroadSpeed,s.speed-12);}
    if(drift&&direction&&s.speed>350&&Math.abs(s.x)<1){s.charge=Math.min(110,s.charge+1);s.drifting=true;}else if(s.drifting){if(s.charge>=40){s.boost=120;s.boosts++;sfx(s,'clear');}s.charge=0;s.drifting=false;}
    if(s.boost)s.boost--;s.distance+=s.speed/60;s.lap=Math.min(3,1+Math.floor(s.distance/TRACKS[s.track].length));
    for(const rival of s.rivals){const catchup=Math.max(-.03,Math.min(.03,(s.distance-rival.distance)/12000));rival.distance+=rival.speed*(1+catchup)/60;rival.x=Math.sin(rival.distance/1600+rival.speed)*.65;if(Math.abs(rival.distance-s.distance)<18&&Math.abs(rival.x-s.x)<.2&&s.speed>rival.speed){s.speed=rival.speed*.7;s.collisions++;sfx(s,'hit');}}
    const length=TRACKS[s.track].length;for(let marker=1;marker<=5;marker++){const z=marker*length/6;const before=Math.floor(old/length)*length+z;if(old<before&&s.distance>=before){const lane=(marker%3-1)*.65;if(Math.abs(s.x-lane)<.25){s.score+=75;s.boost=Math.max(s.boost,35);sfx(s,'pick');}}}
    if(s.distance>=length*CONFIG.laps||s.raceTicks>=60*120){s.races++;s.lastPlace=1+s.rivals.filter(r=>r.distance>s.distance).length;s.points+=[0,10,7,4,2][s.lastPlace];s.score+=[0,1000,700,400,200][s.lastPlace];s.unlocked=Math.max(s.unlocked,Math.min(3,s.track+2));s.wait=120;sfx(s,s.lastPlace===1?'win':'level');}
    return s;
  }
  function bot(s){const b=s.bot;const ahead=curve(s,120);if(--b.think<=0){b.think=6+Math.floor(botRand(b)*14);b.err=(botRand(b)-0.5)*b.wobble;}const target=ahead*.14+b.line+b.err;return {left:s.x>target+b.dead,right:s.x<target-b.dead,action:s.tick%b.period<b.hold,down:false};}
  // --- drawing: POCKET DREAM / 03 ---------------------------------------------
  // Cinder Hop's handheld again, with a warm earth LCD. The road is drawn in 2px scanlines
  // from filled boxes, the way a real handheld racer does it: polygons would anti-alias
  // their diagonal edges and break the pixel look. The camera and the karts share one road
  // width, RW, so a kart sits on screen exactly where the rules put it.
  const INK='#2b2217', DARK='#5f4a2e', MID='#a88f5c', LIGHT='#e6dab0';
  const SX=22, SY=98, SW=436, SH=510, CX=240, HOR=252, SB=608, RW=170, DEPTH=80;
  const KART=["...11......11...", "..1221....1221..", "..12221..12221..", "...1222442221...", "...1222442221...", "...1222222221...", "1111.122221.1111", "1441.112211.1441", "1441133333311441", "1441333333331441", "1441.111111.1441", "1111........1111"];
  const POD=["..1111..", ".133331.", "13322331", "13333331", ".133331.", "..1111.."];
  function box(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
  function label(c,t,x,y,size=16,col=INK,align='center'){c.fillStyle=col;c.font=`bold ${size}px monospace`;c.textAlign=align;c.fillText(t,x,y);}
  function sprite(c,rows,x,y,scale,palette){
    x=Math.round(x);y=Math.round(y);
    rows.forEach((row,j)=>[...row].forEach((v,i)=>{if(v!=='.')box(c,x+i*scale,y+j*scale,scale,scale,palette[Number(v)-1]);}));
  }
  function project(s,z){
    const depth=z/DEPTH, scale=1-depth;
    return {y:HOR+scale*scale*(SB-HOR), w:scale*RW, x:CX-s.x*scale*RW+curve(s,z*15)*depth*depth*110, scale};
  }
  const place=(s)=>1+s.rivals.filter(r=>r.distance>s.distance).length;
  const ORD=['','1ST','2ND','3RD','4TH'];
  const RIVAL={Pip:[INK,LIGHT,MID,DARK],Fern:[INK,MID,LIGHT,DARK],Moss:[INK,DARK,MID,INK],Mossjaw:[INK,DARK,LIGHT,INK]};
  function render(s,c,ui){
    const t=TRACKS[s.track];
    c.imageSmoothingEnabled=false;
    // The device.
    box(c,0,0,W,H,'#b8b9ad');box(c,8,8,464,704,'#eee9db');
    label(c,'BURROW RALLY',28,43,26,INK,'left');label(c,'CLOVER CUP / 03',28,66,12,DARK,'left');
    label(c,ORD[place(s)],452,46,22,INK,'right');label(c,`LAP ${s.lap}/3`,452,66,11,DARK,'right');
    box(c,10,84,460,541,'#7b8b81');box(c,17,92,446,522,INK);

    c.save();c.beginPath();c.rect(SX,SY,SW,SH);c.clip();
    box(c,SX,SY,SW,HOR-SY,'#c9dfd4');
    c.fillStyle='#f8e2a0';c.beginPath();c.arc(374,161,25,0,Math.PI*2);c.fill();
    const slide=Math.round(curve(s)*40/2)*2;
    for(let i=0;i<7;i++){
      const x=i*98-slide-70;
      c.fillStyle='#90b9a0';c.beginPath();c.moveTo(x-65,HOR);c.quadraticCurveTo(x+35,HOR-125-(i%2)*35,x+140,HOR);c.fill();
      c.fillStyle='#6b997b';c.beginPath();c.moveTo(x-15,HOR);c.quadraticCurveTo(x+65,HOR-65,x+170,HOR);c.fill();
    }
    for(let z=DEPTH-1;z>=0;z--){
      const a=project(s,z), b=project(s,z+1);
      const stripe=(Math.floor(s.distance/100)+Math.floor(z/3))%2;
      for(let y=Math.round(b.y/2)*2;y<Math.round(a.y/2)*2;y+=2){
        const f=(y-b.y)/((a.y-b.y)||1), x=b.x+(a.x-b.x)*f, w=b.w+(a.w-b.w)*f, rum=Math.max(2,w*.12);
        box(c,SX,y,SW,2,stripe?'#6b9160':'#749b64');
        box(c,x-w-rum,y,rum,2,stripe?'#ebd9a9':'#ac7256');box(c,x+w,y,rum,2,stripe?'#ebd9a9':'#ac7256');
        box(c,x-w,y,w*2,2,stripe?'#a49170':'#aa9774');
        if(stripe)for(const side of [-.33,.33])box(c,x+w*side-Math.max(1,w*.02),y,Math.max(2,w*.04),2,'#e9dcb5');
      }
    }
    // Trackside shrubs and marker posts share the road's perspective.
    for(let z=DEPTH-5;z>3;z-=8){const p=project(s,Math.max(1,z-(s.distance/15)%8)),sz=Math.max(2,p.scale*24);
      for(const side of [-1,1]){const x=p.x+side*(p.w*1.3+sz);box(c,x,p.y-sz*.8,sz*.18,sz*.8,'#6d6245');
        c.fillStyle='#3e7057';c.beginPath();c.arc(x,p.y-sz,sz*.7,0,Math.PI*2);c.fill();
        c.fillStyle='#67915c';c.beginPath();c.arc(x-sz*.17,p.y-sz*1.2,sz*.48,0,Math.PI*2);c.fill();}}
    // Karts and seed pods, sorted far to near so nearer ones cover farther ones. Pods were
    // real in the rules (+75 and a boost) but never drawn: now you can aim for them.
    const things=[];
    for(const r of s.rivals){const dz=r.distance-s.distance;if(dz>0&&dz<1000)things.push({dz,lane:r.x,rows:KART,pal:RIVAL[r.name]||RIVAL.Pip,unit:4});}
    const len=t.length, lap0=Math.floor(s.distance/len)*len;
    for(const base of [lap0,lap0+len])for(let m=1;m<=5;m++){
      const dz=base+m*len/6-s.distance;
      if(dz>0&&dz<1100)things.push({dz,lane:(m%3-1)*.65,rows:POD,pal:[INK,LIGHT,MID,DARK],unit:3});
    }
    things.sort((p,q)=>q.dz-p.dz);
    for(const o of things){
      const p=project(s,Math.min(DEPTH-4,o.dz/15)), sc=Math.max(1,Math.round(p.scale*o.unit));
      sprite(c,o.rows,p.x+o.lane*p.w-o.rows[0].length*sc/2,p.y-o.rows.length*sc,sc,o.pal);
    }
    // You.
    const wig=s.drifting?(Math.floor(s.tick/3)%2?4:-4):0;
    if(s.boost&&s.tick%4<2){box(c,CX-22+wig,592,8,10,LIGHT);box(c,CX+14+wig,592,8,10,LIGHT);box(c,CX-20+wig,602,4,4,MID);box(c,CX+16+wig,602,4,4,MID);}
    if(s.drifting&&s.charge>=40&&s.tick%6<3){box(c,CX-36+wig,584,4,4,LIGHT);box(c,CX+32+wig,584,4,4,LIGHT);}
    sprite(c,KART,CX-32+wig,544,4,['#293d3c','#efcd8d','#b2674e','#526879']);   // your kart: a dark body no rival wears
    // HUD bands inside the glass.
    box(c,SX,SY,SW,24,LIGHT);label(c,t.name.toUpperCase(),34,115,13,INK,'left');label(c,`CUP ${s.track+1}/3`,446,115,12,DARK,'right');
    box(c,SX,SB-18,96,18,LIGHT);label(c,String(Math.round(s.speed/4)).padStart(3,'0')+' KM/H',70,SB-5,11,INK);
    box(c,SX+SW-96,SB-18,96,18,LIGHT);
    for(let k=0;k<5;k++)box(c,SX+SW-86+k*16,SB-13,12,8,k<Math.floor(s.charge/22)?INK:MID);
    if(s.wait){box(c,62,300,356,104,INK);box(c,66,304,348,96,LIGHT);
      label(c,'FINISHED '+ORD[s.lastPlace],240,344,24);label(c,`${s.points} CUP POINTS`,240,374,14,DARK);}
    if(s.over){box(c,40,265,400,200,INK);
      label(c,s.won?'PODIUM, LITTLE ONE':'THE CUP IS RUN',240,310,22,'#e9dcb5');
      label(c,String(s.score).padStart(5,'0'),240,356,30,MID);
      label(c,`${s.points} POINTS · ${s.boosts} BOOSTS`,240,386,13,LIGHT);
      label(c,'SPACE / TAP TO RACE AGAIN',240,428,15,LIGHT);}
    c.restore();

    label(c,'CLOVER CUP · HOLD SPACE THROUGH A TURN',240,643,11,DARK);
    const r=ui&&ui.rank;
    if(r){const fresh=r.fresh&&s.tick%20<10;label(c,fresh?'LV UP':'LV '+r.level,300,66,11,fresh?INK:DARK,'left');
      for(let k=0;k<5;k++)box(c,344+k*8,59,6,6,k<Math.round(r.part*5)?INK:'#b4ae9f');}
    // The buttons sit exactly where step() reads the touch: x<130 left, 130-260 right, >300 drift.
    box(c,24,654,94,48,INK);box(c,134,654,94,48,INK);box(c,306,654,150,48,'#755966');
    label(c,'◀',71,686,26,LIGHT);label(c,'▶',181,686,26,LIGHT);label(c,'A · DRIFT',381,684,19,'#f4e7d2');
    label(c,'← →',266,671,11,DARK);label(c,'SPACE',266,690,11,DARK);
  }
  globalThis.Game={id: "burrow-rally",
    guide: {
  "version": 1,
  "summary": "Auto-accelerating kart racer, three races of three laps, 120s race limit.",
  "goal": "Earn at least 18 cup points across the three races.",
  "lose": "Finish the cup below 18 points; race time limits affect placement.",
  "rules": [
    "Auto-accelerating kart racer, three races of three laps, 120s race limit. Places award 10/7/4/2 points; 18 wins the cup. Drift above speed 350 for at least 40 ticks; release for a two-second boost."
  ],
  "controls": [
    {
      "action": "Steer",
      "keyboard": "A/D or Left/Right",
      "touch": "Steering controls"
    },
    {
      "action": "Drift / boost",
      "keyboard": "Hold Space while steering; release for boost",
      "touch": "Hold/release drift"
    },
    {
      "action": "Brake",
      "keyboard": "S / Down",
      "touch": "No dedicated brake button yet"
    }
  ],
  "firstSteps": [
    "Steer onto the road and enter a corner.",
    "Charge a drift, then release it for a boost."
  ],
  "tips": [
    "Release a sufficiently charged drift to boost; holding it forever does not bank the boost."
  ],
  "modes": []
},
    title:'Burrow Rally',autoJuice:false,width:W,height:H,touchStick:(s,p)=>!s.over&&(!p||p.x<260),init,step,bot,render,progress:s=>({unlocked:s.unlocked}),metrics:s=>({score:s.score,races:s.races,points:s.points,boosts:s.boosts,offroad_share:s.offroad/Math.max(1,s.tick),won:s.won?1:0}),rules:{TRACKS,CONFIG,curve}};

})();
