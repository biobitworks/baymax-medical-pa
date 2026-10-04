import React,{createContext,useContext} from 'react';
import {interpolate} from 'remotion';

// Scene-local frames: arrive, press, then change state. Holds follow each action.
export const events:Record<string,Record<string,number>>={
 'onboarding:0':{'Stay on top of medications':20,'Prepare for appointments':45,'Set my goals':82},
 'onboarding:1':{'Choose files':25},
 'onboarding:2':{'Review details':35,'Save and continue':78},
 'welcome:1':{'Let’s take care of you':32},
 'welcome:2':{'Today':50},
 'care:0':{'Send':32},
 'care:2':{'Write down my symptoms':12,'Review my medication list':32,'Check in for today':56},
 'care:3':{'Good':20,'Save my check-in':58},
 'care:4':{'Today':62},
 'care:5':{'Water':12},
 'travel:0':{'Prepare checklist':62},
 'travel:2':{'Confirm remaining supply with your clinician':12,'Bring prescription and medication packaging':28,'Open doctor brief':51},
 'prescription:1':{'travel':14,'Plus':37,'Review demo order':72},
 'prescription:3':{'Consent':10,'Confirm demo order':30},
 'brief:1':{'Review email':34},
 'brief:3':{'Email consent':14,'Open email app':42},
};
const Interaction=createContext({frame:0,actions:{} as Record<string,number>});
export const InteractionProvider=({scene,step,frame,children}:{scene:string;step:number;frame:number;children:React.ReactNode})=><Interaction.Provider value={{frame,actions:events[`${scene}:${step}`]??{}}}>{children}</Interaction.Provider>;
export const at=(scene:string,step:number,key:string)=>events[`${scene}:${step}`]?.[key]??Infinity;
export function Cue({id}:{id:string}){
 const {frame,actions}=useContext(Interaction);const click=actions[id];
 if(click===undefined||frame<click-11||frame>click+9)return null;
 const move=interpolate(frame,[click-11,click-3],[1,0],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
 const pressed=frame>=click&&frame<click+4;
 return <span className="demo-cue" style={{transform:`translate(${move*65}px,${move*40}px) scale(${pressed?.85:1})`,opacity:interpolate(frame,[click+5,click+9],[1,0],{extrapolateLeft:'clamp',extrapolateRight:'clamp'})}}>{pressed&&<i/>}<svg width="34" height="42" viewBox="0 0 34 42"><path d="M3 2L28 24L17 25L12 36Z" fill="#283f34" stroke="white" strokeWidth="3" strokeLinejoin="round"/></svg></span>;
}
