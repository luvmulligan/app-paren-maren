import { Player } from "./player";

export interface GameState {
    currentPlayer: Player;
    players: Player[];
    tableScore: number; // Total de puntos de la jugada Dados blancos + Multiplicador
    turnDice: number[]; // Array donde se van sumando los dados para mostrar los valores
    canParenMaren: boolean; // Habilita el botón de multiplicador si el puntaje del dado es superior a 3
    parenMarenPressed: boolean;
    multiplierScore: number; // Puntaje del dado negro
    currentTurn: number;
    lastTurn: number;
    winner?: Player;

}