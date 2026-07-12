import { Link } from "react-router-dom";
import { ArrowLeft, Mail, Phone, MapPin, GitBranch, Globe2 } from "lucide-react";
import ThemeToggle from "../components/ThemeToggle";

const socialLinks = [
    { label: "LinkedIn", href: "https://www.linkedin.com/in/sreeganeshyerraballi/", icon: GitBranch },
    { label: "GitHub", href: "https://github.com/your-profile", icon: GitBranch },
    { label: "Website", href: "https://aethrix-ai.com", icon: Globe2 },
];

export default function Contact() {
    return (
        <main className="dashboard-page">
            <header className="dashboard-header">
                <Link to="/" className="back-link">
                    <ArrowLeft size={18} /> Home
                </Link>
                <div>
                    <span>AETHRIX AI</span>
                    <h1>Contact & support</h1>
                    <p>Need help with your interview journey, assessments, or certificate verification?</p>
                </div>
                <div className="dashboard-actions">
                    <ThemeToggle />
                    <Link to="/login" className="ghost-link">Sign in</Link>
                </div>
            </header>

            <section className="dashboard-grid contact-grid">
                <article className="dash-card contact-card">
                    <span className="card-kicker">Support</span>
                    <h2>Reach out to our team</h2>
                    <p>For account help, assessment support, or partnership inquiries, contact our founder directly.</p>
                    <div className="contact-list">
                        <div>
                            <Mail size={18} />
                            <a href="mailto:sreeganeshyerraballi@gmail.com">sreeganeshyerraballi@gmail.com</a>
                        </div>
                        <div>
                            <Phone size={18} />
                            <a href="tel:+918885368042">+91 88853 68042</a>
                        </div>
                        <div>
                            <MapPin size={18} />
                            <span>India / Remote support</span>
                        </div>
                    </div>
                </article>

                <article className="dash-card contact-card">
                    <span className="card-kicker">Social</span>
                    <h2>Stay connected</h2>
                    <p>Follow the product, get updates, and connect with the team on these channels.</p>
                    <div className="provider-links">
                        {socialLinks.map(({ label, href, icon: Icon }) => (
                            <a key={label} href={href} target="_blank" rel="noreferrer" className="provider-link">
                                <Icon size={18} />
                                <span>{label}</span>
                            </a>
                        ))}
                    </div>
                </article>
            </section>
        </main>
    );
}
