/**
 * Single piece instance.
 */
class PieceInstance {
    private piece: Piece;
    private grid: boolean[][];
    private x: number;
    private y: number;

    public constructor(piece: Piece) {
        this.piece = piece;
        this.grid = piece.cloneGrid();
    }

    /**
     * Rotates the piece by the specified number of rotations.
     * @param count number of rotations
     */
    public rotate(count: number): void {
        // Rotate the piece
        for (let c = 0; c < count; c++) {
            let grid2: boolean[][] = [];
            for (let i = 0; i < this.grid.length; i++) {
                grid2[i] = [];
                for (let j = 0; j < this.grid[i].length; j++) grid2[i][j] = this.grid[j][3 - i];
            }
            this.grid = grid2;
        }

        // Move the result to the top left corner
        let emptyRows: number = -1;
        let empty: boolean = true;
        while (empty) {
            emptyRows++;
            for (let i = 0; i < this.grid[emptyRows].length; i++) if (this.grid[emptyRows][i]) {
                empty = false;
                break;
            }
        }

        let emptyColumns: number = -1;
        empty = true;
        while (empty) {
            emptyColumns++;
            for (let i = 0; i < this.grid.length; i++) if (this.grid[i][emptyColumns]) {
                empty = false;
                break;
            }
        }

        let grid2 = _.cloneDeep(this.grid);
        for (let i = 0; i < this.grid.length; i++)
            for (let j = 0; j < this.grid[i].length; j++)
                this.grid[i][j] = false;
        for (let i = emptyRows; i < this.grid.length; i++)
            for (let j = emptyColumns; j < this.grid[i].length; j++)
                this.grid[i - emptyRows][j - emptyColumns] = grid2[i][j];
    }

    /**
     * Returns the height of current piece, i.e. number of non-empty rows.
     */
    public getHeight(): number {
        let result: number = 0;
        for (let i = 0; i < this.grid.length; i++) {
            for (let j = 0; j < this.grid[i].length; j++) {
                if (this.grid[i][j]) {
                    result++;
                    break;
                }
            }
        }
        return result;
    }

    /**
     * Sets current piece position.
     */
    public setPosition(y: number, x: number): void {
        this.y = y;
        this.x = x;
    }

    /**
     * Moves the piece by the specified offset.
     */
    public move(y: number, x: number) {
        this.y += y;
        this.x += x;
    }

    /**
     * Draws piece to given context.
     */
    public draw(context: CanvasRenderingContext2D): void {
        for (let i = 0; i < this.grid.length; i++) {
            for (let j = 0; j < this.grid[i].length; j++) {
                if (this.grid[i][j] && this.y + i >= 0) {
                    context.fillStyle = this.piece.getBorderColor();;
                    context.fillRect((this.x + j) * elementSize, (this.y + i) * elementSize, elementSize, elementSize);
                    context.fillStyle = this.piece.getColor();
                    context.fillRect((this.x + j) * elementSize + 1, (this.y + i) * elementSize + 1, elementSize - 2, elementSize - 2);
                }
            }
        }
    }

    /**
     * Clears all the squares occupied by current piece.
     */
    public clear(context: CanvasRenderingContext2D): void {
        for (let i = 0; i < this.grid.length; i++) {
            for (let j = 0; j < this.grid[i].length; j++) {
                if (this.grid[i][j] && this.y + i >= 0) {
                    context.clearRect((this.x + j) * elementSize, (this.y + i) * elementSize, elementSize, elementSize);
                }
            }
        }
    }

    /**
     * Clears all the squares in the grid of current piece.
     */
    public clearAll(context: CanvasRenderingContext2D): void {
        for (let i = 0; i < this.grid.length; i++) {
            for (let j = 0; j < this.grid[i].length; j++) {
                if (this.y + i >= 0) {
                    context.clearRect((this.x + j) * elementSize, (this.y + i) * elementSize, elementSize, elementSize);
                }
            }
        }
    }

    public getGrid(): boolean[][] {
        return this.grid;
    }

    public getX(): number {
        return this.x;
    }

    public getY(): number {
        return this.y;
    }

    public getId(): number {
        return this.piece.getId();
    }

    public clone(): PieceInstance {
        let result: PieceInstance = new PieceInstance(this.piece);
        result.grid = _.cloneDeep(this.grid);
        result.x = this.x;
        result.y = this.y;
        return result;
    }
}

