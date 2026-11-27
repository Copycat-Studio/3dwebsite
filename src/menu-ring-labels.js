import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import fontData from './fonts/menu-bold.typeface.json';

export const MENU_LABELS = {
  icon_vr: { hitbox: 'hitbox_vr', text: 'COMING SOON' },
  icon_app: { hitbox: 'hitbox_app', text: 'APPLICATION' },
  icon_ig: { hitbox: 'hitbox_ig', text: 'INSTAGRAM' },
  icon_immersive: { hitbox: 'hitbox_immersive', text: 'CURIO' },
  icon_reel: { hitbox: 'hitbox_reel', text: 'SHOWREEL' },
};

export class MenuRingLabels {
  constructor(scene, mobile=()=>false) {
    this.scene=scene;this.mobile=mobile;this.hover=null;this.entries=[];
    this.font=new FontLoader().parse(fontData);
    this.material=new THREE.MeshStandardMaterial({color:0x87ceeb,emissive:0x87ceeb,emissiveIntensity:1.2,roughness:.35,metalness:.05});
  }
  handles(hitbox){return Object.values(MENU_LABELS).some(x=>x.hitbox===hitbox);}
  setHover(hitbox){this.hover=hitbox;}
  attach(name,model) {
    const spec=MENU_LABELS[name];if(!spec||this.entries.some(e=>e.model===model))return;
    model.updateWorldMatrix(true,true);
    const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
    if(box.isEmpty())return;
    const baseRadius=Math.max(size.x,size.z,size.y*.65,.01)*.70;
    const radius=baseRadius*.75;
    const baseHeight=baseRadius*.32;
    const group=new THREE.Group();group.name='menu_label_'+name;
    // Fixed diagonal tilt; animate a child so the ring keeps its tilted plane.
    group.rotation.z=Math.PI/4;
    const spinner=new THREE.Group();group.add(spinner);
    group.position.copy(center);
    if(name==='icon_ig')group.scale.setScalar(1.15);
    // Per-icon offsets in reference font heights.
    const lift=({icon_app:.5,icon_vr:1,icon_reel:.3}[name]||0)*baseHeight;
    group.position.y=box.max.y+baseRadius*.14-baseHeight*3+lift;
    // Repeat whole labels around 360 degrees, including a gap at the seam.
    const phrase=spec.text+' ';
    const advanceFor=ch=>(this.font.data.glyphs[ch]?.ha||350)/this.font.data.resolution*baseHeight+baseHeight*.10;
    const phraseWidth=[...phrase].reduce((sum,ch)=>sum+advanceFor(ch),0);
    const circumference=2*Math.PI*radius;
    const repeats=Math.max(2,Math.floor(circumference/phraseWidth));
    const characters=[...phrase.repeat(repeats)];
    const layoutScale=circumference/(phraseWidth*repeats);
    const height=baseHeight*Math.min(1,layoutScale);
    const advances=characters.map(ch=>advanceFor(ch)*layoutScale);
    let cursor=-circumference/2;
    characters.forEach((ch,i)=>{
      const advance=advances[i],angle=(cursor+advance/2)/radius;cursor+=advance;
      if(ch===' ')return;
      const geometry=new TextGeometry(ch,{font:this.font,size:height,depth:height*.10,curveSegments:3,bevelEnabled:false});
      geometry.computeBoundingBox();const b=geometry.boundingBox;
      geometry.translate(-(b.min.x+b.max.x)/2,0,0);
      const letter=new THREE.Mesh(geometry,this.material);
      letter.position.set(Math.sin(angle)*radius,0,Math.cos(angle)*radius);letter.rotation.y=angle;
      letter.raycast=()=>{};spinner.add(letter);
    });
    group.visible=false;this.scene.add(group);this.entries.push({group,spinner,model,spec});
  }
  update(delta) {
    const mobile=this.mobile();
    for(const {group,spinner,model,spec} of this.entries){
      group.visible=model.visible&&(mobile||this.hover===spec.hitbox);
      if(group.visible)spinner.rotation.y=(spinner.rotation.y-Math.min(delta,.1)*.65)%(Math.PI*2);
    }
  }
  dispose(){for(const {group} of this.entries){group.traverse(o=>o.geometry?.dispose());this.scene.remove(group);}this.material.dispose();this.entries=[];}
}
