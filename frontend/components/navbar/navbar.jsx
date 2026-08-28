"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { navItems } from "./nav-items";

/* Shared motion vocabulary — mirrors the transitions-dev tokens in
   globals.css (--ease-smooth-out, --stagger-*, --dropdown-*). We pass
   the same numeric values to Motion.dev so CSS-driven and JS-driven
   motion stay on one coherent grid. */
const EASE_SMOOTH_OUT = [0.22, 1, 0.36, 1];

export function Navbar() {
    const reduce = useReducedMotion();
    const [open, setOpen] = useState(false);

    const navRef = useRef(null);
    const containerRef = useRef(null);
    const toggleRef = useRef(null);

    /* Entrance: the whole pill slides in, and its children rise in a
     staggered, blurred reveal (texts-reveal pattern). */
    const containerVariants = {
        hidden: {},
        show: { transition: { staggerChildren: 0.04, delayChildren: 0.05 } },
    };
    const itemVariants = reduce
        ? { hidden: { opacity: 1 }, show: { opacity: 1 } }
        : {
              hidden: { opacity: 0, y: 12, filter: "blur(3px)" },
              show: {
                  opacity: 1,
                  y: 0,
                  filter: "blur(0px)",
                  transition: { duration: 0.5, ease: EASE_SMOOTH_OUT },
              },
          };

    /* Mobile menu: dropdown/panel hybrid — grows from the trigger with a
     short translate + cross-blur, opens slower than it closes
     (--dropdown-open-dur 250ms → --dropdown-close-dur 150ms). */
    const panelVariants = reduce
        ? {
              hidden: { opacity: 0 },
              show: { opacity: 1, transition: { duration: 0.15 } },
              exit: { opacity: 0, transition: { duration: 0.1 } },
          }
        : {
              hidden: {
                  opacity: 0,
                  y: -8,
                  scale: 0.97,
                  filter: "blur(2px)",
              },
              show: {
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  filter: "blur(0px)",
                  transition: { duration: 0.25, ease: EASE_SMOOTH_OUT },
              },
              exit: {
                  opacity: 0,
                  y: -8,
                  scale: 0.99,
                  filter: "blur(2px)",
                  transition: { duration: 0.15, ease: EASE_SMOOTH_OUT },
              },
          };

    /* Scroll behavior — tighten the translucent surface only after the
     page has moved. Toggled imperatively on the element so it never
     triggers a React re-render. Passive + rAF-throttled. */
    useEffect(() => {
        const el = navRef.current;
        if (!el) return;
        let ticking = false;
        const update = () => {
            el.setAttribute(
                "data-scrolled",
                window.scrollY > 8 ? "true" : "false",
            );
            ticking = false;
        };
        const onScroll = () => {
            if (!ticking) {
                ticking = true;
                requestAnimationFrame(update);
            }
        };
        update();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    /* Close the mobile menu on Escape / outside click; restore focus to
     the trigger when dismissed with the keyboard. */
    useEffect(() => {
        if (!open) return;
        const onKey = (e) => {
            if (e.key === "Escape") {
                setOpen(false);
                toggleRef.current?.focus();
            }
        };
        const onClick = (e) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(e.target)
            ) {
                setOpen(false);
            }
        };
        document.addEventListener("keydown", onKey);
        document.addEventListener("pointerdown", onClick);
        return () => {
            document.removeEventListener("keydown", onKey);
            document.removeEventListener("pointerdown", onClick);
        };
    }, [open]);

    /* Move focus into the panel when it opens. */
    useEffect(() => {
        if (!open) return;
        const first = containerRef.current?.querySelector(
            "#kivo-mobile-menu a, #kivo-mobile-menu button",
        );
        first?.focus();
    }, [open]);

    return (
        <motion.header
            initial={reduce ? false : { y: -24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, ease: EASE_SMOOTH_OUT }}
            className="pointer-events-none fixed mt-12 inset-x-0 top-3 z-50 flex justify-center px-3 sm:top-4 sm:px-4"
        >
            <div
                ref={containerRef}
                className="relative w-full max-w-3xl"
            >
                <motion.nav
                    ref={navRef}
                    aria-label="Primary"
                    data-scrolled="false"
                    variants={containerVariants}
                    initial={reduce ? false : "hidden"}
                    animate="show"
                    className="kivo-nav-pill pointer-events-auto flex items-center justify-between gap-4 rounded-pills border px-4 py-2.5 backdrop-blur-[10px] sm:gap-6 sm:px-6 sm:py-3"
                >
                    {/* Brand */}
                    <motion.a
                        variants={itemVariants}
                        href="/"
                        aria-label="Kivo home"
                        className="kivo-focus flex items-center gap-2 rounded-pills px-2"
                    >
                        <BrandMark />
                        <span className="font-goga text-[20px] font-medium tracking-tight text-phosphor-white">
                            Kivo
                        </span>
                    </motion.a>

                    {/* Center links — desktop */}
                    <motion.ul
                        variants={itemVariants}
                        className="hidden flex-1 justify-center gap-2 md:flex"
                    >
                        {navItems.map((item) => (
                            <li key={item.label}>
                                <a
                                    href={item.href}
                                    className="kivo-nav-link kivo-focus rounded-pills px-4 py-2 text-[14px] font-medium text-phosphor-white/90"
                                >
                                    {item.label}
                                </a>
                            </li>
                        ))}
                    </motion.ul>

                    {/* Auth — desktop */}
                    <motion.div
                        variants={itemVariants}
                        className="hidden items-center gap-2 md:flex"
                    >
                        <a
                            href="/login"
                            className="kivo-nav-link kivo-focus rounded-pills px-4 py-2 text-[14px] font-medium text-fern-link"
                        >
                            Log in
                        </a>
                        <a
                            href="/signup"
                            className="kivo-cta kivo-focus rounded-pills bg-lime-pulse px-5 py-2 text-[14px] font-medium text-ground-iron"
                        >
                            Sign up
                        </a>
                    </motion.div>

                    {/* Mobile toggle */}
                    <motion.button
                        ref={toggleRef}
                        variants={itemVariants}
                        type="button"
                        aria-label={open ? "Close menu" : "Open menu"}
                        aria-expanded={open}
                        aria-controls="kivo-mobile-menu"
                        onClick={() => setOpen((v) => !v)}
                        className="kivo-focus flex h-10 w-10 items-center justify-center rounded-pills text-phosphor-white md:hidden"
                    >
                        <MenuIcon open={open} reduce={reduce} />
                    </motion.button>
                </motion.nav>

                <AnimatePresence>
                    {open && (
                        <motion.div
                            id="kivo-mobile-menu"
                            key="mobile-menu"
                            variants={panelVariants}
                            initial="hidden"
                            animate="show"
                            exit="exit"
                            role="menu"
                            aria-label="Mobile navigation"
                            className="pointer-events-auto absolute inset-x-0 top-full mt-2 origin-top rounded-xl border border-circuit-border/70 bg-carbon-veil/95 p-2 shadow-md backdrop-blur-[10px]"
                        >
                            <ul className="flex flex-col">
                                {navItems.map((item) => (
                                    <li key={item.label}>
                                        <a
                                            href={item.href}
                                            role="menuitem"
                                            onClick={() => setOpen(false)}
                                            className="kivo-nav-link kivo-focus flex min-h-[44px] items-center rounded-lg px-3 text-[15px] font-medium text-phosphor-white/90"
                                        >
                                            {item.label}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                            <div className="mt-1 flex flex-col gap-1 border-t border-circuit-border/50 pt-2">
                                <a
                                    href="#login"
                                    role="menuitem"
                                    onClick={() => setOpen(false)}
                                    className="kivo-nav-link kivo-focus flex min-h-[44px] items-center rounded-lg px-3 text-[15px] font-medium text-fern-link"
                                >
                                    Log in
                                </a>
                                <a
                                    href="#signup"
                                    role="menuitem"
                                    onClick={() => setOpen(false)}
                                    className="kivo-cta kivo-focus mt-1 flex min-h-[44px] items-center justify-center rounded-pills bg-lime-pulse px-5 py-2 text-[15px] font-medium text-ground-iron"
                                >
                                    Sign up
                                </a>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.header>
    );
}

/* Provisional brand mark — a phosphor-green LED tile standing in for the
   final 3D logo asset. Drop the real mark at /public/logo.svg and swap
   this for <img src="/logo.svg" alt="Kivo" /> when ready. */
function BrandMark() {
    return (
        <svg
            width="22"
            height="22"
            viewBox="0 0 22 22"
            aria-hidden="true"
            className="shrink-0"
        >
            <rect x="1" y="1" width="20" height="20" rx="6" fill="#7fee64" />
            <rect
                x="6.5"
                y="6.5"
                width="9"
                height="9"
                rx="2.5"
                fill="#181818"
            />
        </svg>
    );
}

/* Hamburger ↔ X morph (plus-to-menu-morph pattern): the two bars rotate
   symmetrically into a cross. Restrained, no spring on UI chrome. */
function MenuIcon({ open, reduce }) {
    const common = {
        transition: reduce
            ? { duration: 0 }
            : { duration: 0.25, ease: EASE_SMOOTH_OUT },
        transformOrigin: "center",
    };
    return (
        <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            aria-hidden="true"
            className="overflow-visible"
        >
            <motion.rect
                x="3"
                y="9"
                width="14"
                height="2"
                rx="1"
                fill="currentColor"
                animate={open ? { rotate: 45, y: 0 } : { rotate: 0, y: -3.5 }}
                style={common}
            />
            <motion.rect
                x="3"
                y="9"
                width="14"
                height="2"
                rx="1"
                fill="currentColor"
                animate={open ? { rotate: -45, y: 0 } : { rotate: 0, y: 3.5 }}
                style={common}
            />
        </svg>
    );
}

export default Navbar;
