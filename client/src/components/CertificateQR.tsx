import { useRef } from 'react';
import { Download } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import type { CertificateRecord } from '../utils/auth';

interface CertificateQRProps {
    certificate: CertificateRecord;
}

export default function CertificateQR({ certificate }: CertificateQRProps) {
    const qrRef = useRef<HTMLDivElement>(null);
    const verificationUrl = `https://aethrix-ai.com/verify-certificate?id=${encodeURIComponent(certificate.id)}`;
    const qrData = [
        "AETHRIX",
        "CERTIFICATE",
        certificate.id,
        certificate.candidateName,
        certificate.examName,
        certificate.grade,
        certificate.passStatus === "pass" ? "PASS" : "FAIL",
        verificationUrl,
    ].join("|");

    function handleDownloadQr() {
        const canvas = qrRef.current?.querySelector('canvas');
        if (!canvas) return;

        const link = document.createElement('a');
        link.download = `certificate-qr-${certificate.id}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    }

    return (
        <div className="certificate-qr-container">
            <div className="qr-wrapper" ref={qrRef}>
                <QRCodeCanvas
                    value={qrData}
                    size={420}
                    bgColor="#ffffff"
                    fgColor="#000000"
                    level="H"
                    includeMargin={true}
                    imageSettings={{
                        src: "https://aethrix-ai.com/favicon.ico",
                        x: undefined,
                        y: undefined,
                        height: 24,
                        width: 24,
                        excavate: true,
                    }}
                />
            </div>
            <div className="qr-details">
                <p className="qr-text">Scan to verify certificate</p>
                <p className="qr-id">ID: {certificate.id}</p>
                <p className="qr-subtext">{certificate.examName} — {certificate.examType}</p>
                <p className="qr-subtext">Score: {certificate.score}/{certificate.totalScore} • Grade: {certificate.grade}</p>
                <button type="button" className="secondary-cta qr-download-button" onClick={handleDownloadQr}>
                    <Download size={16} />
                    Download QR
                </button>
            </div>
        </div>
    );
}
