import React, { useEffect, useRef, useState } from "react";

type Option = { id: string; label: string; icon?: React.ReactNode };

type Props = {
    options: Option[];
    value: string;
    onChange: (v: string) => void;
    ariaLabel?: string;
};

export default function RoleSelect({ options, value, onChange, ariaLabel }: Props) {
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(() => Math.max(0, options.findIndex((o) => o.id === value)));
    const rootRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        setActiveIndex(Math.max(0, options.findIndex((o) => o.id === value)));
    }, [value, options]);

    useEffect(() => {
        function onDoc(e: MouseEvent) {
            if (!rootRef.current) return;
            if (!rootRef.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", onDoc);
        return () => document.removeEventListener("mousedown", onDoc);
    }, []);

    function toggle() {
        setOpen((s) => !s);
    }

    function onKeyDown(e: React.KeyboardEvent) {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActiveIndex((i) => Math.min(options.length - 1, i + 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((i) => Math.max(0, i - 1));
        } else if (e.key === "Enter") {
            e.preventDefault();
            const opt = options[activeIndex];
            if (opt) onChange(opt.id);
            setOpen(false);
        } else if (e.key === "Escape") {
            setOpen(false);
        }
    }

    return (
        <div
            className="custom-select"
            ref={rootRef}
            tabIndex={0}
            onKeyDown={onKeyDown}
            onBlur={() => setOpen(false)}
            aria-label={ariaLabel}
        >
            <button
                type="button"
                className={`custom-select__control${open ? " is-open" : ""}`}
                onClick={toggle}
                aria-haspopup="listbox"
                aria-expanded={open}
            >
                <span className="custom-select__value">{options.find((o) => o.id === value)?.label}</span>
                <span className="custom-select__caret" aria-hidden>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M7 10l5 5 5-5" stroke="#2EE8D2" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </span>
            </button>

            {open && (
                <ul className="custom-select__list" role="listbox">
                    {options.map((o, idx) => (
                        <li
                            key={o.id}
                            role="option"
                            aria-selected={o.id === value}
                            className={`custom-select__option${idx === activeIndex ? " is-active" : ""}${o.id === value ? " is-selected" : ""}`}
                            onMouseEnter={() => setActiveIndex(idx)}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                                onChange(o.id);
                                setOpen(false);
                            }}
                        >
                            <span className="custom-select__opt-label">{o.label}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
