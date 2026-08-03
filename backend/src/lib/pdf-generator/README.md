# PDF Generator (Phase 4c)

This folder will hold the HTML contract template and the Puppeteer wrapper that
renders it to PDF (French + Arabic, RTL-aware — see `docs/architecture.md` §1
and `docs/business-rules.md`).

Left unimplemented in Phase 0 on purpose: Puppeteer bundles a Chromium binary
(~300MB) and there is no contract-generation feature yet to exercise it.
Adding the dependency and template now would slow down every `npm install`
for no benefit — it's introduced in Phase 4c alongside the Rentals contract
endpoint that actually uses it.
