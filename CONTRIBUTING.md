# Working on the project

The deployable app is `index.html`. Keep the scene, layout, text, shader code, and embedded atlas self-contained so a downloaded page remains usable offline.

## Edit and check

1. Use Node.js 22 or newer and run `npm ci`.
2. Edit the relevant engine section in `index.html`.
3. Run `npm test` and `npm run typecheck`.
4. Install Chromium with `npx playwright install chromium`, then run `npm run test:browser`.
5. Inspect the page at desktop and mobile widths with `npm run preview`.

For an installed Chrome, set `PLAYWRIGHT_CHANNEL=chrome`. `SITE_URL` lets the browser suite target a deployment instead of the local file. All scripts resolve page paths relative to their location; no machine-specific dependency paths are required.

## Source landmarks

Look for `A. DATA`, `B. MATH`, `C. GEOMETRY BUILDERS`, `D.`, `E.`, `F. THE CAMERA FLIGHT`, and `G. PAGE` in the inline script. Geometry uses a transform stack and material attributes. Motion data must remain aligned with the vertex buffer. Visible surfaces and shadow casters must use the same deformation.

Check topology, normals, and winding after changing primitives. Check doorway transitions and reverse views after changing visibility. When changing camera composition, examine both the desktop text column and narrow screens.

## Refresh documentation screenshots

Set `UPDATE_SCREENSHOTS=1`, then run `npm run test:browser`. This replaces `docs/images/hero.png` and `docs/images/ark.png` with actual High-quality browser captures. Review the images before committing. Routine runs save screenshots to ignored `test-results/` instead.

## Offline framing probe

```sh
npm run probe -- 1440 900 9 frame-probe.png
```

Arguments are width, height, camera progress, and output path. The probe uses the page's geometry, transforms, and surface deformation. It reports depth-visible pixels for the jar, staff, and tablets. It is a framing diagnostic, not a substitute for the browser's materials or GPU rendering.

## Content and assets

Keep Scripture quotations and their translation attribution intact. English and Arabic part labels should stay synchronized with the step data. Preserve material provenance when replacing an atlas tile. Do not put local paths, credentials, downloaded backups, or generated test output into commits.
