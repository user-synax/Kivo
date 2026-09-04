// One-time password-reset tokens live in the query string — noindex.
export const metadata = {
  title: "Reset password — Kivo",
  robots: { index: false, follow: false },
};

export default function ResetPasswordLayout({ children }) {
  return children;
}
