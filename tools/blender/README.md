# Hardware dello Studio: da Blender a React

Tutte le immagini skeuomorfiche nuove dello Studio nascono da qui: scene Blender scritte in Python, rese con Cycles, ottimizzate e accompagnate dalla geometria che React usa per appoggiarci sopra i controlli veri.

```
specs/<componente>.json      geometria in pixel CSS: l'unica fonte, per Blender e per React
components/<componente>.py   la scena: quali parti, quali materiali
gtlkit/scene.py              unità, camera ortografica, luce standard, rendering
gtlkit/materials.py          materiali procedurali (nessuna texture)
gtlkit/parts.py              geometrie riutilizzabili (scatole, viti, manopole, spie, angolari)
gtlkit/export.py             sfumatura dei bordi, strisce di fotogrammi, WebP, manifest, TypeScript
build.py                     comando unico; ogni componente dichiara le sue immagini in `pictures()`
blend/                       scene salvate (una per immagine)
```

## Uso

```bash
python3 -m venv .venv-blender && .venv-blender/bin/pip install -r tools/blender/requirements.txt
.venv-blender/bin/python tools/blender/build.py amp --blend          # tutto l'amplificatore, circa un minuto su 4 core
.venv-blender/bin/python tools/blender/build.py amp --samples 24 --preview /tmp/anteprima   # prova veloce, non tocca src/
```

Funziona anche dentro Blender: `blender -b -P tools/blender/build.py -- amp`.

Il comando scrive in `src/ui/studio/v6/hardware/`: le immagini in `assets/`, `assets/<componente>.manifest.json` (dimensioni, byte, hash, versione di Blender, campioni) e `<componente>.generated.ts`. I file generati non si modificano a mano: si cambia la spec e si ricostruisce. `npm test` verifica che spec, manifest, file e modulo generato dicano la stessa cosa, senza bisogno di Blender.

## Regole

1. **Unità**: 1 pixel CSS = 0,01 unità Blender (`px()`). x a destra, y in basso come nel CSS, z verso chi guarda.
2. **Camera**: ortografica e frontale. Un controllo disegnato a (x, y) nella spec è a (x, y) nell'immagine.
3. **Luce**: sempre `studio_rig`. Chiave calda da in alto a sinistra, riempimento freddo dall'alto; distanze ed energie scalano con il soggetto. È la direzione delle ombre CSS dello Studio.
4. **Materiali**: solo quelli di `materials.py`, procedurali. Niente texture, HDRI o modelli di terzi: tutto resta GPL-3.0-or-later (D-40).
5. **Altezze standard** in `parts.py` (`Z_CABINET`, `Z_PLATE`, `Z_KNOB`): parti di componenti diversi si impilano allo stesso modo.
6. **Cosa va nell'immagine**: solo ciò che non cambia. Tutto ciò che si muove o si accende è un'immagine a parte (striscia di fotogrammi, stato acceso/spento). Testi, nomi ed etichette restano HTML.
7. **Margine d'ombra**: il corpo è reso più grande del dispositivo (`margin` nella spec) con lo sfondo trasparente e un piano che raccoglie l'ombra; l'ultimo tratto del bordo sfuma a zero.
8. **Formato**: WebP a 2×, qualità 88–92. Un componente intero sotto 160 kB.
9. **Ripetibilità**: seme fisso e CPU. Con la stessa versione di Blender una ricostruzione dà le stesse immagini byte per byte (verificato su Blender 5.3.0, stessa macchina).

## Aggiungere un componente

1. Scrivere `specs/<nome>.json` con dimensioni, margini e posizione di ogni controllo.
2. Scrivere `components/<nome>.py` usando `parts` e `materials`; se manca una parte o un materiale, aggiungerlo al kit, non al componente.
3. Aggiungere il ramo in `build.py` e lanciare prima con `--preview`.
4. In React leggere la geometria dal modulo generato; nessun numero copiato a mano.
5. Aggiungere il componente a `hardware.test.ts` e una prova e2e; rifare gli screenshot con `tools/hardware/shots.mjs`.
