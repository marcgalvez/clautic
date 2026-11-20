import type { Lesson } from '@/lib/training/lessonTypes';

export const LESSONS: Lesson[] = [
  {
    id: 'loose-pieces',
    order: 1,
    title: 'Peces indefenses: escacs, captures i amenaces',
    principle: 'Abans de cada jugada revisa escacs, captures i amenaces, de les dues bandes.',
    conceptIds: ['peces-indefenses', 'revisio-captures', 'revisio-escacs'],
    themes: ['hanging-piece', 'fork', 'double-attack'],
    understand: {
      intro: [
        "La majoria de partides entre aficionats es decideixen per una peça que es queda sense defensa. No cal cap combinació brillant: n'hi ha prou de veure-la.",
        'Els entrenadors recomanen una rutina fixa abans de moure: primer els escacs, després les captures i finalment les amenaces. Si la fas sempre, deixaràs de regalar peces i començaràs a guanyar-ne.',
      ],
      observe: [
        'Quines peces rivals no tenen cap defensor?',
        'Quines captures tinc? I el rival?',
        'Què amenaça la darrera jugada del rival?',
      ],
      example: {
        fen: 'r1bqkb1r/pppp1ppp/2n5/4p3/2B1P1n1/2NP4/PPP2PPP/R1BQK1NR w KQkq - 1 5',
        caption: "Les negres acaben de jugar ...Cg4, amenaçant f2. Abans de defensar-te, mira què t'ofereix la posició.",
        question: {
          kind: 'square',
          prompt: 'Toca la peça negra que està atacada i que ningú defensa.',
          answer: ['g4'],
          predicate: 'hanging',
          correctFeedback: 'Exacte. El cavall de g4 està atacat per la dama de d1 (per la diagonal d1–g4) i cap peça negra el defensa.',
          wrongFeedback: "Aquesta no. Busca una peça negra atacada per una peça blanca i sense cap defensor. Pista: mira la diagonal de la dama.",
        },
      },
    },
    recall: [
      {
        id: 'lp-1',
        prompt: 'Quin és l\'ordre de la rutina de revisió abans de moure?',
        options: ['Captures, desenvolupament, escacs', 'Escacs, captures, amenaces', 'Amenaces, enroc, escacs', 'Només les captures'],
        correct: 1,
        explanation: 'Escacs, captures i amenaces: primer les jugades més forçades, perquè limiten les respostes del rival.',
      },
      {
        id: 'lp-2',
        prompt: 'Una peça "penjada" és…',
        options: ['Una peça que ja s\'ha capturat', 'Una peça atacada que no té defensors suficients', 'Una peça clavada al rei', 'Qualsevol peça al centre'],
        correct: 1,
        explanation: 'Està penjada quan es pot capturar sense perdre material: té més atacants que defensors, o cap defensor.',
      },
      {
        id: 'lp-3',
        prompt: 'Quan has de fer la revisió d\'amenaces?',
        options: ['Només quan el rival fa escac', 'Després de cada jugada del rival i abans de la teva', 'Només a l\'obertura', 'Quan estàs perdent'],
        correct: 1,
        explanation: 'Cada jugada rival pot crear una amenaça nova. Revisar-ho sempre evita sorpreses.',
      },
    ],
  },
  {
    id: 'double-attacks',
    order: 2,
    title: 'Forquilles i atacs dobles',
    principle: 'Una peça que ataca dues peces alhora sol guanyar material, sobretot si un dels atacs és escac.',
    conceptIds: ['forquilla-cavall', 'forquilla-peo', 'atac-doble-dama', 'enfilada'],
    themes: ['fork', 'double-attack', 'skewer'],
    understand: {
      intro: [
        'Un atac doble és una jugada que crea dues amenaces a la vegada. El rival només en pot resoldre una.',
        'Quan l\'atac doble el fa un cavall o un peó l\'anomenem forquilla. Les més fortes inclouen un escac, perquè el rival està obligat a respondre-hi primer.',
      ],
      observe: [
        'Hi ha dues peces rivals que una sola peça meva pugui atacar alhora?',
        'Les peces rivals estan alineades o a distància de salt de cavall?',
        'La casella des d\'on atacaria està defensada?',
      ],
      example: {
        fen: 'r3k2r/pp3ppp/2n1b3/1N6/8/8/PPP2PPP/R3K2R w KQkq - 0 1',
        caption: 'El cavall blanc de b5 està a un salt de dues peces molt valuoses.',
        highlights: ['b5'],
        question: {
          kind: 'square',
          prompt: 'Toca la casella des d\'on el cavall atacaria alhora el rei i la torre d\'a8.',
          answer: ['c7'],
          predicate: 'knight-fork',
          targets: ['e8', 'a8'],
          correctFeedback: 'Molt bé! Des de c7 el cavall fa escac al rei i ataca la torre d\'a8. Les negres hauran de moure el rei i perdran la torre.',
          wrongFeedback: 'Encara no. Imagina el cavall a cadascuna de les seves caselles possibles i compta què ataca des d\'allà.',
        },
      },
    },
    recall: [
      {
        id: 'da-1',
        prompt: 'Per què una forquilla amb escac és especialment forta?',
        options: [
          'Perquè el rival ha de respondre a l\'escac i no pot salvar l\'altra peça',
          'Perquè el cavall val més que la dama',
          'Perquè sempre és mat',
          'Perquè obliga a enrocar',
        ],
        correct: 0,
        explanation: 'L\'escac és una jugada forçada: el rival no té temps de protegir la segona peça.',
      },
      {
        id: 'da-2',
        prompt: 'Quina peça no pot fer mai una enfilada ni una clavada?',
        options: ['La torre', 'L\'alfil', 'El cavall', 'La dama'],
        correct: 2,
        explanation: 'Les clavades i les enfilades necessiten una línia (columna, fila o diagonal). El cavall salta i no actua en línia.',
      },
      {
        id: 'da-3',
        prompt: 'Quina condició ha de complir la casella des d\'on fas la forquilla?',
        options: ['Ha de ser al centre', 'No hi ha de poder capturar la teva peça de franc', 'Ha de ser una casella blanca', 'Ha d\'estar a la vuitena fila'],
        correct: 1,
        explanation: 'Si el rival pot capturar la peça que fa la forquilla sense perdre res, la forquilla no funciona.',
      },
    ],
  },
  {
    id: 'pins-and-discoveries',
    order: 3,
    title: 'Clavades i atacs descoberts',
    principle: 'Una peça clavada no defensa de veritat: ataca-la. I una peça que s\'aparta pot destapar un atac.',
    conceptIds: ['clavada-absoluta', 'atacar-peca-clavada', 'atac-descobert', 'escac-doble'],
    themes: ['pin', 'discovered-attack', 'skewer'],
    understand: {
      intro: [
        'Una clavada passa quan una peça no es pot moure (o no li convé) perquè deixaria al descobert una peça més valuosa que té al darrere. Si al darrere hi ha el rei, la clavada és absoluta: moure-la seria il·legal.',
        'L\'atac descobert és la idea inversa: quan una peça teva s\'aparta d\'una línia, destapa l\'atac d\'una altra peça. Si la peça que es mou també ataca alguna cosa, tens dues amenaces alhora.',
      ],
      observe: [
        'Hi ha peces rivals alineades amb el seu rei o la seva dama?',
        'Puc atacar una peça clavada amb una de menys valor?',
        'Alguna peça meva tapa una línia d\'atac d\'una altra?',
      ],
      example: {
        fen: 'r1bqkbnr/ppp2ppp/2np4/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4',
        caption: 'Obertura espanyola: les negres han jugat ...d6 i l\'alfil de b5 ha quedat apuntant cap al rei.',
        highlights: ['b5'],
        question: {
          kind: 'square',
          prompt: 'Toca la peça negra que està clavada.',
          answer: ['c6'],
          predicate: 'pinned',
          correctFeedback: 'Correcte. El cavall de c6 no es pot moure: deixaria el rei de e8 en escac de l\'alfil de b5.',
          wrongFeedback: 'No és aquesta. Segueix la diagonal de l\'alfil de b5 fins al rei negre: quina peça hi ha entremig?',
        },
      },
    },
    recall: [
      {
        id: 'pd-1',
        prompt: 'Què és una clavada absoluta?',
        options: [
          'Quan la peça clavada té el rei al darrere i moure-la és il·legal',
          'Quan una peça està atacada dues vegades',
          'Quan una torre és a la setena fila',
          'Quan els dos reis estan enfrontats',
        ],
        correct: 0,
        explanation: 'Si al darrere hi ha el rei, moure la peça clavada deixaria el rei en escac, i això no està permès.',
      },
      {
        id: 'pd-2',
        prompt: 'Quina és la millor manera d\'aprofitar una peça clavada?',
        options: ['Canviar-la de seguida', 'Atacar-la, preferiblement amb una peça de menys valor', 'Ignorar-la', 'Clavar-la una altra vegada amb la dama'],
        correct: 1,
        explanation: 'La peça clavada no pot fugir. Si l\'ataques amb un peó o una peça menor, sovint la guanyes.',
      },
      {
        id: 'pd-3',
        prompt: 'Per què l\'escac doble és tan poderós?',
        options: [
          'Perquè l\'única defensa és moure el rei',
          'Perquè sempre guanya la dama',
          'Perquè permet enrocar dues vegades',
          'Perquè obliga a canviar dames',
        ],
        correct: 0,
        explanation: 'No es pot tapar ni capturar dues peces alhora: el rei ha de moure\'s.',
      },
    ],
  },
  {
    id: 'king-attack',
    order: 4,
    title: 'Patrons de mat',
    principle: 'Un rei sense caselles de fugida és vulnerable: busca les caselles que ningú defensa al seu voltant.',
    conceptIds: ['mat-fila-darrere', 'mat-dama-alfil', 'mat-ofegat', 'mat-anastasia', 'punt-feble-f7'],
    themes: ['back-rank', 'mate', 'smothered-mate', 'combination'],
    understand: {
      intro: [
        'Els mats no apareixen per casualitat: es repeteixen uns quants patrons. Si els reconeixes, els veuràs a les teves partides.',
        'El més freqüent és el mat a la fila del darrere: el rei enrocat queda tancat pels seus propis peons i una torre o la dama arriba a l\'última fila. Per evitar-lo, sovint cal fer "aire" al rei amb una jugada de peó (h3, g3...).',
      ],
      observe: [
        'Quantes caselles de fugida té el rei rival?',
        'Qui defensa l\'última fila del rival?',
        'Puc obligar el defensor a abandonar la seva tasca?',
      ],
      example: {
        fen: '6k1/5ppp/8/8/8/8/r4PPP/3R2K1 w - - 0 1',
        caption: 'La torre negra és molt activa a la segona fila, però ha abandonat la defensa del seu rei.',
        highlights: ['f7', 'g7', 'h7'],
        question: {
          kind: 'move',
          prompt: 'Mou una peça per fer escac i mat.',
          answer: ['d1d8'],
          predicate: 'mate',
          correctFeedback: 'Mat! Td8: el rei està tancat pels seus propis peons i ningú defensa la vuitena fila.',
          wrongFeedback: 'Aquesta jugada no fa mat. Quina línia deixa el rei negre sense defensa?',
        },
      },
    },
    recall: [
      {
        id: 'ka-1',
        prompt: 'Quin és el motiu principal del mat a la fila del darrere?',
        options: [
          'El rei està tancat pels seus propis peons i ningú defensa l\'última fila',
          'El rei ha sortit al centre',
          'Hi ha alfils de diferent color',
          'El rival no ha enrocat',
        ],
        correct: 0,
        explanation: 'Els peons que protegeixen el rei també li treuen les caselles de fugida.',
      },
      {
        id: 'ka-2',
        prompt: 'Quina jugada preventiva sol evitar el mat a la fila del darrere?',
        options: ['Avançar un peó davant del rei per fer "aire"', 'Moure la dama al flanc de dama', 'Canviar els alfils', 'Avançar el peó de la columna a'],
        correct: 0,
        explanation: 'Una jugada com h3 dona al rei una casella de fugida i neutralitza el patró.',
      },
      {
        id: 'ka-3',
        prompt: 'En el mat de la coça, quina peça fa el mat?',
        options: ['La dama', 'La torre', 'El cavall', 'El peó'],
        correct: 2,
        explanation: 'El cavall pot fer escac per sobre de les peces que envolten el rei, que queda "ofegat" per les seves pròpies peces.',
      },
    ],
  },
];

export function getLesson(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.id === id);
}
