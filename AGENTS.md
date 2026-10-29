# Architecture decisions

- Family identity auditing is handled by the `family-audit` Edge Function, which returns short-lived signed document URLs; keep private storage paths and service credentials out of the browser.
