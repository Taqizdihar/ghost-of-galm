// Procedural coastline and aircraft. All geometry is original and built at runtime.

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, v) => { const t = clamp((v-a)/(b-a),0,1); return t*t*(3-2*t); };
const fract = v => v - Math.floor(v);
const hash = (x,z) => fract(Math.sin(x*127.1+z*311.7)*43758.5453123);
function noise(x,z) {
  const ix=Math.floor(x), iz=Math.floor(z), fx=x-ix, fz=z-iz;
  const u=fx*fx*(3-2*fx), v=fz*fz*(3-2*fz);
  return (hash(ix,iz)*(1-u)+hash(ix+1,iz)*u)*(1-v)+(hash(ix,iz+1)*(1-u)+hash(ix+1,iz+1)*u)*v;
}
function fbm(x,z) { return noise(x,z)*.56+noise(x*2.07+31,z*2.07-17)*.27+noise(x*4.19-8,z*4.19+52)*.12+noise(x*8.1+18,z*8.1)*.05; }
function coast(z) { return 630 + Math.sin(z*.00016)*390 + Math.sin(z*.00047+0.5)*175 + Math.sin(z*.0011)*35; }
function mainLandHeight(x,z) {
  const inland=x-coast(z);
  if(inland<0) return -12;
  const beach=smooth(0,140,inland);
  const shoulder=smooth(110,1850,inland);
  const ridgeNoise=fbm(x*.00047,z*.00036);
  const ridge=Math.pow(1-Math.abs(ridgeNoise*2-1),1.65);
  const spine=Math.exp(-Math.pow((inland-4400-1300*Math.sin(z*.00025))/5200,2));
  const folded=1-Math.abs(noise(x*.0016+ridgeNoise*.9,z*.00135)*2-1);
  const crags=Math.pow(folded,2.6)*380+fbm(x*.004+5,z*.0037)*90;
  const valleys=.48+.52*Math.pow(fbm(x*.0007+12,z*.00064-30),.8);
  return beach*6+shoulder*(90+spine*(320+ridge*1050)*valleys+crags)*(.73+.27*fbm(x*.0002,z*.00028));
}

function surfaceNoiseTexture(THREE){
  const size=128,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=(y*size+x)*4;
    data[i]=hash(x,y)*255;data[i+1]=hash(x+71,y+193)*255;data[i+2]=hash(x+331,y+57)*255;data[i+3]=255;
  }
  const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps=true;texture.anisotropy=8;texture.needsUpdate=true;
  return texture;
}

function cloudTexture(THREE) {
  const canvas=document.createElement('canvas'); canvas.width=512; canvas.height=256;
  const ctx=canvas.getContext('2d');
  for(let i=0;i<55;i++) {
    const t=i/55, x=60+t*385, y=142-52*Math.sin(t*Math.PI)+Math.sin(i*2.3)*23;
    const r=30+hash(i,18)*52;
    const g=ctx.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0,'rgba(240,245,244,0.34)'); g.addColorStop(.43,'rgba(235,242,244,0.18)'); g.addColorStop(1,'rgba(235,242,244,0)');
    ctx.fillStyle=g; ctx.fillRect(x-r,y-r,r*2,r*2);
  }
  const tex=new THREE.CanvasTexture(canvas); tex.colorSpace=THREE.SRGBColorSpace;
  return tex;
}

export function createWorld(THREE) {
  const scene=new THREE.Scene();
  const haze=new THREE.Color('#a7c0cb');
  const surfaceNoise=surfaceNoiseTexture(THREE);
  scene.background=haze;
  scene.fog=new THREE.FogExp2(haze,.000026);

  const sky=new THREE.Mesh(new THREE.SphereGeometry(170000,32,20),new THREE.ShaderMaterial({
    side:THREE.BackSide,depthWrite:false,
    uniforms:{sunDirection:{value:new THREE.Vector3(-.52,.36,-.77).normalize()}},
    vertexShader:`varying vec3 vDirection; void main(){vDirection=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec3 vDirection; uniform vec3 sunDirection;
      void main(){
        vec3 d=normalize(vDirection); float h=max(d.y,0.);
        vec3 horizon=vec3(.59,.72,.79); vec3 zenith=vec3(.15,.34,.53);
        vec3 color=mix(horizon,zenith,pow(h,.44));
        float s=max(dot(d,sunDirection),0.);
        color+=vec3(1.,.8,.48)*pow(s,12.)*.14;
        color+=vec3(1.,.82,.58)*pow(s,350.)*.34;
        color+=vec3(1.,.92,.72)*smoothstep(.99965,.99988,s)*2.6;
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  }));
  sky.renderOrder=-1000; sky.frustumCulled=false; scene.add(sky);
  scene.add(new THREE.HemisphereLight(0xcce5ee,0x677368,2.1));
  const sun=new THREE.DirectionalLight(0xfff0da,2.8); sun.position.set(-15000,22000,-18000); scene.add(sun);

  const oceanMaterial=new THREE.ShaderMaterial({
    uniforms:{time:{value:0},fogColor:{value:haze},surfaceNoise:{value:surfaceNoise},sunDirection:{value:new THREE.Vector3(-.52,.36,-.77).normalize()}},
    vertexShader:`varying vec3 vWorld; void main(){ vec4 p=modelMatrix*vec4(position,1.); vWorld=p.xyz; gl_Position=projectionMatrix*viewMatrix*p; }`,
    fragmentShader:`
      varying vec3 vWorld; uniform float time; uniform vec3 fogColor; uniform vec3 sunDirection; uniform sampler2D surfaceNoise;
      float shoreline(float z){return 630.+sin(z*.00016)*390.+sin(z*.00047+.5)*175.+sin(z*.0011)*35.;}
      void main(){
        vec2 p=vWorld.xz;
        vec3 viewDir=normalize(cameraPosition-vWorld);
        float dist=length(cameraPosition-vWorld);
        vec2 drift=vec2(time*.00032,time*.00011);
        vec2 slow=texture2D(surfaceNoise,p*.000037).rg-.5;
        mat2 turn=mat2(.8,-.6,.6,.8);
        vec2 swell=texture2D(surfaceNoise,p*vec2(.00013,.00043)+slow*.024+drift*.24).rg-.5;
        vec2 ripple=texture2D(surfaceNoise,turn*p*vec2(.0011,.0029)+swell*.08+drift).rg-.5;
        vec2 micro=texture2D(surfaceNoise,turn*p*.007+drift*2.2).rg-.5;
        float close=1.-smoothstep(650.,7000.,dist);
        vec2 slope=swell*.045+ripple*.085*close+micro*.07*close;
        vec3 normal=normalize(vec3(slope.x,1.,slope.y));
        float fresnel=pow(1.-max(dot(normal,viewDir),0.),4.);
        float offshore=shoreline(p.y)-p.x;
        float shallows=1.-smoothstep(15.,450.,offshore);
        vec3 water=mix(vec3(.018,.112,.163),vec3(.055,.265,.27),shallows*.85);
        water+=vec3(.002,.007,.009)*(swell.x+ripple.y*close);
        water=mix(water,vec3(.34,.50,.59),fresnel*.56);
        vec3 halfDir=normalize(sunDirection+viewDir);
        float glint=pow(max(dot(normal,halfDir),0.),220.);
        float shine=pow(max(dot(normal,halfDir),0.),24.);
        water+=vec3(1.,.88,.65)*(glint*.43+shine*.045);
        float wash=texture2D(surfaceNoise,p*.003+drift*.5).g;
        float foam=(1.-smoothstep(4.,23.,abs(offshore-11.-swell.x*13.)))*(.37+wash*.63);
        water=mix(water,vec3(.66,.77,.72),clamp(foam*.56,0.,.56));
        float fog=1.-exp(-pow(dist*.000032,1.6));
        water=mix(water,fogColor,fog);
        gl_FragColor=vec4(water,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const ocean=new THREE.Mesh(new THREE.PlaneGeometry(240000,240000,1,1),oceanMaterial);
  ocean.rotation.x=-Math.PI/2; ocean.position.y=-1; scene.add(ocean);

  // Nonuniform spacing keeps the shoreline and nearby slopes detailed.
  const columns=132,rows=820;
  const positions=new Float32Array((columns+1)*(rows+1)*3);
  const colors=new Float32Array(positions.length);
  const indices=[];
  const sand=new THREE.Color('#b7b49b'), scrub=new THREE.Color('#667969');
  const green=new THREE.Color('#465b51'), rock=new THREE.Color('#777f78');
  const color=new THREE.Color();
  for(let j=0;j<=rows;j++){
    const z=-68000+j/rows*136000;
    for(let i=0;i<=columns;i++){
      const u=i/columns, inland=-22+Math.pow(u,1.7)*23000;
      const x=coast(z)+inland;
      const h=inland<0?-1.5:mainLandHeight(x,z);
      const index=(j*(columns+1)+i)*3;
      positions[index]=x; positions[index+1]=h; positions[index+2]=z;
      const variation=fbm(x*.007,z*.007);
      color.copy(sand).lerp(scrub,smooth(65,210,inland));
      color.lerp(green,smooth(150,700,inland)*(.36+variation*.52));
      const steep=Math.abs(mainLandHeight(x+35,z)-mainLandHeight(x-35,z))/70+Math.abs(mainLandHeight(x,z+35)-mainLandHeight(x,z-35))/70;
      color.lerp(rock,clamp((steep-.3)*.78+smooth(950,1500,h)*.47,0,.78));
      color.multiplyScalar(.82+variation*.36);
      colors[index]=color.r; colors[index+1]=color.g; colors[index+2]=color.b;
    }
  }
  for(let j=0;j<rows;j++)for(let i=0;i<columns;i++){
    const a=j*(columns+1)+i,b=a+1,c=a+columns+1,d=c+1;
    indices.push(a,c,b,b,c,d);
  }
  const terrainGeometry=new THREE.BufferGeometry();
  terrainGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  terrainGeometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
  terrainGeometry.setIndex(indices); terrainGeometry.computeVertexNormals();
  const terrainMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0});
  terrainMaterial.onBeforeCompile=shader=>{
    shader.uniforms.surfaceNoise={value:surfaceNoise};
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vTerrainWorld; varying vec3 vTerrainNormal;');
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvTerrainWorld=(modelMatrix*vec4(position,1.)).xyz; vTerrainNormal=mat3(modelMatrix)*normal;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D surfaceNoise; varying vec3 vTerrainWorld; varying vec3 vTerrainNormal;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec3 tn=normalize(vTerrainNormal);
      vec2 uv=vTerrainWorld.xz;
      float macro=texture2D(surfaceNoise,uv*.000055).r;
      float terrainPatch=texture2D(surfaceNoise,uv*.00031+vec2(macro*.08)).g;
      vec2 rockUv=mix(uv,vec2(vTerrainWorld.z,vTerrainWorld.y),clamp(abs(tn.x)*1.3,0.,1.));
      float grit=texture2D(surfaceNoise,rockUv*.0047).r;
      float fine=texture2D(surfaceNoise,rockUv*.023).b;
      float strata=sin(vTerrainWorld.y*.068+terrainPatch*8.+vTerrainWorld.z*.0018)*.5+.5;
      float grain=(grit*.84+fine*.16);
      float exposed=clamp(smoothstep(.12,.48,1.-abs(tn.y))*.8+smoothstep(730.,1250.,vTerrainWorld.y)*.3,0.,.84);
      float dryLand=smoothstep(8.,35.,vTerrainWorld.y);
      vec3 rockColor=vec3(.175,.183,.169)*(.65+grain*.48+strata*.12);
      diffuseColor.rgb*=mix(1.,.57+terrainPatch*.5+macro*.22+grain*.14,dryLand);
      diffuseColor.rgb=mix(diffuseColor.rgb,rockColor,exposed*dryLand);
      float detailHeight=(grit*.55+fine*.07+strata*.12)*dryLand;
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      vec3 sigmaX=dFdx(-vViewPosition); vec3 sigmaY=dFdy(-vViewPosition);
      vec3 bumpX=cross(sigmaY,normal); vec3 bumpY=cross(normal,sigmaX);
      float determinant=dot(sigmaX,bumpX);
      vec3 surfaceGradient=sign(determinant)*(dFdx(detailHeight)*bumpX+dFdy(detailHeight)*bumpY);
      normal=normalize(abs(determinant)*normal-surfaceGradient*1.65);
    `);
  };
  const terrain=new THREE.Mesh(terrainGeometry,terrainMaterial);
  terrain.receiveShadow=true; scene.add(terrain);

  // Broken offshore islands anchor the horizon beyond the open sea.
  const islandDefinitions=[[-5900,-13800,1200,2700,530],[-8900,-18500,800,1700,320],[-16000,-32000,1800,2900,610],[-4500,13000,1350,2000,460]];
  const islandHeight=(x,z,island)=>{
    const [cx,cz,rx,rz,peak]=island;
    const nx=(x-cx)/rx,nz=(z-cz)/rz;
    const radius=Math.sqrt(nx*nx+nz*nz);
    return radius>1?-10:Math.pow(Math.max(0,1-radius),1.25)*peak*(.72+fbm(x*.002,z*.002)*.56)-5;
  };
  islandDefinitions.forEach(island=>{
    const [cx,cz,rx,rz]=island,n=48;
    const geo=new THREE.PlaneGeometry(rx*2,rz*2,n,n); geo.rotateX(-Math.PI/2);
    const attr=geo.attributes.position, cs=[];
    for(let i=0;i<attr.count;i++){
      const x=attr.getX(i)+cx,z=attr.getZ(i)+cz,h=islandHeight(x,z,island);
      attr.setXYZ(i,x,h,z);
      color.copy(green).lerp(rock,fbm(x*.004,z*.004)*.75); color.lerp(sand,1-smooth(1,22,h));
      cs.push(color.r,color.g,color.b);
    }
    geo.setAttribute('color',new THREE.Float32BufferAttribute(cs,3));geo.computeVertexNormals();
    scene.add(new THREE.Mesh(geo,terrain.material));
  });

  const clouds=new THREE.Group();const cloudMap=cloudTexture(THREE);
  for(let i=0;i<55;i++){
    const material=new THREE.SpriteMaterial({map:cloudMap,color:0xe1e8e8,transparent:true,opacity:.23+hash(i,4)*.22,depthWrite:false,fog:true});
    const sprite=new THREE.Sprite(material);
    const x=(hash(i,1)-.5)*95000,z=(hash(i,2)-.5)*130000,y=2600+hash(i,3)*5400;
    sprite.position.set(x,y,z);const size=3000+hash(i,5)*8000;sprite.scale.set(size,size*.36,1);
    clouds.add(sprite);
  }
  scene.add(clouds);

  // A small coastal airfield gives the landscape a human scale.
  const airfield=new THREE.Group();
  const airZ=-8800,airX=coast(airZ)+200,airY=mainLandHeight(airX,airZ)+2;
  const strip=new THREE.Mesh(new THREE.BoxGeometry(32,1,740),new THREE.MeshStandardMaterial({color:0x646b65,roughness:1}));
  strip.position.set(airX,airY,airZ);airfield.add(strip);
  const stripeMaterial=new THREE.MeshBasicMaterial({color:0xc3c6ae});
  for(let i=0;i<15;i++){const stripe=new THREE.Mesh(new THREE.BoxGeometry(1.4,.1,15),stripeMaterial);stripe.position.set(airX,airY+.55,airZ-325+i*46);airfield.add(stripe);}
  const buildingMaterial=new THREE.MeshStandardMaterial({color:0x898e82,roughness:1});
  for(let i=0;i<7;i++){const hangar=new THREE.Mesh(new THREE.BoxGeometry(24,12,38),buildingMaterial);hangar.position.set(airX+75,mainLandHeight(airX+75,airZ-210+i*70)+6,airZ-210+i*70);airfield.add(hangar);}
  scene.add(airfield);

  return {
    scene,
    terrainHeight(x,z){
      let height=mainLandHeight(x,z);
      for(const island of islandDefinitions)height=Math.max(height,islandHeight(x,z,island));
      return Math.max(-1,height);
    },
    update(time,playerPosition){
      oceanMaterial.uniforms.time.value=time;
      sky.position.copy(playerPosition);
      ocean.position.x=playerPosition.x;
      ocean.position.z=playerPosition.z;
    }
  };
}

function polygon(THREE,points,y,thickness,material){
  const positions=[],indices=[],count=points.length;
  const area=points.reduce((sum,p,i)=>{const q=points[(i+1)%count];return sum+p[0]*q[1]-q[0]*p[1];},0);
  for(const py of [y+thickness/2,y-thickness/2])for(const p of points)positions.push(p[0],py,p[1]);
  for(let i=1;i<count-1;i++){if(area>0)indices.push(0,i+1,i,count,count+i,count+i+1);else indices.push(0,i,i+1,count,count+i+1,count+i);}
  for(let i=0;i<count;i++){const j=(i+1)%count;if(area>0)indices.push(i,j,count+j,i,count+j,count+i);else indices.push(i,count+j,j,i,count+i,count+j);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  return new THREE.Mesh(geometry,material);
}

export function createAircraft(THREE,{enemy=false}={}){
  const jet=new THREE.Group();
  const bodyMaterial=new THREE.MeshStandardMaterial({color:enemy?0x78817e:0x737f83,metalness:.58,roughness:.44});
  const darkMaterial=new THREE.MeshStandardMaterial({color:0x29343a,metalness:.64,roughness:.42});
  const lightMaterial=new THREE.MeshStandardMaterial({color:0xa6adab,metalness:.48,roughness:.42});
  const undersideMaterial=new THREE.MeshStandardMaterial({color:0x4b585f,metalness:.38,roughness:.64});
  const accentMaterial=new THREE.MeshStandardMaterial({color:enemy?0xce843f:0xb64332,metalness:.3,roughness:.55});
  const cockpitMaterial=new THREE.MeshPhysicalMaterial({color:0x122c37,metalness:.7,roughness:.1,clearcoat:1,clearcoatRoughness:.1});
  const profiles=[[-12.5,.07,.05],[-10.7,.47,.46],[-7.5,1.1,.85],[-4,1.35,1.03],[0,1.56,1.05],[4.5,1.55,.9],[8.3,1.15,.6],[9.1,.8,.44]];
  const vertices=[],indices=[],segments=12;
  for(const [z,rx,ry] of profiles)for(let j=0;j<segments;j++){const theta=j/segments*TAU;vertices.push(Math.cos(theta)*rx,Math.sin(theta)*ry,z);}
  for(let i=0;i<profiles.length-1;i++)for(let j=0;j<segments;j++){const a=i*segments+j,b=i*segments+(j+1)%segments,c=a+segments,d=b+segments;indices.push(a,b,d,a,d,c);}
  const fuselageGeo=new THREE.BufferGeometry();fuselageGeo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));fuselageGeo.setIndex(indices);fuselageGeo.computeVertexNormals();
  jet.add(new THREE.Mesh(fuselageGeo,bodyMaterial));
  const nose=new THREE.Mesh(new THREE.ConeGeometry(.49,2.05,12),darkMaterial);nose.rotation.x=-Math.PI/2;nose.position.set(0,0,-11.32);jet.add(nose);
  const cockpit=new THREE.Mesh(new THREE.SphereGeometry(1,20,12),cockpitMaterial);cockpit.scale.set(.78,.83,2.37);cockpit.position.set(0,.86,-4.6);jet.add(cockpit);
  const canopyFrame=new THREE.Mesh(new THREE.TorusGeometry(.79,.045,5,20,Math.PI),lightMaterial);canopyFrame.position.set(0,1.08,-4.05);jet.add(canopyFrame);

  const flames=[];
  const engineMaterials=[];
  for(const side of [-1,1]){
    // Main swept wings, tailplanes, intake shoulders, and twin engine nacelles.
    const wing=polygon(THREE,[[side*1.1,-3],[side*9.6,2.75],[side*9.25,5],[side*3.1,5.4],[side*1.4,7.05]],-.17,.2,bodyMaterial);jet.add(wing);
    const tail=polygon(THREE,[[side*1.2,5.2],[side*5.9,8.3],[side*5.2,10.3],[side*1.4,9.1]],.13,.16,bodyMaterial);jet.add(tail);
    const wingAccent=polygon(THREE,[[side*8.5,2.02],[side*9.6,2.75],[side*9.25,5],[side*8.35,5.05]],-.055,.022,accentMaterial);jet.add(wingAccent);
    const panel=polygon(THREE,[[side*3.15,1.5],[side*7.55,3.5],[side*7.2,4.2],[side*3.1,3.6]],-.051,.018,undersideMaterial);jet.add(panel);
    const engine=new THREE.Mesh(new THREE.CylinderGeometry(.89,.77,8.5,14),bodyMaterial);engine.rotation.x=Math.PI/2;engine.position.set(side*1.39,-.28,4.1);jet.add(engine);
    const intake=new THREE.Mesh(new THREE.BoxGeometry(1.7,1.05,3.4),undersideMaterial);intake.position.set(side*1.43,-.13,-1.1);jet.add(intake);
    const mouth=new THREE.Mesh(new THREE.PlaneGeometry(1.36,.77),darkMaterial);mouth.rotation.y=Math.PI;mouth.position.set(side*1.43,-.15,-2.82);jet.add(mouth);
    const lip=polygon(THREE,[[side*.6,-3.02],[side*2.34,-2.5],[side*2.3,.4],[side*.5,-.3]],.6,.11,bodyMaterial);jet.add(lip);
    const nozzle=new THREE.Mesh(new THREE.CylinderGeometry(.79,.87,1.5,16,1,true),darkMaterial);nozzle.rotation.x=Math.PI/2;nozzle.position.set(side*1.39,-.28,8.75);jet.add(nozzle);
    const glowMaterial=new THREE.MeshBasicMaterial({color:0xffb762,transparent:true,opacity:.85});
    const glow=new THREE.Mesh(new THREE.CircleGeometry(.66,20),glowMaterial);glow.position.set(side*1.39,-.28,9.52);jet.add(glow);
    const flameMaterial=new THREE.MeshBasicMaterial({color:0x75a9ff,transparent:true,opacity:.26,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
    const flame=new THREE.Mesh(new THREE.ConeGeometry(.58,4.2,12,1,true),flameMaterial);flame.rotation.x=Math.PI/2;flame.position.set(side*1.39,-.28,11.4);jet.add(flame);flames.push(flame);engineMaterials.push(glowMaterial,flameMaterial);

    const finGeometry=new THREE.BufferGeometry();
    finGeometry.setAttribute('position',new THREE.Float32BufferAttribute([side*1.53,.3,4.9,side*1.83,4.6,6.05,side*1.83,4.3,8.6,side*1.58,.3,9.05],3));
    finGeometry.setIndex([0,1,2,0,2,3]);finGeometry.computeVertexNormals();
    const finMat=bodyMaterial.clone();finMat.side=THREE.DoubleSide;jet.add(new THREE.Mesh(finGeometry,finMat));
    const stripeGeometry=new THREE.BufferGeometry();stripeGeometry.setAttribute('position',new THREE.Float32BufferAttribute([side*1.839,3.45,5.75,side*1.849,4.55,6.1,side*1.849,4.28,8.6,side*1.839,3.35,8.69],3));stripeGeometry.setIndex([0,1,2,0,2,3]);stripeGeometry.computeVertexNormals();
    const stripeMat=accentMaterial.clone();stripeMat.side=THREE.DoubleSide;jet.add(new THREE.Mesh(stripeGeometry,stripeMat));
    // White underwing air-to-air missiles, with four small stabilizing fins.
    for(const wingX of [3.45,5.9]){
      const missile=new THREE.Group();
      const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.105,.105,2.65,8),lightMaterial);shaft.rotation.x=Math.PI/2;missile.add(shaft);
      const tip=new THREE.Mesh(new THREE.ConeGeometry(.106,.65,8),darkMaterial);tip.rotation.x=-Math.PI/2;tip.position.z=-1.64;missile.add(tip);
      missile.add(polygon(THREE,[[-.46,.85],[0,.45],[.46,.85],[.46,1.24],[-.46,1.24]],0,.045,lightMaterial));
      const fin=new THREE.Mesh(new THREE.BoxGeometry(.05,.65,.4),lightMaterial);fin.position.z=1.02;missile.add(fin);
      missile.position.set(side*wingX,-.66,2.8);jet.add(missile);
      const pylon=new THREE.Mesh(new THREE.BoxGeometry(.13,.52,.85),undersideMaterial);pylon.position.set(side*wingX,-.34,3.04);jet.add(pylon);
    }
    const nav=new THREE.Mesh(new THREE.SphereGeometry(.11,8,6),new THREE.MeshBasicMaterial({color:side<0?0xf6493f:0x7ee9be}));nav.position.set(side*9.4,-.1,3.8);jet.add(nav);
  }
  const spine=new THREE.Mesh(new THREE.BoxGeometry(.32,.13,5.5),lightMaterial);spine.position.set(0,1.06,2.1);jet.add(spine);
  jet.traverse(child=>{if(child.isMesh){child.castShadow=true;child.receiveShadow=true;}});
  jet.userData.flames=flames;
  jet.userData.engineMaterials=engineMaterials;
  jet.userData.setThrust=(thrust,time=0)=>{
    flames.forEach((flame,i)=>{flame.scale.y=.45+thrust*.85+Math.sin(time*35+i)*.05;flame.material.opacity=.13+thrust*.22;});
  };
  return jet;
}
