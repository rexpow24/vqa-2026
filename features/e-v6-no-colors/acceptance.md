# Acceptance
- node test: E.v6 is current, max_entities 2, no colour cells.
- node test: entityCells never shows a colour under E.v6; motorbike needs only type.
- node test: two motorbikes compose "Xe máy A, xe máy B."; car with dashcam "Xe ô tô (có camera hành trình)".
- node test: a stored entity with vehicle_color composes without colour and does not throw (C sentence on a legacy video).
- pytest: copies byte-identical, migration seed sha matches, iaa scores E.v6 dashcam conditionally.
- local DB: E.v6 entity with vehicle_color refused; car without dashcam refused; E.v5 rows with colours still stored.
- verify-entities.mjs and verify-outcome.mjs pass against local server.
