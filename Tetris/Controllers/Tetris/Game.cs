using System;

namespace Tetris.Controllers.Tetris
{
    public class Game
    {
        public const int TimeToRemoveRow = 10;
        public const int ShaftWidth = 11;
        public const int ShaftHeight = 22;

        public readonly Player[] Players;

        private readonly Random random;

        public Game(string connectionId1, string userName1, string connectionId2, string userName2)
        {
            random = new Random();
            var seed = random.Next();
            Players = new []
            {
                new Player(connectionId1, userName1, new Random(seed)),
                new Player(connectionId2, userName2, new Random(seed))
            };
        }

        public Player GetPlayer(string connectionId)
        {
            return Players[0].ConnectionId == connectionId ? Players[0] : Players[1];
        }

        public Player GetOtherPlayer(string connectionId)
        {
            return Players[0].ConnectionId == connectionId ? Players[1] : Players[0];
        }

        public int Random(int maxValue)
        {
            return random.Next(maxValue);
        }
    }
}