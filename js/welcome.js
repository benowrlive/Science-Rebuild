import { el, mount } from "./el.js";
import { icon as svgIcon } from "./icons.js";
import { setPref } from "./state.js";
export async function welcome(){
  const c=await fetch("content/welcome.json").then(r=>r.json()).catch(()=>({steps:[{headline:"Welcome",body:"Learn science by operating it."}],cta:"Start",note:""}));
  let s=0;const h=el("div");
  function p(){
    const d=c.steps[s],last=s>=c.steps.length-1;
    mount(h,el("section",{class:"welcome","data-world":"origins"},
      el("img",{class:"owner-mark",src:"assets/publisher-mark.png",width:320,height:320,alt:"",decoding:"async"}),
      el("div",{class:"welcome-progress"},...c.steps.map((_,i)=>el("span",{class:`welcome-dot${i<=s?" welcome-dot--done":""}`}))),
      el("h1",{class:"welcome-h",text:d.headline}),
      el("p",{class:"lede",text:d.body}),
      last&&c.note?el("p",{class:"welcome-note",text:c.note}):null,
      el("button",{class:"next-btn pressable m-attend","data-world":"origins",
        onclick:()=>{if(last){setPref("greeted","1");location.hash = "#/"}else{s++;p()}}},
        el("span",{text:last?(c.cta??"Start"):"Next"}),svgIcon("next"))))
  }
  p();return[h];
}
