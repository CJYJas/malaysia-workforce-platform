import type { ComponentProps } from "react";
import { ArrowUpRight, UserRound, Radar, Target, BookOpen, Globe2, GitBranch, GraduationCap, Archive, GitCompareArrows } from "lucide-react";
import "./_group.css";

// Extracted from the real DashboardTools before the notebook redesign.
// Only routing and browser-context boundaries are stubbed for this isolated baseline.
function Link({ href: _href, ...props }: ComponentProps<"a">) {
  return <a {...props} href="#" onClick={event => event.preventDefault()} />;
}
function useJourney(): { profile: { skills: unknown[]; hours_per_week: number } | null } {
  return { profile: null };
}
const features = [
  { id:"profile", number:"01", title:"Your starting point", description:"Tell us about your skills, experience and interests. No perfect CV needed.", action:"Build your profile", href:"/profile", icon:UserRound },
  { id:"radar", number:"02", title:"Future Skills Radar", description:"Explore rising and declining skills and roles, with dated sources behind each signal.", action:"Explore the radar", href:"/radar", icon:Radar },
  { id:"matches", number:"03", title:"Your role matches", description:"Find future roles that fit you, with explainable scores and a clear skills-gap breakdown.", action:"See your matches", href:"/matches", icon:Target },
  { id:"pathway", number:"04", title:"Your learning plan", description:"Follow a step-by-step reskilling pathway, with time estimates, resources and saved progress.", action:"Open your plan", href:"/pathway", icon:BookOpen },
  { id:"goals", number:"05", title:"Skills with purpose", description:"Explore the 17 Sustainable Development Goals and how your career path can contribute.", action:"Explore the SDGs", href:"/goals", icon:Globe2 },
  { id:"scenarios", number:"06", title:"Different possible futures", description:"Compare three scenario assumptions. See possibilities, not one guaranteed prediction.", action:"Explore scenarios", href:"/scenarios", icon:GitBranch },
];
export default function Current() {
  const { profile } = useJourney();
  return <div className="dashboard-baseline"><section className="dashboard-tools" aria-labelledby="dashboard-tools-heading">
    <div className="dashboard-section-heading"><div><p className="fieldnotes-eyebrow">YOUR CAREER DASHBOARD</p><h2 id="dashboard-tools-heading">Where would you like to begin?</h2></div><p>{profile ? `${profile.skills.length} skills saved · ${profile.hours_per_week} hours a week` : "Start with your profile, or explore at your own pace."}</p></div>
    <div className="dashboard-grid">{features.map(item=><Link href={item.href} key={item.id} data-testid={`link-dashboard-${item.id}`} className={`dashboard-card ${item.id === "profile" ? "dashboard-card-featured" : ""}`}><div className="dashboard-card-top"><span>{item.number} / EXPLORE</span><item.icon size={23}/></div><h3>{item.title}</h3><p>{item.description}</p><span className="dashboard-card-action">{item.id === "profile" && profile ? "Edit your profile" : item.action}<ArrowUpRight size={19}/></span></Link>)}</div>
  </section><section className="dashboard-extras" aria-label="More career tools"><p className="fieldnotes-eyebrow">DIG A LITTLE DEEPER</p><div>{[
    {id:"courses",title:"Course finder",description:"Browse the learning catalog",href:"/courses",icon:GraduationCap},
    {id:"skills",title:"Historical skills",description:"Explore Malaysian posting evidence",href:"/skills",icon:Archive},
    {id:"compare",title:"Compare roles",description:"See shared and distinct skills",href:"/compare",icon:GitCompareArrows},
  ].map(item=><Link key={item.id} href={item.href} data-testid={`link-dashboard-${item.id}`}><item.icon size={20}/><span><strong>{item.title}</strong><span>{item.description}</span></span><ArrowUpRight size={17}/></Link>)}</div></section><p className="dashboard-footnote">Your profile and progress stay in this browser. Recommendations are estimates; sources and assumptions stay visible as you explore.</p></div>;
}
