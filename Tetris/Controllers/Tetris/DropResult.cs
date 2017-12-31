namespace Tetris.Controllers.Tetris
{
    public class DropResult
    {
        public string[] Garbage { get; set; }
        public double[][] PendingTimes { get; set; }
        public Piece[] NewPieces { get; set; }
    }
}