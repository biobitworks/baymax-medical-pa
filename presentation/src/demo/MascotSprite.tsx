import {assetFile} from './asset';
import React from 'react';
import {useCurrentFrame,useVideoConfig} from 'remotion';
export const MascotSprite:React.FC<{size?:number;greeting?:boolean}>=({size=540,greeting=false})=>{
 const f=useCurrentFrame();const {fps}=useVideoConfig();
 const durations=greeting?[300,130,180,220,160,300]:[1300,240,240,110,240,1100];
 const total=durations.reduce((a,b)=>a+b,0);let ms=f/fps*1000%total;let index=0;
 while(index<durations.length-1 && ms>=durations[index]){ms-=durations[index];index++}
 return <div style={{position:'relative',zIndex:1,width:size,height:size,backgroundImage:`url(${assetFile(`mascot/${greeting?'greeting':'idle'}.webp`)})`,backgroundSize:'300% 200%',backgroundPosition:`${index%3*50}% ${Math.floor(index/3)*100}%`,backgroundRepeat:'no-repeat'}}/>;
};
