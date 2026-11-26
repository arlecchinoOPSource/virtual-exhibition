# Third-party artwork in the models

`basement.glb` contains two prints of historical artworks, pasted to the basement's side walls (#59). `gallery.glb` contains four third-party models in the studio (#90, #91), joined into `Studio_Props`. Everything else in `gallery.glb`, `frame.glb`, and `basement.glb` is original to this project. The full register of candidate assets is `docs/ASSET_REGISTER.md`.

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

## Studio_Easel

- **Work:** "Art Easel Set Up" by reyshapes, from [Poly Pizza](https://poly.pizza/m/2ZP3o8hyPA). It is an H-frame studio easel with a brush, a palette, paint jars and a can.
- **Licence:** Public Domain, [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). Attribution isn't required; the creator is credited anyway.
- **File:** `assets-source/third-party/2ZP3o8hyPA/art-easel-set-up.glb`, the untouched original, downloaded 2026-11-26 from <https://static.poly.pizza/de6672ae-e7be-47eb-9836-f4894bbc82f2.glb>. It is 315,024 bytes, SHA-256 `077681f09cc23e190159d9f48c33bac5032dc6eaf6cf582297b6d1ed4aa32d84`, made by FBX2glTF.
- **In the model:** part of `Studio_Props` (shared material `Studio_Prop_Paint`), against the studio's north wall, with `COL_Studio_Easel` as its collision box.
- **Modifications:** `assets-source/blender/third_party.py` makes these changes at build time:
  - its one mesh is kept and the root empty is removed;
  - it is scaled from 12.5 units to 1.85 m tall (×0.148, after the original's 100× FBX scale);
  - it is turned to face into the room, with its origin at the centre of its base;
  - its ten identical white materials are replaced by one vertex-colour material, keeping the original vertex colours (baked to 8-bit), and its unused UVs are dropped.

  Geometry is otherwise unchanged: 3,266 triangles and 5,843 vertices.

## Studio_Props: Drafting Table

- **Work:** "Drafting Table" by Joshua Johanson, from [Poly Pizza](https://poly.pizza/m/8Z4yYj39NWS).
- **Licence:** Creative Commons Attribution 3.0, [BY](https://creativecommons.org/licenses/by/3.0/).
- **File:** `assets-source/third-party/8Z4yYj39NWS/drafting-table.glb`, the untouched original, downloaded 2026-11-26 from <https://static.poly.pizza/46576848-ecb9-4203-b4d3-7d4be9f375d7.glb>. It is 781,752 bytes, SHA-256 `b717fecca098e859e04010cedbe9f905b94b29faf63ea0b26ab71f494ea1ccc8`.
- **In the model:** part of `Studio_Props` (the studio's worktable, with its lamp, pencil cup, T-square and stool, and `COL_Studio_Worktable`).
- **Modifications:** `assets-source/blender/third_party.py` joins its parts, scales it to 1.35 m tall, sets its origin at the base and turns it to face the room. It bakes each original material's colour into vertex colours under one shared material and drops its unused UVs. It is kept whole, stool included, and turned to face the elevator. Geometry is otherwise unchanged.

## Studio_Props: Watercolor Set

- **Work:** "Watercolor Set" by Don Carson, from [Poly Pizza](https://poly.pizza/m/cAmECzmVE2_).
- **Licence:** Creative Commons Attribution 3.0, [BY](https://creativecommons.org/licenses/by/3.0/).
- **File:** `assets-source/third-party/cAmECzmVE2_/watercolor-set.glb`, the untouched original, downloaded 2026-11-26 from <https://static.poly.pizza/971bbe97-7b60-4b34-ad2c-8a6a3463ac0c.glb>. It is 254,252 bytes, SHA-256 `8d661f01448bf81dac06b3b36ecd2994ab088129180d90f8631e0b88459838cb`.
- **In the model:** part of `Studio_Props` (standing on an original supply cabinet against the north wall).
- **Modifications:** `assets-source/blender/third_party.py` joins its parts, scales it to 0.2 m tall, sets its origin at the base and turns it to face the room. It bakes each original material's colour into vertex colours under one shared material and drops its unused UVs. Geometry is otherwise unchanged.

## Studio_Props: Horse Statue

- **Work:** "Horse Statue" by Quaternius, from [Poly Pizza](https://poly.pizza/m/AK9CmjFnL6).
- **Licence:** Public Domain (attribution not required; credited anyway), [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
- **File:** `assets-source/third-party/AK9CmjFnL6/horse-statue.glb`, the untouched original, downloaded 2026-11-26 from <https://static.poly.pizza/55b0aa03-543c-439d-a7d7-f0ac4c23578f.glb>. It is 119,712 bytes, SHA-256 `e9d22843b9bef1a6a943b8d59bcee99e5a3702904150fba4a4e4ba1af53448c2`.
- **In the model:** part of `Studio_Props` (in the studio's south-west corner, with `COL_Studio_Statue`).
- **Modifications:** `assets-source/blender/third_party.py` joins its parts, scales it to 1.3 m tall, sets its origin at the base and turns it to face the room. It bakes each original material's colour into vertex colours under one shared material and drops its unused UVs. Geometry is otherwise unchanged.

## Replacing a print

Overwrite the file in `assets-source/posters/` (keep the file name, or change it in the `hang_poster` call in `gallery_blockout.py`, along with any `crop` box), re-export, and update the entry above. Each print has its own material and image, so the other print and every other texture export unchanged.
