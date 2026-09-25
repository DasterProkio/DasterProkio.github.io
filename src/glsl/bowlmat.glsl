// ---------------------------------------------------------------- bowl material
struct Surf {
  vec3 alb;      // diffuse albedo (base, under coat)
  vec3 f0;       // base specular reflectance (metals)
  float rough;   // base roughness
  float coat;    // clear coat (glaze / water film) strength 0..1
  float coatRough;
  vec3 n;        // base normal
  vec3 cn;       // coat normal
  vec3 emit;
  float sss;     // wrap / translucency amount
};

Surf defaultSurf(vec3 n){
  Surf s; s.alb=vec3(0.5); s.f0=vec3(0.04); s.rough=0.8; s.coat=0.0; s.coatRough=0.1;
  s.n=n; s.cn=n; s.emit=vec3(0); s.sss=0.0; return s;
}

vec3 rotYv(vec3 p, float a){ float c=cos(a), s=sin(a); return vec3(c*p.x-s*p.z, p.y, s*p.x+c*p.z); }

// perturb normal with a scalar height function's numerical gradient projected on the surface
#define BUMP(n, P, F, EPS, AMT) { \
  vec3 _e=vec3(EPS,0,0); float _h0=F(P); \
  vec3 _g=vec3(F(P+_e.xyy)-_h0, F(P+_e.yxy)-_h0, F(P+_e.yyx)-_h0)/EPS; \
  _g-=n*dot(_g,n); n=normalize(n-AMT*_g); }

float clayGrain(vec3 p){ return gnoise(p*140.0)*0.5+gnoise(p*330.0)*0.25; }
float glazeRipple(vec3 p){ return gnoise(p*22.0)+0.35*gnoise(p*61.0); }

Surf bowlSurface(vec3 p, vec3 n, vec3 v){
  Surf s = defaultSurf(n);
  BowlHit h = bowlInfo(p);
  { vec2 dr = normalize(p.xz+1e-6); n = normalize(n + vec3(dr.x*h.nDelta.x, h.nDelta.y, dr.y*h.nDelta.x)); s.n=n; s.cn=n; }
  vec3 pr = rotYv(p, uSpin);            // detail rotating with the wheel
  float a = atan(pr.z, pr.x);

  // ---------- clay body
  float speck = smoothstep(0.86, 0.95, vnoise(pr*80.0)) * 0.7;
  float grain = clayGrain(pr);
  vec3 fired = vec3(0.50,0.44,0.37)*(0.92+0.1*grain);
  fired = mix(fired, vec3(0.18,0.09,0.05), speck);
  // flashing on the unglazed foot / exposed body
  float flash = sat(0.5+0.8*gnoise(pr*4.0+3.0));
  vec3 footCol = mix(fired, vec3(0.58,0.30,0.14), 0.55*flash);

  // unfired clay (wet -> dry)
  vec3 wetCol = vec3(0.19,0.10,0.065);
  vec3 dryCol = vec3(0.60,0.53,0.46)*(0.95+0.08*grain);
  vec3 raw = mix(wetCol, dryCol, smoothstep(0.0,1.0,uDry));
  float slurry = sat(0.5+0.9*gnoise(vec3(a*6.0, pr.y*38.0, 0.0)));

  float firedAmt = max(uMelt, uHeat);
  // iron shows through where the glaze thins over the rim: a warm brown lip, not raw grain
  fired = mix(fired, vec3(0.30,0.19,0.12)*(0.95+0.05*grain), smoothstep(0.955, 0.997, h.s)*0.8);
  vec3 body = mix(raw, h.side<-1.5 ? footCol : fired, sat(firedAmt*1.5));
  s.alb = body;
  s.rough = 0.85;
  BUMP(s.n, pr, clayGrain, 0.002, 0.00025*(1.0-0.8*uMelt));

  // ---------- wet film
  if(uWet>0.0){
    float film = uWet*(0.55+0.45*slurry);
    s.coat = film;
    s.coatRough = mix(0.16, 0.05, slurry);
    s.alb = mix(s.alb, s.alb*0.7, film);
    s.cn = n;
    // throwing lines in the film
    vec3 nn = n;
    float lines = sin(p.y*140.0+2.0*gnoise(vec3(a*3.0,p.y*10.0,0.0)));
    nn = normalize(nn + 0.08*uWet*lines*vec3(0,1,0));
    s.cn = nn;
  }

  // ---------- glaze
  float t = glazeThickness(p, h);
  float rawCov = smoothstep(1.02-uGlazeRaw*1.1, 1.04-uGlazeRaw*1.1, h.s)*step(0.001,uGlazeRaw);
  float cov = sat(t*4.0)*max(rawCov, uMelt);
  if(cov>0.0){
    // raw slip (unfired glaze powder)
    vec3 slip = vec3(0.70,0.72,0.70)*(0.95+0.08*grain);
    float rawAmt = rawCov*(1.0-uMelt);
    // melted celadon: Beer-Lambert over the body + milky scatter
    vec3 sigma = vec3(0.62,0.26,0.33);
    float tt = t*(1.0+0.15*gnoise(p*7.0));
    vec3 trans = exp(-sigma*tt*1.6);
    vec3 milk = vec3(0.55,0.72,0.66);
    float scat = 1.0-exp(-tt*0.9);
    vec3 glazeCol = mix(body*trans*1.15, milk*mix(vec3(1.0),trans,0.5), scat*0.72);
    // ash: greener glassy runs
    glazeCol = mix(glazeCol, vec3(0.30,0.42,0.22)*trans*1.4, sat(uAsh*(t-0.9)*0.9));
    // iron specks bleed through
    glazeCol = mix(glazeCol, vec3(0.22,0.13,0.07), speck*0.5*exp(-tt*1.2));

    // crackle network (two scales, only in glaze)
    float crk = 0.0;
    if(uCrackle>0.0){
      vec3 wp = p + 0.02*vec3(gnoise(p*13.0), gnoise(p*13.0+7.0), gnoise(p*13.0+3.0));
      vec3 c1 = voronoiB(wp*vec3(5.5,7.0,5.5)+vec3(3.0));
      vec3 c2 = voronoiB(wp*15.0+vec3(1.3));
      float l1 = 1.0-smoothstep(0.004, 0.016, c1.x);
      float l2 = (1.0-smoothstep(0.004, 0.02, c2.x))*0.45;
      float reveal = smoothstep(c1.y*0.8, c1.y*0.8+0.2, uCrackle);
      crk = max(l1*reveal, l2*smoothstep(0.4,1.0,uCrackle)*step(0.55,c2.y));
      crk *= 0.55+0.45*sat(gnoise(p*5.0)+0.5);
      vec3 crackCol = mix(glazeCol*1.4+0.06, vec3(0.28,0.16,0.07), uStain*(h.side>0.0?1.0:0.6));
      glazeCol = mix(glazeCol, crackCol, crk*0.8);
    }

    vec3 glazed = glazeCol;
    s.alb = mix(s.alb, mix(glazed, slip, rawAmt), cov);
    s.rough = mix(s.rough, 0.9, cov*rawAmt);
    // melted glaze is a clear coat
    float coat = cov*uMelt;
    s.coat = max(s.coat, coat);
    s.coatRough = mix(s.coatRough, 0.045, coat);
    vec3 cn = n;
    BUMP(cn, p, glazeRipple, 0.004, 0.0004*uMelt);
    s.cn = normalize(mix(s.cn, cn, coat));
    s.sss = 0.35*coat*scat;
  }

  // ---------- tea stain on the unglazed foot over years
  s.alb *= 1.0 - 0.15*uStain*step(h.side,-1.5);

  // ---------- incandescence
  if(uHeat>0.0){
    // thin walls and the rim run hotter than the foot; the glaze shimmers as it boils
    float T = mix(800.0, 1330.0, uHeat) + 90.0*uHeat*(h.s-0.55) + 25.0*uHeat*gnoise(p*18.0+vec3(0.0,uTime*0.6,0.0))
            + 70.0*uHeat*uMelt*(fbm(vec3(p.xz*5.0, p.y*9.0+uTime*0.25), 3));   // molten glaze running down
    s.emit = blackbody(T)*pow(uHeat,2.2)*2.5*(0.85+0.15*grain);
  }

  // ---------- kintsugi gold
  if(uGold>0.0){
    vec3 sf = seamField(p);
    float w = 0.0075*(0.75+0.5*sat(gnoise(p*6.0)*0.5+0.5));
    float g = 1.0-smoothstep(w*0.75, w, sf.x);
    g *= uGold;
    if(g>0.0){
      vec3 e = normalize(uSeeds[int(sf.z)].xyz-uSeeds[int(sf.y)].xyz);
      float x = sat(sf.x/w);
      float slope = -0.9*x/sqrt(max(1.0-x*x,0.02));
      vec3 et = normalize(e - n*dot(e,n));
      vec3 gn = normalize(n + slope*et*0.6);
      float burnish = sat(0.5+0.8*gnoise(p*40.0));
      s.alb = mix(s.alb, vec3(0.0), g);
      s.f0 = mix(s.f0, vec3(1.0,0.74,0.32), g);
      s.rough = mix(s.rough, mix(0.34,0.14,burnish), g);
      s.coat = mix(s.coat, 0.0, g);
      s.n = normalize(mix(s.n, gn, g));
      s.cn = s.n;
    }
  }
  return s;
}
