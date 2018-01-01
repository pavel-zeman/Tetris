/** Enumeration of control keys */
enum Keys {
    Up,
    Down,
    Left,
    Right
};

/**
 * Main game controller.
 */
class Game {

    private static shaftHeight: number = 22;
    private static shaftWidth: number = 11;
    private static keysLength: number = Object.keys(Keys).length / 2;

    /** Maps key codes to keys enum */
    private static controlKeys: { [key: number]: number } = {
        37: Keys.Left,
        39: Keys.Right,
        38: Keys.Up,
        40: Keys.Down
    };

    /** Current game speed indicator, i.e. number of game ticks to drop a tetromino by a single line */
    private speed: number;

    /** Speed counter incremented for each tick. When it reaches speed, a tetromino is dropped by a single line. */
    private speedCounter: number;

    /** Array of 2 shafts (0 for left player, 1 for right player) */
    private shafts: Shaft[];

    /** Sound to play upon key press */
    private bounceAudioElement: HTMLAudioElement;
    /** Background music */
    private backgroundAudioElement: HTMLAudioElement;
    /** Sound to play, when a complete row disappears */
    private bombAudioElement: HTMLAudioElement;

    /**
     * JQuery element representing the dialog shown, when a new game is created and we are waiting for it to start.
     * We have to use JQuery here, because it is required by Bootstrap.
     */
    private waitingForStartModal: any;

    /** JQuery element representing the dialog with the list of existing games */
    private waitingPlayersModal: any;

    /** Array of states of control keys (see Keys enum). True, if the corresponding key is pressed. */
    private keyState: boolean[];
    /** This is to prevent autorepeat. For each key, if the value is true, the key must be depressed so that it can be pressed again. */
    private keyResetNeeded: boolean[];

    /** Web socket connection to server */
    private tetrisSocketHub: any;

    /** Timer instance */
    private interval: number;



    public constructor() {
        let playerArea1Element: HTMLElement = document.getElementById("playArea1");
        let playerArea2Element: HTMLElement = document.getElementById("playArea2");
        playerArea2Element.innerHTML = playerArea1Element.innerHTML;

        let audioParentElement: HTMLElement = document.getElementById("audioParent");
        this.bombAudioElement = audioParentElement.querySelector("#bomb") as HTMLAudioElement;
        this.bounceAudioElement = audioParentElement.querySelector("#bounce") as HTMLAudioElement;
        this.backgroundAudioElement = audioParentElement.querySelector("#background") as HTMLAudioElement;

        this.shafts = [];
        this.shafts.push(new Shaft(Game.shaftHeight, Game.shaftWidth, Game.getCanvasContext(playerArea1Element, "canvas"),
            Game.getCanvasContext(playerArea1Element, "nextCanvas"), playerArea1Element.querySelector("#pendingRemoves") as HTMLElement));
        this.shafts.push(new Shaft(Game.shaftHeight, Game.shaftWidth, Game.getCanvasContext(playerArea2Element, "canvas"),
            Game.getCanvasContext(playerArea2Element, "nextCanvas"), playerArea2Element.querySelector("#pendingRemoves") as HTMLElement));

        this.waitingForStartModal = $("#waitingForStartModal");
        this.waitingPlayersModal = $("#waitingPlayersModal");

        // JQuery must be used here, because Bootstrap events can't be handled using addEventListener 
        // (see https://stackoverflow.com/questions/24211185/twitter-bootstrap-why-do-modal-events-work-in-jquery-but-not-in-pure-js)
        this.waitingForStartModal.on("hidden.bs.modal", () => this.stopWaiting());
        this.waitingPlayersModal.on("hidden.bs.modal", () => this.removeJoiningPlayer());
    }


    /**
     * Returns 2D canvas context for given parent element and child identified by ID.
     * @param parent parent element
     * @param id child ID
     */
    private static getCanvasContext(parent: HTMLElement, id: string): CanvasRenderingContext2D {
        return (parent.querySelector("#" + id) as HTMLCanvasElement).getContext("2d")
    }


    /**
     * Create a new game and start waiting for an opponent.
     * @param name player name
     */
    public startWaiting(name: string): void {
        this.waitingForStartModal.modal("show");
        this.tetrisSocketHub.waitForOpponent(name);
    }

    /**
     * Try to join an existing game.
     * @param name player name
     */
    public joinExisting(name: string): void {
        this.waitingPlayersModal.modal("show");
        this.tetrisSocketHub.findOpponent(name).then((waitingPlayers: WaitingPlayer[]) => this.updateWaitingList(waitingPlayers));
    }

    /**
     * Invoked by server to indicate, that opponent droppped a single piece.
     * @param dropResult drop data
     */
    private otherDropped(dropResult: DropResult): void {
        let shaft = this.shafts[1];
        shaft.finishPiece();
        if (dropResult.garbage) {
            shaft.generateGarbage(dropResult.garbage);
        }
        for (var i = 0; i < 2; i++) {
            this.shafts[i ^ 1].updatePendingTimes(dropResult.pendingTimes[i]);
        }
        shaft.newPiece(dropResult.newPieces);
    }

    /**
     * Creates and initializes web socket for the communication with server.
     */
    public connect(): void {
        this.tetrisSocketHub = $.connection.tetrisSocketHub.server;
        let tetrisClient = $.connection.tetrisSocketHub.client;
        tetrisClient.otherMove = (offset: number) => this.shafts[1].move(0, offset);
        tetrisClient.otherRotate = () => this.shafts[1].rotate();
        tetrisClient.otherDown = () => this.shafts[1].move(1, 0);
        tetrisClient.otherDropped = (dropResult: DropResult) => this.otherDropped(dropResult);

        tetrisClient.startGame = (thisUserName: string, otherUserName: string, pieceData: ServerPiece[], otherPieceData: ServerPiece[]) =>
            this.startGame(thisUserName, otherUserName, pieceData, otherPieceData);
        tetrisClient.newPiece = (position: number, pieceData: ServerPiece[]) => this.newPiece(position, pieceData);

        tetrisClient.thisWin = (pieceData: ServerPiece[]) => this.win();
        tetrisClient.updateWaitingList = (waitingPlayers: WaitingPlayer[]) => this.updateWaitingList(waitingPlayers);

        $.connection.hub.start().done(() => { });
    }

    /**
     * Selects a single waiting player and starts a new game.
     * @param connectionId
     */
    public pickWaitingPlayer(connectionId: string): void {
        this.tetrisSocketHub.pickWaitingPlayer(connectionId).fail(() => alert("Player not waiting any more"));
    }

    /**
     * Handles a single key event.
     * @param code key code
     * @param down true for key down, false for key up
     * @returns True, if the key was handled, otherwise false.
     */
    private handleKey(code: number, down: boolean): boolean {
        let keyIndex: number = Game.controlKeys[code];
        if (typeof keyIndex === "undefined") {
            return false;
        } else {
            if (down) {
                if (!this.keyResetNeeded[keyIndex]) {
                    this.keyState[keyIndex] = true;
                }
            } else {
                this.keyResetNeeded[keyIndex] = false;
                this.keyState[keyIndex] = false;
            }
            return true;
        }
    }

    /**
     * Invoked by server to start the game.
     * @param thisUserName username of current user
     * @param otherUserName username of opponent
     * @param pieceData piece data for current user
    * @param otherPieceData piece data for opponent
     */
    private startGame(thisUserName: string, otherUserName: string, pieceData: ServerPiece[], otherPieceData: ServerPiece[]): void {
        // Connection initialized
        // Hide modals
        this.waitingForStartModal.modal("hide");
        this.waitingPlayersModal.modal("hide");

        // Play background music
        this.backgroundAudioElement.play();
        this.initKeyboard();
        this.initPieces();

        // Initialize shafts
        for (let shaft of this.shafts) {
            shaft.reset();
        }
        this.shafts[0].setUserName(thisUserName);
        this.shafts[1].setUserName(otherUserName);
        this.shafts[0].newPiece(pieceData);
        this.shafts[1].newPiece(otherPieceData);

        this.speed = 30;
        this.speedCounter = 0;

        // Start timer
        this.interval = setInterval(() => this.timerTick(), 20);
    }


    /**
     * Adds keyboard handler.
     */
    private initKeyboard(): void {
        this.keyState = [];
        this.keyResetNeeded = [];
        for (let i = 0; i < Game.keysLength; i++) {
            this.keyState.push(false);
            this.keyResetNeeded.push(false);
        }

        window.addEventListener("keydown", (e: KeyboardEvent) => {
            if (this.handleKey(e.keyCode, true)) {
                e.preventDefault();
            }
        });
        window.addEventListener("keyup", (e: KeyboardEvent) => {
            if (this.handleKey(e.keyCode, false)) {
                e.preventDefault();
            }
        });
    }

    /**
     * Initializes piece templates.
     */
    private initPieces(): void {
        pieces = [];
        pieces.push(new Piece([15],   "#00FFFF", "#008888", 0));
        pieces.push(new Piece([7, 4], "#0088FF", "#006688", 1));
        pieces.push(new Piece([7, 1], "#FF8000", "#CC7700", 2));
        pieces.push(new Piece([3, 3], "#DDAA00", "#AA7700", 3));
        pieces.push(new Piece([6, 3], "#00FF00", "#009900", 4));
        pieces.push(new Piece([7, 2], "#FF00FF", "#770077", 5));
        pieces.push(new Piece([3, 6], "#FF0000", "#990000", 6));
    }


    /**
     * Handler of a single timer tick.
     */
    private timerTick(): void {
        for (let shaft of this.shafts) {
            shaft.updatePendingRemoves();
        }
        let shaft = this.shafts[0];
        // There may be no piece, because we are waiting for a new piece from server
        if (shaft.getCurrentPiece()) {
            if (this.keyState[Keys.Left]) {
                if (shaft.move(0, -1)) {
                    this.playSound(this.bounceAudioElement);
                    this.tetrisSocketHub.move(-1);
                }
                this.keyState[Keys.Left] = false;
                this.keyResetNeeded[Keys.Left] = true;
            }
            if (this.keyState[Keys.Right]) {
                if (shaft.move(0, 1)) {
                    this.playSound(this.bounceAudioElement);
                    this.tetrisSocketHub.move(1);
                }
                this.keyState[Keys.Right] = false;
                this.keyResetNeeded[Keys.Right] = true;
            }
            if (this.keyState[Keys.Up]) {
                if (shaft.rotate()) {
                    this.playSound(this.bounceAudioElement);
                    this.tetrisSocketHub.rotate();
                }
                this.keyState[Keys.Up] = false;
                this.keyResetNeeded[Keys.Up] = true;
            }
            if (this.keyState[Keys.Down]) {
                if (shaft.move(1, 0)) {
                    this.tetrisSocketHub.down();
                } else {
                    // Set the counter to current speed, so that the piece is immediately dropped
                    this.speedCounter = this.speed;
                }
            }
        }

        // When the speed is reached, drop the piece
        if (++this.speedCounter >= this.speed) {
            this.speedCounter = 0;
            if (shaft.move(1, 0)) {
                this.tetrisSocketHub.down();
            } else {
                // We are at the bottom
                this.keyState[Keys.Down] = false;
                this.keyResetNeeded[Keys.Down] = true;
                let rowsRemoved = shaft.finishPiece();
                if (rowsRemoved > 0) {
                    this.playSound(this.bombAudioElement);
                }
                this.tetrisSocketHub.dropped(rowsRemoved).then((dropResult: DropResult) => {
                    if (dropResult.garbage) {
                        shaft.generateGarbage(dropResult.garbage);
                    }
                    for (var i = 0; i < 2; i++) {
                        this.shafts[i].updatePendingTimes(dropResult.pendingTimes[i]);
                    }
                    this.newPiece(0, dropResult.newPieces);
                });
            }
        }
    }

    /**
     * Sets new piece to a shaft.
     * @param position shaft position
     * @param pieceData piece data (first item is current piece, everything else are following pieces)
     */
    private newPiece(position: number, pieceData: ServerPiece[]): void {
        let newPieceResult = this.shafts[position].newPiece(pieceData);
        // If it is shaft of current player and it is not possible to place the piece, then the game is over
        if (position === 0 && !newPieceResult) {
            this.tetrisSocketHub.lost();
            this.openGameOver("You've lost");
        }
    }

    /**
     * Plays a sound for the given audio element.
     * @param element audio element to play
     */
    private playSound(element: HTMLAudioElement): void {
        element.currentTime = 0;
        element.play();
    }

    /**
     * Stops sound for the given audio element.
     * @param element audio element to stop
     */
    private stopSound(element: HTMLAudioElement): void {
        element.pause();
        element.currentTime = 0;
    }

    /**
     * Shows a game over dialog with given text.
     * @param text text to show
     */
    private openGameOver(text: string): void {
        clearInterval(this.interval);
        $("#gameOverModal").find("#result").html(text);
        $("#gameOverModal").modal("show");
        this.stopSound(this.backgroundAudioElement);
    }

    /**
     * Invoked by server to indicate, that current user has won.
     */
    private win(): void {
        this.openGameOver("You've won");
    }

    /**
     * Updates list of waiting players using the given list.
     * @param waitingPlayers
     */
    private updateWaitingList(waitingPlayers: WaitingPlayer[]): void {
        let list: HTMLElement = document.getElementById("waitingPlayersList");
        let listHtml: string = "";
        for (let player of waitingPlayers) {
            listHtml += `<li class="list-group-item"><a onclick="event.preventDefault(); game.pickWaitingPlayer('${player.connectionId}')" href="">${player.userName} (${player.connectionId})</a></li>`;
        }
        list.innerHTML = listHtml;
    }

    /**
     * Stops waiting for an opponent.
     */
    private stopWaiting(): void {
        this.tetrisSocketHub.stopWaiting();
    }

    /**
     * Stops searching for an opponent.
     */
    private removeJoiningPlayer(): void {
        this.tetrisSocketHub.removeJoiningPlayer();
    }
}

