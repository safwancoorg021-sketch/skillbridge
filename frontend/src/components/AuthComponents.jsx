import { useEffect, useRef, useState } from "react";
import { GOOGLE_CLIENT_ID } from "../services/googleAuth.js";
import { SkillBridgeLogo } from "./SkillBridgeLogo.jsx";

export function Icon({name="mark",size=18}){
 const shapes={
  mark:<><path d="M3 10.5 12 5l9 5.5-9 5.5-9-5.5Z"/><path d="M7 13v4c3.2 2.4 6.8 2.4 10 0v-4M21 11v6"/></>,
  mail:<><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></>,
  lock:<><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></>,
  eye:<><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></>,
  eyeOff:<><path d="m3 3 18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A11 11 0 0 1 12 5c6.4 0 10 7 10 7a15.5 15.5 0 0 1-4 4.8M6.6 6.6A15.5 15.5 0 0 0 2 12s3.6 7 10 7c1.3 0 2.5-.3 3.6-.8"/></>,
  search:<><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></>,
  shield:<><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/></>,
  grid:<><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  people:<><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM20 8v6M23 11h-6"/></>,
  book:<><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 1 4 17.5v-12ZM4 17.5A2.5 2.5 0 0 1 6.5 15H20"/></>,
  card:<><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3"/></>,
  tag:<><path d="m20 13-7 7-10-10V3h7l10 10Z"/><circle cx="7.5" cy="7.5" r="1"/></>,
  chart:<><path d="M4 19V5m0 14h17M8 15l3-4 3 2 5-7"/></>,
  support:<><path d="M3 13v-2a9 9 0 0 1 18 0v2M3 13h4v7H5a2 2 0 0 1-2-2v-5Zm18 0h-4v7h2a2 2 0 0 0 2-2v-5Z"/></>,
  settings:<><circle cx="12" cy="12" r="3"/><path d="m19 15 1.6 1.2-1.5 2.5-1.9-.6a8 8 0 0 1-1.5.8l-.3 2h-3l-.4-2a8 8 0 0 1-1.5-.8l-1.8.6-1.5-2.5L7 15.1a8 8 0 0 1 0-1.8l-1.6-1.2 1.5-2.5 1.8.6a8 8 0 0 1 1.5-.8l.4-2h3l.3 2a8 8 0 0 1 1.5.8l1.9-.6 1.5 2.5-1.6 1.2a8 8 0 0 1 0 1.7Z"/></>,
  logout:<><path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7"/></>,
  arrow:<><path d="M5 12h14m-6-6 6 6-6 6"/></>
 };
 return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{shapes[name]||shapes.mark}</svg>
}

export function Brand(){return <SkillBridgeLogo className="brand-lockup" size="medium" theme="inverse"/>}

export function Hero({admin=false}){return <section className="auth-hero"><div className="hero-top"><Brand/><span className="portal-badge"><i className="dot"/>{admin?"ADMINISTRATOR PORTAL":"STUDENT LEARNING PORTAL"}</span></div><div className="hero-copy"><span className="eyebrow"><i className="dot"/>{admin?"PLATFORM OPERATIONS":"ADMISSIONS OPEN · BATCH OF 2026"}</span><h1>{admin?<>Manage learning,<br/>with confidence.</>:"Unlock Your Learning Potential"}</h1><p>{admin?"A secure workspace for managing the SkillBridge learning community.":"Master high-demand tech stacks, build industry-standard capstones, and get career-ready with daily mentor office hours."}</p>{!admin&&<div className="skill-tags"><span>Full Stack MERN</span><span>Distributed Systems</span><span>Kubernetes & DevOps</span><span>Applied LLMs</span></div>}</div>{!admin&&<div className="hero-stats"><div className="hero-stat"><strong>500+</strong><span>Specialized modules</span></div><div className="hero-stat"><strong>99.4%</strong><span>Completion rate</span></div><div className="hero-stat"><strong>Govt & ISO</strong><span>Verified credential</span></div></div>}</section>}

export function AuthTop(){return <div className="auth-topline"><span className="health"><i className="dot"/>All learning engines active</span><span className="support">Need support? <a href="mailto:support@skillbridge.edu">Contact desk</a></span></div>}

export function AuthShell({children,admin=false}){return <main className="auth-page"><div className="auth-card"><Hero admin={admin}/><section className="auth-content"><div className="auth-form-wrap">{children}<div className="security-note"><Icon name="shield"/><span>Protected by enterprise-grade encryption. Your account details stay secure.</span></div><footer className="auth-footer"><span>© 2026 SkillBridge Inc.</span><div><span>Academic integrity</span><span>System status</span></div></footer></div></section></div></main>}

export function Message({children,success=false}){return <p className={"form-message"+(success?" success":"")} role="status">{children}</p>}

export function Input({label,name,icon,...props}){
 const [passwordVisible,setPasswordVisible]=useState(false);
 const isPassword=props.type==="password",inputId=props.id||`field-${name}`;
 const inputType=isPassword&&passwordVisible?"text":props.type;
 const input=<input {...props} id={inputId} name={name} type={inputType}/>;
 return <div className="field"><label className="field-label" htmlFor={inputId}>{label}</label>{icon||isPassword?<span className={`input-wrap${icon?" has-icon":""}${isPassword?" has-password-toggle":""}`}>{icon&&<Icon name={icon} />}{input}{isPassword&&<button className="password-visibility" type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>setPasswordVisible(value=>!value)} aria-label={passwordVisible?"Hide password":"Show password"} aria-pressed={passwordVisible} title={passwordVisible?"Hide password":"Show password"}><Icon name={passwordVisible?"eyeOff":"eye"} size={18}/></button>}</span>:input}</div>
}

export function GoogleButton({onSuccess,onError}){
 const mount=useRef(null);
 useEffect(()=>{let attempts=0;const timer=setInterval(()=>{if(!mount.current){clearInterval(timer);return}if(!window.google?.accounts?.id){if(++attempts>=40){clearInterval(timer);mount.current.textContent="Google sign-in did not load. Try again."}return}clearInterval(timer);if(mount.current.dataset.ready)return;mount.current.dataset.ready="true";window.google.accounts.id.initialize({client_id:GOOGLE_CLIENT_ID,callback:async r=>{try{await onSuccess(r.credential)}catch(e){onError(e.message)}}});window.google.accounts.id.renderButton(mount.current,{theme:"outline",size:"large",text:"continue_with",shape:"rectangular",width:Math.max(250,mount.current.clientWidth||400)})},250);return()=>clearInterval(timer)},[onSuccess,onError]);
 return <div id="google-button" ref={mount}/>
}

