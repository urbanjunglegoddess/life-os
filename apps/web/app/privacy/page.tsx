export const metadata = { title: 'Privacy policy — Life OS' };

/**
 * Both stores require this document in store metadata AND in-app (ADR-0014).
 *
 * The text is deliberately absent rather than drafted. BUILD-SPEC §12 is
 * explicit that the privacy policy and the terms each need review by a
 * Georgia-licensed attorney before launch, and a plausible-looking policy
 * written here would be a legal document nobody had reviewed — which is worse
 * than an empty one, because it would be relied on.
 */
export default function Page() {
  return (
    <>
      <h1>Privacy policy</h1>
      <div className="notice">
        <p>
          <strong>Not yet published.</strong> This document is pending review by
          a Georgia-licensed attorney and will be published here before the
          first app store submission.
        </p>
      </div>
      <p className="muted">
        Life OS is in private development and has no public users. No data is
        collected from anyone other than its author.
      </p>
    </>
  );
}
