// One-time email-verification tokens live in the query string — noindex.
export const metadata = {
  title: "Verify your email — Kivo",
  robots: { index: false, follow: false },
};

export default function VerifyEmailLayout({ children }) {
  return children;
}
