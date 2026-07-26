# Local D1 export output

Files generated from migration CSV exports are local-only and must not be committed.
Run `workers/scripts/csv-to-d1.js` only on a trusted workstation. It writes
`seed.local.sql`, which is ignored by Git. Delete the generated SQL after use.
