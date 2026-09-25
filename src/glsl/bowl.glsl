// ---------------------------------------------------------------- bowl
// Units: 1.0 = 10 cm. Bowl local space: foot rests on y=0, axis is +y.
#define NPROF 16
uniform vec4  uProf[NPROF];   // centerline (r, y), half thickness, unused
uniform vec4  uFoot;          // foot ring stroke: r0,y0,r1,y1
uniform float uFootTh;        // foot half thickness (0 = none)
uniform float uWobble;        // rim wobble amplitude
uniform float uOval;          // ovality
uniform float uRidge;         // throwing ridge amplitude
uniform float uSpin;          // wheel angle (radians), rotates surface detail

// material state
uniform float uWet;       // 1 = wet thrown clay
uniform float uDry;       // 0..1 wet->leather->bone dry
uniform float uGlazeRaw;  // raw glaze slip coverage (matte)
uniform float uMelt;      // glaze melted (glossy)
uniform float uHeat;      // incandescence 0..1
uniform float uAsh;       // natural ash deposit
uniform float uCrackle;   // crackle network visibility
uniform float uStain;     // tea stain in crackle
uniform float uGold;      // kintsugi seams
uniform float uTeaLevel;  // tea fill 0..1 (0 = empty)
uniform float uFroth;     // matcha froth amount

// fracture / seam network
#define NSEED 14
uniform vec4 uSeeds[NSEED]; // xyz seed on bowl surface (local), w unused

struct BowlHit { float d; float side; float s; vec2 nDelta; };

vec2 segPerp(int i){ vec2 b=normalize(uProf[i+1].xy-uProf[i].xy); return vec2(-b.y, b.x); }

// distance-only version for marching
float bowlProfileD(vec2 q){
  float d = 1e5;
  for(int i=0;i<NPROF-1;i++){
    vec2 a=uProf[i].xy, ba=uProf[i+1].xy-a, pa=q-a;
    float t=sat(dot(pa,ba)/dot(ba,ba));
    d=min(d, length(pa-ba*t)-mix(uProf[i].z, uProf[i+1].z, t));
  }
  return d;
}

// full version: side (+1 inside the cavity, -1 outside), arc parameter, and the
// correction that turns faceted polyline normals into smooth (Phong-like) ones
BowlHit bowlProfile(vec2 q){
  BowlHit h; h.d = 1e5; h.side = 0.0; h.s = 0.0; h.nDelta=vec2(0);
  float acc = 0.0, total = 0.0;
  for(int i=0;i<NPROF-1;i++) total += length(uProf[i+1].xy-uProf[i].xy);
  int bi=0; float bt=0.0;
  for(int i=0;i<NPROF-1;i++){
    vec2 a=uProf[i].xy, b=uProf[i+1].xy;
    vec2 pa=q-a, ba=b-a;
    float L = length(ba);
    float t=sat(dot(pa,ba)/(L*L));
    float th=mix(uProf[i].z, uProf[i+1].z, t);
    float d=length(pa-ba*t)-th;
    if(d<h.d){ h.d=d; h.side = (pa.x*ba.y-pa.y*ba.x) < 0.0 ? 1.0 : -1.0; h.s=(acc+t*L)/total; bi=i; bt=t; }
    acc += L;
  }
  if(bt>0.0 && bt<1.0){
    vec2 pf = segPerp(bi);
    vec2 n0 = bi>0 ? normalize(segPerp(bi-1)+pf) : pf;
    vec2 n1 = bi<NPROF-2 ? normalize(segPerp(bi+1)+pf) : pf;
    vec2 ns = normalize(mix(n0,n1,bt));
    h.nDelta = (ns-pf)*h.side;
  }
  return h;
}

vec2 bowlQ(vec3 p){
  float a = atan(p.z,p.x);
  float r = length(p.xz);
  r *= 1.0 + uOval*cos(2.0*a-1.4);
  float rim = smoothstep(0.25,0.75,p.y);
  float y = p.y - uWobble*rim*(0.55*sin(a*2.0+1.3)+0.3*sin(a*5.0+4.0)+0.15*sin(a*9.0+0.5));
  return vec2(r, y);
}

float sdBowl(vec3 p){
  vec2 q = bowlQ(p);
  float d = bowlProfileD(q);
  if(uFootTh>0.0){
    float th = uFootTh;
    float df = sdSeg(q, uFoot.xy, uFoot.zw) - th;
    d = smin(d, df, 0.03);
  }
  // throwing ridges (spiral rings)
  d -= uRidge*sin(q.y*70.0 + 0.6*sin(q.y*9.0))*smoothstep(0.02,0.1,q.y);
  return d;
}

// full info at a surface point (called once per hit)
BowlHit bowlInfo(vec3 p){
  vec2 q = bowlQ(p);
  BowlHit h = bowlProfile(q);
  if(uFootTh>0.0){
    float df = sdSeg(q, uFoot.xy, uFoot.zw) - uFootTh;
    if(df < h.d + 0.012){ h.side = -2.0; h.nDelta = vec2(0); } // foot ring: unglazed
  }
  return h;
}

// Warped Voronoi on the fixed fracture seeds. Returns (border distance, cell index, second index)
vec3 seamField(vec3 p){
  vec3 w = p + 0.035*vec3(gnoise(p*9.0), gnoise(p*9.0+11.0), gnoise(p*9.0+23.0))
             + 0.012*vec3(gnoise(p*31.0), gnoise(p*31.0+5.0), gnoise(p*31.0+9.0));
  float d1=1e5, d2=1e5; int i1=0, i2=0;
  for(int i=0;i<NSEED;i++){
    vec3 r = w-uSeeds[i].xyz;
    float d = dot(r,r);
    if(d<d1){ d2=d1; i2=i1; d1=d; i1=i; } else if(d<d2){ d2=d; i2=i; }
  }
  vec3 s1=uSeeds[i1].xyz, s2=uSeeds[i2].xyz;
  float bd = (d2-d1)/(2.0*length(s2-s1));
  return vec3(bd, float(i1), float(i2));
}

// glaze thickness 0..~2 on the surface
float glazeThickness(vec3 p, BowlHit h){
  float a = atan(p.z,p.x);
  if(h.side < -1.5) return 0.0;              // foot
  float s = h.s;
  float t;
  if(h.side > 0.0){
    // interior: pools in the well
    t = 0.75 + 1.1*smoothstep(0.42,0.05,s) ;
    t *= 0.35+0.65*smoothstep(1.0,0.9,s);     // thins over the rim
  } else {
    // exterior: glaze line with drips
    float line = 0.46 + 0.04*gnoise(vec2(a*2.0,1.7));
    float drip = pow(sat(gnoise(vec2(a*7.0, 3.1))*0.5+0.5), 5.0)*0.28
               + pow(sat(gnoise(vec2(a*19.0, 8.3))*0.5+0.5), 8.0)*0.18;
    float edge = line - drip;
    float cov = smoothstep(edge-0.004, edge+0.01, s);
    // thick roll at the drip end, thinning toward the rim
    t = cov*(0.7 + 1.1*exp(-max(s-edge,0.0)*28.0));
    t *= 0.35+0.65*smoothstep(1.0,0.9,s);
  }
  // natural ash: heavier on one flank (facing the fire)
  float ashSide = sat(0.5+0.5*cos(a-2.4))*smoothstep(0.35,0.85,s);
  t += uAsh*ashSide*(0.6+0.8*sat(gnoise(p*14.0)+0.3));
  return t;
}
