# Browser viewers

The repository root is now an educational portal: `index.html` (English) and
`it/index.html` (Italian). Both link to the filling lesson, the 3D viewer and
the calculation guides. `shell_filling_it.html` translates the lesson and its
controls, explanations and canvas labels, plus shared Italian element names.
English options retain chemical symbols and atomic numbers across the full range. Links such as
`shell_filling_it.html?z=8` select an example and retain it when switching language.

Regenerate the Italian lesson, portals and sitemap with
`python3 tools/education_pages_gen.py`; use `--check` to check they are current.
Edit the English lesson and the generator’s translations rather than generated HTML.
Canonical URLs, reciprocal language alternatives, page descriptions, social
metadata and static learning content make both languages discoverable without JavaScript.

Assemble the published site with `python3 tools/assemble_web_site.py /tmp/atom-cube-site`
(choose an empty output directory). This also adds a visible, static link to the
[original FabLab Bergamo article](https://www.fablabbergamo.it/2026/09/20/orbitali-elettronici-esp32/)
to every HTML page, including all calculation guides. Links use
`utm_source=github_pages`, `utm_medium=referral`, `utm_campaign=electron_orbitals`,
and a page/language-specific `utm_content`. FabLab’s analytics can attribute
arrivals using these tags if it records campaign parameters. No analytics script
or tracking request is added to the GitHub Pages site.
The Pages workflow uses this assembler, so future HTML pages receive the link too.

Serve the repository root with `python3 -m http.server 8000`, then open
`http://localhost:8000/web/index.html` for the atom/orbital viewer or
`http://localhost:8000/web/shell_filling.html` for the educational filling animation.
The filling lesson must be served over HTTP. It reads symbols, Italian names and configuration exceptions from the shared Python source and radial wavefunctions from the shared binary on this site, without executing Python or downloading an external runtime. A 15-second timeout exposes the retry control if fetching fails.

The filling animation covers the shared model’s neutral configurations for all 118 elements. The heaviest configurations are model predictions. The browser reads micropython/slater.py directly, including its configuration exceptions, rather than maintaining a second exception table.
Choose an element, play/pause, step forward/backward, or scrub the electron count.
Orbital boxes show Hund filling and opposite-spin pairing; shell bars sum
subshell occupancies. A synchronized, rotating atom cloud adds one contribution
per electron, with matching shell colors. Its s/p/d/f clouds combine normalized
real spherical harmonics with calculated radial probability distributions;
dots are probability samples, not electron particles.
The vibrant cloud rotates independently of filling playback; use Rotate atom
to stop rotation. Points adjusts the cloud density.
Reduced-motion mode disables rotation, point turnover, and arrivals.
Nitrogen/oxygen illustrate the onset of p pairing;
potassium/calcium illustrate 4s filling before 3d. Reduced-motion preferences
disable visual transitions. Changing element resets the construction.

This is an instructional configuration-building sequence, not an ionization
process or a physical electron trajectory. It uses schematic box spacing,
not numerical orbital energies. Each construction follows the selected atom’s
final subshell occupancies in the usual ordering, so configurations such as
chromium and palladium finish correctly without displaying an incorrect
intermediate state as the ground state of another neutral element. The page
explains exceptions when present. Seven shell colors and responsive orbital
boxes keep d/f filling readable.

The filling clouds use physical distances in Bohr, with a picometre scale bar.
Hydrogen uses the exact nonrelativistic hydrogenic radial function. For He–U,
the browser reads the same signed u(r)=rR(r) rows in
`micropython/hfs_tables.bin` as the device. These are the project's
SPARC-atomSFE LDA_SVWN orbitals, on the existing 128-point radial grid
(see `pc/RUN_HFS.md`, section 5). LDA is an approximate many-electron model;
these tables omit relativistic corrections. The reference methodology is
described in [NIST's atomic electronic-structure data](https://www.nist.gov/pml/atomic-reference-data-electronic-structure-calculations).
For Z=93–118, the lesson uses hydrogenic radial functions with the same
Slater/n* screening as `micropython/slater.py`. These have physical radial
nodes but are a less accurate fallback, identified explicitly on the page.

Sampling integrates the square of linearly interpolated signed u, preserving
zero crossings rather than interpolating a positive density across a node.
Roundoff sign flips beyond the 99.999999% probability radius are excluded
from the reported node list, while the probability distribution is unchanged.
Every radial row is normalized before sampling. One scale applies to the
entire atom; its frame is fixed throughout filling using the largest final
orbital's 99.5% probability radius. No per-orbital display rescaling or
empirical atom-size factor is applied. The finite viewport may crop rare tails.

Use Inspect subshell and Show only this subshell to reveal an orbital's gaps;
other orbitals can obscure its nodes in the summed atom density. The radial
probability chart and node positions show the selected subshell's distribution.
The nucleus glow is an enlarged marker. Filling keeps the final neutral atom's
orbitals fixed; it does not solve a sequence of ions or electron capture.
Physics reference: [OpenStax, electronic structure of atoms](https://openstax.org/books/chemistry-atoms-first-2e/pages/3-4-electronic-structure-of-atoms-electron-configurations).

Run the model checks with `node web/shell_filling_model.test.js`.
The existing Pages workflow copies these assets with the rest of `web/`.

The portal hero uses a real 3D carbon cloud sampled offline by the shared atom
model. Regenerate its coordinates with `python3 tools/portal_atom_gen.py`
(`--check` verifies freshness). `web/portal_atom.js` rotates those coordinates
in yaw, tilt and roll, with a localized pause control and reduced-motion
support. Rendering stops while the tab is hidden or the atom is offscreen.
A static image remains available when JavaScript or canvas is unavailable;
the portal does not need Pyodide or an external runtime to animate.
