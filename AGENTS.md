# Architecture decisions

- Family identity auditing is handled by the `family-audit` Edge Function, which returns short-lived signed document URLs; keep private storage paths and service credentials out of the browser.
- Family editing uses authenticated ownership RLS, not timed grants; this keeps every family restricted to its own records while authorized reviewers can manage members.
- New family members are local drafts until validation succeeds, so opening the editor never creates incomplete database records.
- Family login uses the existing synthetic-email authentication and four-digit code derivation; never reset existing passwords as part of rendering a login page.
