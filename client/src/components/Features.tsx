import { BookOpen, BrainCircuit, Code2, FileCheck2, MessagesSquare, TrendingUp } from "lucide-react";

const features = [
  {
    icon: BrainCircuit,
    title: "AI-powered assessments",
    text: "Evaluate technical and soft skills with tailored questions generated from candidate performance.",
  },
  {
    icon: Code2,
    title: "Coding and aptitude testing",
    text: "Measure problem-solving, logic, and programming strength through structured challenges.",
  },
  {
    icon: MessagesSquare,
    title: "Communication review",
    text: "Capture verbal and written communication insights through interviews and structured prompts.",
  },
  {
    icon: FileCheck2,
    title: "Project-based evaluation",
    text: "Assess practical understanding and real-world readiness with role-relevant assignments.",
  },
  {
    icon: BookOpen,
    title: "Personalized learning paths",
    text: "Turn assessment outcomes into resource recommendations and targeted growth plans.",
  },
  {
    icon: TrendingUp,
    title: "Recruiter-ready reporting",
    text: "Generate professional reports, feedback summaries, and downloadable certificates with ease.",
  },
];

export default function Features() {
  return (
    <section className="features-section" id="platform" style={{ scrollMarginTop: "100px" }}>
      <div className="section-heading">
        <span>Platform</span>
        <h2>Everything feels focused, calm, and ready for meaningful assessment work.</h2>
      </div>
      <div className="feature-grid">
        {features.map((feature) => {
          const Icon = feature.icon;

          return (
            <article className="feature-card" key={feature.title}>
              <span className="feature-icon">
                <Icon size={22} />
              </span>
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
