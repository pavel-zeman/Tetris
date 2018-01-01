
/**
 * Represents a single shaft.
 */
class Shaft {
    private width: number;
    private height: number;

    /** Shaft content. 0 means empty square, everything else is an occupied square - in this case, the number - 1 is the piece ID. */
    private content: number[][];

    /** Canvas of the shaft */
    private canvasContext: CanvasRenderingContext2D;
    /** Canvas of the area to show the following pieces */
    private nextCanvasContext: CanvasRenderingContext2D;

    /** The piece, that is currently falling down through the shaft */
    private currentPiece: PieceInstance;

    /** Times before garbage is added */
    private pendingTimes: number[];
    /** HTML element of the area to draw pending times */
    private pendingRemovesElement: HTMLElement;

    /** User name associated with the shaft */
    private userName: string;

    public constructor(height: number, width: number, canvasContext: CanvasRenderingContext2D, nextCanvasContext: CanvasRenderingContext2D, pendingRemovesElement: HTMLElement) {
        this.height = height;
        this.width = width;
        this.canvasContext = canvasContext;
        this.nextCanvasContext = nextCanvasContext;
        this.pendingRemovesElement = pendingRemovesElement;
    }


    public reset(): void {
        this.content = [];
        this.pendingTimes = [];
        for (let i = 0; i < this.height; i++) {
            this.content[i] = [];
            for (let j = 0; j < this.width; j++) this.content[i].push(0);
        }
        this.redraw();
    }

    /**
     * Checks, if the given square is empty.
     */
    private isEmpty(y: number, x: number): boolean {
        return x >= 0 && x < this.width && (y < 0 || y < this.height && !this.content[y][x]);
    }

    /**
     * Checks, if the given piece can be moved to given coordinates.
     */
    private canMove(piece: PieceInstance, y: number, x: number): boolean {
        let grid: boolean[][] = piece.getGrid();
        for (let i = 0; i < grid.length; i++) {
            for (let j = 0; j < grid[i].length; j++) {
                if (grid[i][j] && !this.isEmpty(y + i, x + j)) return false;
            }
        }
        return true;
    }

    /**
     * Moves current piece by the given offset. Returns false, if the move is not possible.
     */
    public move(y: number, x: number): boolean {
        let canMove: boolean = this.canMove(this.currentPiece, this.currentPiece.getY() + y, this.currentPiece.getX() + x);
        if (canMove) {
            this.currentPiece.clear(this.canvasContext);
            this.currentPiece.move(y, x);
            this.currentPiece.draw(this.canvasContext);
        }
        return canMove;
    }

    /**
     * Rotates current piece by a single rotation. Returns false, if the rotation is not possible.
     */
    public rotate(): boolean {
        let clone: PieceInstance = this.currentPiece.clone();
        clone.rotate(1);
        let canMove: boolean = this.canMove(clone, this.currentPiece.getY(), this.currentPiece.getX());
        if (canMove) {
            this.currentPiece.clear(this.canvasContext);
            this.currentPiece.rotate(1);
            this.currentPiece.draw(this.canvasContext);
        }
        return canMove;
    }

    /**
     * After the piece falls down, adds it to the content.
     * Returns the number of cleared rows.
     */
    public finishPiece(): number {
        let grid: boolean[][] = this.currentPiece.getGrid();
        for (let i = 0; i < grid.length; i++) {
            for (let j = 0; j < grid[i].length; j++) {
                if (grid[i][j] && this.currentPiece.getY() + i >= 0) {
                    this.content[this.currentPiece.getY() + i][this.currentPiece.getX() + j] = this.currentPiece.getId() + 1;
                }
            }
        }
        this.currentPiece = null;
        return this.removeFullRows();
    }

    /**
     * Initializes a new piece. Returns false, if the initialization is not possible, i.e. the shaft is full.
     */
    public newPiece(pieceData: ServerPiece[]): boolean {
        let currentPiece = pieceData[0];
        this.currentPiece = new PieceInstance(pieces[currentPiece.id]);
        this.currentPiece.rotate(currentPiece.rotation);
        this.currentPiece.setPosition(-this.currentPiece.getHeight() + 1, (this.width >> 1) - 1);
        if (this.canMove(this.currentPiece, this.currentPiece.getY(), this.currentPiece.getX())) {
            this.currentPiece.draw(this.canvasContext);

            for (let i = 1; i < pieceData.length; i++) {
                let pieceInstance = new PieceInstance(pieces[pieceData[i].id]);
                pieceInstance.rotate(pieceData[i].rotation);
                pieceInstance.setPosition((i - 1) * 4, 0);
                pieceInstance.clearAll(this.nextCanvasContext);
                pieceInstance.draw(this.nextCanvasContext);
            }
            return true;
        } else {
            return false;
        }
    }

    /**
     * Redraws complete shaft.
     */
    private redraw(): void {
        this.canvasContext.setTransform(1, 0, 0, 1, 0, 0);
        this.canvasContext.translate(0.0, 0.0);

        for (let i = 0; i < this.height; i++) {
            for (let j = 0; j < this.width; j++) {
                this.canvasContext.clearRect(j * elementSize, i * elementSize, elementSize, elementSize);
                if (this.content[i][j]) {
                    let pieceId = this.content[i][j] - 1;
                    this.canvasContext.clearRect(j * elementSize, i * elementSize, elementSize, elementSize);
                    this.canvasContext.fillStyle = pieces[pieceId].getBorderColor();
                    this.canvasContext.fillRect(j * elementSize + 1, i * elementSize + 1, elementSize - 2, elementSize - 2);
                    this.canvasContext.fillStyle = pieces[pieceId].getColor();
                    this.canvasContext.fillRect(j * elementSize + 2, i * elementSize + 2, elementSize - 4, elementSize - 4);
                }
            }
        }
    }

    /**
     * Removes all full rows. Returns the number of removed rows.
     */
    private removeFullRows(): number {
        let rowsRemoved: number = 0;
        for (let i = this.height - 1; i >= 0; i--) {
            let isFull: boolean = true;
            for (let j = 0; j < this.width; j++) {
                if (!this.content[i][j]) {
                    isFull = false;
                }
            }
            if (isFull) {
                for (let j = i; j > 0; j--) {
                    for (let k = 0; k < this.width; k++) {
                        this.content[j][k] = this.content[j - 1][k];
                    }
                }
                i++;
                rowsRemoved++;
            }
        }
        if (rowsRemoved > 0) {
            this.redraw();
        }
        return rowsRemoved;
    }

    /**
     * Generates garbage.
     * @param rows one string for each row of garbage, which contains 0-1 string with a single character for each square
     */
    public generateGarbage(rows: string[]): void {
        let count = rows.length;
        for (let i = 0; i < this.height - count; i++) {
            for (let j = 0; j < this.width; j++) {
                this.content[i][j] = this.content[i + count][j];
            }
        }
        for (let i = this.height - count; i < this.height; i++) {
            let row: string = rows[i - (this.height - count)];
            for (let j = 0; j < this.width; j++) {
                this.content[i][j] = Number(row.substr(j, 1));
            }
        }
        this.redraw();
    }

    public getWidth(): number {
        return this.width;
    }

    public getCurrentPiece(): PieceInstance {
        return this.currentPiece;
    }

    /**
     * Updates pending times.
     */
    public updatePendingTimes(items: number[]): void {
        let now: Date = new Date();
        this.pendingTimes = [];
        for (let item of items) {
            this.pendingTimes.push(now.getTime() + item);
        }
    }

    /**
     * Redraws the area with the list of pending times.
     */
    public updatePendingRemoves(): void {
        let lastValue: string = this.pendingRemovesElement.innerHTML;
        let newValue: string = "";
        let now: number = new Date().getTime();
        for (let pending of this.pendingTimes) {
            let diff: number = Math.floor(Math.max(pending - now, 0) / 100);
            let diffString: string = "" + diff;
            if (diffString.length < 2) diffString = "0" + diffString;
            diffString = diffString.substr(0, diffString.length - 1) + "," + diffString.substr(diffString.length - 1, 1);
            newValue += diffString + "<br>";
        }
        if (newValue != lastValue) {
            this.pendingRemovesElement.innerHTML = newValue;
        }
    }

    public setUserName(userName: string): void {
        this.userName = userName;
    }
}



