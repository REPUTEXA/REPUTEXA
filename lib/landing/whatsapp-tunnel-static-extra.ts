/**
 * Transcripts statiques ES / DE / IT (fallback sans clés IA) — ton SMS natif, même logique métier que EN/FR.
 */

import type { TunnelDemoPayload, TunnelScenarioPath } from '@/types/whatsapp-tunnel-demo';

const E: TunnelDemoPayload['enginesUsed'] = [];

export const TUNNEL_STATIC_EXTRA: Record<
  'es' | 'de' | 'it',
  Record<TunnelScenarioPath, TunnelDemoPayload>
> = {
  es: {
    decline_first: {
      establishmentName: 'Bar El Mirador',
      enginesUsed: E,
      scenario: 'decline_first',
      messages: [
        {
          from: 'business',
          text: 'Hola Laura — El Mirador. Estamos afinando el servicio de mediodía: tu tortilla con pimientos y el salmorejo, ¿qué te encajó o qué mejorarías?\n\n¿Seguimos por aquí con el intercambio? Sí si te parece bien, o no si prefieres que no te escribamos — en ambos casos lo respetamos 🙏 Si sí, si luego tienes un minuto, nos ayuda mucho.',
        },
        { from: 'client', text: 'mejor no, prefiero no recibir más mensajes' },
        {
          from: 'business',
          text: 'Entendido, gracias por contestar. Damos de baja este número para esta recogida de opiniones y no te volveremos a escribir por esto. Que vaya muy bien.',
        },
      ],
    },
    happy_full: {
      establishmentName: 'Café Ribera',
      enginesUsed: E,
      scenario: 'happy_full',
      messages: [
        {
          from: 'business',
          text: 'Hola Dani, aquí Café Ribera — croissant de pistacho + cortado sobre las 10. Queremos mejorar de verdad, no molestar.\n\n¿Te va bien seguir por aquí? Sí o no — si no, paramos. Si sí, ¿dos minutos esta tarde para decirnos qué te funcionó o no?',
        },
        { from: 'client', text: 'sí claro' },
        {
          from: 'business',
          text: 'Genial. Truco de barra: si mañana queréis revivir el cruasán, 2 min a 160° en papel y vuelve a crujir sin pasarlo. ¿El cortado os iba en su punto y el dulzor del pistacho os encajó?',
        },
        {
          from: 'client',
          text: 'muy rico todo, capas crujientes y el café con cuerpo sin quemar, el chico de barra me atendió rápido',
        },
        {
          from: 'business',
          text: 'Si algún día quieres dejar unas líneas en Google, aquí va un borrador suave con tus palabras — solo si te apetece, cero presión:\n\n"Café Ribera: cruasán de pistacho fino, cortado intenso y equipo ágil en barra."\n\n¿Lo dejarías así o retocamos algo?',
        },
        { from: 'client', text: 'perfecto así' },
        {
          from: 'business',
          text: 'Perfecto. El texto a publicar es el del mensaje de arriba: mantén pulsado para copiar. El siguiente mensaje es solo el enlace (demo).',
        },
        {
          from: 'business',
          text: 'https://search.google.com/local/writereview?placeid=DEMO_PLACE_ID',
        },
        {
          from: 'business',
          text: 'Ahí se abre Google: pegas, eliges estrellas, publicas. Gracias de verdad. Sin más mensajes en este hilo y datos en caducidad ~120 días.',
        },
      ],
      googleScene: {
        reviewSnippet:
          'Café Ribera: cruasán de pistacho fino, cortado intenso y equipo ágil en barra.',
        businessReply:
          'Gracias por el detalle — nos alegra que el cruasán y el cortado hayan ido finos; seguimos cuidando el ritmo en barra.',
        replyDelayHint: 'Al día siguiente (~10 h)',
      },
    },
    happy_with_edit: {
      establishmentName: 'Barbería Norte',
      enginesUsed: E,
      scenario: 'happy_with_edit',
      messages: [
        {
          from: 'business',
          text: 'Carlos — Leña en Norte. Degradado bajo + patillas hace un rato; queremos afinar el acabado.\n\n¿Seguimos por aquí? Sí o no. Si sí, ¿un minuto para decir qué te encajó?',
        },
        { from: 'client', text: 'dale' },
        { from: 'business', text: '¿La transición en la nuca y el acabado con navaja te iban limpios?' },
        {
          from: 'client',
          text: 'muy limpio, igual el vapor de la toalla olía un poco fuerte a colonia',
        },
        {
          from: 'business',
          text: 'Si quieres un texto corto para dejar online, propuesta opcional:\n\n"Norte - degradado limpio, nuca fina, equipo atento con el detalle."\n\n¿Algún ajuste?',
        },
        { from: 'client', text: 'quita "atento con el detalle" suena anuncio' },
        {
          from: 'business',
          text: 'Vale. "Norte - degradado limpio, nuca fina, buen trato sin rodeos." ¿Mejor?',
        },
        { from: 'client', text: 'mejor sin "buen trato"' },
        {
          from: 'business',
          text: '"Norte - degradado limpio, nuca fina." Puedes seguir corrigiendo por aquí si quieres.',
        },
        { from: 'client', text: 'ahí está bien' },
        {
          from: 'business',
          text: 'Listo. Copia el texto del mensaje anterior (pulsación larga). El siguiente mensaje es solo el enlace (demo).',
        },
        {
          from: 'business',
          text: 'https://search.google.com/local/writereview?placeid=DEMO_PLACE_ID',
        },
        {
          from: 'business',
          text: 'Pegas, estrellas, publicas. Gracias por el pulido. Sin más mensajes en este flujo y datos en caducidad ~120 días.',
        },
      ],
    },
    stop_after_yes: {
      establishmentName: 'Spa Olivo',
      enginesUsed: E,
      scenario: 'stop_after_yes',
      messages: [
        {
          from: 'business',
          text: 'Buenas Elena — Spa Olivo. Tras el ritual de pies y la compresa caliente, queremos ajustar ritmo y presión con feedback real.\n\n¿Seguimos con un par de mensajes más? Sí o no. Si sí, ¿dos minutos si te cuadra?',
        },
        { from: 'client', text: 'sí vale' },
        {
          from: 'business',
          text: 'Gracias. ¿La presión en gemelos fue adecuada o demasiado intensa?',
        },
        { from: 'client', text: 'para mejor paro aquí, no quiero seguir por whatsapp' },
        {
          from: 'business',
          text: 'Por supuesto, perdona la molestia. Quedas fuera de esta campaña; no te escribiremos más por este canal. Que descanses.',
        },
      ],
    },
  },
  de: {
    decline_first: {
      establishmentName: 'Gasthaus Altmarkt',
      enginesUsed: E,
      scenario: 'decline_first',
      messages: [
        {
          from: 'business',
          text: 'Hi Lena — Altmarkt. Wir wollen den Mittagstisch schärfer abstimmen: dein Szegediner mit Semmelknödel eben — was hat gepasst, was nicht?\n\nSollen wir hier weiterschreiben? Ja oder nein — wenn nein, melden wir uns dazu nicht mehr. Wenn ja und du später 90 Sekunden hast, hilft uns das.',
        },
        { from: 'client', text: 'lieber nicht, keine weiteren sms bitte' },
        {
          from: 'business',
          text: 'Alles klar, danke fürs Zurückschreiben. Wir sperren die Nummer für diesen Flow und melden uns dazu nicht wieder. Bis bald im Laden.',
        },
      ],
    },
    happy_full: {
      establishmentName: 'Café Hafenkante',
      enginesUsed: E,
      scenario: 'happy_full',
      messages: [
        {
          from: 'business',
          text: 'Hi Tom, Hafenkante — Hafer-Cortado + Shakshuka zum Mitnehmen kurz nach 10. Wir wollen uns verbessern, nicht nerven.\n\nPasst es, hier kurz weiterzumachen? Ja oder nein — wenn nein, hören wir auf. Wenn ja, hättest du heute Abend zwei ehrliche Minuten?',
        },
        { from: 'client', text: 'klar' },
        {
          from: 'business',
          text: 'Super. War die Shakshuka sauer genug für dich und wie war die Parklage vorn?',
        },
        {
          from: 'client',
          text: 'säure ok, eier noch flüssig wie ich mag, host hat allergie still erinnert ohne drama',
        },
        {
          from: 'business',
          text: 'Falls du mal ein paar Worte online stellen willst, hier ein sanfter Entwurf — nur wenn du magst:\n\n"Frühstück Hafenkante — Shakshuka tief im Geschmack, Hafer-Cortado sitzt, Team dezent bei Allergie."\n\nPasst so?',
        },
        { from: 'client', text: 'passt' },
        {
          from: 'business',
          text: 'Passt. Der Text steht in der Nachricht darüber — zum Kopieren lange drücken. Die nächste Nachricht ist nur der Demo-Link.',
        },
        {
          from: 'business',
          text: 'https://search.google.com/local/writereview?placeid=DEMO_PLACE_ID',
        },
        {
          from: 'business',
          text: 'Dort öffnet sich Google: einfügen, Sterne wählen, veröffentlichen. Danke fürs Feedback. Keine weiteren Nachrichten von uns zu diesem Flow, Daten laufen ~120 Tage aus.',
        },
      ],
    },
    happy_with_edit: {
      establishmentName: 'Salon Schnittwerk',
      enginesUsed: E,
      scenario: 'happy_with_edit',
      messages: [
        {
          from: 'business',
          text: 'Chris — Mia bei Schnittwerk. Low Fade + Kontur vorhin; wir wollen die Feinarbeit verbessern.\n\nKurz hier weiterschreiben? Ja oder nein — wenn nein, hören wir auf. Wenn ja, hättest du eine Minute?',
        },
        { from: 'client', text: 'jp' },
        {
          from: 'business',
          text: 'Sauber durch den Nacken? Irritation nach dem Finish?',
        },
        {
          from: 'client',
          text: ' taper sitzt, aber dampftuch roch sehr stark nach parfum',
        },
        {
          from: 'business',
          text: 'Optionaler Online-Text in deinem Stil:\n\n"Schnittwerk — sauberer Low Fade, Nacken knapp, Team entspannt auf Augenhöhe."\n\nÄnderungen?',
        },
        { from: 'client', text: '"entspannt" klingt wie werbung' },
        {
          from: 'business',
          text: 'Okay. "Schnittwerk — sauberer Low Fade, Nacken knapp, ruhige Hand."\n\nBesser?',
        },
        { from: 'client', text: 'ohne ruhige hand' },
        {
          from: 'business',
          text: '"Schnittwerk — sauberer Low Fade, Nacken knapp." Du kannst weiter feilen.',
        },
        { from: 'client', text: 'passt' },
        {
          from: 'business',
          text: 'Steht. Text aus der Nachricht darüber kopieren (lange drücken). Nächste Nachricht: nur der Demo-Link.',
        },
        {
          from: 'business',
          text: 'https://search.google.com/local/writereview?placeid=DEMO_PLACE_ID',
        },
        {
          from: 'business',
          text: 'Einfügen, Sterne, fertig. Danke. Keine weiteren SMS zu diesem Programm, Daten ~120 Tage.',
        },
      ],
    },
    stop_after_yes: {
      establishmentName: 'Spa Berglicht',
      enginesUsed: E,
      scenario: 'stop_after_yes',
      messages: [
        {
          from: 'business',
          text: 'Guten Abend Sam — Berglicht. Nach dem Hot-Stone-Part: wir justieren Druck und Tempo.\n\nNoch ein paar Nachrichten hier? Ja oder nein? Wenn ja, zwei Minuten, wenn ok?',
        },
        { from: 'client', text: 'ok' },
        {
          from: 'business',
          text: 'Danke. War der Druck im Trapezbereich passend oder zu tief?',
        },
        { from: 'client', text: 'stop bitte lieber kein chat mehr' },
        {
          from: 'business',
          text: 'Verstanden, sorry für den Lärm. Du bist für diesen Flow gesperrt — keine weiteren Nachrichten. Schön, dass du warst.',
        },
      ],
    },
  },
  it: {
    decline_first: {
      establishmentName: 'Osteria del Vicolo',
      enginesUsed: E,
      scenario: 'decline_first',
      messages: [
        {
          from: 'business',
          text: 'Ciao Giulia — Osteria del Vicolo. Stiamo lavorando sul pranzo: la tua tagliatella al ragù bianco e il tiramisù, cosa ti ha convinto o meno?\n\nTi va di continuare qui? Sì se ti sta bene, o no se preferisci che ci fermiamo — in entrambi i casi rispettiamo 🙏 Se sì e più tardi hai novanta secondi, ci aiuta.',
        },
        { from: 'client', text: 'meglio di no grazie niente altri messaggi' },
        {
          from: 'business',
          text: 'Chiaro, grazie per aver risposto. Blocchiamo questo numero per questa raccolta e non ti scriveremo più per questo. A presto.',
        },
      ],
    },
    happy_full: {
      establishmentName: 'Caffè Lungo',
      enginesUsed: E,
      scenario: 'happy_full',
      messages: [
        {
          from: 'business',
          text: 'Ciao Alex, Caffè Lungo — shakerato al caffè + maritozzo poco dopo le 10. Vogliamo migliorare, non disturbare.\n\nTi va di proseguire qui? Sì o no — se no, ci fermiamo. Se sì, due minuti sinceri stasera?',
        },
        { from: 'client', text: 'sì certo' },
        {
          from: 'business',
          text: 'Se avanza un pezzo, sacchetto chiuso batte frigo diretto — la pasta resta morbida. Com\'era il maritozzo sul dolce per te e il bancone, onesti?',
        },
        {
          from: 'client',
          text: 'crema leggera, pasta morbida, barista mi ha ricordato la nocciola senza fare sketch',
        },
        {
          from: 'business',
          text: 'Se un domani vuoi lasciare due parole online, ecco una bozza leggera con le tue parole — solo se ti va:\n\n"Caffè Lungo — maritozzo morbido, shakerato equilibrato, bancone veloce e chiaro."\n\nVa bene così?',
        },
        { from: 'client', text: 'sì perfetto' },
        {
          from: 'business',
          text: 'Perfetto. Il testo da pubblicare è nel messaggio sopra: tieni premuto per copiare. Il messaggio dopo è solo il link (demo).',
        },
        {
          from: 'business',
          text: 'https://search.google.com/local/writereview?placeid=DEMO_PLACE_ID',
        },
        {
          from: 'business',
          text: 'Si apre Google: incolli, scegli le stelle, pubblichi. Grazie davvero. Niente altri messaggi qui; dati trattati fino ad eliminazione automatica intorno a 120 giorni.',
        },
      ],
    },
    happy_with_edit: {
      establishmentName: 'Barberia Cordusio',
      enginesUsed: E,
      scenario: 'happy_with_edit',
      messages: [
        {
          from: 'business',
          text: 'Luca — Sara da Cordusio. Degradé basso + contorno prima; puntiamo a limare il finish.\n\nUn minuto qui ancora? Sì o no — se no, ci fermiamo. Se sì, com\'è andata?',
        },
        { from: 'client', text: 'vai' },
        { from: 'business', text: 'Linea nuca pulita e irritazione dopo la lametta?' },
        {
          from: 'client',
          text: 'molto pulito, forse l\'asciugamano caldo profumava troppo',
        },
        {
          from: 'business',
          text: 'Se vuoi un testo online opzionale:\n\n"Cordusio — degradé netto, nuca precisa, team discreto."\n\nModifiche?',
        },
        { from: 'client', text: 'togli "team discreto" fa spot' },
        {
          from: 'business',
          text: 'Ok. "Cordusio — degradé netto, nuca precisa." Meglio?',
        },
        { from: 'client', text: 'togli anche netto su degradé' },
        {
          from: 'business',
          text: '"Cordusio — degradé basso curato, nuca precisa." Puoi ancora ritoccare.',
        },
        { from: 'client', text: 'ok così' },
        {
          from: 'business',
          text: 'Ok. Copia il testo dal messaggio precedente (pressione lunga). Il messaggio dopo è solo il link (demo).',
        },
        {
          from: 'business',
          text: 'https://search.google.com/local/writereview?placeid=DEMO_PLACE_ID',
        },
        {
          from: 'business',
          text: 'Incolla, stelle, pubblica. Grazie. Fine messaggi per questo flusso, dati in scadenza ~120 giorni.',
        },
      ],
    },
    stop_after_yes: {
      establishmentName: 'Spa Lume',
      enginesUsed: E,
      scenario: 'stop_after_yes',
      messages: [
        {
          from: 'business',
          text: 'Buonasera Marco — Spa Lume. Dopo la fascia calda alle spalle vogliamo calibrare ritmo.\n\nTi va di rispondere ancora un attimo? Sì o no? Se sì, due minuti se ti sta bene?',
        },
        { from: 'client', text: 'sì ok' },
        {
          from: 'business',
          text: 'Grazie. Pressione tra scapole adeguata o troppo forte?',
        },
        { from: 'client', text: 'fermati preferisco non continuare su whatsapp' },
        {
          from: 'business',
          text: 'Capito, scusa il disturbo. Sei fuori da questa raccolta — non ricontatteremo. Buona serata.',
        },
      ],
    },
  },
};
