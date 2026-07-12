import { useState } from "react";

export default function FloatingRobot() {
    const [showImage, setShowImage] = useState(true);
    return (
        <div className="floating-robot" aria-hidden="true">
            {showImage ? (
                // try to load a public image at /robot.png (place file in client/public/robo.png)
                // falls back to inline SVG if loading fails
                // eslint-disable-next-line jsx-a11y/img-redundant-alt
                <img
                    src="/robot.png"
                    alt="robot"
                    className="robot-img"
                    onError={() => setShowImage(false)}
                    onLoad={() => setShowImage(true)}
                    style={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
            ) : (
                <svg className="robot-svg" viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                    <defs>
                        <linearGradient id="g1" x1="0" x2="1">
                            <stop offset="0" stopColor="#65fff0" />
                            <stop offset="1" stopColor="#6fa8ff" />
                        </linearGradient>
                        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                            <feDropShadow dx="0" dy="10" stdDeviation="16" floodColor="#0b9caa" floodOpacity="0.08" />
                        </filter>
                    </defs>

                    <g filter="url(#shadow)">
                        <ellipse cx="80" cy="128" rx="34" ry="8" fill="rgba(0,0,0,0.32)" />
                    </g>

                    <g transform="translate(20,20)">
                        <rect x="20" y="36" width="80" height="64" rx="14" fill="#0d1420" stroke="url(#g1)" strokeWidth="2" />

                        <circle className="robot-head" cx="60" cy="28" r="28" fill="#07101a" stroke="url(#g1)" strokeWidth="3" />

                        <g className="robot-eye" transform="translate(44,20)">
                            <circle cx="12" cy="12" r="10" fill="#001219" />
                            <circle cx="12" cy="12" r="5" fill="#6ff0e0" />
                        </g>

                        <rect x="52" y="76" width="16" height="8" rx="4" fill="#0b9caa" />

                        <g className="antenna" transform="translate(64,2)">
                            <line x1="0" y1="0" x2="0" y2="12" stroke="#6fa8ff" strokeWidth="2" strokeLinecap="round" />
                            <circle cx="0" cy="-2" r="4" fill="#65fff0" />
                        </g>
                    </g>
                </svg>
            )}
        </div>
    );
}
