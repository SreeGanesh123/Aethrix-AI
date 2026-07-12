import { useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowLeft, CheckCircle2, Download, Upload } from "lucide-react";
import { Link } from "react-router-dom";
import jsQR from "jsqr";
import { QRCodeCanvas } from "qrcode.react";
import ThemeToggle from "../components/ThemeToggle";
import { summarizeCertificateWithAI, type CertificateSummaryResult } from "../services/aiService";

interface CertificateData {
    id: string;
    name: string;
    email: string;
    exam: string;
    examType: string;
    score: number;
    totalScore: number;
    grade: string;
    status: "pass" | "fail";
    passStatus?: "pass" | "fail";
    date: string;
    issued: string;
    issuer?: string;
    verified?: boolean;
    note?: string;
    verificationUrl?: string;
    supportEmail?: string;
    supportPhone?: string;
}

function tryDecodeQrFromCanvas(canvas: HTMLCanvasElement): string | null {
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const tryDecode = (targetCanvas: HTMLCanvasElement) => {
        const targetCtx = targetCanvas.getContext("2d");
        if (!targetCtx) return null;

        const imageData = targetCtx.getImageData(0, 0, targetCanvas.width, targetCanvas.height);
        return jsQR(imageData.data, imageData.width, imageData.height)?.data ?? null;
    };

    const original = tryDecode(canvas);
    if (original) return original;

    const processedCanvas = document.createElement("canvas");
    processedCanvas.width = canvas.width;
    processedCanvas.height = canvas.height;
    const processedCtx = processedCanvas.getContext("2d");
    if (processedCtx) {
        processedCtx.drawImage(canvas, 0, 0);
        const imageData = processedCtx.getImageData(0, 0, processedCanvas.width, processedCanvas.height);
        const data = imageData.data;

        for (let index = 0; index < data.length; index += 4) {
            const gray = (data[index] + data[index + 1] + data[index + 2]) / 3;
            const value = gray > 128 ? 255 : 0;
            data[index] = value;
            data[index + 1] = value;
            data[index + 2] = value;
        }

        processedCtx.putImageData(imageData, 0, 0);
        const processed = tryDecode(processedCanvas);
        if (processed) return processed;
    }

    const scaledCanvas = document.createElement("canvas");
    scaledCanvas.width = Math.min(1200, canvas.width * 2);
    scaledCanvas.height = Math.min(1200, canvas.height * 2);
    const scaledCtx = scaledCanvas.getContext("2d");
    if (scaledCtx) {
        scaledCtx.drawImage(canvas, 0, 0, scaledCanvas.width, scaledCanvas.height);
        const scaled = tryDecode(scaledCanvas);
        if (scaled) return scaled;
    }

    return null;
}

export default function VerifyCertificate() {
    const [scannedData, setScannedData] = useState<CertificateData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [aiSummary, setAiSummary] = useState<CertificateSummaryResult | null>(null);
    const [summaryLoading, setSummaryLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const qrCanvasContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!scannedData) {
            setAiSummary(null);
            return;
        }

        let isMounted = true;
        setSummaryLoading(true);
        summarizeCertificateWithAI({ certificate: scannedData })
            .then((summary) => {
                if (isMounted) setAiSummary(summary);
            })
            .catch((summaryError) => {
                console.error("Certificate AI summary failed:", summaryError);
            })
            .finally(() => {
                if (isMounted) setSummaryLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [scannedData]);

    async function handleImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file) return;

        setLoading(true);
        setError(null);

        const objectUrl = URL.createObjectURL(file);
        const img = new Image();
        img.onload = async () => {
            try {
                const canvas = document.createElement("canvas");
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext("2d");
                if (!ctx) {
                    setError("Failed to process image");
                    setLoading(false);
                    URL.revokeObjectURL(objectUrl);
                    return;
                }

                ctx.drawImage(img, 0, 0);
                const decodedText = tryDecodeQrFromCanvas(canvas);

                if (!decodedText) {
                    setError("No QR code found in image. Try a clearer, higher-contrast image of the QR code.");
                    setLoading(false);
                    URL.revokeObjectURL(objectUrl);
                    return;
                }

                try {
                    setScannedData(JSON.parse(decodedText) as CertificateData);
                } catch {
                    const parsed = parseCertificateText(decodedText);
                    if (parsed) {
                        setScannedData(parsed);
                    } else {
                        setError("Invalid QR code data");
                    }
                }
            } catch {
                setError("Unable to read the QR code from this image.");
            } finally {
                setLoading(false);
                URL.revokeObjectURL(objectUrl);
            }
        };

        img.onerror = () => {
            setError("Failed to load image");
            setLoading(false);
            URL.revokeObjectURL(objectUrl);
        };

        img.src = objectUrl;
    }

    function parseCertificateText(text: string): CertificateData | null {
        const trimmedText = text.trim();
        if (!trimmedText) return null;

        const pipeParts = trimmedText.split("|").map((part) => part.trim()).filter(Boolean);
        if (pipeParts.length >= 7) {
            const [prefix, certificateType, id, name, exam, grade, status, verificationUrl] = pipeParts;
            const normalizedPrefix = prefix?.toLowerCase();
            if (normalizedPrefix !== "aethrix" && normalizedPrefix !== "aethrix ai") {
                return null;
            }

            const normalizedStatus = status?.toLowerCase().includes("pass") ? "pass" : "fail" as const;
            return {
                id: id ?? "",
                name: name ?? "",
                email: "",
                exam: exam ?? "",
                examType: certificateType ?? "Certificate",
                score: 0,
                totalScore: 0,
                grade: grade ?? "N/A",
                status: normalizedStatus,
                passStatus: normalizedStatus,
                date: new Date().toISOString(),
                issued: new Date().toISOString(),
                issuer: "AETHRIX AI / Inventra",
                verified: normalizedStatus === "pass",
                note: "Verified from QR payload",
                verificationUrl: verificationUrl || undefined,
                supportEmail: "support@aethrix-ai.com",
                supportPhone: "+91 88853 68042",
            };
        }

        const lines = trimmedText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
        const map = new Map<string, string>();
        const normalizeKey = (key: string) => key.toLowerCase().replace(/[^a-z0-9]+/g, "");

        for (const line of lines) {
            if (/^https?:\/\//i.test(line)) {
                map.set("verificationurl", line);
                continue;
            }

            const separatorIndex = line.indexOf(":");
            if (separatorIndex === -1) continue;

            const key = line.slice(0, separatorIndex).trim();
            const value = line.slice(separatorIndex + 1).trim();
            map.set(normalizeKey(key), value);
        }

        const id = map.get("certificateid") ?? map.get("id");
        const name = map.get("candidatename") ?? map.get("candidate") ?? map.get("name");
        const email = map.get("candidateemail") ?? map.get("email");
        const exam = map.get("examname") ?? map.get("exam");
        const examType = map.get("examtype") ?? map.get("type");
        const scoreText = map.get("score");
        if (!id || !name || !email || !exam || !examType || !scoreText) return null;

        const [scorePart] = scoreText.split("(");
        const [scoreValue, totalValue] = scorePart.split("/").map((part) => Number(part.trim()));
        if (Number.isNaN(scoreValue) || Number.isNaN(totalValue)) return null;

        const statusText = map.get("status") ?? "fail";
        const normalizedStatus = statusText.toLowerCase().includes("pass") ? "pass" : "fail" as const;
        const supportValue = map.get("support");
        const supportParts = supportValue?.split("|").map((part) => part.trim()).filter(Boolean) ?? [];

        return {
            id,
            name,
            email,
            exam,
            examType,
            score: scoreValue,
            totalScore: totalValue,
            grade: map.get("grade") ?? "N/A",
            status: normalizedStatus,
            passStatus: normalizedStatus,
            date: map.get("completed") ?? map.get("completiondate") ?? new Date().toISOString(),
            issued: map.get("issued") ?? new Date().toISOString(),
            issuer: map.get("issuer") || undefined,
            verified: statusText.toLowerCase().includes("pass"),
            note: map.get("note") || undefined,
            verificationUrl: map.get("verificationurl") || undefined,
            supportEmail: supportParts[0] || map.get("supportemail") || undefined,
            supportPhone: supportParts[1] || undefined,
        };
    }

    const percentage = scannedData ? Math.round((scannedData.score / scannedData.totalScore) * 100) : 0;

    function handleDownloadQr() {
        if (!scannedData) return;

        const canvas = qrCanvasContainerRef.current?.querySelector("canvas");
        if (!canvas) return;

        const link = document.createElement("a");
        link.download = `certificate-qr-${scannedData.id}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
    }

    const qrPayload = scannedData
        ? [
            "AETHRIX AI Certificate Verification",
            scannedData.verificationUrl ?? `https://aethrix-ai.com/verify-certificate?id=${encodeURIComponent(scannedData.id)}`,
            `Certificate ID: ${scannedData.id}`,
            `Candidate Name: ${scannedData.name}`,
            `Candidate Email: ${scannedData.email}`,
            `Exam Name: ${scannedData.exam}`,
            `Exam Type: ${scannedData.examType}`,
            `Score: ${scannedData.score}/${scannedData.totalScore}`,
            `Percentage: ${percentage}%`,
            `Grade: ${scannedData.grade}`,
            `Status: ${scannedData.status.toUpperCase()}`,
            `Completed: ${new Date(scannedData.date).toLocaleDateString()}`,
            `Issued: ${new Date(scannedData.issued).toLocaleDateString()}`,
            `Issuer: ${scannedData.issuer ?? "AETHRIX AI / Inventra"}`,
            `Support: ${scannedData.supportEmail ?? "support@aethrix-ai.com"}${scannedData.supportPhone ? ` | ${scannedData.supportPhone}` : ""}`,
            "Note: Scan the QR code to verify certificate details online.",
        ].join("\r\n")
        : "";

    return (
        <main className="auth-page">
            <div className="page-topbar">
                <Link to="/" className="back-link">
                    <ArrowLeft size={18} /> Back to home
                </Link>
                <ThemeToggle />
            </div>

            <section className="auth-shell verify-shell">
                <div className="auth-panel verify-panel">
                    <span className="eyebrow">Verify Certificate</span>
                    <h1>Certificate Verification</h1>
                    <p>Upload a QR code image from a certificate to verify its authenticity.</p>

                    {!scannedData && (
                        <div className="certificate-upload">
                            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} hidden />
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={loading}
                                className="primary-cta full-width"
                            >
                                <Upload size={18} />
                                {loading ? "Processing..." : "Upload QR Code Image"}
                            </button>

                            {error && (
                                <div className="status-callout status-callout--error">
                                    <AlertCircle size={20} />
                                    <span>{error}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {scannedData && (
                        <div className="certificate-details">
                            <div className="status-callout status-callout--success">
                                <CheckCircle2 size={22} />
                                <span>Certificate Verified</span>
                            </div>

                            <div className="status-callout status-callout--success">
                                <CheckCircle2 size={20} />
                                <span>QR payload recognized from the student certificate format.</span>
                            </div>

                            <div className="verify-actions">
                                <button type="button" onClick={handleDownloadQr} className="secondary-cta">
                                    <Download size={18} />
                                    Download QR
                                </button>
                                <div ref={qrCanvasContainerRef} className="qr-download-preview" aria-hidden="true">
                                    <QRCodeCanvas value={qrPayload} size={256} level="H" includeMargin />
                                </div>
                            </div>

                            <div className="verify-card">
                                <div className="verify-card-header">
                                    <div>
                                        <span className="card-kicker">Verified certificate</span>
                                        <h2>{scannedData.exam}</h2>
                                        <p>{scannedData.examType}</p>
                                    </div>
                                    <div className="verify-issuer">
                                        <span>Issued by</span>
                                        <strong>{scannedData.issuer ?? "AETHRIX AI / Inventra"}</strong>
                                        <p>{new Date(scannedData.issued).toLocaleDateString()}</p>
                                    </div>
                                </div>

                                <div className="verify-info-grid">
                                    <div className="verify-info-tile">
                                        <span>Candidate</span>
                                        <strong>{scannedData.name}</strong>
                                        <p>{scannedData.email}</p>
                                    </div>
                                    <div className="verify-info-tile">
                                        <span>Certificate ID</span>
                                        <strong>{scannedData.id}</strong>
                                        <p>Completed on {new Date(scannedData.date).toLocaleDateString()}</p>
                                    </div>
                                    <div className="verify-info-tile">
                                        <span>Issued on</span>
                                        <strong>{new Date(scannedData.issued).toLocaleDateString()}</strong>
                                        <p>Verified by secure QR scan</p>
                                    </div>
                                </div>

                                <div className="verify-metric-grid">
                                    <div className="verify-metric">
                                        <span>Score</span>
                                        <strong>{scannedData.score}/{scannedData.totalScore}</strong>
                                        <p>{percentage}%</p>
                                    </div>
                                    <div className="verify-metric">
                                        <span>Grade</span>
                                        <strong>{scannedData.grade}</strong>
                                    </div>
                                    <div className="verify-metric">
                                        <span>Status</span>
                                        <strong className={scannedData.status === "pass" ? "status-pass" : "status-fail"}>
                                            {scannedData.status.toUpperCase()}
                                        </strong>
                                    </div>
                                </div>

                                <div className="verify-card-meta">
                                    <div className="verify-card-meta-item">
                                        <span>Verification URL</span>
                                        <p><a href={scannedData.verificationUrl ?? "#"} target="_blank" rel="noreferrer">{scannedData.verificationUrl ?? "Not provided"}</a></p>
                                    </div>
                                    <div className="verify-card-meta-item">
                                        <span>Support</span>
                                        <p>{scannedData.supportEmail ?? "support@aethrix-ai.com"}</p>
                                        {scannedData.supportPhone && <p>{scannedData.supportPhone}</p>}
                                    </div>
                                    <div className="verify-card-meta-item">
                                        <span>Reference</span>
                                        <p>{scannedData.passStatus ? `Official record ${scannedData.passStatus.toUpperCase()}` : "Verified certificate record"}</p>
                                    </div>
                                </div>

                                <div className="verify-note">
                                    <h3>Certificate preview</h3>
                                    <p>
                                        This certificate confirms that <strong>{scannedData.name}</strong> successfully completed the <strong>{scannedData.exam}</strong> assessment on <strong>{new Date(scannedData.date).toLocaleDateString()}</strong>, with performance validated by AETHRIX AI.
                                    </p>
                                </div>

                                {scannedData.note && (
                                    <div className="verify-note verify-note--accent">
                                        <span>Verification note</span>
                                        <p>{scannedData.note}</p>
                                    </div>
                                )}

                                <div className="verify-footer-grid">
                                    {scannedData.verificationUrl && (
                                        <div>
                                            <span>Verification URL</span>
                                            <p><a href={scannedData.verificationUrl} target="_blank" rel="noreferrer">{scannedData.verificationUrl}</a></p>
                                        </div>
                                    )}
                                    {scannedData.supportEmail && (
                                        <div>
                                            <span>Support email</span>
                                            <p>{scannedData.supportEmail}</p>
                                        </div>
                                    )}
                                    {scannedData.supportPhone && (
                                        <div>
                                            <span>Support phone</span>
                                            <p>{scannedData.supportPhone}</p>
                                        </div>
                                    )}
                                </div>

                                <div className="ai-result-block">
                                    <strong>{summaryLoading ? "Generating AI verification summary..." : "AI verification summary"}</strong>
                                    {aiSummary ? (
                                        <>
                                            <p>{aiSummary.summary}</p>
                                            <div className="ai-chip-row">
                                                {aiSummary.skills.map((skill) => <span key={skill}>{skill}</span>)}
                                            </div>
                                            <p>{aiSummary.interpretation}</p>
                                        </>
                                    ) : !summaryLoading ? (
                                        <p>No AI summary available yet.</p>
                                    ) : null}
                                </div>

                            </div>

                            <button
                                type="button"
                                onClick={() => {
                                    setScannedData(null);
                                    setError(null);
                                }}
                                className="primary-cta full-width"
                            >
                                Verify Another Certificate
                            </button>
                        </div>
                    )}
                </div>
            </section>
        </main>
    );
}
