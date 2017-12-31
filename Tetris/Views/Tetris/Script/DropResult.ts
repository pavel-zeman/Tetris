/**
 * Data structure sent, after a piece made it all the way down to the bottom of the shaft.
 */
class DropResult {

    /** Optional garbage to generate (a single string for each row of garbage */
    public garbage: string[];

    /** Updated pending times (array of 2 arrays - one array for each user) */
    public pendingTimes: number[][];

    /** New pieces - the first piece is the current one, all others are shown as the next pieces */
    public newPieces: ServerPiece[];
}

