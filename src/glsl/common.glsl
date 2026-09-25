// ---------------------------------------------------------------- common
precision highp float;
precision highp int;

in vec2 vUv;
uniform vec2  uRes;
uniform float uTime;      // film time, seconds
uniform float uLocal;     // scene-local time
uniform vec3  uCamPos;
uniform mat3  uCamRot;
uniform float uFov;       // tan(fov/2)
uniform vec2  uJitter;    // subpixel jitter in pixels

#define PI 3.14159265359
#define TAU 6.28318530718

float sat(float x){ return clamp(x,0.,1.); }
vec3  sat(vec3 x){ return clamp(x,0.,1.); }
float sq(float x){ return x*x; }
float lin(float a,float b,float x){ return sat((x-a)/(b-a)); }
mat2  rot(float a){ float c=cos(a),s=sin(a); return mat2(c,s,-s,c); }

// ---- hashing (integer based, stable across GPUs)
uint hashu(uint x){ x ^= x>>16; x *= 0x7feb352du; x ^= x>>15; x *= 0x846ca68bu; x ^= x>>16; return x; }
float hash11(float p){ return float(hashu(floatBitsToUint(p)))*(1.0/4294967296.0); }
float hash12(vec2 p){ uvec2 q = uvec2(ivec2(floor(p))); return float(hashu(q.x ^ hashu(q.y + 0x9e3779b9u)))*(1.0/4294967296.0); }
float hash13(vec3 p){ uvec3 q = uvec3(ivec3(floor(p))); return float(hashu(q.x ^ hashu(q.y ^ hashu(q.z + 0x632be5abu))))*(1.0/4294967296.0); }
vec3  hash33(vec3 p){
  uvec3 q = uvec3(ivec3(floor(p)));
  uint h = hashu(q.x ^ hashu(q.y ^ hashu(q.z)));
  return vec3(float(h), float(hashu(h)), float(hashu(h+1u)))*(1.0/4294967296.0);
}
vec2  hash22(vec2 p){
  uvec2 q = uvec2(ivec2(floor(p)));
  uint h = hashu(q.x ^ hashu(q.y));
  return vec2(float(h), float(hashu(h)))*(1.0/4294967296.0);
}
// screen-space blue-ish noise for dithering / jittering ray starts
float ign(vec2 p){ return fract(52.9829189*fract(dot(p, vec2(0.06711056,0.00583715)))); }

// ---- value noise
float vnoise(vec3 p){
  vec3 i=floor(p), f=fract(p);
  vec3 u=f*f*(3.0-2.0*f);
  float a=hash13(i), b=hash13(i+vec3(1,0,0)), c=hash13(i+vec3(0,1,0)), d=hash13(i+vec3(1,1,0));
  float e=hash13(i+vec3(0,0,1)), f1=hash13(i+vec3(1,0,1)), g=hash13(i+vec3(0,1,1)), h=hash13(i+vec3(1,1,1));
  return mix(mix(mix(a,b,u.x),mix(c,d,u.x),u.y), mix(mix(e,f1,u.x),mix(g,h,u.x),u.y), u.z);
}
float vnoise(vec2 p){
  vec2 i=floor(p), f=fract(p);
  vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(hash12(i),hash12(i+vec2(1,0)),u.x), mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),u.x), u.y);
}
// gradient noise (signed, -1..1)
float gnoise(vec3 p){
  vec3 i=floor(p), f=fract(p);
  vec3 u=f*f*f*(f*(f*6.0-15.0)+10.0);
  #define G(o) dot(hash33(i+o)*2.0-1.0, f-o)
  float r = mix(mix(mix(G(vec3(0,0,0)),G(vec3(1,0,0)),u.x), mix(G(vec3(0,1,0)),G(vec3(1,1,0)),u.x),u.y),
                mix(mix(G(vec3(0,0,1)),G(vec3(1,0,1)),u.x), mix(G(vec3(0,1,1)),G(vec3(1,1,1)),u.x),u.y),u.z);
  #undef G
  return r*1.6;
}
float gnoise(vec2 p){
  vec2 i=floor(p), f=fract(p);
  vec2 u=f*f*f*(f*(f*6.0-15.0)+10.0);
  #define G(o) dot(hash22(i+o)*2.0-1.0, f-o)
  float r = mix(mix(G(vec2(0,0)),G(vec2(1,0)),u.x), mix(G(vec2(0,1)),G(vec2(1,1)),u.x), u.y);
  #undef G
  return r*1.4;
}
float fbm(vec3 p, int oct){
  float s=0., a=0.5;
  for(int i=0;i<8;i++){ if(i>=oct) break; s+=a*gnoise(p); p=p*2.03+vec3(17.1,-3.7,9.2); a*=0.5; }
  return s;
}
float fbm(vec2 p, int oct){
  float s=0., a=0.5;
  for(int i=0;i<8;i++){ if(i>=oct) break; s+=a*gnoise(p); p=mat2(1.6,1.2,-1.2,1.6)*p+vec2(3.1,7.7); a*=0.5; }
  return s;
}

// Voronoi with true border distance (iq). Returns (border distance, cell id hash, F1)
vec3 voronoiB(vec3 x){
  vec3 p=floor(x), f=fract(x);
  vec3 mb; vec3 mr; float md=8.0;
  for(int k=-1;k<=1;k++) for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){
    vec3 b=vec3(i,j,k);
    vec3 r=b+hash33(p+b)-f;
    float d=dot(r,r);
    if(d<md){ md=d; mr=r; mb=b; }
  }
  float bd=8.0;
  for(int k=-1;k<=1;k++) for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){
    vec3 b=mb+vec3(i,j,k);
    vec3 r=b+hash33(p+b)-f;
    vec3 dr=r-mr;
    if(dot(dr,dr)>1e-5) bd=min(bd, dot(0.5*(mr+r), normalize(dr)));
  }
  return vec3(bd, hash13(p+mb+vec3(7.0)), sqrt(md));
}
vec3 voronoiB(vec2 x){
  vec2 p=floor(x), f=fract(x);
  vec2 mb; vec2 mr; float md=8.0;
  for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){
    vec2 b=vec2(i,j); vec2 r=b+hash22(p+b)-f; float d=dot(r,r);
    if(d<md){ md=d; mr=r; mb=b; }
  }
  float bd=8.0;
  for(int j=-2;j<=2;j++) for(int i=-2;i<=2;i++){
    vec2 b=mb+vec2(i,j); vec2 r=b+hash22(p+b)-f; vec2 dr=r-mr;
    if(dot(dr,dr)>1e-5) bd=min(bd, dot(0.5*(mr+r), normalize(dr)));
  }
  return vec3(bd, hash12(p+mb+vec2(7.0)), sqrt(md));
}

// ---- SDF helpers
float smin(float a,float b,float k){ float h=max(k-abs(a-b),0.0)/k; return min(a,b)-h*h*k*0.25; }
float smax(float a,float b,float k){ return -smin(-a,-b,k); }
float sdBox(vec3 p, vec3 b){ vec3 q=abs(p)-b; return length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0); }
float sdBox(vec2 p, vec2 b){ vec2 q=abs(p)-b; return length(max(q,0.0))+min(max(q.x,q.y),0.0); }
float sdRBox(vec3 p, vec3 b, float r){ return sdBox(p,b-r)-r; }
float sdCyl(vec3 p, float r, float h){ vec2 d=abs(vec2(length(p.xz),p.y))-vec2(r,h); return min(max(d.x,d.y),0.0)+length(max(d,0.0)); }
float sdSeg(vec2 p, vec2 a, vec2 b){ vec2 pa=p-a, ba=b-a; float h=sat(dot(pa,ba)/dot(ba,ba)); return length(pa-ba*h); }

// ---- camera
vec3 camRay(vec2 frag){
  vec2 uv = (2.0*(frag+uJitter)-uRes)/uRes.y;
  return normalize(uCamRot*vec3(uv*uFov, 1.0));
}

// ---- colour
vec3 blackbody(float t){ // t in Kelvin, returns linear rgb (normalised-ish)
  t = clamp(t, 800.0, 12000.0)/100.0;
  vec3 c;
  c.r = t<=66.0 ? 1.0 : 1.292936*pow(t-60.0,-0.1332047592);
  c.g = t<=66.0 ? 0.3900815*log(t)-0.6318414 : 1.129890*pow(t-60.0,-0.0755148492);
  c.b = t>=66.0 ? 1.0 : (t<=19.0 ? 0.0 : 0.5432068*log(t-10.0)-1.1962541);
  return pow(sat(c), vec3(2.2));
}
float luma(vec3 c){ return dot(c, vec3(0.2126,0.7152,0.0722)); }

// ---- BRDF
float D_GGX(float nh, float a){ float a2=a*a; float d=nh*nh*(a2-1.0)+1.0; return a2/(PI*d*d); }
float V_SmithJ(float nv, float nl, float a){ float a2=a*a;
  float gv=nl*sqrt(nv*nv*(1.0-a2)+a2), gl=nv*sqrt(nl*nl*(1.0-a2)+a2); return 0.5/max(gv+gl,1e-5); }
vec3  F_Schlick(vec3 f0, float vh){ return f0+(1.0-f0)*pow(1.0-vh,5.0); }
float F_Schlick1(float f0, float vh){ return f0+(1.0-f0)*pow(1.0-vh,5.0); }
// returns specular (already multiplied by nl)
vec3 specGGX(vec3 n, vec3 v, vec3 l, float rough, vec3 f0){
  vec3 h=normalize(v+l);
  float nl=sat(dot(n,l)), nv=max(dot(n,v),1e-4), nh=sat(dot(n,h)), vh=sat(dot(v,h));
  float a=max(rough*rough,0.002);
  return D_GGX(nh,a)*V_SmithJ(nv,nl,a)*F_Schlick(f0,vh)*nl;
}
// analytic env-BRDF approximation (Karis)
vec2 envBRDF(float nv, float rough){
  vec4 c0=vec4(-1,-0.0275,-0.572,0.022), c1=vec4(1,0.0425,1.04,-0.04);
  vec4 r=rough*c0+c1; float a004=min(r.x*r.x,exp2(-9.28*nv))*r.x+r.y;
  return vec2(-1.04,1.04)*a004+r.zw;
}
