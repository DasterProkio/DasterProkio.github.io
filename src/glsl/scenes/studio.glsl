// ---------------------------------------------------------------- scene: CLAY (studio)
// A dark pottery studio. One window shaft. The clay rises on a spinning wheel.
uniform vec3  uSun;        // direction toward the window light
uniform vec3  uSunCol;
uniform float uWheelSpin;  // wheel head angle
uniform float uWater;      // wetness of the wheel head
uniform float uDust;
uniform float uWarm;       // warm practical light (evening / drying)
out vec4 fragColor;

#define WIN_X -9.0
// window opening on the plane x = WIN_X (y in [2,9], z in [-3,2])
float windowLit(vec3 p, vec3 L){
  if(L.x >= -0.01) return 0.0;
  float t = (WIN_X - p.x)/L.x;
  vec3 w = p + L*t;
  float pen = 0.04 + 0.01*t;
  float a = smoothstep(2.0-pen, 2.0+pen, w.y)*smoothstep(9.0+pen, 9.0-pen, w.y)*smoothstep(-3.0-pen,-3.0+pen,w.z)*smoothstep(2.0+pen,2.0-pen,w.z);
  // mullions
  float m = smoothstep(0.06, 0.12, abs(w.z+0.5))*smoothstep(0.06,0.12,abs(w.y-5.5));
  return a*mix(1.0, m, 0.9);
}

// ids: 1 clay, 2 wheel head, 3 splash pan, 4 room, 5 shelf pots
vec2 studioMap(vec3 p){
  vec2 r = vec2(1e5, 0.0);
  float bb = length(p-vec3(0,0.4,0))-0.95;
  float c = bb > 0.3 ? bb : sdBowl(p);
  r = vec2(c, 1.0);
  // wheel head: disc radius 1.6, top at y = 0
  float wh = sdCyl(p-vec3(0,-0.12,0), 1.6, 0.12) - 0.02;
  if(wh<r.x) r = vec2(wh, 2.0);
  // splash pan: bowl-shaped ring around the wheel
  vec2 q = vec2(length(p.xz), p.y);
  float pan = max(abs(q.x-2.5)-0.06, abs(q.y+0.35)-0.55);
  pan = min(pan, max(q.x-2.5, abs(q.y+0.9)-0.05));
  if(pan<r.x) r = vec2(pan, 3.0);
  // floor, back wall, window wall
  float room = min(p.y+3.2, min(12.0-p.z, p.x-WIN_X+0.3));
  if(room<r.x) r = vec2(room, 4.0);
  // shelf with pots in the background
  vec3 s = p-vec3(1.0, 2.2, 9.0);
  float shelf = sdBox(s-vec3(0,-0.1,0), vec3(8.0,0.08,0.8));
  float pots = 1e5;
  for(int i=0;i<6;i++){
    float fi = float(i);
    vec3 o = s-vec3(-6.0+fi*2.4, 0.0, 0.1*sin(fi*3.0));
    float h = 0.6+0.5*fract(fi*0.618);
    float w = 0.45+0.25*fract(fi*0.37);
    vec2 pq = vec2(length(o.xz), o.y);
    float body = length(pq/vec2(w, h)-vec2(0.0, 0.9))*min(w,h) - min(w,h)*0.95;
    body = max(body, -o.y);
    pots = min(pots, body);
  }
  shelf = min(shelf, pots);
  if(shelf<r.x) r = vec2(shelf, 5.0);
  return r;
}

vec3 studioNormal(vec3 p){
  const vec2 e = vec2(0.0007,-0.0007);
  return normalize(e.xyy*studioMap(p+e.xyy).x + e.yyx*studioMap(p+e.yyx).x + e.yxy*studioMap(p+e.yxy).x + e.xxx*studioMap(p+e.xxx).x);
}

float studioShadow(vec3 ro, vec3 rd){
  float res = 1.0, t = 0.01;
  for(int i=0;i<40;i++){
    vec3 p = ro+rd*t;
    float h = min(studioMap(p).x, 1e5);
    res = min(res, 10.0*h/t);
    t += clamp(h, 0.01, 0.3);
    if(res<0.003 || t>8.0) break;
  }
  return sat(res);
}

vec3 studioEnv(vec3 d){
  // what glossy things see: the bright window to the left, a dim warm room
  vec3 c = vec3(0.012,0.011,0.01) + uWarm*vec3(0.05,0.03,0.015);
  float win = smoothstep(0.55,0.75,-d.x)*smoothstep(-0.05,0.15,d.y)*smoothstep(0.85,0.6,d.y)*smoothstep(0.7,0.4,abs(d.z+0.1));
  c += uSunCol*0.35*win;
  return c;
}

float studioAO(vec3 p, vec3 n){
  float o=0.0, s=1.0;
  for(int i=1;i<=4;i++){ float h=0.03*float(i*i); o+=(h-studioMap(p+n*h).x)*s; s*=0.65; }
  return sat(1.0-1.8*o);
}

vec3 studioLight(Surf s, vec3 p, vec3 v, float ao){
  vec3 L = normalize(uSun);
  float lit = windowLit(p, L);
  float sh = lit>0.0 ? studioShadow(p+s.n*0.003, L) : 0.0;
  vec3 direct = uSunCol*lit*sh;
  // practical warm lamp above right
  vec3 lp = vec3(3.0, 6.0, -2.0);
  vec3 ld = lp-p; float r2 = dot(ld,ld); vec3 Lw = ld*inversesqrt(r2);
  vec3 warm = vec3(1.0,0.6,0.3)*uWarm*18.0/r2;
  float nl = sat(dot(s.n,L)), nlw = sat(dot(s.n,Lw));
  float nv = sat(dot(s.cn,v));
  float Fc = s.coat*F_Schlick1(0.02, nv);
  vec3 amb = studioEnv(s.n)*1.4*ao + vec3(0.02,0.022,0.025)*ao*sat(s.n.y*0.5+0.5);
  vec3 col = s.alb*(1.0-Fc)*(direct*nl + warm*nlw + amb);
  col += specGGX(s.n, v, L, s.rough, s.f0)*direct + specGGX(s.n, v, Lw, s.rough, s.f0)*warm;
  if(s.coat>0.0){
    col += s.coat*(specGGX(s.cn, v, L, s.coatRough, vec3(0.02))*direct + specGGX(s.cn, v, Lw, s.coatRough, vec3(0.02))*warm
                  + studioEnv(reflect(-v,s.cn))*F_Schlick1(0.02,nv)*mix(1.0, 3.0, 1.0-s.coatRough*2.0));
  }
  return col + s.emit;
}

vec3 studioShade(vec3 p, vec3 rd, float id){
  vec3 n = studioNormal(p);
  vec3 v = -rd;
  float ao = studioAO(p, n);
  Surf s;
  if(id==1.0){
    s = bowlSurface(p, n, v);
  } else if(id==2.0){
    s = defaultSurf(n);
    // wheel head covered in slip, rotating
    vec3 q = rotYv(p, uWheelSpin);
    float r = length(q.xz), a = atan(q.z,q.x);
    float smear = sat(0.5+0.8*gnoise(vec3(a*5.0, r*6.0, 0.0)));
    float rings = 0.5+0.5*sin(r*40.0);
    s.alb = mix(vec3(0.07,0.04,0.028), vec3(0.14,0.09,0.06), smear*0.6)*(0.9+0.1*rings);
    s.alb = mix(s.alb, vec3(0.35,0.36,0.37), smoothstep(1.45,1.6,r)*0.8);   // metal rim
    s.coat = uWater*(0.4+0.6*smear); s.coatRough = 0.12; s.rough = 0.7;
  } else if(id==3.0){
    s = defaultSurf(n);
    s.alb = vec3(0.08,0.07,0.065); s.rough = 0.4; s.coat = 0.3; s.coatRough = 0.3;
    s.alb *= 0.7+0.3*sat(gnoise(p*8.0)+0.5);
  } else if(id==4.0){
    s = defaultSurf(n);
    s.alb = vec3(0.2,0.18,0.16)*(0.8+0.2*fbm(p*0.8,3));
    if(p.y < -3.0) s.alb = vec3(0.12,0.1,0.08)*(0.7+0.3*fbm(p.xz*2.0,3)); // floor
    s.rough = 0.9;
  } else {
    s = defaultSurf(n);
    s.alb = vec3(0.35,0.26,0.2)*(0.7+0.3*fbm(p*3.0,2)); s.rough = 0.6; s.coat = 0.4; s.coatRough = 0.15;
  }
  return studioLight(s, p, v, ao);
}

void main(){
  vec3 ro = uCamPos, rd = camRay(gl_FragCoord.xy);
  float t = 0.0; vec2 h = vec2(0); bool hit = false;
  for(int i=0;i<150;i++){
    h = studioMap(ro+rd*t);
    if(h.x < 0.0003*t+0.0003){ hit=true; break; }
    t += h.x*0.9;
    if(t>40.0) break;
  }
  vec3 col = studioEnv(rd)*0.3;
  if(hit) col = studioShade(ro+rd*t, rd, h.y); else t = 40.0;

  // window shaft with dust
  vec3 L = normalize(uSun);
  float tEnd = min(t, 25.0);
  const int N = 28;
  float dt = tEnd/float(N);
  float tt = dt*ign(gl_FragCoord.xy + fract(uTime*13.0)*97.0);
  vec3 acc = vec3(0);
  float mu = dot(rd, L);
  float g = 0.6; float phase = (1.0-g*g)/(4.0*PI*pow(1.0+g*g-2.0*g*mu,1.5));
  for(int i=0;i<N;i++){
    vec3 p = ro+rd*tt;
    float lit = windowLit(p, L);
    if(lit>0.0){
      float d = 0.03 + 0.08*sq(vnoise(p*0.6+vec3(uTime*0.03,0,0)));
      acc += lit*d*dt;
    }
    tt += dt;
  }
  col += acc*uSunCol*phase*0.8;
  // dust motes: bright specks drifting inside the shaft
  for(int l=0;l<5;l++){
    float z = 1.2 + float(l)*1.1;
    if(z > t) break;
    vec3 p = ro+rd*z;
    vec3 cell = floor(p*5.0);
    vec3 hh = hash33(cell + float(l)*31.0);
    vec3 sp = (cell + 0.5 + 0.4*sin(hh*6.28 + uTime*vec3(0.3,0.2,0.25)))/5.0;
    vec3 w = sp-ro; float tp = dot(w,rd);
    float d = length(w-rd*tp);
    float lit = windowLit(sp, L);
    if(hh.x>0.85 && lit>0.5) col += uSunCol*lit*uDust*0.00025/(d*d*3000.0+0.004);
  }
  fragColor = vec4(col, t);
}
