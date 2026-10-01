// Crosstown — original, deterministic night-shift city driving.
(function () {
  'use strict';
  const W = 480, H = 720, DT = 1 / 60, SHIFT = 180;
  // Vehicle archetypes with distinct handling characteristics
  const ARCHETYPES = /*CONFIG*/{
    "Hatch": {"mass": 1.2, "grip": 0.17, "topSpeed": 190, "acceleration": 105, "turnRate": 2.5},
    "Sedan": {"mass": 1.4, "grip": 0.15, "topSpeed": 200, "acceleration": 95, "turnRate": 2.1},
    "Van": {"mass": 2.0, "grip": 0.12, "topSpeed": 160, "acceleration": 75, "turnRate": 1.8},
    "Coupe": {"mass": 1.1, "grip": 0.19, "topSpeed": 230, "acceleration": 115, "turnRate": 2.7},
    "Pickup": {"mass": 1.7, "grip": 0.14, "topSpeed": 180, "acceleration": 85, "turnRate": 2.0},
    "Sport": {"mass": 0.9, "grip": 0.21, "topSpeed": 250, "acceleration": 130, "turnRate": 3.0}
  }/*END*/;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const angle = n => Math.atan2(Math.sin(n), Math.cos(n));
  function rand(s) { s.rng = (Math.imul(s.rng, 1664525) + 1013904223) >>> 0; return s.rng / 4294967296; }
  function nearest(a, n) { let k = 0; for (let i = 1; i < a.length; i++) if (Math.abs(a[i] - n) < Math.abs(a[k] - n)) k = i; return k; }
  const node = (s, x, y) => ({ x: s.city.xs[x], y: s.city.ys[y], ix: x, iy: y });
  function district(s, p) { return p.x < s.city.size / 2 ? (p.y < s.city.size / 2 ? 'OLD TOWN' : 'THE DOCKS') : (p.y < s.city.size / 2 ? 'NORTH QUARTER' : 'DOWNTOWN'); }
  function blocked(s, x, y, margin = 9) {
    if (x < 55 || y < 55 || x > s.city.size - 55 || y > s.city.size - 55) return true;
    return s.city.blocks.some(b => x > b.x - margin && x < b.x + b.w + margin && y > b.y - margin && y < b.y + b.h + margin);
  }
  function sight(s, a, b) {
    const d = dist(a, b); if (d > 410) return false;
    for (let k = 1; k < 12; k++) if (blocked(s, a.x + (b.x - a.x) * k / 12, a.y + (b.y - a.y) * k / 12, 0)) return false;
    return true;
  }
  function job(s) {
    const ix = nearest(s.city.xs, s.car.x), iy = nearest(s.city.ys, s.car.y);
    const px = clamp(ix + (rand(s) > .5 ? 1 : -1), 0, 5), py = iy;
    const dx = (px + 2 + Math.floor(rand(s) * 3)) % 6, dy = (py + 1 + Math.floor(rand(s) * 4)) % 6;
    s.job = { pickup: node(s, px, py), drop: node(s, dx, dy), carrying: false, deadline: 0, damage: s.crashes, value: 120 + Math.round(dist(node(s,px,py),node(s,dx,dy)) * .15) };
    s.route = [];
  }
  function init(seed) {
    const s = { rng: seed >>> 0 || 1, tick: 0, over: false, started: false, score: 0, money: 0, jobsDone: 0, jobsFailed: 0, crashes: 0, pedestrianClips: 0, busts: 0, heat: 0, maxHeat: 0, unseen: 0, caught: 0, distance: 0, speedSum: 0, speedTicks: 0, cooldown: 0, notice: 'WELCOME TO THE NIGHT SHIFT', noticeUntil: 180, route: [], fx: [], botNoise: 0, districtMask: 0, seenDistricts: 0 };
    const xs = [140], ys = [140];
    for (let i = 1; i < 6; i++) { xs.push(xs[i-1] + 265 + Math.floor(rand(s) * 42)); ys.push(ys[i-1] + 265 + Math.floor(rand(s) * 42)); }
    s.city = { xs, ys, size: Math.max(xs[5], ys[5]) + 145, blocks: [] };
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) {
      s.city.blocks.push({ x: xs[x] + 61, y: ys[y] + 61, w: xs[x+1]-xs[x]-122, h: ys[y+1]-ys[y]-122, hue: Math.floor(rand(s)*4), park: rand(s)<.17, sign: Math.floor(rand(s)*6), roof: Math.floor(rand(s)*18) });
    }

    // Select vehicle archetype based on seed
    const archetypeNames = Object.keys(ARCHETYPES);
    const selectedArchetype = archetypeNames[Math.floor(rand(s) * archetypeNames.length)];
    s.archetype = selectedArchetype;
    s.vehicleConfig = ARCHETYPES[selectedArchetype];

    s.car = { x: xs[2], y: ys[3], a: -Math.PI/2, speed: 0, vx: 0, vy: 0, damage: 0 };
    s.camera = { x: s.car.x, y: s.car.y, zoom: 1 };
    s.traffic = [];
    for (let n = 0; n < 24; n++) {
      const horizontal = n % 2 === 0, dir = rand(s) > .5 ? 1 : -1, lane = Math.floor(rand(s)*6);
      s.traffic.push({ horizontal, dir, lane, x: horizontal ? 90 + rand(s)*(s.city.size-180) : xs[lane]+dir*21, y: horizontal ? ys[lane]+dir*21 : 90+rand(s)*(s.city.size-180), speed: 48+rand(s)*24, hue: Math.floor(rand(s)*4), stopped: false });
    }
    s.people = [];
    for (let n = 0; n < 30; n++) { const ix = Math.floor(rand(s)*5), iy = Math.floor(rand(s)*6); s.people.push({x:xs[ix]+80+rand(s)*95,y:ys[iy]+49,home:xs[ix]+80,dir:rand(s)>.5?1:-1,dodge:0}); }
    s.units = [{x:xs[2],y:ys[2],a:0,lastX:xs[2],lastY:ys[3],seen:false},{x:xs[4],y:ys[4],a:0,lastX:xs[4],lastY:ys[4],seen:false}];
    job(s); return s;
  }
  function say(s, text) { s.notice = text; s.noticeUntil = s.tick + 180; }
  function bump(s, severity) {
    if (s.cooldown) return;
    s.cooldown = 70; s.crashes++; s.car.damage = clamp(s.car.damage + severity, 0, 75); s.heat = clamp(s.heat + .7, 0, 3);
    s.fx.push({k:'shake',m:5},{k:'sound',s:'thud'}); say(s,'CONTACT · ease off and find a gap');
  }
  function step(s, input) {
    if (s.over) return s;
    const i = input || {}; s.fx = [];
    if (!s.started) { if (i.actionPressed || i.up || i.action) s.started = true; return s; }
    s.tick++; if (s.cooldown) s.cooldown--;
    const c = s.car, p = i.pointer && i.pointer.down ? i.pointer : null;
    const steer = typeof i.steer === 'number' ? clamp(i.steer,-1,1) : i.stick ? i.stick.x : Number(!!i.right)-Number(!!i.left);
    const gas = i.up || (p && p.x > 345 && p.y > 585);
    const brake = i.down || (p && p.x > 245 && p.x < 345 && p.y > 585);
    const handbrake = (i.action && !p) || (p && p.x > 385 && p.y > 480 && p.y < 575);
    c.speed += (gas ? s.vehicleConfig.acceleration : brake ? -150 : -Math.sign(c.speed)*28) * DT;
    c.speed = clamp(c.speed, brake ? -55 : 0, s.vehicleConfig.topSpeed*(1-c.damage*.003));
    if (Math.abs(c.speed) < .5 && !gas && !brake) c.speed = 0;
    c.a += steer * s.vehicleConfig.turnRate * clamp(Math.abs(c.speed)/45,0,1) * (c.speed<0?-1:1) * (handbrake?1.45:1) * DT;
    // Adjust grip based on vehicle mass for more realistic physics
    const baseGrip = s.vehicleConfig.grip;
    const massFactor = 1 / s.vehicleConfig.mass; // Lighter cars have better grip
    const grip = handbrake ? (.035 * massFactor) : (baseGrip * massFactor);
    c.vx += (Math.cos(c.a)*c.speed-c.vx)*grip; c.vy += (Math.sin(c.a)*c.speed-c.vy)*grip;
    const nx = c.x+c.vx*DT, ny = c.y+c.vy*DT;
    if (blocked(s,nx,ny)) { if(Math.abs(c.speed)>25)bump(s,5); c.speed *= -.2; c.vx *= -.25; c.vy *= -.25; }
    else { s.distance+=Math.hypot(nx-c.x,ny-c.y);c.x=nx;c.y=ny; }
    s.speedSum += Math.abs(c.speed); s.speedTicks++;   // sampled here, where state is meant to change
    const phase = Math.floor(s.tick / 300) % 2;
    for (const t of s.traffic) {
      const a = t.horizontal?s.city.xs:s.city.ys, pos = t.horizontal?t.x:t.y;
      const junction = a[nearest(a,pos)], delta = (junction-pos)*t.dir;
      const red = (t.horizontal ? phase===0 : phase===1) && delta>25 && delta<62;
      t.stopped = red || (dist(t,c)<65 && Math.abs(t.horizontal?c.y-t.y:c.x-t.x)<18 && ((t.horizontal?(c.x-t.x):(c.y-t.y))*t.dir>0));
      if (!t.stopped) { if(t.horizontal)t.x+=t.dir*t.speed*DT;else t.y+=t.dir*t.speed*DT; }
      if(t.x<70)t.x=s.city.size-75;if(t.x>s.city.size-70)t.x=75;
      if(t.y<70)t.y=s.city.size-75;if(t.y>s.city.size-70)t.y=75;
      const contact=dist(t,c);
      if(contact<17){
        if(Math.abs(c.speed)>35)bump(s,3);
        const normalX=(c.x-t.x)/(contact||1),normalY=(c.y-t.y)/(contact||1);
        const px=c.x+normalX*(18-contact),py=c.y+normalY*(18-contact);
        if(!blocked(s,px,py)){c.x=px;c.y=py;}
        c.speed*=.35;c.vx*=.35;c.vy*=.35;
      }
    }
    for (const person of s.people) {
      if(person.dodge>0)person.dodge--;
      if(dist(person,c)<38) {person.dodge=90;person.x+=c.x<person.x?2:-2;}
      else {person.x+=person.dir*.25;if(person.x>person.home+100||person.x<person.home)person.dir*=-1;}
      // People step onto the pavement, never suffer injury.
      if(dist(person,c)<16&&!s.cooldown){s.pedestrianClips++;s.heat=clamp(s.heat+.5,0,3);s.cooldown=60;c.speed*=.5;say(s,'GIVE PEOPLE ROOM · time penalty');}
    }
    let seen = false;
    for(const u of s.units){
      u.seen=sight(s,u,c);
      if(u.seen && Math.abs(c.speed)>165)s.heat=clamp(s.heat+.004,0,3);
      if(s.heat>.5 && u.seen){seen=true;u.lastX=c.x;u.lastY=c.y;}
      if(s.heat>.5){
        const ix=nearest(s.city.xs,u.x),iy=nearest(s.city.ys,u.y);
        let target={x:u.lastX,y:u.lastY};
        if(!sight(s,u,target)) target=Math.abs(u.x-s.city.xs[ix])>25?{x:s.city.xs[ix],y:u.y}:{x:u.x,y:s.city.ys[iy]+Math.sign(u.lastY-u.y)*80};
        u.a=Math.atan2(target.y-u.y,target.x-u.x);
        const ux=u.x+Math.cos(u.a)*90*DT,uy=u.y+Math.sin(u.a)*90*DT;
        if(!blocked(s,ux,uy)){u.x=ux;u.y=uy;}
      }
    }
    s.unseen=seen?0:s.unseen+1;
    if(s.unseen>300)s.heat=Math.max(0,s.heat-.003);
    s.maxHeat=Math.max(s.maxHeat,s.heat);
    const boxed=s.heat>.5 && Math.abs(c.speed)<24 && s.units.some(u=>dist(u,c)<48);
    s.caught=boxed?s.caught+1:Math.max(0,s.caught-2);
    if(s.caught>=150){s.busts++;if(s.job.carrying)s.jobsFailed++;s.money=Math.max(0,s.money-60);s.heat=0;s.caught=0;job(s);say(s,'STOPPED · $60 fee. A new job is waiting.');}
    const dest=s.job.carrying?s.job.drop:s.job.pickup;
    if(dist(c,dest)<48 && Math.abs(c.speed)<105){
      if(!s.job.carrying){s.job.carrying=true;s.job.deadline=s.tick+3300;s.route=[];say(s,'PARCEL ON BOARD · follow the mint beacon');s.fx.push({k:'sound',s:'pick'});}
      else {const pay=Math.max(50,s.job.value-(s.crashes-s.job.damage)*25);s.money+=pay;s.score+=pay;s.jobsDone++;c.damage=Math.max(0,c.damage-8);s.fx.push({k:'sound',s:'level'});say(s,`DELIVERED +$${pay} · next pickup marked`);job(s);}
    }
    if(s.job.carrying&&s.tick>s.job.deadline){s.jobsFailed++;say(s,'DELIVERY MISSED · try the next route');job(s);}
    const bit=(c.x>s.city.size/2?1:0)+(c.y>s.city.size/2?2:0);s.districtMask|=1<<bit;s.seenDistricts=[1,2,4,8].filter(b=>s.districtMask&b).length;
    s.camera.x+=(c.x+Math.cos(c.a)*Math.abs(c.speed)*.45-s.camera.x)*.06;
    s.camera.y+=(c.y+Math.sin(c.a)*Math.abs(c.speed)*.45-s.camera.y)*.06;
    s.camera.zoom+=(1.05-Math.abs(c.speed)*.0012-s.camera.zoom)*.025;
    if(s.tick>=SHIFT*60){s.over=true;say(s,'SHIFT COMPLETE');}
    return s;
  }
  function bot(s){
    if(!s.started)return{actionPressed:true};
    const c=s.car,d=s.job.carrying?s.job.drop:s.job.pickup;
    if(!s.route.length){
      let x=nearest(s.city.xs,c.x),y=nearest(s.city.ys,c.y);
      const route=[node(s,x,y)];
      while(x!==d.ix||y!==d.iy){if(x!==d.ix && (y===d.iy||rand(s)>.5))x+=Math.sign(d.ix-x);else y+=Math.sign(d.iy-y);route.push(node(s,x,y));}
      s.route=route;
    }
    if(dist(c,s.route[0])<33&&s.route.length>1)s.route.shift();
    const target=s.route[0];
    // Aim along the current street first, not diagonally at a distant junction.
    // This also lets a bumped car return to the lane instead of nudging the same car forever.
    const dx=target.x-c.x,dy=target.y-c.y;
    const aim=dist(c,target)>120?(Math.abs(dx)>Math.abs(dy)?{x:c.x+Math.sign(dx)*90,y:target.y}:{x:target.x,y:c.y+Math.sign(dy)*90}):target;
    const delta=angle(Math.atan2(aim.y-c.y,aim.x-c.x)-c.a);
    const next=s.route[1];const turn=next?Math.abs(angle(Math.atan2(next.y-target.y,next.x-target.x)-Math.atan2(target.y-c.y,target.x-c.x))):0;
    let limit=Math.abs(delta)>.65?46:125;
    if((turn>.5||!next)&&dist(c,target)<110)limit=65;
    if(s.tick%20===0)s.botNoise=(rand(s)-.5)*.1;
    if(s.cooldown>35)limit=40;
    return{up:c.speed<limit,down:c.speed>limit+12,steer:clamp(delta*2+s.botNoise,-1,1)};
  }
  // A report, never a writer: the shell calls this at its own rates (every frame for the
  // juice layer, every 30 ticks to publish), so anything it stored would depend on who was
  // watching, and the browser and the playtest would measure different games.
  function metrics(s){
    const avgSpeed = s.speedTicks ? (s.speedSum || 0) / s.speedTicks : 0;
    return{
      score:s.score,
      jobs_done:s.jobsDone,
      jobs_failed:s.jobsFailed,
      money:s.money,
      max_heat:Math.round(s.maxHeat*100)/100,
      busts:s.busts,
      pedestrians_clipped:s.pedestrianClips,
      crashes:s.crashes,
      districts_visited:s.seenDistricts,
      distance:Math.round(s.distance),
      avg_speed: Math.round(avgSpeed * 100) / 100
    };
  }
  function text(ctx,t,x,y,size=14,color='#ecf9f2',align='left'){ctx.fillStyle=color;ctx.font=`600 ${size}px system-ui`;ctx.textAlign=align;ctx.fillText(t,x,y);}
  function rect(ctx,x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(x,y,w,h);}
  function car(ctx,c,color,police=false,archetype='Hatch'){
    ctx.save();ctx.translate(c.x,c.y);ctx.rotate(c.a);

    // Base dimensions
    let width = 32, height = 18, wheelSize = 4;

    // Adjust dimensions based on archetype
    switch(archetype) {
      case 'Van':
        width = 42; height = 24; wheelSize = 5;
        break;
      case 'Coupe':
        width = 28; height = 14; wheelSize = 3;
        break;
      case 'Pickup':
        width = 38; height = 20; wheelSize = 5;
        break;
      case 'Sport':
        width = 26; height = 12; wheelSize = 3;
        break;
      case 'Sedan':
        width = 34; height = 16; wheelSize = 4;
        break;
      // Default is Hatch
    }

    const halfWidth = width/2, halfHeight = height/2;
    rect(ctx,-halfWidth-1,-halfHeight-1,width+2,height+4,'#070d1b'); // Shadow
    rect(ctx,-halfWidth,-halfHeight,width,height,color); // Body
    rect(ctx,-halfWidth/2,-halfHeight+2,halfWidth-4,halfHeight+2,'#162b3e'); // Windows

    // Wheels
    const wheelOffsetX = halfWidth - 4;
    const wheelOffsetY = halfHeight - wheelSize;
    rect(ctx,wheelOffsetX,-wheelOffsetY,wheelSize,wheelSize,'#fff3b6'); // Front right
    rect(ctx,wheelOffsetX,wheelOffsetY,wheelSize,wheelSize,'#fff3b6'); // Rear right
    rect(ctx,-wheelOffsetX,-wheelOffsetY,wheelSize,wheelSize,'#fa7171'); // Front left
    rect(ctx,-wheelOffsetX,wheelOffsetY,wheelSize,wheelSize,'#fa7171'); // Rear left

    if(police){
      rect(ctx,-2,-halfHeight-2,4,9,'#ff657e');
      rect(ctx,-2,-halfHeight+7,4,9,'#6ac3ff');
    }
    ctx.restore();
  }
  function render(s,ctx){
    const c=s.car,cam=s.camera,z=cam.zoom;
    rect(ctx,0,0,W,H,'#0b1725');
    ctx.save();ctx.translate(W/2,H*.48);ctx.scale(z,z);ctx.translate(-cam.x,-cam.y);
    const size=s.city.size;
    rect(ctx,0,0,size,size,'#18333d');
    for(const x of s.city.xs){rect(ctx,x-53,50,106,size-100,'#60716c');rect(ctx,x-43,50,86,size-100,'#243342');for(let y=60;y<size-60;y+=35)rect(ctx,x-1,y,2,16,'#75836e');}
    for(const y of s.city.ys){rect(ctx,50,y-53,size-100,106,'#60716c');rect(ctx,50,y-43,size-100,86,'#243342');for(let x=60;x<size-60;x+=35)rect(ctx,x,y-1,16,2,'#75836e');}
    for(const x of s.city.xs)for(const y of s.city.ys){
      rect(ctx,x-44,y-44,88,88,'#293c48');
      for(let k=-30;k<35;k+=10){rect(ctx,x+k,y-42,5,11,'#99aaa1');rect(ctx,x-42,y+k,11,5,'#99aaa1');}
      rect(ctx,x+38,y-55,5,9,Math.floor(s.tick/300)%2?'#84eebd':'#fa7878');
      rect(ctx,x-55,y+38,9,5,Math.floor(s.tick/300)%2?'#fa7878':'#84eebd');
    }
    const roofs=['#294359','#304052','#354b53','#33404e'],glow=['#e7ad6f','#71d9ce','#d78eb6','#a6b4db'];
    for(const b of s.city.blocks){
      if(Math.abs(b.x+b.w/2-cam.x)>530||Math.abs(b.y+b.h/2-cam.y)>620)continue;
      rect(ctx,b.x+14,b.y+20,b.w,b.h,'#102630');rect(ctx,b.x+9,b.y+14,b.w,b.h,'#0f2531');rect(ctx,b.x,b.y,b.w,b.h,b.park?'#274c46':roofs[b.hue]);
      ctx.strokeStyle=b.park?'#51806a':'#4b6675';ctx.lineWidth=2;ctx.strokeRect(b.x+6,b.y+6,b.w-12,b.h-12);
      if(b.park){for(let x=18;x<b.w-15;x+=33)for(let y=20;y<b.h-15;y+=35){ctx.fillStyle='#326d5b';ctx.beginPath();ctx.arc(b.x+x+3,b.y+y+4,14,0,Math.PI*2);ctx.fill();ctx.fillStyle='#54866a';ctx.beginPath();ctx.arc(b.x+x-2,b.y+y-3,10,0,Math.PI*2);ctx.fill();}rect(ctx,b.x+b.w/2-4,b.y,8,b.h,'#779885');}
      else{
        for(let x=17;x<b.w-10;x+=23){rect(ctx,b.x+x,b.y+9,11,3,glow[b.hue]);rect(ctx,b.x+x,b.y+b.h-12,11,3,glow[b.hue]);}
        rect(ctx,b.x+4,b.y+4,b.w-8,3,'#728082');rect(ctx,b.x+4,b.y+7,3,b.h-14,'#536d74');
        rect(ctx,b.x+25,b.y+30,35,26,'#1d303d');rect(ctx,b.x+27,b.y+28,31,24,'#53646c');
        for(let k=0;k<4;k++)rect(ctx,b.x+31,b.y+32+k*4,23,1,'#82908d');
        if(b.w>95){rect(ctx,b.x+b.w-35,b.y+22,19,23,'#152e3a');rect(ctx,b.x+b.w-37,b.y+20,19,23,'#465f68');ctx.strokeStyle='#7f9493';ctx.lineWidth=1;ctx.beginPath();ctx.arc(b.x+b.w-27,b.y+31,6,0,Math.PI*2);ctx.stroke();}
        for(let k=0;k<3;k++)rect(ctx,b.x+17+k*18,b.y+b.h-51,8,10,'#182f3b');
        rect(ctx,b.x+10,b.y+b.h-34,b.w-20,17,'#162c38');text(ctx,['NIGHT OWL','POST / 24','CORNER STORE','STUDIO 06','FRESH MARKET','THE LANTERN'][b.sign],b.x+b.w/2,b.y+b.h-21,9,glow[b.hue],'center');
      }
    }
    for(const t of s.traffic)car(ctx,{...t,a:t.horizontal?(t.dir>0?0:Math.PI):(t.dir>0?Math.PI/2:-Math.PI/2)},['#9ba995','#b97e70','#8b9db6','#d4ba82'][t.hue]);
    for(const p of s.people){ctx.fillStyle=p.dodge?'#ffda94':'#b3b4c5';ctx.beginPath();ctx.arc(p.x,p.y,4,0,Math.PI*2);ctx.fill();}
    const goal=s.job.carrying?s.job.drop:s.job.pickup;
    ctx.strokeStyle=s.job.carrying?'#73e4c6':'#f6c77c';ctx.lineWidth=3;ctx.beginPath();ctx.arc(goal.x,goal.y,31+Math.sin(s.tick*.06)*4,0,Math.PI*2);ctx.stroke();
    text(ctx,s.job.carrying?'DROP':'PICKUP',goal.x,goal.y-42,12,s.job.carrying?'#73e4c6':'#f6c77c','center');
    for(const u of s.units)car(ctx,u,'#d5e3df',true);
    // Soft headlight cones and a bright coupe establish the player at a glance.
    ctx.save();ctx.translate(c.x,c.y);ctx.rotate(c.a);ctx.globalAlpha=.1;ctx.fillStyle='#ffe2a0';ctx.beginPath();ctx.moveTo(15,-8);ctx.lineTo(135,-43);ctx.lineTo(135,43);ctx.lineTo(15,8);ctx.fill();ctx.restore();
    car(ctx,c,'#f8bc70',false,s.archetype);
    ctx.restore();
    // Navigation marker remains on screen when the next stop is outside the camera.
    const gx=(goal.x-cam.x)*z+W/2,gy=(goal.y-cam.y)*z+H*.48;
    if(gx<28||gx>452||gy<158||gy>562){const ax=clamp(gx,28,452),ay=clamp(gy,158,562);ctx.save();ctx.translate(ax,ay);ctx.rotate(Math.atan2(gy-ay,gx-ax));ctx.fillStyle=s.job.carrying?'#73e4c6':'#f6c77c';ctx.beginPath();ctx.moveTo(10,0);ctx.lineTo(-7,-8);ctx.lineTo(-7,8);ctx.fill();ctx.restore();}
    rect(ctx,0,0,W,90,'#101e2cec');text(ctx,'CROSSTOWN',20,32,24);text(ctx,'NIGHT SHIFT / '+district(s,c),21,53,10,'#8eacae');
    text(ctx,`$${s.money}`,458,32,24,'#78dfc0','right');text(ctx,`${Math.max(0,SHIFT-Math.floor(s.tick/60))}s LEFT`,458,53,11,'#a2b8bd','right');
    for(let n=0;n<3;n++)rect(ctx,21+n*22,67,16,4,s.heat>n?'#fc9a79':'#314759');
    text(ctx,s.heat>.5?(s.unseen>90?'SEARCHING · break sight':'PURSUIT · find cover'):'KEEP IT CLEAN',100,73,10,s.heat>.5?'#ffbd95':'#92b0af');
    rect(ctx,12,98,456,44,'#101e2ce8');text(ctx,s.job.carrying?'DELIVER THE PARCEL':'PICK UP YOUR NEXT DELIVERY',24,116,11,s.job.carrying?'#73e4c6':'#f6c77c');
    text(ctx,`${Math.round(dist(c,goal))}m · ${s.job.carrying?Math.max(0,Math.ceil((s.job.deadline-s.tick)/60))+'s remaining':'Slow down inside the gold ring'}`,24,132,11,'#adc0c2');
    // Minimap includes every street, destination, vehicle and searching patrol.
    const mx=18,my=480,mw=118,scale=mw/size;
    rect(ctx,mx-6,my-6,mw+12,mw+12,'#101e2ce8');
    ctx.strokeStyle='#4c6976';ctx.lineWidth=2;
    for(const x of s.city.xs){ctx.beginPath();ctx.moveTo(mx+x*scale,my);ctx.lineTo(mx+x*scale,my+mw);ctx.stroke();}
    for(const y of s.city.ys){ctx.beginPath();ctx.moveTo(mx,my+y*scale);ctx.lineTo(mx+mw,my+y*scale);ctx.stroke();}
    for(const u of s.units){if(s.heat>.5){ctx.strokeStyle='#f99a7966';ctx.beginPath();ctx.arc(mx+u.lastX*scale,my+u.lastY*scale,15,0,Math.PI*2);ctx.stroke();}rect(ctx,mx+u.x*scale-2,my+u.y*scale-2,4,4,'#8caaf5');}
    rect(ctx,mx+goal.x*scale-3,my+goal.y*scale-3,6,6,s.job.carrying?'#73e4c6':'#f6c77c');rect(ctx,mx+c.x*scale-3,my+c.y*scale-3,6,6,'#ffffff');
    text(ctx,`${Math.round(Math.abs(c.speed)*.45)} KM/H`,458,544,22,'#f6eee0','right');text(ctx,`BODY ${100-Math.round(c.damage)}%`,458,565,11,'#a1b8be','right');
    rect(ctx,0,612,W,108,'#101e2ce8');text(ctx,'←    STEER    →',94,655,16,'#afc9c9','center');
    rect(ctx,253,625,83,55,'#253c4c');text(ctx,'BRAKE',294,658,14,'#e3ecdf','center');rect(ctx,348,625,112,55,'#6cd5b7');text(ctx,'DRIVE',404,658,14,'#112d30','center');
    rect(ctx,395,490,65,32,'#243b4e');text(ctx,'DRIFT',428,511,11,'#dce9df','center');
    text(ctx,s.tick<s.noticeUntil?s.notice:'ARROWS / WASD · SPACE DRIFTS · P PAUSES',W/2,702,10,'#9eb9bd','center');
    if(!s.started||s.over){
      rect(ctx,0,0,W,H,'#091522dd');rect(ctx,30,184,420,334,'#142b39');rect(ctx,30,184,4,334,'#76dbc1');
      text(ctx,s.over?'SHIFT COMPLETE':'CROSSTOWN',58,237,30);text(ctx,s.over?'THE CITY IS STILL AWAKE.':'A city after dark. A job worth the detour.',58,267,13,'#9dbdbc');
      const lines=s.over?[`${s.jobsDone} parcels delivered · $${s.money} earned`,`${s.crashes} bumps · ${s.busts} stops`,`${s.seenDistricts} neighborhoods explored`]:['Find the gold pickup. Stop in the ring.','Follow the mint beacon to deliver.','Clean driving pays. Lose patrols behind blocks.'];
      lines.forEach((t,n)=>text(ctx,t,58,311+n*28,13));
      text(ctx,'WASD / arrows drive · Space drifts',58,419,12,'#9dbdbc');text(ctx,'Touch: left thumb steers, right thumb drives',58,441,11,'#9dbdbc');
      rect(ctx,58,465,364,34,'#72d8bb');text(ctx,s.over?'TAP / SPACE FOR ANOTHER SHIFT':'TAP / SPACE TO START YOUR SHIFT',240,487,12,'#102f32','center');
    }
  }
  globalThis.Game={id: "crosstown",
    guide: {
  "version": 1,
  "summary": "Three-minute shift on seeded streets, ordinary pickup/drop jobs with deadlines.",
  "goal": "Currently a score shift: earn as much net pay as possible in three minutes.",
  "lose": "No campaign failure currently; missed jobs, damage and busts reduce shift earnings.",
  "rules": [
    "Three-minute shift on seeded streets, ordinary pickup/drop jobs with deadlines. Crashes hurt pay/car, successful jobs repair some damage; heat and patrol busts cost money/cargo. No current pass/fail threshold or career save."
  ],
  "controls": [
    {
      "action": "Drive / brake-reverse",
      "keyboard": "W/Up / S/Down",
      "touch": "Gas / brake"
    },
    {
      "action": "Steer / handbrake",
      "keyboard": "A/D or arrows / Space",
      "touch": "Steering / drift"
    }
  ],
  "firstSteps": [
    "Approach the gold pickup ring and slow down.",
    "Take the parcel to the mint ring before its deadline."
  ],
  "tips": [
    "Driving through a pickup at speed does not collect it; slow inside the marked ring."
  ],
  "modes": []
},
    title:'Crosstown',width:W,height:H,init,step,bot,metrics,render,rules:{ARCHETYPES},touchStick:(s,p)=>s.started&&!s.over&&(!p||p.x<235)};
})();
