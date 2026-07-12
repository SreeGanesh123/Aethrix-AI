import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, PlayCircle } from "lucide-react";
import ThemeToggle from "../components/ThemeToggle";

type AssessmentConfig = {
    title: string;
    subtitle: string;
    description: string;
    route: string;
    queryKey: string;
    options: readonly string[];
    placeholder: string;
    note: string;
};

const assessmentConfigs: Record<string, AssessmentConfig> = {
    mcq: {
        title: "MCQ Assessment",
        subtitle: "Search a language track and continue to the exam.",
        description: "Choose the language track you want to practice before starting the MCQ exam.",
        route: "/assessment/mcq",
        queryKey: "language",
        options: ["JavaScript", "Python", "SQL"],
        placeholder: "Search a language",
        note: "Your selection will open the exam on the next page.",
    },
    coding: {
        title: "Coding Assessment",
        subtitle: "Search a language track and continue to the coding challenge.",
        description: "Choose the language track you want to use before starting the coding exam.",
        route: "/assessment/coding",
        queryKey: "language",
        options: ["JavaScript", "Python", "SQL"],
        placeholder: "Search a language",
        note: "Your selection will open the coding exam on the next page.",
    },
    "aptitude-communication": {
        title: "Aptitude & Communication",
        subtitle: "Search a focus area and continue to the assessment.",
        description: "Choose the focus area you want to practice before starting the assessment.",
        route: "/assessment/aptitude-communication",
        queryKey: "track",
        options: ["Analytical", "Communication", "Mixed"],
        placeholder: "Search a focus area",
        note: "Your selection will open the assessment on the next page.",
    },
};

export default function AssessmentStart() {
    const navigate = useNavigate();
    const { assessmentType } = useParams<{ assessmentType: string }>();
    const [searchParams] = useSearchParams();
    const config = assessmentConfigs[assessmentType ?? ""] ?? assessmentConfigs.mcq;
    const [searchValue, setSearchValue] = useState("");
    const [selectedOption, setSelectedOption] = useState(searchParams.get(config.queryKey) ?? config.options[0]);

    useEffect(() => {
        setSelectedOption(searchParams.get(config.queryKey) ?? config.options[0]);
        setSearchValue("");
    }, [assessmentType, config.options, config.queryKey, searchParams]);

    const filteredOptions = useMemo(() => {
        const normalized = searchValue.trim().toLowerCase();
        if (!normalized) return [...config.options];
        return config.options.filter((option) => option.toLowerCase().includes(normalized));
    }, [config.options, searchValue]);

    const handleStart = () => {
        const params = new URLSearchParams(searchParams);
        params.set(config.queryKey, selectedOption);
        navigate(`${config.route}?${params.toString()}`);
    };

    return (
        <main className="dashboard-page">
            <header className="dashboard-header">
                <Link to="/assessment" className="back-link">
                    <ArrowLeft size={18} />
                    Back to hub
                </Link>
                <div>
                    <span>AETHRIX AI</span>
                    <h1>{config.title}</h1>
                    <p>{config.subtitle}</p>
                </div>
                <div className="dashboard-actions">
                    <ThemeToggle />
                    <Link to="/candidate" className="ghost-link">
                        Candidate profile
                    </Link>
                </div>
            </header>

            <section className="dashboard-grid test-grid">
                <article className="dash-card test-start-card">
                    <span className="card-kicker">Assessment setup</span>
                    <h2>Search and choose a track</h2>
                    <p>{config.description}</p>

                    <label className="role-select-label" htmlFor="assessment-search">
                        {config.placeholder}
                    </label>
                    <input
                        id="assessment-search"
                        type="search"
                        className="role-select"
                        value={searchValue}
                        onChange={(event) => setSearchValue(event.target.value)}
                        placeholder={config.placeholder}
                    />

                    <div className="language-options stack-top-sm">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((option) => (
                                <button
                                    key={option}
                                    type="button"
                                    className={option === selectedOption ? "option selected" : "option"}
                                    onClick={() => setSelectedOption(option)}
                                >
                                    {option}
                                </button>
                            ))
                        ) : (
                            <p className="form-note">No matching tracks were found for that search.</p>
                        )}
                    </div>

                    <div className="profile-ready stack-top-sm">
                        <PlayCircle size={18} />
                        <span>Selected track: {selectedOption}</span>
                    </div>

                    <button type="button" className="primary-cta stack-top-md" onClick={handleStart}>
                        Start assessment
                    </button>

                    <p className="form-note">{config.note}</p>
                </article>
            </section>
        </main>
    );
}
