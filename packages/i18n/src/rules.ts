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
          "Después de un tranque, sale el jugador del lado ganador con menos pintas en la mano.",
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
          "Si las dos puntas de la mesa tienen números distintos y tu última ficha lleva esos dos números, es capicúa: +25 puntos extra.",
          "Ejemplo: las puntas son 3 y 5, y te quedas sin fichas con el 3-5.",
          "Si las dos puntas tienen el mismo número, no hay capicúa, aunque tu ficha pegue por los dos lados.",
          "Un doble nunca es capicúa.",
        ],
      },
      {
        title: "Tranque",
        items: [
          "Si nadie puede jugar, la mesa se tranca: trancao.",
          "En 1v1, la mesa se tranca cuando los dos jugadores pasan seguidos, con el pozo vacío.",
          "En 2v2, la mesa se tranca cuando los cuatro jugadores pasan seguidos.",
          "En 2v2, antes del tranque siempre hay pase corrido: al tercer pase, el lado que jugó último gana +25. Si ese jugador también pasa, el cuarto pase tranca la mesa.",
          "Ese +25 se queda, aunque ese lado pierda el tranque.",
          "Gana el lado con menos pintas en la mano y se lleva todas las pintas que quedan en la mesa.",
          "Si empatan, gana el lado que salió en esa ronda.",
        ],
      },
      {
        title: "Veinticinco (pase corrido)",
        items: [
          "Solo en 2v2.",
          "Si después de tu ficha pasan los otros tres, tu lado gana +25 al momento y te toca jugar otra vez.",
          "La ronda sigue. Si tú tampoco puedes jugar y pasas, la mesa se tranca.",
          "Puede pasar más de una vez en la misma ronda.",
        ],
      },
      {
        title: "La partida",
        items: [
          "La partida es a 100 puntos. Si creas la mesa en la app o en playcapi.com, puedes ponerla a 200.",
          "Los puntos se acumulan de ronda en ronda.",
          "Gana el lado que llega a la meta cuando termina una ronda.",
          "Un +25 a mitad de ronda no cierra la partida: la ronda se juega hasta el final.",
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
          "After a tranque, it is the player on the winning side with the fewest pips in hand.",
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
          "If the two open ends show different numbers and your last tile carries both of them, that is a capicúa: +25 extra points.",
          "Example: the ends are 3 and 5, and you go out with the 3-5.",
          "If both ends show the same number, there is no capicúa, even when your tile fits both ends.",
          "A double never counts as capicúa.",
        ],
      },
      {
        title: "Tranque",
        items: [
          "When nobody can play, the table is locked: trancao.",
          "In 1v1, the table locks when both players pass in a row, with the boneyard empty.",
          "In 2v2, the table locks when all four players pass in a row.",
          "In 2v2, a pase corrido always comes first: on the third pass, the side that played last gets +25. If that player passes too, the fourth pass locks the table.",
          "That +25 stays, even if that side loses the tranque.",
          "The side with fewer pips in hand wins and takes every pip left on the table.",
          "A tie goes to the side that opened the round.",
        ],
      },
      {
        title: "Veinticinco (pase corrido)",
        items: [
          "2v2 only.",
          "If the other three players all pass right after your tile, your side gets +25 on the spot and you play again.",
          "The round goes on. If you cannot play either and pass, the table locks.",
          "It can happen more than once in the same round.",
        ],
      },
      {
        title: "The game",
        items: [
          "The game is played to 100 points. When you create the table in the app or at playcapi.com, you can set it to 200.",
          "Points carry over from round to round.",
          "The side that reaches the target when a round ends wins the game.",
          "A mid-round +25 never ends the game on its own. The round is played out first.",
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
