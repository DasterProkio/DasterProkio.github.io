// Look-dev scene: bowl on a table under window light.
uniform vec3 uSunDir;
uniform vec3 uSunCol;
uniform vec3 uAmb;
out vec4 fragColor;

float mapT(vec3 p){ return p.y; }
float map(vec3 p){
  return min(sdBowl(p), mapT(p));
}
vec3 calcN(vec3 p){
  const vec2 e=vec2(0.0007,-0.0007);
  return normalize(e.xyy*map(p+e.xyy)+e.yyx*map(p+e.yyx)+e.yxy*map(p+e.yxy)+e.xxx*map(p+e.xxx));
}
float softShadow(vec3 ro, vec3 rd, float k){
  float res=1.0, t=0.004;
  for(int i=0;i<48;i++){
    float h=map(ro+rd*t);
    res=min(res, k*h/t);
    t+=clamp(h,0.004,0.12);
    if(res<0.002||t>4.0) break;
  }
  return sat(res);
}
float calcAO(vec3 p, vec3 n){
  float o=0.0, s=1.0;
  for(int i=1;i<=5;i++){ float h=0.012*float(i*i); o+=(h-map(p+n*h))*s; s*=0.7; }
  return sat(1.0-2.2*o);
}
// studio environment: dark room, a big window softbox, warm table bounce
vec3 env(vec3 d, float r){
  vec3 c = uAmb*(0.6+0.4*d.y);
  vec3 wdir = normalize(vec3(-uSunDir.x, 0.0, -uSunDir.z))*-1.0;
  // window rectangle in the sun's azimuth
  float az = atan(d.z,d.x) - atan(uSunDir.z,uSunDir.x);
  az = atan(sin(az),cos(az));
  float el = d.y;
  float soft = 0.02+r*0.6;
  float win = smoothstep(0.45+soft,0.45-soft,abs(az)) * smoothstep(-0.05-soft,0.1+soft,el)*smoothstep(0.75+soft,0.6-soft,el);
  // mullions
  float mull = mix(1.0, 0.25+0.75*smoothstep(0.02,0.05+r,abs(fract(az*2.2+0.5)-0.5)), 1.0-sat(r*3.0));
  c += uSunCol*2.2*win*mull;
  c += vec3(0.12,0.07,0.04)*sat(-d.y)*0.6; // table bounce
  return c;
}

vec3 tableCol(vec3 p){
  float g = fbm(vec2(p.x*1.2, p.z*18.0+2.0*fbm(p.xz*vec2(0.4,2.0),3)),4);
  vec3 c = mix(vec3(0.11,0.06,0.035), vec3(0.22,0.13,0.07), sat(g*0.8+0.5));
  return c;
}

vec3 lightSurf(Surf s, vec3 p, vec3 v, float sh, float ao){
  vec3 L = normalize(uSunDir);
  float nl = sat(dot(s.n,L));
  float nv = sat(dot(s.cn,v));
  float Fc = s.coat*F_Schlick1(0.04, nv);
  vec3 dif = s.alb*(1.0-Fc)*(uSunCol*nl*sh + env(s.n,1.0)*ao*1.2 + s.sss*uSunCol*sat(dot(-s.n,L)*0.5+0.35)*0.3) / 1.0;
  vec3 spec = specGGX(s.n, v, L, s.rough, s.f0)*uSunCol*sh;
  vec2 eb = envBRDF(sat(dot(s.n,v)), s.rough);
  spec += env(reflect(-v,s.n), s.rough)*(s.f0*eb.x+eb.y)*ao;
  vec3 coat = s.coat*(specGGX(s.cn, v, L, s.coatRough, vec3(0.04))*uSunCol*sh
                     + env(reflect(-v,s.cn), s.coatRough)*F_Schlick1(0.04,nv)*ao);
  return dif + spec + coat + s.emit;
}

void main(){
  vec2 frag = gl_FragCoord.xy;
  vec3 ro = uCamPos, rd = camRay(frag);
  float t = 0.0; bool hit=false;
  for(int i=0;i<160;i++){
    vec3 p = ro+rd*t;
    float d = map(p);
    if(d<0.0004*t){ hit=true; break; }
    t += d*0.9;
    if(t>20.0) break;
  }
  vec3 col = env(rd, 0.3)*0.4;
  if(hit){
    vec3 p = ro+rd*t;
    vec3 n = calcN(p);
    vec3 v = -rd;
    float sh = softShadow(p+n*0.002, normalize(uSunDir), 10.0);
    float ao = calcAO(p,n);
    if(sdBowl(p) < mapT(p)){
      Surf s = bowlSurface(p, n, v);
      col = lightSurf(s, p, v, sh, ao);
    } else {
      Surf s = defaultSurf(n);
      s.alb = tableCol(p); s.rough=0.5; s.coat=0.3; s.coatRough=0.25;
      col = lightSurf(s, p, v, sh, ao);
    }
  }
  fragColor = vec4(col, t);
}
