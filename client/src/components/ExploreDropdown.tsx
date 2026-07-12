import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";

type ExploreDropdownItem = {
    label: string;
    to: string;
};

const defaultExploreLinks: ExploreDropdownItem[] = [
    { label: "Assessment hub", to: "/assessment" },
    { label: "Candidate workspace", to: "/candidate" },
    { label: "Recruiter dashboard", to: "/recruiter" },
    { label: "Trainer dashboard", to: "/trainer" },
];

export default function ExploreDropdown({
    items = defaultExploreLinks,
}: {
    items?: ExploreDropdownItem[];
}) {
    const [open, setOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement | null>(null);
    const toggleRef = useRef<HTMLButtonElement | null>(null);
    const [portalStyle, setPortalStyle] = useState<React.CSSProperties | null>(null);
    const portalElRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };

        document.addEventListener("mousedown", handleOutsideClick);
        document.addEventListener("touchstart", handleOutsideClick);

        return () => {
            document.removeEventListener("mousedown", handleOutsideClick);
            document.removeEventListener("touchstart", handleOutsideClick);
        };
    }, []);

    // Create portal container
    useEffect(() => {
        const el = document.createElement("div");
        el.className = "explore-dropdown-portal";
        portalElRef.current = el;
        document.body.appendChild(el);
        return () => {
            if (portalElRef.current && portalElRef.current.parentElement) {
                portalElRef.current.parentElement.removeChild(portalElRef.current);
            }
            portalElRef.current = null;
        };
    }, []);

    // Position portal menu based on toggle button. On small screens use fixed full-width placement
    useEffect(() => {
        if (!open) return;
        const btn = toggleRef.current;
        if (!btn) return;

        const updatePosition = () => {
            const vw = window.innerWidth || document.documentElement.clientWidth;
            if (vw <= 900) {
                // fixed full-width panel below header
                const header = document.querySelector('.site-header') as HTMLElement | null;
                const headerBottom = header ? header.getBoundingClientRect().bottom : 72;
                const top = Math.max(12, headerBottom + 8);
                setPortalStyle({ position: 'fixed', top: `${top}px`, left: '12px', right: '12px', width: 'auto', zIndex: 99999 });
                return;
            }

            const rect = btn.getBoundingClientRect();
            const top = rect.bottom + 10 + window.scrollY;
            const left = Math.max(12, rect.left + window.scrollX);
            const width = Math.min(420, Math.max(220, rect.width + 40));
            setPortalStyle({ position: 'absolute', top: `${top}px`, left: `${left}px`, width: `${width}px`, zIndex: 99999 });
        };

        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);
        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [open]);

    const menu = (
        <div className="explore-dropdown" ref={dropdownRef}>
            <button
                ref={toggleRef}
                type="button"
                className="explore-dropdown-toggle"
                onClick={() => setOpen((value) => !value)}
                aria-expanded={open}
            >
                Explore
                <ChevronDown size={16} />
            </button>
        </div>
    );

    const dropdownMenu = open ? (
        <>
            {/* Backdrop to ensure menu is above other page content and to capture outside clicks */}
            <div
                className="explore-dropdown-backdrop"
                onClick={() => setOpen(false)}
                style={{ position: 'fixed', inset: 0, zIndex: (portalStyle && (portalStyle.zIndex as number) - 1) || 19998, background: 'transparent' }}
            />

            <div
                className="explore-dropdown-menu"
                style={{ ...(portalStyle || {}), transform: 'translateZ(0)', WebkitTransform: 'translateZ(0)' }}
                role="menu"
            >
                {items.map((item) => (
                    <Link
                        key={item.to}
                        to={item.to}
                        className="explore-dropdown-link"
                        onClick={() => setOpen(false)}
                    >
                        {item.label}
                    </Link>
                ))}
            </div>
        </>
    ) : null;

    return (
        <>
            {menu}
            {portalElRef.current && dropdownMenu && createPortal(dropdownMenu, portalElRef.current)}
        </>
    );
}
