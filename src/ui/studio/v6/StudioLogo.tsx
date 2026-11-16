/**
 * The Studio's nameplate (approved V6.7 header, `#vectorHeader`): cream enamel
 * plate, the "GUITAR THEORY LAB" wordmark, the edition label and the two
 * continuous racing stripes. Geometry, colours and lettering are the
 * reference's own SVG, unchanged: the plate's outline (its clip path), the
 * four stripe strokes, the wordmark traced from the original letters and the
 * label's text element. Two things are adapted to this app: the plate is
 * filled with the reference's own `enamel` gradient instead of its bitmap, so
 * the whole mark is vector (where the bitmap has a screw, at the plate's left
 * end, the header puts the key of the left sidebar), and the stripes go on along the top of the header
 * past the reference's 635 units, straight, until the toolbar.
 */
export const LOGO_VIEW = { w: 635, h: 85 } as const;

const PLATE = 'M 0 0 H 635 V 22 H 612 Q 598 22 585 34 L 551 74 Q 543 85 519 85 H 0 Z';
const STRIPE_UPPER = 'M 0 65 L 502 65 Q 531 65 549 44 L 574 17 Q 590 5 611 5 L 635 5';
const STRIPE_LOWER = 'M 0 75 L 503 75 Q 538 75 557 52 L 581 25 Q 594 15 612 15 L 635 15';
/** Where the stripes leave the reference's drawing: they continue from here, level. */
const RUN = ' H 6000';
const WORDMARK = 'M504 9 L504 40 L513 40 L513 29 L515 27 L517 27 L520 30 L516 33 L516 40 L523 40 L527 38 L527 37 L529 35 L529 28 L526 24 L528 20 L528 15 L527 13 L525 11 L521 9 Z M505 38 L506 37 L511 37 L512 39 L511 40 L510 39 L509 40 L506 40 Z M513 18 L514 17 L518 17 L519 18 L519 20 L516 22 L514 22 L513 21 Z M478 11 L475 14 L473 18 L473 40 L482 40 L482 34 L483 33 L490 33 L491 34 L491 38 L490 39 L491 40 L500 40 L500 19 L499 18 L498 14 L495 11 L491 9 L482 9 Z M482 21 L485 18 L488 18 L490 20 L491 24 L490 25 L483 25 L482 24 Z M478 12 L479 14 L482 16 L482 17 L483 16 L485 17 L482 20 L482 22 L481 23 L480 21 L478 22 L474 19 L475 15 Z M450 9 L450 34 L451 36 L456 40 L470 40 L470 31 L463 31 L460 29 L460 20 L459 19 L459 12 L460 10 L459 9 Z M464 38 L466 37 L467 39 L465 40 Z M458 9 L459 10 L459 25 L458 26 L457 24 L456 24 L453 27 L451 27 L450 26 L450 24 L451 23 L451 19 L452 18 L454 22 L455 21 L457 22 L457 12 L455 11 Z M407 9 L407 21 L408 22 L408 25 L410 27 L410 28 L416 31 L416 40 L425 40 L425 31 L426 30 L430 29 L433 25 L433 22 L434 21 L434 10 L433 9 L424 9 L424 20 L421 23 L420 23 L417 20 L417 10 L416 9 Z M415 29 L416 28 L417 29 L420 29 L421 30 L423 29 L424 30 L424 33 L423 34 L420 34 L419 33 L419 34 L417 35 L416 34 L416 31 Z M409 24 L410 23 L412 25 L412 26 L416 28 L415 29 L411 28 Z M380 9 L380 29 L379 30 L379 32 L380 33 L380 38 L379 39 L380 40 L388 40 L389 39 L389 33 L391 32 L394 34 L396 40 L405 40 L405 33 L401 28 L401 27 L403 26 L404 24 L404 15 L403 13 L400 10 L398 10 L397 9 Z M390 17 L393 17 L396 20 L396 21 L393 24 L390 24 L389 23 L388 19 Z M381 17 L383 20 L382 21 L382 24 L381 25 L380 24 L380 18 Z M356 9 L352 11 L347 16 L346 18 L346 21 L345 22 L345 28 L349 36 L355 40 L366 40 L370 38 L376 31 L376 28 L377 27 L376 19 L374 15 L370 11 L366 9 Z M361 18 L367 23 L367 26 L364 30 L362 31 L359 31 L355 27 L355 22 L358 19 L360 19 Z M328 9 L326 10 L322 15 L322 21 L324 24 L321 31 L322 32 L322 35 L323 37 L327 40 L342 40 L342 31 L333 31 L332 30 L333 28 L342 28 L342 21 L333 21 L332 20 L333 18 L342 18 L342 9 Z M291 9 L291 40 L301 40 L301 29 L302 28 L307 28 L308 29 L308 40 L317 40 L318 39 L317 38 L317 34 L318 33 L318 10 L317 9 L308 9 L308 19 L307 20 L302 20 L300 18 L301 16 L301 10 L300 9 Z M265 9 L265 18 L271 18 L272 19 L272 40 L274 41 L281 41 L282 40 L282 19 L283 18 L288 18 L288 9 Z M225 9 L225 40 L232 40 L233 41 L234 40 L234 33 L235 32 L238 32 L240 34 L241 40 L248 40 L249 41 L250 40 L250 32 L247 28 L250 23 L250 16 L249 14 L243 9 Z M234 18 L235 17 L238 17 L241 20 L241 21 L238 24 L235 24 L234 23 Z M156 9 L156 40 L166 40 L166 9 Z M124 9 L124 29 L125 30 L125 33 L127 35 L127 36 L130 39 L134 40 L135 41 L141 41 L148 38 L150 36 L152 32 L152 9 L142 9 L142 28 L139 31 L136 30 L134 27 L134 24 L135 23 L134 22 L135 20 L135 10 L134 9 Z M71 34 L71 35 L74 38 L78 40 L87 40 L92 46 L120 46 L120 43 L121 42 L121 26 L120 25 L108 25 L107 26 L107 36 L106 37 L102 37 L98 32 L98 27 L101 23 L105 21 L119 21 L119 9 L99 9 L98 10 L96 10 L94 12 L93 12 L87 19 L87 21 L85 24 L85 33 L84 34 Z M72 35 L74 34 L78 37 L76 38 Z M219 14 L213 9 L206 8 L205 9 L202 9 L200 10 L196 14 L194 18 L193 17 L193 9 L169 9 L169 18 L175 18 L176 19 L176 40 L177 41 L179 40 L186 40 L186 19 L187 18 L193 18 L194 19 L194 40 L203 40 L204 39 L204 34 L205 33 L211 33 L212 34 L212 40 L221 40 L221 18 Z M204 20 L207 18 L209 18 L211 20 L212 24 L211 25 L205 25 L204 24 Z';

export function StudioLogo() {
  return (
    <svg className="v6-logo" viewBox={`0 0 ${LOGO_VIEW.w} ${LOGO_VIEW.h}`} role="img" aria-label="Guitar Theory Lab · Studio · Ver. 6.0" data-testid="studio-logo">
      <defs>
        <linearGradient id="gtl-enamel" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#fbe6bd" /><stop offset=".55" stopColor="#ead0a0" /><stop offset="1" stopColor="#9a673d" /></linearGradient>
      </defs>
      <path d={PLATE} fill="url(#gtl-enamel)" data-part="plate" />
      <path d={STRIPE_UPPER + RUN} fill="none" stroke="#e5bd80" strokeWidth="19" strokeLinecap="round" data-part="stripe" />
      <path d={STRIPE_UPPER + RUN} fill="none" stroke="#76100d" strokeWidth="7" strokeLinecap="round" data-part="stripe" />
      <path d={STRIPE_LOWER + RUN} fill="none" stroke="#f6d9a8" strokeWidth="13" strokeLinecap="round" data-part="stripe" />
      <path d={STRIPE_LOWER + RUN} fill="none" stroke="#e53b13" strokeWidth="7" strokeLinecap="round" data-part="stripe" />
      <path d={WORDMARK} fill="#750b09" fillRule="evenodd" data-part="wordmark" />
      <text x="185" y="54" fill="#26150d" fontFamily="Arial Narrow,Arial,sans-serif" fontWeight="900" fontSize="12" letterSpacing=".5" data-part="edition">STUDIO · VER. 6.0</text>
    </svg>
  );
}
