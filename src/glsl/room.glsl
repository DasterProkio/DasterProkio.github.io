// ---------------------------------------------------------------- the room
// A low table by a shoji wall. Every visual parameter lives in a Mem struct so
// the same room can be traced "now" (Life scene) or at any remembered moment
// (the shard portals).
//
// Room coordinates (units 10cm): table top y=0, bowl at origin.
// Shoji wall is the plane z = WALLZ, facing -z. Floor at y = FLOORY.
#define WALLZ 7.0
#define FLOORY -3.3
#define TABLE_HX 6.0
#define TABLE_HZ 4.2

struct Mem {
  float day;      // 0..1  (0.25 sunrise, 0.5 noon, 0.75 sunset)
  float season;   // 0 spring, 1 summer, 2 autumn, 3 winter (continuous)
  float two;      // second bowl presence 0..1
  float gap;      // distance between the bowls (bowl-centre spacing)
  float candle;   // candle light 0..1
  float steam;    // steam amount 0..1
  float tea;      // tea level 0..1 in the celadon bowl
  float tea2;     // tea in the tenmoku
  float open;     // shoji panel open 0..1
  float ring;     // faint ring left where the second bowl stood
  float bowlOn;   // celadon bowl present on table (0 while lifted/fallen)
  vec3  bowlOff;  // offset of the celadon bowl (lift)
  float bowlTilt; // tilt of the celadon bowl
};

uniform vec4 uProf2[6]; // tenmoku profile

// ---- second bowl: tenmoku (conical, dark iron glaze), analytic 6-point lathe
float sdTenmoku(vec3 p){
  vec2 q = vec2(length(p.xz), p.y);
  float d = 1e5;
  for(int i=0;i<5;i++){
    vec2 a=uProf2[i].xy, ba=uProf2[i+1].xy-a, pa=q-a;
    float t=sat(dot(pa,ba)/dot(ba,ba));
    d=min(d, length(pa-ba*t)-mix(uProf2[i].z, uProf2[i+1].z, t));
  }
  // foot
  d = smin(d, sdSeg(q, vec2(0.17,0.07), vec2(0.18,0.025))-0.022, 0.02);
  return d;
}

vec3 sunDir(Mem m){
  // sun travels across the sky beyond the shoji (+z), lower in winter
  float a = (m.day-0.25)*PI;            // 0 at sunrise, PI at sunset
  float elev = mix(0.95, 0.5, sat(abs(m.season-1.0)/2.0)) ;
  vec3 d = vec3(-cos(a)*0.9, sin(a)*elev, 1.0);
  return normalize(d);
}
float sunUp(Mem m){ return smoothstep(0.2,0.3,m.day)*smoothstep(0.8,0.7,m.day); }
vec3 sunColor(Mem m){
  float h = sunDir(m).y;
  vec3 c = mix(vec3(1.0,0.45,0.16), vec3(1.0,0.86,0.68), smoothstep(0.05,0.45,h));
  c *= mix(1.0, 0.8, smoothstep(2.5,3.0,m.season)); // pale winter
  return c*6.0*sunUp(m);
}
vec3 skyColor(Mem m, float up){
  float d = sunUp(m);
  vec3 night = vec3(0.012,0.016,0.03);
  vec3 dayc = mix(vec3(0.45,0.58,0.8), vec3(0.62,0.66,0.72), smoothstep(2.4,3.0,m.season));
  vec3 c = mix(night, dayc*(0.6+0.4*up), d);
  float dusk = sat(1.0-abs(m.day-0.25)*12.0)+sat(1.0-abs(m.day-0.75)*12.0);
  c = mix(c, vec3(0.9,0.5,0.3)*0.8, dusk*0.5*(1.0-up));
  return c;
}

// shoji lattice: 1 on paper, 0 on wood bars. uv in wall coords (x, y)
float shojiPaper(vec2 w){
  vec2 cell = vec2(1.9, 2.3);
  vec2 f = abs(fract(w/cell+0.5)-0.5)*cell;
  float bar = min(f.x, f.y);
  return smoothstep(0.07, 0.1, bar);
}
// open panel: a slid-open gap in the shoji (x from -1.2 widening to the right)
float openPanel(vec2 w, Mem m){
  float x0 = -1.2, x1 = x0 + m.open*4.0;
  return step(x0,w.x)*step(w.x,x1)*step(-1.0,w.y)*step(w.y,14.0);
}
// light transmitted through the wall toward direction L from point p
// returns (direct sun fraction through the gap, diffuse paper glow factor)
vec2 wallTransmit(vec3 p, vec3 L, Mem m){
  if(L.z<=0.01) return vec2(0);
  float t = (WALLZ-p.z)/L.z;
  vec2 w = (p+L*t).xy;
  if(w.y<-1.0 || w.y>14.0) return vec2(0);
  // soft penumbra on the gap edges (sun is not a point, the gap is 30cm away)
  float x0 = -1.2, x1 = x0 + m.open*4.0;
  float pen = 0.05 + 0.012*t;
  float open = smoothstep(x0-pen, x0+pen, w.x)*smoothstep(x1+pen, x1-pen, w.x)*smoothstep(-1.0,-0.6,w.y);
  return vec2(open, 1.0-open);
}

// garden through the gap: an out-of-focus impression (DOF will blur it more)
vec3 garden(vec3 ro, vec3 rd, Mem m){
  vec3 sky = skyColor(m, rd.y);
  float t = (WALLZ+40.0-ro.z)/max(rd.z,1e-3);
  vec2 g = (ro+rd*t).xy*0.05;
  float s = m.season;
  vec3 spring = vec3(1.0,0.66,0.74), summer = vec3(0.16,0.32,0.10), autumn = vec3(0.9,0.26,0.06), winter = vec3(0.35,0.32,0.3);
  vec3 leaf = s<1.0 ? mix(spring,summer,smoothstep(0.3,1.0,s)) : s<2.0 ? mix(summer,autumn,smoothstep(1.3,2.0,s)) : mix(autumn,winter,smoothstep(2.1,2.6,s));
  float bare = smoothstep(2.2,2.7,s);
  vec3 sunc = sunColor(m);
  vec3 lit = sunc*0.1 + skyColor(m,1.0)*0.45;
  // foliage mass: soft, low frequency
  float mass = fbm(g*vec2(1.2,1.6)+vec2(1.7,0.3), 4)*0.9 + 0.25 - 0.35*g.y;
  float leafy = smoothstep(-0.05,0.25,mass)*(1.0-0.85*bare);
  vec3 col = mix(sky, leaf*lit*(0.55+0.6*sat(fbm(g*5.0,3)+0.5)), leafy);
  // sun sparkles through the canopy (become bokeh discs)
  vec3 v = voronoiB(g*14.0);
  float spark = smoothstep(0.25,0.05,v.z)*step(0.82,v.y)*leafy*sunUp(m);
  col += sunc*0.25*spark*mix(vec3(1.0), leaf+0.3, 0.5);
  // winter: snow on the ground and bare dark branches
  float branches = (1.0-smoothstep(0.0,0.06,abs(fbm(g*vec2(2.0,1.0)+3.0,4))))*smoothstep(0.8,0.0,g.y)*bare;
  col = mix(col, vec3(0.02)*lit, branches*0.8);
  float ground = smoothstep(-0.28,-0.4,g.y+0.05*fbm(g*6.0,2));
  vec3 gcol = mix(vec3(0.06,0.09,0.04), vec3(0.85,0.88,0.93), smoothstep(2.6,2.9,s));
  col = mix(col, gcol*(lit+0.02), ground);
  return col;
}

// -------- geometry
// ids: 1 bowl, 2 tenmoku, 3 table, 4 wall, 5 floor, 6 tea surface, 7 candle
vec3 bowlLocal(vec3 p, Mem m){
  vec3 q = p - m.bowlOff;
  q.xy = rot(m.bowlTilt)*q.xy;
  return q;
}
vec3 tenLocal(vec3 p, Mem m){ return p - vec3(-m.gap*0.95, 0.0, m.gap*0.3); }
vec3 candlePos(){ return vec3(2.6, 0.0, 1.6); }

vec2 roomMap(vec3 p, Mem m){
  vec2 r = vec2(1e5, 0.0);
  // table top slab (only its top face and edges matter)
  float tb = sdRBox(p-vec3(0.0,-0.25,0.0), vec3(TABLE_HX,0.25,TABLE_HZ), 0.04);
  r = vec2(tb, 3.0);
  if(m.bowlOn>0.5){
    vec3 q = bowlLocal(p,m);
    float bb = length(q-vec3(0,0.35,0))-0.75;
    float b = bb>0.4 ? bb : sdBowl(q);
    if(b<r.x) r=vec2(b,1.0);
  }
  if(m.two>0.01){
    vec3 q = tenLocal(p,m);
    q.y += (1.0-m.two)*8.0;    // absent bowls are far below the table
    float bb = length(q-vec3(0,0.3,0))-0.7;
    float b = bb>0.4 ? bb : sdTenmoku(q);
    if(b<r.x) r=vec2(b,2.0);
  }
  // candle (short, in a clay dish)
  if(m.candle>0.01){
    vec3 q = p-candlePos();
    float c = sdCyl(q-vec3(0,0.4,0), 0.22, 0.4);
    c = min(c, sdCyl(q-vec3(0,0.04,0), 0.42, 0.04));
    if(c<r.x) r=vec2(c,7.0);
  }
  // wall and floor
  float w = WALLZ + 0.02 - p.z;
  if(w<r.x) r=vec2(w,4.0);
  float f = p.y-FLOORY;
  if(f<r.x) r=vec2(f,5.0);
  return r;
}

vec3 roomNormal(vec3 p, Mem m){
  const vec2 e=vec2(0.0008,-0.0008);
  return normalize(e.xyy*roomMap(p+e.xyy,m).x+e.yyx*roomMap(p+e.yyx,m).x+e.yxy*roomMap(p+e.yxy,m).x+e.xxx*roomMap(p+e.xxx,m).x);
}

float roomShadow(vec3 ro, vec3 rd, Mem m, float k){
  float res=1.0, t=0.01;
  for(int i=0;i<40;i++){
    vec3 p = ro+rd*t;
    if(p.y>1.5 || p.z>WALLZ-0.1) break;
    float h=roomMap(p,m).x;
    res=min(res, k*h/t);
    t+=clamp(h,0.01,0.25);
    if(res<0.002) break;
  }
  return sat(res);
}

// radiance of the shoji wall itself (glowing paper; the gap shows the garden)
vec3 wallRadianceR(vec3 p, vec3 rd, Mem m, float rough){
  vec2 w = p.xy;
  vec3 L = sunDir(m);
  vec3 sunc = sunColor(m);
  float paper = mix(shojiPaper(w), 0.8, sat(rough*6.0));
  vec3 glow = (skyColor(m,0.7)*1.1 + sunc*0.10*sat(L.z))*vec3(1.0,0.95,0.86);
  // the sun's disc seen through paper: broad warm hot-spot
  vec2 sp = vec2(p.x - L.x/L.z*6.0, p.y - 2.0 + L.y*4.0);
  glow *= 1.0 + 1.1*sunUp(m)*exp(-dot(sp,sp)*0.02);
  glow *= 0.9+0.1*fbm(w*2.5,3);
  vec3 wood = vec3(0.045,0.03,0.02)*(skyColor(m,0.5)*0.5 + 0.02);
  vec3 col = mix(wood, glow, paper);
  float open = openPanel(w, m);
  if(open>0.5) col = garden(p, rd, m);
  // plaster below the shoji, lintel above
  if(w.y<-1.0 || w.y>14.0) col = vec3(0.30,0.26,0.21)*(skyColor(m,0.2)*0.15+0.004);
  return col;
}
vec3 wallRadiance(vec3 p, vec3 rd, Mem m){ return wallRadianceR(p, rd, m, 0.0); }

// irradiance estimate inside the room: the shoji is a big soft area light
vec3 roomAmbient(vec3 p, vec3 n, Mem m){
  vec3 sky = skyColor(m, 0.7);
  float toWall = sat(n.z*0.6+0.4);
  float near = 1.0/(1.0+0.02*sq(WALLZ-p.z));
  vec3 a = sky*(0.03 + 0.55*toWall*toWall*near)*(0.7+0.3*sat(n.y));
  // warm bounce from the room behind the camera (sunlit tatami, plaster)
  a += (sky*0.06 + sunColor(m)*0.012)*vec3(1.0,0.85,0.7)*sat(-n.z*0.7+0.3);
  a += sunColor(m)*0.015*sat(-n.y*0.5+0.5)*0.5;  // bounce from sunlit floor
  return a;
}

vec3 candleLight(vec3 p, vec3 n, Mem m, out vec3 L){
  vec3 fl = candlePos()+vec3(0.0,1.05,0.0);
  vec3 d = fl-p; float r2 = dot(d,d); L = d*inversesqrt(r2);
  float flick = 0.85+0.15*sin(uTime*23.0)*sin(uTime*7.3+1.0);
  return vec3(1.0,0.55,0.22)*m.candle*flick*3.0/(r2+0.5);
}

vec3 woodTable(vec3 p){
  vec2 u = p.xz;
  float warp = fbm(u*vec2(0.18,0.9),3);
  float ring = fract((u.y+warp*1.8)*1.6 + 0.3*fbm(u*vec2(0.06,0.5),2));
  float grain = smoothstep(0.0,0.3,ring)*smoothstep(1.0,0.55,ring);
  vec3 c = mix(vec3(0.075,0.042,0.024), vec3(0.15,0.085,0.045), grain);
  c *= 0.8+0.3*sat(fbm(u*vec2(0.5,14.0),3)+0.5);
  return c;
}

// inner radius of the celadon bowl at height y (for the tea surface)
float teaRadius(float y){
  for(int i=0;i<NPROF-1;i++){
    vec4 a=uProf[i], b=uProf[i+1];
    if(y>=a.y && y<b.y){ float t=(y-a.y)/max(b.y-a.y,1e-4); return mix(a.x,b.x,t)-mix(a.z,b.z,t)*1.1; }
  }
  return 0.0;
}
float teaHeight(float lvl){ return mix(0.16, 0.56, lvl); }

// cheap reflection lookup: shoji wall / table / dark room, no occlusion
vec3 roomReflect(vec3 p, vec3 r, float rough, Mem m){
  vec3 c = vec3(0.0);
  if(r.z>0.05){
    float t=(WALLZ-p.z)/r.z; vec3 w=p+r*t;
    if(w.y>FLOORY && w.y<16.0) c = wallRadianceR(w, r, m, rough);
    else c = skyColor(m,0.3)*0.05;
  } else if(r.y<-0.05){
    float t=-p.y/r.y; vec3 w=p+r*t;
    vec2 tr = wallTransmit(w, sunDir(m), m);
    c = woodTable(w)*(sunColor(m)*tr.x*sat(sunDir(m).y) + roomAmbient(w, vec3(0,1,0), m));
  } else {
    c = roomAmbient(p, -r, m)*0.25;
  }
  // blur toward average as roughness grows
  return mix(c, roomAmbient(p, r, m)*0.8, sat(rough*3.5));
}

vec3 roomLightSurf(Surf s, vec3 p, vec3 v, Mem m, float ao){
  vec3 L = sunDir(m);
  vec3 sc = sunColor(m);
  vec2 tr = wallTransmit(p, L, m);
  float sh = 1.0;
  if(tr.x>0.0 && sunUp(m)>0.0) sh = roomShadow(p+s.n*0.004, L, m, 12.0);
  vec3 direct = sc*tr.x*sh;
  float nl = sat(dot(s.n,L));
  float nv = sat(dot(s.cn,v));
  float Fc = s.coat*F_Schlick1(0.04, nv);
  vec3 amb = roomAmbient(p, s.n, m)*ao;
  vec3 Lc; vec3 cl = candleLight(p, s.n, m, Lc);
  vec3 dif = s.alb*(1.0-Fc)*(direct*nl + amb + cl*sat(dot(s.n,Lc)) + s.sss*direct*sat(dot(-s.n,L)*0.5+0.4)*0.4);
  vec3 spec = specGGX(s.n, v, L, s.rough, s.f0)*direct + specGGX(s.n, v, Lc, s.rough, s.f0)*cl;
  vec2 eb = envBRDF(sat(dot(s.n,v)), s.rough);
  spec += roomReflect(p, reflect(-v,s.n), s.rough, m)*(s.f0*eb.x+eb.y)*ao;
  vec3 coat = vec3(0);
  if(s.coat>0.0){
    coat = s.coat*(specGGX(s.cn, v, L, s.coatRough, vec3(0.04))*direct
                  + specGGX(s.cn, v, Lc, s.coatRough, vec3(0.04))*cl
                  + roomReflect(p, reflect(-v,s.cn), s.coatRough, m)*F_Schlick1(0.04,nv)*ao);
  }
  return dif + spec + coat + s.emit;
}

float roomAO(vec3 p, vec3 n, Mem m){
  float o=0.0, sc=1.0;
  for(int i=1;i<=4;i++){ float h=0.03*float(i*i); o+=(h-roomMap(p+n*h,m).x)*sc; sc*=0.65; }
  return sat(1.0-1.6*o);
}

Surf tenmokuSurface(vec3 q, vec3 n){
  Surf s = defaultSurf(n);
  float y = q.y;
  // iron glaze: black-brown with rust breaking at the rim, "hare's fur" streaks
  float a = atan(q.z,q.x);
  float fur = sat(0.5+0.7*gnoise(vec3(a*90.0+3.0*gnoise(q*6.0), y*2.0, 0.0)))*0.8;
  vec3 black = vec3(0.018,0.012,0.009);
  vec3 rust = vec3(0.30,0.12,0.04);
  vec3 c = mix(black, rust, sat(fur*smoothstep(0.3,0.62,y)*0.55 + 0.8*smoothstep(0.56,0.63,y)));
  float foot = step(y,0.1)*step(length(q.xz),0.24);
  c = mix(c, vec3(0.42,0.3,0.2), foot + smoothstep(0.14,0.1,y));
  s.alb = c; s.rough=0.7;
  s.coat = 1.0-foot; s.coatRough = 0.035;
  return s;
}

// shade tea surface (matcha)
vec3 teaShade(vec3 p, vec3 v, Mem m, float froth){
  vec3 n = vec3(0,1,0);
  vec2 u = p.xz;
  float bub = voronoiB(vec3(u*55.0, 1.0)).z;
  float foam = sat(froth*(0.6+0.6*fbm(u*9.0,3)));
  vec3 base = mix(vec3(0.10,0.17,0.02), vec3(0.42,0.58,0.16), foam);
  base *= 0.9+0.2*smoothstep(0.2,0.6,bub);
  Surf s = defaultSurf(n);
  s.alb = base; s.rough=0.5; s.coat = 1.0-foam*0.8; s.coatRough = 0.06;
  s.n = normalize(n + vec3(gnoise(vec3(u*30.0,0.0)),0.0,gnoise(vec3(u*30.0,3.0)))*0.03*foam);
  s.cn = n;
  return roomLightSurf(s, p, v, m, 1.0);
}

// steam: a few noisy wisps rising from a point, integrated front to back
vec4 steamVolume(vec3 ro, vec3 rd, float tmax, vec3 base, float amt, Mem m){
  if(amt<0.01) return vec4(0);
  // bounding cylinder r=0.55 around base, y in [base.y, base.y+4]
  vec3 oc = ro-base;
  float a=dot(rd.xz,rd.xz), b=dot(oc.xz,rd.xz), c=dot(oc.xz,oc.xz)-0.55*0.55;
  float h=b*b-a*c; if(h<0.0) return vec4(0);
  h=sqrt(h); float t0=max((-b-h)/a,0.0), t1=min((-b+h)/a,tmax);
  if(t1<=t0) return vec4(0);
  vec4 acc=vec4(0);
  float dt=(t1-t0)/14.0;
  float t=t0+dt*ign(gl_FragCoord.xy);
  vec3 sc = sunColor(m)*0.5+roomAmbient(base, vec3(0,1,0), m)*3.0;
  for(int i=0;i<14;i++){
    vec3 p=ro+rd*t-base;
    float y=p.y;
    if(y>0.0 && y<4.0){
      vec3 q=p; q.xz += vec2(sin(y*1.3+uTime*0.7), cos(y*1.1+uTime*0.5))*0.12*y;
      float r=length(q.xz);
      float n=fbm(vec3(q.x*3.0, y*1.6-uTime*1.2, q.z*3.0),3);
      float d=sat(n*1.4+0.4-r*2.2)*smoothstep(0.0,0.4,y)*smoothstep(4.0,1.0,y)*amt;
      float al=1.0-exp(-d*dt*5.0);
      acc.rgb += (1.0-acc.a)*al*sc*0.6;
      acc.a += (1.0-acc.a)*al;
    }
    t+=dt;
  }
  return acc;
}

// ---- full trace of the room. Returns colour and hit distance.
vec4 roomTrace(vec3 ro, vec3 rd, Mem m, int steps){
  float t=0.0; vec2 h=vec2(0.0);
  bool hit=false;
  for(int i=0;i<200;i++){
    if(i>=steps) break;
    h = roomMap(ro+rd*t, m);
    if(h.x<0.0003*t+0.0005){ hit=true; break; }
    t += h.x*0.9;
    if(t>120.0) break;
  }
  // tea surface is analytic (flat disk inside the bowl)
  float tTea = 1e5;
  if(m.tea>0.01 && m.bowlOn>0.5){
    float yT = teaHeight(m.tea);
    vec3 lo = bowlLocal(ro,m), ld = rd; ld.xy = rot(m.bowlTilt)*ld.xy;
    float tt = (yT-lo.y)/ld.y;
    if(tt>0.0){ vec3 q=lo+ld*tt; if(length(q.xz)<teaRadius(yT)) tTea=tt; }
  }
  vec3 col = vec3(0);
  if(hit || tTea<1e4){
    if(tTea < t || !hit){
      t = tTea;
      col = teaShade(ro+rd*t, -rd, m, 0.8);
    } else {
      vec3 p = ro+rd*t;
      vec3 n = roomNormal(p, m);
      vec3 v = -rd;
      float ao = roomAO(p, n, m);
      if(h.y==1.0){
        vec3 q = bowlLocal(p,m);
        vec3 nq = n; nq.xy = rot(m.bowlTilt)*nq.xy;
        Surf s = bowlSurface(q, nq, v);
        s.n.xy = rot(-m.bowlTilt)*s.n.xy; s.cn.xy = rot(-m.bowlTilt)*s.cn.xy;
        col = roomLightSurf(s, p, v, m, ao);
      } else if(h.y==2.0){
        Surf s = tenmokuSurface(tenLocal(p,m), n);
        col = roomLightSurf(s, p, v, m, ao);
      } else if(h.y==3.0){
        Surf s = defaultSurf(n);
        s.alb = woodTable(p);
        // ring stain where the second bowl stood
        vec3 tq = tenLocal(p, m);
        float rr = length(tq.xz);
        s.alb *= 1.0 - 0.35*m.ring*smoothstep(0.03,0.0,abs(rr-0.2))*step(p.y,0.01);
        s.rough = 0.55; s.coat = 0.35; s.coatRough = 0.16;
        col = roomLightSurf(s, p, v, m, ao);
      } else if(h.y==4.0){
        col = wallRadiance(p, rd, m);
      } else if(h.y==5.0){
        Surf s = defaultSurf(n);
        // tatami
        float weave = 0.85+0.15*sin(p.x*40.0);
        s.alb = vec3(0.32,0.28,0.16)*weave; s.rough=0.8;
        col = roomLightSurf(s, p, v, m, ao);
      } else if(h.y==7.0){
        Surf s = defaultSurf(n);
        vec3 q = p-candlePos();
        s.alb = q.y>0.1 ? vec3(0.8,0.75,0.65) : vec3(0.3,0.18,0.1);
        s.sss = 1.0; s.rough=0.6;
        col = roomLightSurf(s, p, v, m, ao);
        // wax glows near the top
        col += vec3(1.0,0.5,0.2)*m.candle*smoothstep(0.5,0.8,q.y)*0.6;
      }
    }
  } else {
    col = roomAmbient(ro, -rd, m)*0.2;
    t = 120.0;
  }
  // candle flame (additive glow along the ray)
  if(m.candle>0.01){
    vec3 fl = candlePos()+vec3(0.0,1.05,0.0);
    vec3 oc = fl-ro; float tc = max(dot(oc,rd),0.0);
    if(tc<t+0.2){
      vec3 d = ro+rd*tc-fl; d.y *= 0.45;
      float fd = length(d);
      col += vec3(1.0,0.62,0.25)*m.candle*(0.02/(fd*fd+0.004) + 0.15*exp(-fd*4.0));
    }
  }
  return vec4(col, t);
}

// sunbeams through the open panel, with drifting dust
vec3 roomBeams(vec3 ro, vec3 rd, float tmax, Mem m, int N, float dens){
  vec3 L = sunDir(m);
  vec3 sc = sunColor(m);
  if(sunUp(m)<0.01) return vec3(0);
  float tEnd = min(tmax, 30.0);
  float dt = tEnd/float(N);
  float t = dt*ign(gl_FragCoord.xy+uTime*60.0);
  vec3 acc = vec3(0);
  float mu = dot(rd, L);
  float g=0.55; float phase = (1.0-g*g)/(4.0*PI*pow(1.0+g*g-2.0*g*mu,1.5));
  for(int i=0;i<64;i++){
    if(i>=N) break;
    vec3 p = ro+rd*t;
    vec2 tr = wallTransmit(p, L, m);
    float d = dens*(0.25+1.2*sq(vnoise(p*0.9+vec3(0.0,uTime*0.05,0.0))));
    acc += tr.x*d*dt;
    t += dt;
  }
  return acc*sc*phase;
}
