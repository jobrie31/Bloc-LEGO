// Empaquetage 3D multi-vannes (pouces). Orientation fixe L→X, l→Y, H→Z.
// Empilement Z optionnel (keepZBase=false). Marge en X/Y uniquement.
// CONTRAINTE: au plus **2 colonnes** en largeur (Y) par zone (ySplits <= 1).

function vol(b){return b.l*b.w*b.h;}
function clone(o){return JSON.parse(JSON.stringify(o));}

// ----- Génération des instances (qty) -----
function expandItems(items){
  const out=[];
  items.forEach(it=>{
    const q=Number(it.qty??1);
    for(let i=0;i<q;i++){
      out.push({ id:`${it.id??"item"}-${i+1}`, l:+it.l, w:+it.w, h:+it.h, type: it.id??"item" });
    }
  });
  return out;
}

// ----- Tri(s) testés -----
const ORDERINGS = {
  byVolume: (a,b)=> vol(b)-vol(a) || b.l-a.l || b.w-a.w || b.h-a.h,
  byL:      (a,b)=> b.l-a.l || b.w-a.w || b.h-a.h,
  byW:      (a,b)=> b.w-a.w || b.l-a.l || b.h-a.h,
};

// ----- Orientations (aucune rotation si lockAxesFully) -----
function orientations(box,{lockAxesFully=true,forbidZRotation=false}={}){
  const {l,w,h}=box;
  if(lockAxesFully) return [{l,w,h}];
  const rots=[
    {l,w,h},{l,w:h,h:w},
    {l:w,w:l,h},{l:w,w:h,h:l},
    {l:h,w,h:l},{l:h,w:l,h:w},
  ];
  return forbidZRotation?rots.filter(r=>r.h===h):rots;
}

// ----- Test d’ajustement -----
function fits(space,b,clearXY,maxH=Infinity,keepZBase=true){
  const L=Math.max(space.l-2*clearXY,0);
  const W=Math.max(space.w-2*clearXY,0);
  const H=Math.min(space.h,maxH);
  if(b.l>L||b.w>W||b.h>H) return false;
  if(keepZBase && space.z>0) return false;
  return true;
}

// ----- Découpe guillotine SANS chevauchement + limite 2 colonnes -----
// DROITE : [x+used.l .. finX] × [toute la largeur] × [pleine hauteur] (hérite ySplits)
// DEVANT : [x .. x+used.l]    × [y+used.w .. finY] × [pleine hauteur]
//          **uniquement si parent.ySplits < 1** (=> max 2 colonnes). ySplits+1.
// AU-DESSUS : si empilement, au-dessus de l’empreinte (used.l×used.w) (hérite ySplits)
function splitSpace(space,used,{keepZBase}){
  const out=[];
  const rx=space.l-used.l;
  const ry=space.w-used.w;
  const rz=space.h-used.h;

  // Droite (hérite ySplits)
  if(rx>0){
    out.push({
      x:space.x+used.l, y:space.y, z:space.z,
      l:rx, w:space.w, h:space.h,
      ySplits: space.ySplits||0,
    });
  }

  // Devant : autorisé une seule fois → max 2 colonnes
  if(ry>0 && used.l>0 && (space.ySplits||0) < 1){
    out.push({
      x:space.x, y:space.y+used.w, z:space.z,
      l:used.l, w:ry, h:space.h,
      ySplits: (space.ySplits||0) + 1,
    });
  }

  // Au-dessus (empilement, hérite ySplits)
  if(!keepZBase && rz>0){
    out.push({
      x:space.x, y:space.y, z:space.z+used.h,
      l:used.l, w:used.w, h:rz,
      ySplits: space.ySplits||0,
    });
  }

  return out.filter(s=>s.l>0&&s.w>0&&s.h>0);
}

// ----- Un essai de placement dans une vanne (pour un ordre donné) -----
function tryPack(van, items, opts={}){
  const {
    clearance=0, forbidZRotation=false, maxStackHeight=Infinity,
    keepZBase=true, lockAxesFully=true
  } = opts;

  const spaces=[{x:0,y:0,z:0,l:van.l,w:van.w,h:van.h,ySplits:0}];
  const placed=[], remaining=[];

  for(const box of items){
    let done=false;

    // Remplir le plancher d’abord, préférer grands espaces
    spaces.sort((a,b)=> (a.z-b.z) || (vol(b)-vol(a)) || (b.l-a.l) || (b.w-a.w));

    for(let si=0; si<spaces.length && !done; si++){
      const sp=spaces[si];
      for(const o of orientations(box,{lockAxesFully,forbidZRotation})){
        if(fits(sp,o,clearance,maxStackHeight,keepZBase)){
          const pb={ id:box.id,type:box.type,
            x:sp.x+clearance, y:sp.y+clearance, z:sp.z,
            l:o.l, w:o.w, h:o.h };
          placed.push(pb);
          const newSpaces=splitSpace(sp,{l:o.l,w:o.w,h:o.h},{keepZBase});
          spaces.splice(si,1,...newSpaces);
          done=true; break;
        }
      }
    }
    if(!done) remaining.push(box);
  }

  const usedVolume=placed.reduce((s,b)=>s+vol(b),0);
  return { placed, remaining, usedVolume, fillRate: usedVolume/vol(van) };
}

// ----- Pack dans une vanne en testant plusieurs ordres -----
export function packIntoSingleVan(van, items, opts={}){
  const orderings = Object.entries(ORDERINGS);
  let best=null;
  for(const [name,cmp] of orderings){
    const sorted=clone(items).sort(cmp);
    const sim=tryPack(van, sorted, opts);
    const key=[ sim.placed.length, sim.usedVolume, -sorted.length ];
    if(!best || compareKey(key,best.key)>0) best={sim,key,order:name};
  }
  return best.sim;
}

// ----- Empaquetage multi-vannes -----
export function packAllWithCost({ vanTypes, items, opts={} }){
  const {
    costs={}, clearance=0, forbidZRotation=false, maxStackHeight=Infinity,
    keepZBase=true, lockAxesFully=true, strategy="min_vans", maxIterations=5000
  } = opts;

  let remaining=expandItems(items);
  const vans=[]; let iter=0;

  while(remaining.length>0){
    if(iter++>maxIterations) break;

    let best=null;
    for(const vt of vanTypes){
      const sim=packIntoSingleVan(vt, remaining, {
        clearance, forbidZRotation, maxStackHeight, keepZBase, lockAxesFully
      });
      const placedCount=sim.placed.length;
      const usedVol=sim.usedVolume;
      const cost=costs[vt.code]??0;

      const key = (strategy==="min_cost")
        ? [usedVol/(cost||1), placedCount, -cost]
        : [placedCount, usedVol, -cost];

      if(!best || compareKey(key,best.key)>0) best={ vt, sim, cost, key };
    }

    if(!best || best.sim.placed.length===0){
      return { vans, remaining, stats:{
        usedVans:vans.length,
        unplacedCount:remaining.length,
        totalCost:vans.reduce((s,v)=>s+v.cost,0),
      }};
    }

    vans.push({ ...best.vt, cost:best.cost, placed:best.sim.placed, fillRate:best.sim.fillRate });
    remaining = best.sim.remaining;
  }

  return { vans, remaining:[], stats:{
    usedVans:vans.length,
    unplacedCount:0,
    totalCost:vans.reduce((s,v)=>s+v.cost,0),
  }};
}

function compareKey(a,b){
  for(let i=0;i<Math.min(a.length,b.length);i++){
    if(a[i]>b[i]) return 1;
    if(a[i]<b[i]) return -1;
  }
  return 0;
}
