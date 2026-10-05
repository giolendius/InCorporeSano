/* ============================================================================
 *  COME SI NAVIGA TRA I 4 SISTEMI
 *  ----------------------------------------------------------------------------
 *  Dentro la sezione dei sistemi lo scroll non è libero: è un carosello.
 *  Un gesto (rotella, swipe, frecce) sposta di UN solo sistema, e lo schermo
 *  resta sempre centrato su un sistema intero, mai a metà.
 *
 *  Qui sotto ci sono i numeri da cambiare per tarare la sensazione: i due marcati
 *  con la stella sono quelli che contano, gli altri sono tempi di animazione.
 * ========================================================================== */

/**
 * ⭐ RESISTENZA — quanto scroll serve per girare pagina.
 *
 * È espresso in frazioni di schermo: 0.33 = un terzo di schermo, cioè circa
 * 280px su un telefono (~3 scatti di rotella).
 *
 *   più ALTO  → la pagina fa più resistenza, è difficile cambiare per sbaglio
 *   più BASSO → si gira con un gesto breve, scorre più veloce
 */
export const SCROLL_PER_CAMBIARE_SISTEMA = 0.33

/**
 * ⭐ RESISTENZA AL DITO — quanto va trascinato il dito per girare pagina (telefoni e tablet).
 *
 * Sempre in frazioni di schermo: 0.14 = circa 120px su un telefono, una passata naturale.
 * È più bassa di quella della rotella perché il dito percorre davvero quella distanza,
 * mentre un singolo scatto di rotella vale già un centinaio di pixel.
 */
export const SWIPE_PER_CAMBIARE_SISTEMA = 0.14

/**
 * Quanto deve affacciarsi la sezione perché la pagina si allinei da sola sul primo
 * (o sull'ultimo) sistema: il "magnetismo" in ingresso e in uscita, in frazioni di schermo.
 *
 * Tenuto molto basso di proposito (0.02 ≈ 17px): così non si riesce a sostare con un
 * pezzo di sistema in vista. Alzarlo lascia affacciare una striscia prima dello scatto.
 */
export const SCROLL_PER_ENTRARE = 0.02

/**
 * ⭐ CORSA SUL RIASSUNTO — quanto si può scorrere liberamente sullo screen 2
 * prima che la pagina porti al circolatorio.
 *
 * In frazioni di schermo: 0.25 = un quarto di schermo (~220px), due giri di rotella.
 * Se su qualche schermo il contenuto del riassunto sborda, lo spazio per leggerlo
 * tutto viene aggiunto a questo valore, non sottratto.
 */
export const CORSA_RIASSUNTO = 0.25

/** Durata della transizione tra due sistemi, in secondi. Mentre scorre, i gesti sono ignorati. */
export const DURATA_CAMBIO = 0.6

/** Pausa dopo la transizione: assorbe l'inerzia di trackpad e touch, così un gesto = un sistema. */
export const PAUSA_DOPO_CAMBIO = 0.25

/** Durata dell'allineamento magnetico e delle uscite verso riassunto / CTA, in secondi.
 *  Il movimento copre circa uno schermo, quindi conviene tenerlo morbido. */
export const DURATA_ALLINEAMENTO = 0.7
