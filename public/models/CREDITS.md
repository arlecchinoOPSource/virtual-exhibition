# Third-party artwork in the models

`basement.glb` contains two prints of historical artworks, pasted to the basement's side walls (#59). Everything else in `gallery.glb`, `frame.glb`, and `basement.glb` is original to this project.

The source files are kept unmodified in `assets-source/posters/`. `assets-source/blender/posters.py` builds both prints the same way. It adds a narrow paper margin around the image without resizing it (only the Doré scan is cropped, as noted below), and lightly tones the sheet: the margin yellows toward its edges and the paper has a faint uneven tone. The glTF export then re-encodes each sheet as a JPEG (quality 82) inside `basement.glb`. No logos, album artwork, typography, or later adaptations are included.

## Poster_Kittelsen_Lur

- **Work:** Theodor Kittelsen (1857–1914), _Op under Fjeldet toner en Lur_ ("Up in the Hills a Clarion Call Rings Out"), 1900. This is the drawing reproduced on Burzum's _Filosofem_; only the historical drawing is used here. WikiArt lists it under the series "Tirilil Tove". It does not name a holding collection, and none has been confirmed.
- **File:** `assets-source/posters/kittelsen-op-under-fjeldet-toner-en-lur.webp`, 750 × 546 px WebP, SHA-256 `4dc23879a76e63132e141580d291e35711a044118fddb9cc72a798ca450f82e3`.
- **In the model:** `Poster_Kittelsen_Lur` on the north wall, using material `Poster_Kittelsen_Lur_Print` and image `Poster_Kittelsen_Lur - print` (804 × 600 px JPEG, 85,063 bytes). The artwork is 1.65 × 1.20 m.
- **Source:** WikiArt, [artwork page](https://www.wikiart.org/en/theodor-severin-kittelsen/op-under-fjeldet-toner-en-lur-1900) (added 14 Aug 2013). Downloaded file: <https://uploads4.wikiart.org/images/theodor-severin-kittelsen/op-under-fjeldet-toner-en-lur-1900.jpg!Large.jpg>. That is WikiArt's "Large" rendition of a 1200 × 874 px maximum; the project owner supplied it as WebP on 2026-11-25. WikiArt is an aggregator, not the holding institution.
- **Rights:** WikiArt marks the image "Public domain". The artist died in 1914, so the work is in the public domain worldwide. A faithful photographic reproduction of a two-dimensional public-domain work gains no new copyright in the United States (_Bridgeman v. Corel_, 1999) or the EU (Directive (EU) 2019/790, Art. 14). The source's own reuse statement should still be checked once the URL is recorded.
- **Attribution:** Theodor Kittelsen, _Op under Fjeldet toner en Lur_. Public domain.

## Poster_Dore_Pale_Horse

- **Work:** _Death on the Pale Horse_ (Revelation 6:8), titled in this source _(La Muerte) Visión de San Juan_. It is a wood engraving by Héliodore Pisan after Gustave Doré (1832–1883); both signatures, Doré's and "H. PISAN", are on the plate. Doré's Bible illustrations were first published in _La Sainte Bible_ (Tours: Alfred Mame et fils, 1866). This impression is from the Spanish edition, _La Sagrada Biblia_, vol. 4 (trans. Félix Torres Amat, 1884), p. 391.
- **File:** `assets-source/posters/dore-death-on-the-pale-horse.jpg`, 770 × 1012 px greyscale JPEG, 142,279 bytes, SHA-256 `0f700e871e6c728fe7782a0b176cc457f750e59d2a5531e0acc6824bf5fafbeb`. It was downloaded unmodified on 2026-11-25 from the file URL below. Its embedded comment cites <https://archive.org/details/AI159/page/n353/mode/2up>.
- **Source:** Wikimedia Commons, [File:Gustave Doré - St. John's vision of death.jpg](https://commons.wikimedia.org/wiki/File:Gustave_Dor%C3%A9_-_St._John%27s_vision_of_death.jpg). File URL: <https://upload.wikimedia.org/wikipedia/commons/8/88/Gustave_Dor%C3%A9_-_St._John%27s_vision_of_death.jpg>. Commons credits the scan to archive.org (_La Sagrada Biblia_ T4, item AI159).
- **Modifications:** At build time, `gallery_blockout.py` crops the scan to the engraved plate, pixel box (8, 12, 760, 961) from the top-left. This removes the scanned page edge and the printed Spanish caption. The general changes listed above also apply.
- **In the model:** `Poster_Dore_Pale_Horse` on the south wall, using material `Poster_Dore_Pale_Horse_Print` and image `Poster_Dore_Pale_Horse - print` (822 × 1019 px JPEG, 192,736 bytes). The plate is 1.30 × 1.64 m.
- **Rights:** Commons tags the file public domain in the United States (PD-1923, published before 1931) with the Public Domain Mark 1.0. Its general notice says US public-domain status may not hold everywhere. Doré died in 1883 and Pisan in 1890, so the engraving is also out of copyright under life-plus-100-year terms. The same reproduction rule applies as for the Kittelsen file.
- **Attribution:** Gustave Doré (design) and Héliodore Pisan (engraving), _Death on the Pale Horse_, from _La Sagrada Biblia_ (1884). Public domain, via Wikimedia Commons.

## Replacing a print

Overwrite the file in `assets-source/posters/` (keep the file name, or change it in the `hang_poster` call in `gallery_blockout.py`, along with any `crop` box), re-export, and update the entry above. Each print has its own material and image, so the other print and every other texture export unchanged.
