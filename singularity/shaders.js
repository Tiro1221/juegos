// ─────────────────────────────────────────────────────────────────────────────
//  SINGULARITY — shaders
//  Units: Schwarzschild radius Rs = 1  (G = c = 1, M = 0.5)
// ─────────────────────────────────────────────────────────────────────────────

export const VERT = /* glsl */ `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vUv;
void main(){ vUv = aPos*0.5+0.5; gl_Position = vec4(aPos,0.,1.); }`;

// ── Main relativistic ray tracer ─────────────────────────────────────────────
export const BLACKHOLE_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform vec2  uRes;
uniform float uTime;       // simulation time (disk rotation)
uniform float uClock;      // wall clock (noise jitter)
uniform vec3  uCamPos;
uniform mat3  uCamRot;
uniform float uFov;
uniform int   uSteps;
uniform float uLensing;    // 0 = newtonian straight rays, 1 = full GR
uniform float uDoppler;    // 0..1 relativistic beaming + grav. redshift
uniform float uDiskTemp;   // peak temperature (K)
uniform float uDiskGain;
uniform float uDiskInner;
uniform float uDiskOuter;
uniform float uDiskThick;  // volumetric haze amount
uniform float uFar;
uniform float uStarGain;
uniform vec3  uTint;

#define PI 3.14159265359

// ---------- hashing / noise ----------
float hash13(vec3 p){ p = fract(p*0.1031); p += dot(p, p.zyx+31.32); return fract((p.x+p.y)*p.z); }
vec3  hash33(vec3 p){
  p = fract(p*vec3(.1031,.1030,.0973));
  p += dot(p, p.yxz+33.33);
  return fract((p.xxy+p.yxx)*p.zyx);
}
float noise(vec3 x){
  vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.-2.*f);
  return mix(mix(mix(hash13(i+vec3(0,0,0)),hash13(i+vec3(1,0,0)),f.x),
                 mix(hash13(i+vec3(0,1,0)),hash13(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash13(i+vec3(0,0,1)),hash13(i+vec3(1,0,1)),f.x),
                 mix(hash13(i+vec3(0,1,1)),hash13(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float fbm(vec3 p){
  float a = .5, s = 0.;
  for(int i=0;i<5;i++){ s += a*noise(p); p = p*2.03 + vec3(1.7,9.2,3.1); a *= .5; }
  return s;
}

// ---------- blackbody (Kelvin -> linear RGB) ----------
vec3 blackbody(float t){
  t = clamp(t, 800., 40000.) / 100.;
  float r = t <= 66. ? 1. : clamp(1.29293618606*pow(t-60.,-0.1332047592),0.,1.);
  float g = t <= 66. ? clamp(0.39008157876*log(t)-0.63184144378,0.,1.)
                     : clamp(1.12989086089*pow(t-60.,-0.0755148492),0.,1.);
  float b = t >= 66. ? 1. : (t <= 19. ? 0. : clamp(0.54320678911*log(t-10.)-1.19625408914,0.,1.));
  return pow(vec3(r,g,b), vec3(2.2));
}

// ---------- background sky: stars + galactic band + nebula ----------
vec3 starLayer(vec3 d, float scale, float density){
  vec3 p = d*scale;
  vec3 c = floor(p);
  vec3 f = fract(p) - .5;
  vec3 h = hash33(c);
  if(h.z > density) return vec3(0);
  vec3 off = (h-.5)*.6;
  float dist = length(f-off);
  float mag = pow(hash13(c+7.1), 6.);
  float core = exp(-dist*dist*160.);
  float tw = .75 + .25*sin(uClock*(1.+h.x*3.) + h.y*40.);
  vec3 col = blackbody(mix(2800., 16000., pow(h.y, 1.5)));
  return col * core * mag * tw * 9.;
}
vec3 sky(vec3 d){
  vec3 col = vec3(0);
  col += starLayer(d, 60.,  .5);
  col += starLayer(d, 130., .4) * .55;
  col += starLayer(d, 260., .3) * .3;

  // galactic plane
  vec3 gn = normalize(vec3(.25, 1., -.35));
  float band = dot(d, gn);
  float bw = exp(-band*band*18.);
  float dust = fbm(d*6. + 3.);
  float neb  = fbm(d*2.2 - 7.);
  vec3 galaxy = mix(vec3(.55,.45,.8), vec3(1.,.75,.5), fbm(d*3.1)) * bw * (.35 + .9*dust);
  galaxy *= smoothstep(.25, .75, fbm(d*9.)) * .8 + .2;     // dust lanes
  col += galaxy * .09;
  col += starLayer(d, 300., .8*bw) * .35 * bw;              // dense star clouds in band

  // faint colored nebulae
  col += vec3(.20,.05,.25) * pow(neb, 4.) * .35;
  col += vec3(.02,.10,.22) * pow(fbm(d*1.4+11.), 5.) * .5;
  return col * uStarGain;
}

// ---------- accretion disk ----------
float diskPattern(vec3 pc, float r, float t){
  float omega = 1.6 / pow(r, 1.5);
  float phi = atan(pc.z, pc.x) - omega * t;
  vec2 cs = vec2(cos(phi), sin(phi));
  // low angular frequency, high radial frequency => orbiting filaments
  float n  = fbm(vec3(cs*1.6, r*1.2));
  float n2 = fbm(vec3(cs*4.0 + 3., r*3.2 + n*1.5));
  float fil = .5 + .5*sin(r*5.5 + n*5. + n2*2.);
  float s = n*.6 + n2*.5;
  s *= .7 + .3*fil;
  s *= .55 + .45*smoothstep(.2,.8,noise(vec3(r*.9, 7.1, 2.3)));   // broad gaps
  return s;
}

vec4 diskSample(vec3 pc, vec3 rd){
  float r = length(pc.xz);
  if(r < uDiskInner*.92 || r > uDiskOuter) return vec4(0);

  float n = diskPattern(pc, r, uTime);

  // radial profile
  float x = uDiskInner / r;
  float edgeIn  = smoothstep(uDiskInner*.92, uDiskInner*1.15, r);
  float edgeOut = 1. - smoothstep(uDiskOuter*.55, uDiskOuter, r);
  float dens = edgeIn * edgeOut * pow(max(n,0.), 1.8) * 2.6;

  // Novikov-Thorne-ish temperature profile, normalised to peak = 1
  float Tprof = pow(x, .75) * pow(max(1. - sqrt(x), 0.), .25) / .488;
  float temp = uDiskTemp * max(Tprof, .12);

  // relativistic effects
  vec3 vdir = normalize(vec3(-pc.z, 0., pc.x));
  float beta = clamp(sqrt(.5/max(r - 1., .05)), 0., .98);
  float gam  = 1./sqrt(1. - beta*beta);
  float cosT = dot(vdir, -rd);
  float D    = 1./(gam*(1. - beta*cosT));          // doppler factor
  float gr   = sqrt(max(1. - 1./r, 0.));            // gravitational redshift
  float g    = mix(1., D*gr, uDoppler);

  vec3 col = blackbody(temp * g) * pow(g, 3.) * dens * uDiskGain * (0.4 + 3.0*Tprof*Tprof);
  col *= uTint;
  float alpha = clamp(dens * 1.15, 0., 1.);
  return vec4(col, alpha);
}

// volumetric haze near the plane (cheap, accumulated along steps)
vec3 diskHaze(vec3 p, vec3 rd, float dt){
  float r = length(p.xz);
  if(r < uDiskInner*.9 || r > uDiskOuter*1.1) return vec3(0);
  float h = abs(p.y);
  float thick = .03 + .025*r;
  float fall = exp(-h*h/(thick*thick));
  float prof = smoothstep(uDiskInner*.9, uDiskInner*1.6, r) * (1.-smoothstep(uDiskOuter*.4, uDiskOuter*1.1, r));
  float x = uDiskInner / r;
  float Tprof = pow(x, .75) * pow(max(1.-sqrt(x),0.), .25)/.488;
  vec3 vdir = normalize(vec3(-p.z,0.,p.x));
  float beta = clamp(sqrt(.5/max(r-1.,.05)),0.,.98);
  float D = 1./((1./sqrt(1.-beta*beta))*(1.-beta*dot(vdir,-rd)));
  float g = mix(1., D*sqrt(max(1.-1./r,0.)), uDoppler);
  return blackbody(uDiskTemp*.8*max(Tprof,.15)*g) * pow(g,3.) * fall * prof * dt * uDiskThick * uDiskGain * .09 * uTint * smoothstep(.0, 2.5, length(p-uCamPos));
}

void main(){
  vec2 uv = (gl_FragCoord.xy - .5*uRes) / uRes.y;
  vec3 rd = normalize(uCamRot * vec3(uv * uFov, -1.));
  vec3 p  = uCamPos;
  vec3 v  = rd;

  vec3 h3 = cross(p, v);
  float h2 = dot(h3, h3);

  vec3  col   = vec3(0);
  float alpha = 0.;
  bool  captured = false;

  float jitter = hash13(vec3(gl_FragCoord.xy, fract(uClock)*97.));
  float minR = 1e9;

  for(int i = 0; i < 600; i++){
    if(i >= uSteps) break;
    float r2 = dot(p,p);
    float r  = sqrt(r2);
    minR = min(minR, r);

    float dt = clamp(.055*r, .012, 1.6);
    if(i == 0) dt *= jitter;

    // photon geodesic in Schwarzschild spacetime (Binet form): a = -3/2 h^2 r / |r|^5
    vec3 acc = -1.5 * h2 * p / (r2*r2*r) * uLensing;

    vec3 pOld = p;
    v += acc * dt;
    p += v * dt;

    // thin disk crossing
    if(pOld.y * p.y < 0.){
      float t = pOld.y / (pOld.y - p.y);
      vec3 pc = mix(pOld, p, t);
      vec4 d = diskSample(pc, normalize(v));
      col   += (1.-alpha) * d.rgb;
      alpha += (1.-alpha) * d.a;
      if(alpha > .995) break;
    }
    if(uDiskThick > 0.) col += (1.-alpha) * diskHaze(p, normalize(v), dt);

    if(dot(p,p) < 1.) { captured = true; break; }
    if(r > uFar && dot(p, v) > 0.) break;
  }

  if(!captured) col += (1.-alpha) * sky(normalize(v));

  if(any(isnan(col)) || any(isinf(col))) col = vec3(0);
  fragColor = vec4(clamp(col, 0., 3e4), 1.);
}`;

// ── Bloom: threshold / downsample / upsample ────────────────────────────────
export const PREFILTER_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uTex; uniform vec2 uTexel; uniform float uThreshold;
void main(){
  vec3 c = vec3(0);
  c += texture(uTex, vUv + uTexel*vec2(-1,-1)).rgb;
  c += texture(uTex, vUv + uTexel*vec2( 1,-1)).rgb;
  c += texture(uTex, vUv + uTexel*vec2(-1, 1)).rgb;
  c += texture(uTex, vUv + uTexel*vec2( 1, 1)).rgb;
  c *= .25;
  if(any(isnan(c))) c = vec3(0);
  float br = max(c.r, max(c.g, c.b));
  float soft = clamp(br - uThreshold + .5, 0., 1.); soft = soft*soft*.5;
  float contrib = max(soft, br - uThreshold) / max(br, 1e-4);
  o = vec4(min(c*contrib, vec3(60.)), 1.);
}`;

export const DOWN_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uTex; uniform vec2 uTexel;
void main(){
  // 13-tap filter (Jimenez, "Next Generation Post Processing in Call of Duty")
  vec2 t = uTexel;
  vec3 a = texture(uTex, vUv + t*vec2(-2, 2)).rgb;
  vec3 b = texture(uTex, vUv + t*vec2( 0, 2)).rgb;
  vec3 c = texture(uTex, vUv + t*vec2( 2, 2)).rgb;
  vec3 d = texture(uTex, vUv + t*vec2(-2, 0)).rgb;
  vec3 e = texture(uTex, vUv).rgb;
  vec3 f = texture(uTex, vUv + t*vec2( 2, 0)).rgb;
  vec3 g = texture(uTex, vUv + t*vec2(-2,-2)).rgb;
  vec3 h = texture(uTex, vUv + t*vec2( 0,-2)).rgb;
  vec3 i = texture(uTex, vUv + t*vec2( 2,-2)).rgb;
  vec3 j = texture(uTex, vUv + t*vec2(-1, 1)).rgb;
  vec3 k = texture(uTex, vUv + t*vec2( 1, 1)).rgb;
  vec3 l = texture(uTex, vUv + t*vec2(-1,-1)).rgb;
  vec3 m = texture(uTex, vUv + t*vec2( 1,-1)).rgb;
  vec3 res = e*.125 + (a+c+g+i)*.03125 + (b+d+f+h)*.0625 + (j+k+l+m)*.125;
  o = vec4(res, 1.);
}`;

export const UP_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uTex; uniform vec2 uTexel; uniform float uRadius;
void main(){
  vec2 t = uTexel * uRadius;
  vec3 s = texture(uTex, vUv).rgb * 4.;
  s += (texture(uTex, vUv+vec2(-t.x,0)).rgb + texture(uTex, vUv+vec2(t.x,0)).rgb +
        texture(uTex, vUv+vec2(0,-t.y)).rgb + texture(uTex, vUv+vec2(0,t.y)).rgb) * 2.;
  s += texture(uTex, vUv+vec2(-t.x,-t.y)).rgb + texture(uTex, vUv+vec2(t.x,-t.y)).rgb +
       texture(uTex, vUv+vec2(-t.x, t.y)).rgb + texture(uTex, vUv+vec2(t.x, t.y)).rgb;
  o = vec4(s/16., 1.);
}`;

// ── Final composite: bloom + ACES + lens artefacts + grain ──────────────────
export const COMPOSITE_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform sampler2D uStreak;
uniform float uBloomStrength;
uniform float uExposure;
uniform float uTime;
uniform float uAberration;
uniform float uFade;
uniform vec2  uRes;

vec3 aces(vec3 x){
  const mat3 i = mat3(0.59719,0.07600,0.02840, 0.35458,0.90834,0.13383, 0.04823,0.01566,0.83777);
  const mat3 o = mat3(1.60475,-0.10208,-0.00327, -0.53108,1.10813,-0.07276, -0.07367,-0.00605,1.07602);
  vec3 v = i * x;
  vec3 a = v*(v+0.0245786)-0.000090537;
  vec3 b = v*(0.983729*v+0.4329510)+0.238081;
  return clamp(o*(a/b), 0., 1.);
}
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }

void main(){
  vec2 c = vUv - .5;
  float r2 = dot(c,c);
  vec2 off = c * r2 * uAberration;
  vec3 scene;
  scene.r = texture(uScene, vUv - off).r;
  scene.g = texture(uScene, vUv).g;
  scene.b = texture(uScene, vUv + off).b;

  vec3 bloom = texture(uBloom, vUv).rgb;
  vec3 col = scene + bloom * uBloomStrength;

  // subtle anamorphic streak from bloom
  vec3 st = vec3(0);
  for(int i=-6;i<=6;i++){ float fi=float(i); st += texture(uStreak, vUv + vec2(fi*.022,0.)).rgb * exp(-abs(fi)*.35); }
  col += st * vec3(.5,.6,1.) * .018 * uBloomStrength;

  col *= uExposure;
  col = aces(col);
  col = pow(col, vec3(1./2.2));

  // vignette
  col *= mix(1., smoothstep(.95, .2, length(c*vec2(1.,.85))), .55);

  // film grain + dither
  float g = hash(vUv*uRes + fract(uTime)*100.) - .5;
  col += g * .035;

  col *= uFade;
  o = vec4(col, 1.);
}`;
