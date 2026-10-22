import { Link } from "wouter";
import { ArrowUpRight, UserRound, Radar, Target, BookOpen, Globe2, GitBranch, GraduationCap, Archive, GitCompareArrows } from "lucide-react";
import { useJourney } from "@/lib/journey";

const features = [
  { id:"profile", number:"01", title:"Start with your story", description:"Add the skills you’ve tried, what interests you and the time you have. No CV or perfect starting point needed.", action:"Shape your profile", href:"/profile", icon:UserRound },
  { id:"radar", number:"02", title:"Signals on the horizon", description:"Read dated global signals for rising and declining skills and roles. Evidence first; no vacancy predictions.", action:"Open the radar", href:"/radar", icon:Radar },
  { id:"matches", number:"03", title:"Roles to explore", description:"See five explainable role matches, what you already bring and the skills you might build next.", action:"See possible roles", href:"/matches", icon:Target },
  { id:"pathway", number:"04", title:"A plan at your pace", description:"Turn one role into ordered learning steps, time estimates, resources and a checklist saved here.", action:"Open your plan", href:"/pathway", icon:BookOpen },
  { id:"goals", number:"05", title:"Work with purpose", description:"Browse all 17 Sustainable Development Goals and possible contributions from skills and roles.", action:"Explore the goals", href:"/goals", icon:Globe2 },
  { id:"scenarios", number:"06", title:"Try another future", description:"Change the assumptions behind your matches and plan. Three plausible lenses, not predictions.", action:"Compare futures", href:"/scenarios", icon:GitBranch },
];

export function DashboardTools() {
  const { profile } = useJourney();
  return <>
    <section className="dashboard-tools" aria-labelledby="dashboard-tools-heading">
      <div className="dashboard-section-heading"><div><p className="fieldnotes-eyebrow">YOUR CAREER INTELLIGENCE</p><h2 id="dashboard-tools-heading">Choose where to begin.</h2></div><p>{profile ? `${profile.skills.length} assessed skills · ${profile.hours_per_week} learning hours per week` : "Start with your profile, or explore the evidence and pathways at your own pace."}</p></div>
      <div className="dashboard-grid">{features.map(item=><Link href={item.href} key={item.id} data-testid={`link-dashboard-${item.id}`} className={`dashboard-card ${item.id === "profile" ? "dashboard-card-featured" : ""}`}><div className="dashboard-card-top"><span>{item.number} / CAREER JOURNEY</span><item.icon size={23}/></div><h3>{item.title}</h3><p>{item.description}</p><span className="dashboard-card-action">{item.id === "profile" && profile ? "Edit your profile" : item.action}<ArrowUpRight size={19}/></span></Link>)}</div>
    </section>
    <section className="dashboard-extras" aria-label="More career tools"><p className="fieldnotes-eyebrow">MORE TO EXPLORE</p><div>{[
      {id:"courses",title:"Course finder",description:"Browse the learning catalog",href:"/courses",icon:GraduationCap},
      {id:"skills",title:"Historical skills",description:"Explore Malaysian posting evidence",href:"/skills",icon:Archive},
      {id:"compare",title:"Compare roles",description:"See shared and distinct skills",href:"/compare",icon:GitCompareArrows},
    ].map(item=><Link key={item.id} href={item.href} data-testid={`link-dashboard-${item.id}`}><item.icon size={20}/><span><strong>{item.title}</strong><span>{item.description}</span></span><ArrowUpRight size={17}/></Link>)}</div></section>
    <p className="dashboard-footnote">Your profile and checklist live in this browser. Recommendations are estimates; sources, dates and assumptions stay beside the evidence.</p>
  </>;
}
