import type { Lang } from "./strings";

// The "how to play" page, in both languages. Every line states a rule the
// engine actually enforces (packages/engine/src/reducer.ts, validate.ts,
// scoring.ts and forfeit.ts); when the code changes, this copy changes with it.

export interface RulesSection {
  title: string;
  items: string[];
}

export interface RulesContent {
  title: string;
  intro: string;
  sections: RulesSection[];
}

export const RULES: Record<Lang, RulesContent> = {
  es: {
    title: "Cómo se juega",
    intro:
      "Capi juega el dominó dominicano como se juega en la mesa. Estas son las reglas, tal cual las aplica el juego.",
    sections: [
      {
        title: "La mesa",
        items: [
          "Se juega 1v1, o 2v2 en parejas.",
          "En parejas, tu frente se sienta enfrente de ti: Norte con Sur y Este con Oeste.",
          "El turno va por la derecha: Norte, Este, Sur, Oeste.",
        ],
      },
      {
        title: "Las fichas",
        items: [
          "El juego tiene 28 fichas. Cada jugador recibe 7.",
          "En 1v1, las otras 14 fichas van al pozo.",
          "En 2v2 no hay pozo: se reparten las 28.",
        ],
      },
      {
        title: "Quién sale",
        items: [
          "En la primera ronda sale el doble más alto de la mesa. Esa ficha se pone sola.",
          "Si nadie tiene doble, sale la ficha más alta.",
          "En las demás rondas sale el que ganó la ronda anterior, con la ficha que quiera.",
          "Después de un dominó o una capicúa, sale el jugador que se quedó sin fichas.",
          "Después de un tranque, sale el que ganó el tranque: el que trancó o el jugador a su derecha.",
        ],
      },
      {
        title: "Tu turno",
        items: [
          "Juega una ficha que pegue con una de las dos puntas de la mesa.",
          "Si tienes una ficha que pega, tienes que jugarla. No se puede pasar con jugada.",
          "Si no tienes jugada, en 1v1 jalas del pozo hasta que te salga una. Solo pasas cuando el pozo está vacío.",
          "En 2v2 no se jala: si no puedes jugar, pasas.",
        ],
      },
      {
        title: "Dominó",
        items: [
          "El primero que se queda sin fichas gana la ronda.",
          "Su lado se lleva todas las pintas que quedan en las manos. En parejas, eso incluye la mano de su frente.",
        ],
      },
      {
        title: "Capicúa",
        items: [
          "Si tu última ficha pega por las dos puntas de la mesa, es capicúa: +25 puntos extra.",
          "Ejemplo: las puntas son 3 y 5, y te quedas sin fichas con el 3-5.",
          "Con las dos puntas iguales también vale: las puntas son 5 y 5, y sales con el 5-6.",
          "Un doble nunca es capicúa.",
          "La capicúa es solo en un dominó, nunca en un tranque.",
        ],
      },
      {
        title: "Tranque",
        items: [
          "La mesa se tranca cuando pones una ficha y ya ninguna ficha pega en las puntas, ni en las manos ni en el pozo.",
          "La ronda se acaba ahí mismo: trancao. No se espera a que todos pasen.",
          "El que puso esa ficha trancó. Cuenta sus pintas contra las del jugador a su derecha.",
          "Solo cuentan las manos de ellos dos, no la de su frente.",
          "Gana el que tenga menos pintas. Su lado se lleva todas las pintas que quedan en las manos.",
          "Si empatan, gana el lado que salió en esa ronda.",
          "Si trancas con tu última ficha, es dominó, no tranque.",
        ],
      },
      {
        title: "Veinticinco (pase corrido)",
        items: [
          "Solo en 2v2.",
          "Si después de tu ficha pasan los otros tres, tu lado gana +25 al momento y te toca jugar otra vez.",
          "La ronda sigue, y tú siempre tienes jugada.",
          "Puede pasar más de una vez en la misma ronda.",
          "Si esos 25 llevan a tu lado a la meta o más, no cuentan.",
        ],
      },
      {
        title: "La partida",
        items: [
          "La partida es a 100 puntos. Si creas la mesa en la app o en playcapi.com, puedes ponerla a 200.",
          "Los puntos se acumulan de ronda en ronda.",
          "La partida solo se gana ganando una ronda: gana el lado que gana la ronda y con eso llega a la meta.",
          "Un pase corrido nunca da la partida.",
          "Si el jugador de turno lleva 2 minutos sin jugar, el otro lado puede reclamar la partida y la gana.",
          "Las partidas que empiezan en iMessage van por turnos y no se pueden reclamar.",
        ],
      },
      {
        title: "Chat",
        items: [
          "El chat solo tiene frases rápidas y reacciones. No se escribe nada.",
        ],
      },
    ],
  },
  en: {
    title: "How to play",
    intro:
      "Capi plays Dominican dominoes the way the table plays it. These are the rules, exactly as the game applies them.",
    sections: [
      {
        title: "The table",
        items: [
          "Play 1v1, or 2v2 in pairs.",
          "In pairs, your partner sits across from you: North with South, East with West.",
          "Turns go around the table to the right: North, East, South, West.",
        ],
      },
      {
        title: "The tiles",
        items: [
          "The set has 28 tiles. Each player gets 7.",
          "In 1v1, the other 14 tiles form the boneyard.",
          "In 2v2 there is no boneyard: all 28 tiles are dealt.",
        ],
      },
      {
        title: "Who opens",
        items: [
          "In the first round, the highest double at the table opens. That tile is placed for you.",
          "If nobody has a double, the highest tile opens.",
          "In later rounds, the winner of the last round opens with any tile.",
          "After a dominó or a capicúa, that is the player who ran out of tiles.",
          "After a tranque, it is the player who won the tranque: the blocker or the player to his right.",
        ],
      },
      {
        title: "Your turn",
        items: [
          "Play a tile that fits one of the two open ends of the table.",
          "If you have a tile that fits, you must play it. You cannot pass with a play in hand.",
          "If nothing fits, in 1v1 you draw from the boneyard until something does. You can only pass when the boneyard is empty.",
          "In 2v2 there is no draw: if you cannot play, you pass.",
        ],
      },
      {
        title: "Dominó",
        items: [
          "The first player to run out of tiles wins the round.",
          "Their side scores every pip left in every hand. In pairs, that includes the partner's hand.",
        ],
      },
      {
        title: "Capicúa",
        items: [
          "If your last tile fits both open ends of the table, that is a capicúa: +25 extra points.",
          "Example: the ends are 3 and 5, and you go out with the 3-5.",
          "Two equal ends count too: the ends are 5 and 5, and you go out with the 5-6.",
          "A double never counts as capicúa.",
          "A capicúa only happens on a dominó, never on a tranque.",
        ],
      },
      {
        title: "Tranque",
        items: [
          "The table locks when you place a tile and no tile left fits either end, in any hand or in the boneyard.",
          "The round ends right there: trancao. Nobody has to pass first.",
          "The player who placed that tile is the blocker. He counts his pips against the player to his right.",
          "Only those two hands count, not the partner's.",
          "Fewer pips wins. That player's side takes every pip left in the hands.",
          "A tie goes to the side that opened the round.",
          "If you lock the table with your last tile, it is a dominó, not a tranque.",
        ],
      },
      {
        title: "Veinticinco (pase corrido)",
        items: [
          "2v2 only.",
          "If the other three players all pass right after your tile, your side gets +25 on the spot and you play again.",
          "The round goes on, and you always have a play.",
          "It can happen more than once in the same round.",
          "If those 25 would take your side to the target or past it, they do not count.",
        ],
      },
      {
        title: "The game",
        items: [
          "The game is played to 100 points. When you create the table in the app or at playcapi.com, you can set it to 200.",
          "Points carry over from round to round.",
          "You win the game only by winning a round: the side that wins the round and reaches the target with it wins.",
          "A pase corrido never wins the game.",
          "If the player on turn goes 2 minutes without a move, the other side can claim the game and wins it.",
          "Games started in iMessage go turn by turn and cannot be claimed.",
        ],
      },
      {
        title: "Chat",
        items: [
          "Chat is quick phrases and reactions only. Nothing is typed.",
        ],
      },
    ],
  },
};
