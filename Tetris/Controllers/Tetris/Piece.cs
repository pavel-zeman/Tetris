namespace Tetris.Controllers.Tetris
{
    public class Piece
    {
        public int Id { get; set; } 

        public int Rotation { get; set; }

        public Piece(int id, int rotation)
        {
            Id = id;
            Rotation = rotation;
        }
    }
}