/**
 * Single piece template.
 */
class Piece {
    private color: string;
    private borderColor: string;
    private grid: boolean[][];
    private id: number;

    public constructor(config: number[], color: string, borderColor: string, id: number) {
        this.color = color;
        this.borderColor = borderColor;
        this.id = id;
        this.grid = [];
        for (let i = 0; i < 4; i++) {
            this.grid.push([]);
            var c = i < config.length ? config[i] : 0;
            for (let j = 0; j < 4; j++) {
                this.grid[i].push((c & 1) == 1);
                c >>= 1;
            }
        }
    }

    public cloneGrid(): boolean[][] {
        return _.cloneDeep(this.grid);
    }

    public getColor(): string {
        return this.color;
    }

    public getBorderColor(): string {
        return this.borderColor;
    }

    public getId(): number {
        return this.id;
    }
}

