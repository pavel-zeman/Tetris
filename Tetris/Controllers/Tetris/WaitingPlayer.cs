namespace Tetris.Controllers.Tetris
{
    public class WaitingPlayer
    {
        public readonly string ConnectionId;
        public readonly string UserName;

        public WaitingPlayer(string connectionId, string userName)
        {
            ConnectionId = connectionId;
            UserName = userName;
        }
    }
}