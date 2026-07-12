import { Award, Calendar, TrendingUp } from "lucide-react";
import { getSessionCertificates } from "../utils/auth";

interface SessionCertificatesProps {
    email?: string;
}

export default function SessionCertificates({ email }: SessionCertificatesProps) {
    const certificates = email ? getSessionCertificates(email) : [];

    if (certificates.length === 0) return null;

    return (
        <article className="dash-card session-cert-card">
            <span className="card-kicker">This Session</span>
            <h2 className="section-title-row">
                <Award size={24} />
                Certificates Earned
            </h2>
            <p>You earned {certificates.length} certificate{certificates.length !== 1 ? "s" : ""} in this session</p>

            <div className="session-cert-list">
                {certificates.map((cert, index) => (
                    <div className="session-cert-item" key={cert.id}>
                        <div>
                            <div className="session-cert-title">
                                <span>{index + 1}</span>
                                <strong>{cert.examName}</strong>
                            </div>
                            <p>{cert.examType} - {new Date(cert.completedDate).toLocaleDateString()}</p>
                        </div>

                        <div className="session-cert-score">
                            <span><TrendingUp size={14} /> {cert.score}/{cert.totalScore}</span>
                            <small>Grade: <strong>{cert.grade}</strong></small>
                        </div>
                    </div>
                ))}
            </div>

            <div className="session-cert-footer">
                <Calendar size={14} />
                Session started: {new Date().toLocaleDateString()}
            </div>
        </article>
    );
}
