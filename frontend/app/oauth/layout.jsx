// OAuth callback landing — session tokens can appear in the URL and the page
// is only meaningful mid-flow, so keep it out of search results entirely.
export const metadata = {
  robots: { index: false, follow: false },
};

export default function OAuthLayout({ children }) {
  return children;
}
