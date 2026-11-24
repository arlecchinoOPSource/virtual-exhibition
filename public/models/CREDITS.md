# Third-party artwork in the models

`basement.glb` contains two prints of historical artworks, pasted to the basement's side walls (#59). Everything else in `gallery.glb`, `frame.glb`, and `basement.glb` is original to this project.

The source files are kept unmodified in `assets-source/posters/`. `assets-source/blender/posters.py` builds both prints the same way. It adds a narrow paper margin around the image without cropping or resizing it, and lightly tones the sheet: the margin yellows toward its edges and the paper has a faint uneven tone. The glTF export then re-encodes each sheet as a JPEG (quality 82) inside `basement.glb`. No logos, album artwork, typography, or later adaptations are included.

## Poster_Kittelsen_Lur

- **Work:** Theodor Kittelsen (1857–1914), _Op under Fjeldet toner en Lur_. This is the drawing reproduced on Burzum's _Filosofem_; only the historical drawing is used here. Date and holding collection still need to be confirmed against the source record.
- **File:** `assets-source/posters/kittelsen-op-under-fjeldet-toner-en-lur.webp`, 750 × 546 px WebP, SHA-256 `4dc23879a76e63132e141580d291e35711a044118fddb9cc72a798ca450f82e3`.
- **In the model:** `Poster_Kittelsen_Lur` on the north wall, using material `Poster_Kittelsen_Lur_Print` and image `Poster_Kittelsen_Lur - print` (804 × 600 px JPEG, 84,833 bytes). The artwork is 0.82 × 0.60 m.
- **Source:** The project owner supplied the file on 2026-11-25 and reports it is public domain, taken from a public archive website. **The source page and file URL are not recorded yet; add them before release.**
- **Rights:** The artist died in 1914, so the work is in the public domain worldwide. A faithful photographic reproduction of a two-dimensional public-domain work gains no new copyright in the United States (_Bridgeman v. Corel_, 1999) or the EU (Directive (EU) 2019/790, Art. 14). The source's own reuse statement should still be checked once the URL is recorded.
- **Attribution:** Theodor Kittelsen, _Op under Fjeldet toner en Lur_. Public domain.

## Poster_Dore_Pale_Horse

- **Work:** _Death on the Pale Horse_ (Revelation 6:8), a wood engraving by Héliodore Pisan after Gustave Doré (1832–1883), from Doré's illustrated Bible (_La Sainte Bible_, Tours: Alfred Mame et fils, 1866). The file shows both signatures, Doré's and "H. PISAN". The edition and holding collection still need to be confirmed against the source record.
- **File:** `assets-source/posters/dore-death-on-the-pale-horse.webp`, 960 × 1198 px WebP, SHA-256 `1d1f3dd68d840307bb0e0ac3e51fbfd0bab2c0b7b021f98447718b46b6f735c8`.
- **In the model:** `Poster_Dore_Pale_Horse` on the south wall, using material `Poster_Dore_Pale_Horse_Print` and image `Poster_Dore_Pale_Horse - print` (1048 × 1286 px JPEG, 246,102 bytes). The artwork is 0.66 × 0.82 m.
- **Source:** The project owner supplied the file on 2026-11-25 and reports it is public domain, taken from a public archive website. **The source page and file URL are not recorded yet; add them before release.**
- **Rights:** Doré died in 1883 and Pisan in 1890, so the engraving is in the public domain worldwide. The same reproduction rule applies as for the Kittelsen file.
- **Attribution:** Gustave Doré (design) and Héliodore Pisan (engraving), _Death on the Pale Horse_, 1866. Public domain.

## Replacing a print

Overwrite the file in `assets-source/posters/` (keep the file name, or change it in the `hang_poster` call in `gallery_blockout.py`), re-export, and update the entry above. Each print has its own material and image, so the other print and every other texture export unchanged.
