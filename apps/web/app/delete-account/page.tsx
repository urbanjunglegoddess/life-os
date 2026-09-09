export const metadata = { title: 'Delete your Life OS account' };

/**
 * Google Play requires this route to be reachable on the public web, without
 * installing the app (ADR-0014). It describes the process; it does not perform
 * the deletion.
 *
 * The deletion itself is a cascading hard delete across every table, Storage
 * object and the auth user — BUILD-SPEC §9 calls it a build slice rather than a
 * settings checkbox, and the single most likely place for a partial delete that
 * becomes a compliance failure rather than a defect report. It is not wired here
 * because that slice has not been designed, and a form that appears to delete an
 * account while doing nothing would be worse than no form.
 */
export default function DeleteAccount() {
  return (
    <>
      <h1>Delete your account</h1>

      <p>
        You can ask for your Life OS account and all of its data to be deleted.
        You do not need the app installed to make the request.
      </p>

      <h2>What gets deleted</h2>
      <p>
        Everything tied to your account: actions, journal entries, finance
        records, household and children&rsquo;s records, academic data, uploaded
        files, and the login itself. The deletion is permanent and there is no
        recovery afterwards.
      </p>

      <h2>How to request it</h2>
      <div className="notice">
        <p>
          <strong>This route is not live yet.</strong> Life OS is in private
          development and has no public users. The request channel is published
          here before the first store submission, which is the point at which
          this page becomes a requirement.
        </p>
      </div>

      <h2>How long it takes</h2>
      <p>
        Requests are actioned within 30 days. You will get written confirmation
        when the deletion has completed.
      </p>
    </>
  );
}
