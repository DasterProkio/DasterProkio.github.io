// ---------------------------------------------------------------- shards
// Each shard = bowl shell ∩ warped Voronoi cell i, with its own rigid transform.
// world = R_i * (local - C_i) + P_i
uniform vec4 uShardQ[NSEED];   // rotation quaternion (local -> world)
uniform vec4 uShardP[NSEED];   // world position of the centroid, w = visible (0/1)
uniform vec4 uShardC[NSEED];   // rest centroid (bowl local), w = bounding radius
uniform float uShardScale;     // world scale of the bowl (1 normally)
uniform vec3  uBowlWorld;      // world position of the bowl origin at rest

vec3 qrot(vec4 q, vec3 v){ return v + 2.0*cross(q.xyz, cross(q.xyz, v) + q.w*v); }
vec3 qinv(vec4 q, vec3 v){ return qrot(vec4(-q.xyz, q.w), v); }

vec3 shardLocal(vec3 p, int i){
  return qinv(uShardQ[i], p-uShardP[i].xyz)/uShardScale + uShardC[i].xyz;
}

float sdShard(vec3 q, int i){
  float b = sdBowl(q);
  if(b > 0.03) return b;
  return max(b, cellDist(q, i)*0.8);
}

// candidate list from ray / bounding-sphere tests
struct Cands { int n; int id[6]; float t0; float t1; };

Cands shardCull(vec3 ro, vec3 rd){
  Cands c; c.n=0; c.t0=1e5; c.t1=0.0;
  for(int i=0;i<NSEED;i++){
    if(uShardP[i].w<0.5) continue;
    vec3 oc = ro-uShardP[i].xyz;
    float r = uShardC[i].w*uShardScale;
    float b = dot(oc,rd), cc = dot(oc,oc)-r*r;
    float h = b*b-cc;
    if(h<0.0) continue;
    h = sqrt(h);
    float ta=-b-h, tb=-b+h;
    if(tb<0.0) continue;
    if(c.n<6){ c.id[c.n]=i; c.n++; c.t0=min(c.t0,max(ta,0.0)); c.t1=max(c.t1,tb); }
  }
  return c;
}

// returns (distance, shard index)
vec2 shardMap(vec3 p, Cands c){
  vec2 r = vec2(1e5, -1.0);
  for(int k=0;k<6;k++){
    if(k>=c.n) break;
    int i = c.id[k];
    vec3 q = shardLocal(p, i);
    // quick reject by bounding sphere
    float bs = length(p-uShardP[i].xyz) - uShardC[i].w*uShardScale;
    float d = bs > 0.05 ? bs : sdShard(q, i)*uShardScale;
    if(d<r.x) r=vec2(d, float(i));
  }
  return r;
}

vec3 shardNormalLocal(vec3 q, int i){
  const vec2 e=vec2(0.0006,-0.0006);
  return normalize(e.xyy*sdShard(q+e.xyy,i)+e.yyx*sdShard(q+e.yyx,i)+e.yxy*sdShard(q+e.yxy,i)+e.xxx*sdShard(q+e.xxx,i));
}

// march the shard field between the culled bounds. returns (t, index) or t<0
vec2 shardTrace(vec3 ro, vec3 rd, Cands c, float tmax){
  if(c.n==0) return vec2(-1.0);
  float t = c.t0;
  float te = min(c.t1, tmax);
  for(int s=0;s<110;s++){
    vec2 h = shardMap(ro+rd*t, c);
    if(h.x < 0.0004*t+0.0003) return vec2(t, h.y);
    t += h.x*0.85;
    if(t>te) break;
  }
  return vec2(-1.0);
}
