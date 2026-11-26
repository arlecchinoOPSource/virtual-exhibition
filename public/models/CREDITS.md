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
- **Modifications:** `assets-source/blender/third_party.py` joins its parts, scales it to 1.35 m tall, sets its origin at the base and turns it to face the room. It bakes each original material's colour into vertex colours under one shared material and drops its unused UVs. It is kept whole, stool included, and stands against the north wall facing the room. Since #92 it is simplified to 35% of its triangles.

## Studio_Props: Watercolor Set

- **Work:** "Watercolor Set" by Don Carson, from [Poly Pizza](https://poly.pizza/m/cAmECzmVE2_).
- **Licence:** Creative Commons Attribution 3.0, [BY](https://creativecommons.org/licenses/by/3.0/).
- **File:** `assets-source/third-party/cAmECzmVE2_/watercolor-set.glb`, the untouched original, downloaded 2026-11-26 from <https://static.poly.pizza/971bbe97-7b60-4b34-ad2c-8a6a3463ac0c.glb>. It is 254,252 bytes, SHA-256 `8d661f01448bf81dac06b3b36ecd2994ab088129180d90f8631e0b88459838cb`.
- **In the model:** part of `Studio_Props` (standing on an original supply cabinet in the north-west corner).
- **Modifications:** `assets-source/blender/third_party.py` joins its parts, scales it to 0.2 m tall, sets its origin at the base and turns it to face the room. It bakes each original material's colour into vertex colours under one shared material and drops its unused UVs. Since #92 it is simplified to 30% of its triangles.

## Studio_Props: Horse Statue

- **Work:** "Horse Statue" by Quaternius, from [Poly Pizza](https://poly.pizza/m/AK9CmjFnL6).
- **Licence:** Public Domain (attribution not required; credited anyway), [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
- **File:** `assets-source/third-party/AK9CmjFnL6/horse-statue.glb`, the untouched original, downloaded 2026-11-26 from <https://static.poly.pizza/55b0aa03-543c-439d-a7d7-f0ac4c23578f.glb>. It is 119,712 bytes, SHA-256 `e9d22843b9bef1a6a943b8d59bcee99e5a3702904150fba4a4e4ba1af53448c2`.
- **In the model:** part of `Studio_Props` (in the studio's south-west corner, with `COL_Studio_Statue`).
- **Modifications:** `assets-source/blender/third_party.py` joins its parts, scales it to 1.3 m tall, sets its origin at the base and turns it to face the room. It bakes each original material's colour into vertex colours under one shared material and drops its unused UVs. Geometry is otherwise unchanged.

## Reading_Shelf: Bookcase with Books

- **Work:** "Bookcase with Books" by Quaternius, from [Poly Pizza](https://poly.pizza/m/tACDGJ4CGW).
- **Licence:** Public Domain (attribution not required; credited anyway), [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
- **File:** `assets-source/third-party/tACDGJ4CGW/bookcase-with-books.glb`, the untouched original, downloaded 2026-11-26 from <https://static.poly.pizza/7d59d0aa-6447-4bbb-afc7-0452e9a34353.glb>. It is 589,464 bytes, SHA-256 `d2e2cd56498bec39dae1d8cf0b776bbfaaf25694a2abb845633515a248b0e5de`.
- **In the model:** the mesh `Reading_Shelf`, drawn twice as the reading area's two shelves (`Reading_Shelf_West`, `Reading_Shelf_East`, with `COL_` boxes).
- **Modifications:** `assets-source/blender/third_party.py` joins its parts, scales it to 1.75 m tall, sets its origin at the base and turns it to face the room. It bakes each original material's colour into vertex colours under one shared material and drops its unused UVs. It is simplified to 35% of its triangles.

## Reading_Props: Desk

- **Work:** "Desk" by Quaternius, from [Poly Pizza](https://poly.pizza/m/V86Go2rlnq).
- **Licence:** Public Domain (attribution not required; credited anyway), [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
- **File:** `assets-source/third-party/V86Go2rlnq/desk.glb`, the untouched original, downloaded 2026-11-26 from <https://static.poly.pizza/91c2bf8d-0876-4801-abd3-8dd5d017ecbd.glb>. It is 135,916 bytes, SHA-256 `3878f6d93d946d77f3e1be55919627a81435696252137ae33c22391c0411f3ce`.
- **In the model:** part of `Reading_Props` (the reading desk against the south partition, with `COL_Reading_Desk`).
- **Modifications:** `assets-source/blender/third_party.py` joins its parts, scales it to 0.76 m tall, sets its origin at the base and turns it to face the room. It bakes each original material's colour into vertex colours under one shared material and drops its unused UVs. It is simplified to 50% of its triangles.

## Reading_Props: Quill and parchment

- **Work:** "Quill and parchment" by Bruno Oliveira, from [Poly Pizza](https://poly.pizza/m/9RjoPxajS8Z).
- **Licence:** Creative Commons Attribution 3.0, [BY](https://creativecommons.org/licenses/by/3.0/).
- **File:** `assets-source/third-party/9RjoPxajS8Z/quill-and-parchment.glb`, the untouched original, downloaded 2026-11-26 from <https://static.poly.pizza/e530ed57-848a-41d6-b9da-46a77d49f33a.glb>. It is 28,276 bytes, SHA-256 `2897862754df75e8c246224855306ed01c9455639efdd9917b7acf0b97d919bb`.
- **In the model:** part of `Reading_Props` (on the reading desk).
- **Modifications:** `assets-source/blender/third_party.py` joins its parts, scales it to 0.22 m tall, sets its origin at the base and turns it to face the room. It bakes each original material's colour into vertex colours under one shared material and drops its unused UVs. Geometry is otherwise unchanged.

## Reading_Props: Scroll

- **Work:** "Scroll" by Justin Randall, from [Poly Pizza](https://poly.pizza/m/9ylwwjAp8KM).
- **Licence:** Creative Commons Attribution 3.0, [BY](https://creativecommons.org/licenses/by/3.0/).
- **File:** `assets-source/third-party/9ylwwjAp8KM/scroll.glb`, the untouched original, downloaded 2026-11-26 from <https://static.poly.pizza/ea03c1f7-b7dc-42de-a870-a2d0114ca5b0.glb>. It is 117,104 bytes, SHA-256 `ca6f93461bd898c833eeb90619e66c18bc604991c4144bb79a96d27c90f643e6`.
- **In the model:** part of `Reading_Props` (three copies by the reading area's south partition; no collider).
- **Modifications:** `assets-source/blender/third_party.py` joins its parts, scales it to 0.12 m tall, sets its origin at the base and turns it to face the room. It bakes each original material's colour into vertex colours under one shared material and drops its unused UVs. It is simplified to 25% of its triangles, and used three times.

## Living_Props: old tv

- **Work:** "old tv" by Justin Randall, from [Poly Pizza](https://poly.pizza/m/9y-mTmCyefL).
- **Licence:** Creative Commons Attribution 3.0, [BY](https://creativecommons.org/licenses/by/3.0/).
- **File:** `assets-source/third-party/9y-mTmCyefL/old-tv.glb`, the untouched original, downloaded 2026-11-26 from <https://static.poly.pizza/eb7cdd7c-3cd6-4f56-91f1-b006816c9371.glb>. It is 235,456 bytes, SHA-256 `bbbff469f383523003c244d8ba3f7ed5007a4817d7359d7b49f24838b7fa36fa`.
- **In the model:** part of `Living_Props` (on an original cabinet against the living room's west wall); its screen glass is in `Living_Glass`.
- **Modifications:** `assets-source/blender/third_party.py` joins its parts, scales it to 0.5 m tall, sets its origin at the base and turns it to face the room. It bakes each original material's colour into vertex colours under one shared material and drops its unused UVs. It is simplified to 35% of its triangles. Its screen glass uses a shared transparent material.

## Living_Props: Bowl of Fruit

- **Work:** "Bowl of Fruit" by sirkitree, from [Poly Pizza](https://poly.pizza/m/2kBAnLbWgMJ).
- **Licence:** Creative Commons Attribution 3.0, [BY](https://creativecommons.org/licenses/by/3.0/).
- **File:** `assets-source/third-party/2kBAnLbWgMJ/bowl-of-fruit.glb`, the untouched original, downloaded 2026-11-26 from <https://static.poly.pizza/e226eeca-f47a-4c6d-af00-fffbed5f20ca.glb>. It is 68,252 bytes, SHA-256 `9f2e667eaa1739217e5d2ec8363337ff307dff783d8d4df296ba6b7cbff90c77`.
- **In the model:** part of `Living_Props` (on the original coffee table).
- **Modifications:** `assets-source/blender/third_party.py` joins its parts, scales it to 0.16 m tall, sets its origin at the base and turns it to face the room. It bakes each original material's colour into vertex colours under one shared material and drops its unused UVs. It is simplified to 50% of its triangles.

## Living_Props: Couch Large

- **Work:** "Couch Large" by Quaternius, from [Poly Pizza](https://poly.pizza/m/6MoOyPtetL).
- **Licence:** Public Domain (attribution not required; credited anyway), [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
- **File:** `assets-source/third-party/6MoOyPtetL/couch-large.glb`, the untouched original, downloaded 2026-11-26 from <https://static.poly.pizza/7ac6188b-72be-4c82-81c8-85deab020a1c.glb>. It is 30,800 bytes, SHA-256 `c75418e4e222e1dfe7cddb42e98f44017cfc051071a81a4072fa153b8fbe7e76`.
- **In the model:** part of `Living_Props` (facing the TV, with `COL_Living_Couch`).
- **Modifications:** `assets-source/blender/third_party.py` joins its parts, scales it to 0.75 m tall, sets its origin at the base and turns it to face the room. It bakes each original material's colour into vertex colours under one shared material and drops its unused UVs. Geometry is otherwise unchanged.

## Living_Props: Display Case

- **Work:** "Display Case" by CMHT Oculus, from [Poly Pizza](https://poly.pizza/m/cp6KFmnPnnn).
- **Licence:** Creative Commons Attribution 3.0, [BY](https://creativecommons.org/licenses/by/3.0/).
- **File:** `assets-source/third-party/cp6KFmnPnnn/display-case.glb`, the untouched original, downloaded 2026-11-26 from <https://static.poly.pizza/5c1a22e7-b567-4ea4-b3c4-c2ede476b862.glb>. It is 36,764 bytes, SHA-256 `f03696c93efd3e31a88eeb36131fcfc059613f803627c97a813edee2adf6cde6`.
- **In the model:** part of `Living_Props` (against the living room's south wall, with `COL_Living_Display_Case`); its glass is in `Living_Glass`.
- **Modifications:** `assets-source/blender/third_party.py` joins its parts, scales it to 1.65 m tall, sets its origin at the base and turns it to face the room. It bakes each original material's colour into vertex colours under one shared material and drops its unused UVs. Its glass uses a shared transparent material.

## Living_Props: Dining Set

- **Work:** "Dining Set" by CMHT Oculus, from [Poly Pizza](https://poly.pizza/m/emZBrrhot73).
- **Licence:** Creative Commons Attribution 3.0, [BY](https://creativecommons.org/licenses/by/3.0/).
- **File:** `assets-source/third-party/emZBrrhot73/dining-set.glb`, the untouched original, downloaded 2026-11-26 from <https://static.poly.pizza/73d542fa-ef4d-4d10-8c53-99eb11ae6700.glb>. It is 77,616 bytes, SHA-256 `e034abcfd847512bb0608d276295f4e6a54b19906e3d591be513839dcead508a`.
- **In the model:** part of `Living_Props` (with `COL_Living_Dining_Set`).
- **Modifications:** `assets-source/blender/third_party.py` joins its parts, scales it to 0.9 m tall, sets its origin at the base and turns it to face the room. It bakes each original material's colour into vertex colours under one shared material and drops its unused UVs. Geometry is otherwise unchanged.

## Living_Props: Eight Vases (one vase)

- **Work:** "Eight Vases" by Paul Spooner, from [Poly Pizza](https://poly.pizza/m/083bnosQpkP).
- **Licence:** Creative Commons Attribution 3.0, [BY](https://creativecommons.org/licenses/by/3.0/).
- **File:** `assets-source/third-party/083bnosQpkP/eight-vases.glb`, the untouched original, downloaded 2026-11-26 from <https://static.poly.pizza/7020fbb4-4cb8-4eb0-affb-394b49a7a2cf.glb>. It is 95,204 bytes, SHA-256 `f3a111603a71f9fa0d1224db9eaac3bf3125daad59cb1c46cf58c8e4b74e2873`.
- **In the model:** part of `Living_Props` (one vase, `vase.113`, in the living room's north-west corner).
- **Modifications:** Only `vase.113` is used; the other seven vases are left out. `assets-source/blender/third_party.py` joins its parts, scales it to 0.75 m tall, sets its origin at the base and turns it to face the room. It bakes each original material's colour into vertex colours under one shared material and drops its unused UVs.

## Theater_Props: Bench

- **Work:** "Bench" by Quaternius, from [Poly Pizza](https://poly.pizza/m/nARUaxtRHA).
- **Licence:** Public Domain (attribution not required; credited anyway), [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
- **File:** `assets-source/third-party/nARUaxtRHA/bench.glb`, the untouched original, downloaded 2026-11-26 from <https://static.poly.pizza/d0ed7f6f-ccca-412c-8328-7835d2575dab.glb>. It is 21,044 bytes, SHA-256 `746c726d642ff279788d9950a7667a15d9963a25a541ca1ff9f2324e76907f91`.
- **In the model:** part of `Theater_Props` (twice, beside the stage aisle).
- **Modifications:** `assets-source/blender/third_party.py` joins its parts, scales it to 0.48 m tall, sets its origin at the base and turns it to face the room. It bakes each original material's colour into vertex colours under one shared material and drops its unused UVs. Its palette texture is sampled into the vertex colours and not exported.

## Theater_Props: Stone Tower

- **Work:** "Stone Tower" by Quaternius, from [Poly Pizza](https://poly.pizza/m/dJLAD6p90F).
- **Licence:** Public Domain (attribution not required; credited anyway), [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
- **File:** `assets-source/third-party/dJLAD6p90F/stone-tower.glb`, the untouched original, downloaded 2026-11-26 from <https://static.poly.pizza/9d0ad85b-a250-4197-a5d3-8bac9f463004.glb>. It is 217,660 bytes, SHA-256 `5f4db1513020d24f57f991b951efcddf97beebf061d11c2e5a6da64fadc52cd3`.
- **In the model:** part of `Theater_Props` (twice, as reliefs in the stage corners).
- **Modifications:** `assets-source/blender/third_party.py` joins its parts, scales it to 1.8 m tall, sets its origin at the base and turns it to face the room. It bakes each original material's colour into vertex colours under one shared material and drops its unused UVs. It is flattened to 0.33 m deep as a wall relief and simplified to 30% of its triangles.

## Theater_Props: Banner Wall

- **Work:** "Banner Wall" by Quaternius, from [Poly Pizza](https://poly.pizza/m/dQjx8fBjIl).
- **Licence:** Public Domain (attribution not required; credited anyway), [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
- **File:** `assets-source/third-party/dQjx8fBjIl/banner-wall.glb`, the untouched original, downloaded 2026-11-26 from <https://static.poly.pizza/0c1ba162-9d94-4fc7-9a35-23653aacc7ac.glb>. It is 26,720 bytes, SHA-256 `4f9f8af26f4b46f18bd9f6a03de4978d70788f161e0d4a3c26286985f3c78c62`.
- **In the model:** part of `Theater_Props` (twice, on the theater's side walls).
- **Modifications:** `assets-source/blender/third_party.py` joins its parts, scales it to 2.2 m tall, sets its origin at the base and turns it to face the room. It bakes each original material's colour into vertex colours under one shared material and drops its unused UVs. It is flattened to 0.18 m deep against the wall.

## Theater_Props: Window Bars

- **Work:** "Window Bars" by Quaternius, from [Poly Pizza](https://poly.pizza/m/mvTeQA5aBn).
- **Licence:** Public Domain (attribution not required; credited anyway), [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
- **File:** `assets-source/third-party/mvTeQA5aBn/window-bars.glb`, the untouched original, downloaded 2026-11-26 from <https://static.poly.pizza/9de110df-9370-4925-b031-8ab5fe90dea8.glb>. It is 87,260 bytes, SHA-256 `a9bf3cccd2e313d410e5241e3b73d94de4fbf3df77baf8fc5acf6d84d0470dd4`.
- **In the model:** part of `Theater_Props` (a relief on the theater's north wall).
- **Modifications:** `assets-source/blender/third_party.py` joins its parts, scales it to 1.6 m tall, sets its origin at the base and turns it to face the room. It bakes each original material's colour into vertex colours under one shared material and drops its unused UVs. It is flattened to 0.12 m deep and simplified to 50% of its triangles.

## Theater_Props: Flower Pot

- **Work:** "Flower Pot" by Zsky, from [Poly Pizza](https://poly.pizza/m/Kgt363WkKd).
- **Licence:** Creative Commons Attribution 3.0, [BY](https://creativecommons.org/licenses/by/3.0/).
- **File:** `assets-source/third-party/Kgt363WkKd/flower-pot.glb`, the untouched original, downloaded 2026-11-26 from <https://static.poly.pizza/fcbc720c-858e-4c35-ab6c-0797c71d6978.glb>. It is 56,460 bytes, SHA-256 `eaceb6b254efe758829450d90657b6d7cc6db658548c761fd88291cd460396a6`.
- **In the model:** part of `Theater_Props` (beside the theater door).
- **Modifications:** `assets-source/blender/third_party.py` joins its parts, scales it to 0.7 m tall, sets its origin at the base and turns it to face the room. It bakes each original material's colour into vertex colours under one shared material and drops its unused UVs. It is simplified to 50% of its triangles.

## Replacing a print

Overwrite the file in `assets-source/posters/` (keep the file name, or change it in the `hang_poster` call in `gallery_blockout.py`, along with any `crop` box), re-export, and update the entry above. Each print has its own material and image, so the other print and every other texture export unchanged.
